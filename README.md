# CogGrow · 认知成长

家庭试用版 v0.8.0-beta.1，主要面向 8～12 岁。一个私有家庭账号可以管理多个儿童档案，每个孩子也能用独立识别码和数字口令登录。

## 部署方式

| 使用场景 | 推荐方式 |
| --- | --- |
| 已在 VPS 使用 Dockge | 复制 `compose.yaml`，拉取 GHCR 镜像 |
| 在服务器上使用 Docker Compose 命令行 | 下载 `compose.yaml`，执行 `docker compose pull` 和 `docker compose up -d` |
| 手头没有 GHCR 包读取权限 | 从仓库克隆源码，在服务器上构建同一个应用容器 |
| 只想在电脑上试用 | 直接用 Node.js 启动 |

### 使用 Dockge 部署

前提是 Docker 主机已安装 Dockge，可以访问 `ghcr.io`。GHCR 包有独立的访问权限。拉取私有包时，请使用有包读取权限的 GitHub 账号和带 `read:packages` 权限的经典个人访问令牌。在 Docker 主机用交互方式登录，把令牌填入密码提示。Dockge 使用的 Docker 凭据配置应能读取这次登录凭据。[GitHub 容器仓库认证说明](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)

```sh
docker login ghcr.io -u YOUR_GITHUB_USERNAME
```

1. 在 Dockge 新建名为 `coggrow` 的 Stack，将仓库中的 [`compose.yaml`](compose.yaml) 原样粘贴到 Compose 编辑区。默认镜像为 `ghcr.io/sagehere/coggrow:latest`。
2. 在 Stack 的 `.env` 中设置下面的变量。将示例口令替换为随机生成的值，可以在服务器上运行 `openssl rand -hex 24` 生成。
3. 启动 Stack。例子中宿主机地址为 `192.168.1.50`，浏览器访问 `http://192.168.1.50:9100`。用初始化口令建立第一个家长账号，之后使用家长账号和密码登录。

```dotenv
# Stack 的 .env 示例
COGGROW_SETUP_CODE=replace-with-a-random-value
COGGROW_PORT=9100
```

如 9100 已被占用，将 `COGGROW_PORT` 改为 `9101`，再访问 `http://192.168.1.50:9101`。应用容器内部端口始终为 `3000`。SQLite 数据存放在 Compose 的 `coggrow-data` 命名卷中，更新镜像时继续使用这个卷。

### 使用 Docker Compose 命令行部署

准备好 Docker Compose v2、`curl` 和 OpenSSL，按上文登录 GHCR，然后在服务器上运行以下命令。初始化口令只在首次建号时使用，请从 `.env` 查看并妥善保存。

```sh
mkdir -p coggrow
cd coggrow
curl -fsSL https://raw.githubusercontent.com/sagehere/coggrow/main/compose.yaml -o compose.yaml

# 首次部署时创建 .env，重复运行会保留已有配置。
if [ ! -f .env ]; then
  (umask 077; printf 'COGGROW_SETUP_CODE=%s\nCOGGROW_PORT=9100\n' "$(openssl rand -hex 24)" > .env)
fi

docker compose pull
docker compose up -d --wait
docker compose ps
curl -fsS http://127.0.0.1:9100/health
```

健康检查返回 `{"status":"ok"}` 后，使用服务器地址加 `:9100` 打开初始化页面。启动失败时，使用 `docker compose logs --tail 100 coggrow` 查看日志。

### 从公开源码构建本地镜像

这个方式使用同一份 Compose 和数据卷，可用于 GHCR 私有包拉取受限的情况。克隆后在仓库根目录按上面的 `.env` 示例设置 `COGGROW_SETUP_CODE`，再构建和启动：

```sh
git clone https://github.com/sagehere/coggrow.git
cd coggrow
# 在当前目录创建 .env，并填入初始化口令。
docker build -t coggrow:local .
COGGROW_IMAGE=coggrow:local docker compose up -d --pull never
```

如果使用 Dockge 管理本地构建的镜像，可将 `COGGROW_IMAGE=coggrow:local` 写入 Stack 的 `.env`，并在同一 Docker 主机先完成构建。

### 可选的 HTTPS 反向代理

