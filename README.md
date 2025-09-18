# Snake Web Game

基于 TypeScript + Canvas 构建的 PC 端贪吃蛇网页小游戏，提供排行榜能力并可部署到阿里云 ECS 上。项目分为前端 (Vite) 与后端 (Express + SQLite) 两部分。

## 目录结构

- `frontend/`：贪吃蛇 Canvas 游戏及排行榜界面
- `backend/`：Express 排行榜 API 与 SQLite 数据库
- `data/`：默认 SQLite 数据库存放目录（运行时创建）

## 开发环境准备

1. 安装依赖
   ```bash
   cd frontend && npm install
   cd ../backend && npm install
   ```
2. 启动后端
   ```bash
   npm run dev
   ```
   默认监听 `http://localhost:3000`
3. 启动前端
   ```bash
   npm run dev
   ```
   Vite 会通过代理将 `/api` 请求转发至后端

> 首次启动后端会自动创建 `data/leaderboard.sqlite` 数据库文件。

## 构建与部署

### 前端构建
```bash
cd frontend
npm run build
```
产物位于 `frontend/dist`，可直接放入 Nginx 静态目录。

### 后端构建
```bash
cd backend
npm run build
```
编译输出至 `backend/dist`。使用 `npm run start` 运行编译后的服务。

### Nginx 参考配置
将静态资源与 API 部署在同一域名下：
```nginx
server {
    listen 80;
    server_name snake.example.com;

    root /var/www/snake;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```
> 若开启 HTTPS，请补充证书配置，并监听 443 端口。

### PM2 启动脚本
项目提供 `backend/ecosystem.config.cjs`，可通过以下命令管理进程：
```bash
cd backend
pm2 start ecosystem.config.cjs
```

### CI/CD 建议
- GitHub Actions 构建前端产物并上传至 OSS 或直接同步到 ECS
- 后端编译后通过 SCP/RSYNC 发布到服务器，再使用 PM2 reload
- 部署完成后执行 `/health` 健康检查

## 环境变量
后端支持下列环境变量：

| 名称 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | 3000 | 监听端口 |
| `HOST` | 0.0.0.0 | 监听地址 |
| `SQLITE_PATH` | data/leaderboard.sqlite | 数据库文件路径 |
| `LEADERBOARD_LIMIT` | 20 | 排行榜返回条数 |
| `RATE_LIMIT_WINDOW` | 60000 | 提交接口限流时间窗口 (ms) |
| `RATE_LIMIT_MAX` | 8 | 每窗口允许的请求次数 |

可在 `backend/.env` 中覆盖上述配置。

## 测试策略 (建议)
- 前端使用 [Vitest](https://vitest.dev/) 对核心逻辑进行单测
- 使用 [Playwright](https://playwright.dev/) 编写端到端脚本验证控制 & 排行榜提交流程
- 后端可使用 [Supertest](https://github.com/visionmedia/supertest) 编写 API 单测

## 部署清单
- 阿里云 ECS Ubuntu 22.04 LTS
- Node.js 18+
- Nginx + PM2
- Fail2ban / 防火墙策略 (22, 80/443)
- CloudMonitor 告警 (CPU、内存、带宽)

## 运行截图
后续可在 `docs/` 目录添加静态截图，方便验收与推广。
