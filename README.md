# CogGrow · 认知成长

家庭试用版 v0.8.0-beta.1，主要面向 8～12 岁。一个私有家庭账号可以管理多个儿童档案，每个孩子也能用独立识别码和数字口令登录。

## 直接运行

安装 Node.js 24.12 或更新的 24.x 版本，在项目根目录执行：

```sh
npm start
```

用本机浏览器打开 http://localhost:3000 完成首次建档。本机初始化可以留空部署口令。家长账号密码至少 10 位。建档后可按当日练习顺序开始，进入「家长设置」可更改目标、训练时长和休息日，进入「成长记录」可查看逐题统计并导出。

应用默认监听 `0.0.0.0:3000`，使用 `Asia/Shanghai` 计算当日日期和月龄。可通过环境变量 `PORT`、`DATA_DIR` 和 `TZ` 修改。使用非本机地址完成首次初始化时，启动前设置仅家长知道的 `SETUP_CODE`。SQLite 存储于 `DATA_DIR/coggrow.db`，默认目录为项目下的 `data`。

## Dockge 单容器部署

1. 在 Dockge 新建 Stack，粘贴仓库中的 `compose.yaml`。
2. 默认镜像为 `ghcr.io/sagehere/coggrow:latest`。私有包需先在 Docker 主机以拥有包读取权限的 GitHub 帐户登录 GHCR。使用 GitHub 生成的经典个人访问令牌，选择 `read:packages`，用交互提示输入令牌：`docker login ghcr.io -u sagehere`。若 Dockge 以独立身份执行 Compose，在该身份可访问的 Docker 凭据配置中完成登录。
3. 在 Stack 的 `.env` 设置随机生成的 `COGGROW_SETUP_CODE`。端口冲突时设置 `COGGROW_PORT=9101`，默认端口为 9100。
4. 启动 Stack 后访问 `http://服务器IP:9100`，填入初始化口令并建立家庭账号。日常使用家长密码或儿童口令登录。
5. 如使用已有的 Caddy 或 Nginx Proxy Manager，将 HTTPS 请求转发到宿主机端口，并设置 `COGGROW_SECURE_COOKIE=1`。HTTP 直连适用于局域网。HTTPS 或 localhost 支持安装 PWA。打开的作答页面遇到断网时可暂存当前答案，在同一标签页恢复连接后重试。

推送到 `main` 或推送 `v*` 标签会启动 GitHub Actions。测试通过后，工作流把 AMD64 和 ARM64 产物合为一个镜像索引并发布到 GHCR，再验证两种架构。主分支更新 `latest` 和 `main`，每次发布也带完整提交 SHA 标签。版本标签单独发布，可以设置 `COGGROW_IMAGE` 固定到某次发布。自建镜像时，在仓库根目录运行 `docker build -t coggrow:local .`，再设置 `COGGROW_IMAGE=coggrow:local`。

## 阅读材料与模型

默认使用内置阅读材料和程序生成的数学题。可选配置 `COGGROW_AI_BASE_URL`、`COGGROW_AI_MODEL`、`COGGROW_AI_KEY`，其中 URL 是服务的 HTTPS API 根地址，例如以 `/v1` 结尾。直接启动时对应为 `AI_BASE_URL`、`AI_MODEL`、`AI_KEY`。模型密钥留在服务端，调用仅发送年龄段、训练类型和素材主题。生成草稿通过结构检查后，需在「家长设置 → 阅读材料」检查答案、依据和年龄适宜性后批准。批准后会替换对应阅读练习组中的一题。复测使用内置材料。

## 数据备份与回滚

- 本地运行时用 `node backup.js ./coggrow-backup.db` 生成一致性 SQLite 备份。输出路径须不存在，脚本默认读取项目下的 `data/coggrow.db`。
- 容器运行时用 `docker compose exec coggrow node backup.js /data/pre-upgrade.db`，再用 `docker compose cp coggrow:/data/pre-upgrade.db ./coggrow-backup.db` 下载备份。保留备份所对应的镜像标签。
- 恢复时先停应用，在空的数据目录或新数据卷放入备份并命名为 `coggrow.db`。使用容器时确认文件可由容器中的 node 用户读写，再以对应镜像启动并核对账号及训练记录。需要回滚升级时，旧镜像应与升级前的数据库快照配套使用。

## 家庭试用范围

18 个训练与活动模块包括基础注意力、视觉搜索、空间记忆、阅读、数学读题、轨道规划、规则切换、逻辑矩阵、汉诺塔、呼吸动画和离屏活动。起点任务、训练和独立复测的记录分开显示。内置复测材料有限，尤其是阅读，多次复测可能遇到熟悉材料。训练级别与逐题记录用于家庭练习安排。阶段比对应结合家长观察和新的学习题。

策略参数属于试用配置。家庭试用、材料扩充、实际 Edge/移动设备兼容验证、真实模型联调和容器架构正式发布是后续验收项。

运行 `npm test` 可验证核心规则和端到端 API 流程。

## 与 schulte-app 的关系

审查了旧项目的 `src/index.js`、`src/db.js`、`src/routes.js` 和学习训练页面。旧站的公开成绩入口、周任务模板、sql.js 持久化和学习会话 JSON 与新平台的私有认证、循环计划和逐题日志属于不同的数据结构。CogGrow 保留了舒尔特和「看原文、找条件、辨所求」的训练方式，独立使用新的数据库。项目包未包含既有家庭数据，正式迁移需提供旧数据库副本并核对字段及条数。