局域网可以直接使用 `IP:端口`。如果宿主机已有 Caddy 或 Nginx Proxy Manager，将外部 HTTPS 请求转发到 Compose 暴露的端口，在 Stack 的 `.env` 里设置 `COGGROW_SECURE_COOKIE=1`，然后重新部署。下面是同一台主机上的 Caddy 示例，域名请换成实际域名。

```caddyfile
coggrow.example.com {
    reverse_proxy 127.0.0.1:9100
}
```

如果代理本身运行在独立 Docker 容器，使用该代理实际可访问的宿主机地址或共享网络目标。通过 HTTPS 或 `localhost` 可安装 PWA。

### 启动本地开发版本

安装 Node.js 24.12 或更新的 24.x 版本，在源码根目录运行 `npm start`，打开 [localhost:3000](http://localhost:3000)。从本机初始化时可留空部署口令。家长账号密码至少 10 位。

应用默认监听 `0.0.0.0:3000`，使用 `Asia/Shanghai` 计算当日日期和月龄。可通过 `PORT`、`DATA_DIR` 和 `TZ` 修改。使用非本机地址初始化时，先设置 `SETUP_CODE`。直接用 Node.js 运行时，SQLite 默认保存在 `data/coggrow.db`。

## 镜像版本与升级

推送到 `main` 或推送 `v*` 标签会启动 GitHub Actions。测试通过后，工作流把 AMD64 和 ARM64 产物合为一个镜像索引，发布到 GHCR，并验证两种架构。主分支发布 `latest` 和 `main`，每次构建也有 `sha-<完整提交 SHA>` 标签。

升级前先按下文备份数据库，再运行 `docker compose pull && docker compose up -d`，或在 Dockge 中更新该 Stack。若要锁定镜像，在 `.env` 中设置 `COGGROW_IMAGE=ghcr.io/sagehere/coggrow:<已发布的标签>`，然后重新部署。

## 阅读材料与模型

默认使用内置阅读材料和程序生成的数学题。可选配置 `COGGROW_AI_BASE_URL`、`COGGROW_AI_MODEL`、`COGGROW_AI_KEY`，其中 URL 是服务的 HTTPS API 根地址，例如以 `/v1` 结尾。直接启动时对应为 `AI_BASE_URL`、`AI_MODEL`、`AI_KEY`。模型密钥留在服务端，调用仅发送年龄段、训练类型和素材主题。生成草稿通过结构检查后，需在「家长设置 → 阅读材料」检查答案、依据和年龄适宜性后批准。批准后会替换对应阅读练习组中的一题。复测使用内置材料。

## 数据备份与回滚

- 本地运行时用 `node backup.js ./coggrow-backup.db` 生成一致性 SQLite 备份。输出路径须不存在，脚本默认读取项目下的 `data/coggrow.db`。
- 容器运行时用 `docker compose exec coggrow node backup.js /data/pre-upgrade.db`，再用 `docker compose cp coggrow:/data/pre-upgrade.db ./coggrow-backup.db` 下载备份。保留备份所对应的镜像标签。
- 恢复时先停应用，在空的数据目录或新数据卷放入备份并命名为 `coggrow.db`。使用容器时确认文件可由容器中的 node 用户读写，再以对应镜像启动并核对账号及训练记录。需要回滚升级时，旧镜像应与升级前的数据库快照配套使用。

## 家庭试用范围

18 个训练与活动模块包括基础注意力、视觉搜索、空间记忆、阅读、数学读题、轨道规划、规则切换、逻辑矩阵、汉诺塔、呼吸动画和离屏活动。起点任务、训练和独立复测的记录分开显示。内置复测材料有限，尤其是阅读，多次复测可能遇到熟悉材料。训练级别与逐题记录用于家庭练习安排。阶段比对应结合家长观察和新的学习题。

策略参数属于试用配置。家庭试用、材料扩充、实际 Edge/移动设备兼容验证、真实模型联调是后续验收项。

运行 `npm test` 可验证核心规则和端到端 API 流程。

## 与 schulte-app 的关系

审查了旧项目的 `src/index.js`、`src/db.js`、`src/routes.js` 和学习训练页面。旧站的公开成绩入口、周任务模板、sql.js 持久化和学习会话 JSON 与新平台的私有认证、循环计划和逐题日志属于不同的数据结构。CogGrow 保留了舒尔特和「看原文、找条件、辨所求」的训练方式，独立使用新的数据库。项目包未包含既有家庭数据，正式迁移需提供旧数据库副本并核对字段及条数。
