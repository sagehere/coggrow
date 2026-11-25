FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000 DATA_DIR=/data TZ=Asia/Shanghai
RUN install -d -o node -g node -m 0700 /data && install -o node -g node -m 0600 /dev/null /data/.keep
COPY --chown=node:node package.json server.js rules.js content.js ai.js backup.js ./
COPY --chown=node:node public/ public/
USER node
EXPOSE 3000
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=3s CMD ["node", "-e", "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node","server.js"]
