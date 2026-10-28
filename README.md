# AI Agent 工程师成长计划

一个可长期使用的个人学习操作系统：12 周从「前端工程师」转向「AI Agent / 大模型应用工程师」，每天 1–2 小时，以真实项目 **KBDesk Agent · 企业知识库 AI 客服** 为主线（不需要 NAS 或群晖）。

不是课程视频的包装页，而是把计划、任务、实操步骤、代码证据、资料、笔记、周复盘和阶段验收串成一条可执行的链路。

## 功能

| 模块 | 说明 |
| --- | --- |
| 总览 | 真实任务完成率、学习时长、连续天数、逾期项、项目进度、下一步推荐 |
| 学习路线 | 7 个阶段，含目标、知识范围、前置条件、资源、任务、项目、验收标准；支持调整与新增 |
| 每日任务 | 按天分解，支持拆分、改期、状态流转、计时（按任务保存在浏览器）与学习记录 |
| 任务工作台 | 8 步实操时间线，逐步解锁，记录结果 / 报错 / 笔记，附命令、代码与验收标准 |
| 资料库 | 29 份官方或高质量免费资源，记录核验日期、阅读状态、收藏与阅读笔记 |
| 主项目 | 里程碑、任务看板、决策与问题、架构 / 部署 / 演示文档、进度统计 |
| 笔记与面试 | Markdown 笔记、标签、任务 / 阶段关联；面试题与 0–5 掌握度 |
| 复盘与验收 | 由真实任务、记录和笔记汇总周复盘；阶段验收要求任务完成且证据充分 |
| AI 助手 | DeepSeek / OpenAI 兼容接口，SSE 流式；按任务 / 阶段 / 项目 / 复盘授权上下文 |
| 设置 | 模型连接（配置只存浏览器本地）、数据统计、JSON 备份下载、计划参数 |

未配置模型 API 时，除 AI 助手外的所有功能均可正常使用。

## 技术栈

- 前端：Vue 3 + TypeScript + Vite 6，自研深色设计系统，vue-router，marked + DOMPurify + highlight.js
- 后端：Node.js 20 + Fastify 5 + TypeScript，Mongoose 8，Zod 4
- 数据库：MongoDB 7（本地内嵌或外部实例）
- 测试：Vitest（后端 API / 进度逻辑，前端工具与 Markdown 安全）
- 部署：Docker Compose + nginx，SSE 反向代理关闭缓冲

## 目录

```
.
├── server/               # Fastify API
│   ├── src/
│   │   ├── routes/       # REST 路由
│   │   ├── services/     # 进度、项目、复盘、AI 业务逻辑
│   │   ├── models/       # Mongoose 模型
│   │   ├── db/seed/      # 12 周种子内容（幂等）
│   │   └── ai/           # Provider、上下文、安全
│   ├── test/
│   └── Dockerfile
├── web/                  # Vue 3 前端
│   ├── src/views/        # 10 个页面
│   ├── src/components/   # 工作台、聊天、Markdown 等
│   ├── nginx.conf
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
└── package.json          # npm workspaces
```

## 本地启动

要求：Node.js ≥ 20、npm ≥ 10。首次使用会下载 MongoDB 7 可执行文件（约 100 MB），已安装 `mongod` 时可改用 `MONGOD_BINARY`。

```bash
npm install
npm run mongo:setup     # 下载内置 mongod 到 server/.cache（仅首次）
cp .env.example .env    # Windows: copy .env.example .env
npm run dev             # API :8787 + Web :5173
```

打开 http://localhost:5173 。

- 首次连接空数据库时，API 会自动写入 7 个阶段、55 个任务（含 2 个选修）、181 个步骤、29 份资料和项目种子内容。
- 选修任务（群晖 DSM 只读与 Docker 工具）保留在任务列表中，可随时完成，但不计入主线完成率、逾期统计、周计划与阶段解锁。
- 再次启动不会覆盖已完成进度。
- 也可以手动执行 `npm run seed`。
- 若本机 27017 端口已有 MongoDB，会直接复用。

### 环境变量

服务端配置在项目根目录 `.env`（或 `server/.env`），示例见 [.env.example](.env.example)。模型 API 配置不在 `.env`，而是在网页设置页填写（见下一节）。

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `HOST` / `PORT` | `127.0.0.1` / `8787` | API 监听地址；容器内设为 `0.0.0.0` |
| `WEB_ORIGIN` | `http://localhost:5173` | 允许跨域的前端来源 |
| `MONGODB_URI` | 空 | 留空使用内置 MongoDB；生产填写外部连接串 |
| `MONGODB_DB` | `airoad` | 数据库名 |
| `MONGO_PORT` | `27017` | 内置 MongoDB 端口 |

### AI 配置（浏览器本地）

打开「设置 → 模型连接」，填写 Base URL、模型名与 API Key 后点击「保存配置」：

- 配置保存在当前浏览器的 `localStorage`（键名 `airoad.ai.config.v1`），不写入数据库、不提交到仓库；刷新页面仍然有效。
- 发送消息时配置通过请求头临时传给本机 API，由其转发到 OpenAI 兼容接口；服务端不落库、不写日志。
- 支持 DeepSeek（默认 `https://api.deepseek.com` / `deepseek-chat`）以及任意 OpenAI 兼容接口。
- 点击「测试连接」可用当前表单值发起一次最小请求；点击「清除」会删除此浏览器中的配置。
- 密钥可被能访问此浏览器或注入脚本的人读取，请只在个人设备使用；清除站点数据会一并删除配置。
- 未配置时 AI 接口返回 503 并提示去设置，学习、任务、资料库、项目与复盘不受影响。
- 升级提示：旧版本 `.env` 中的 `AI_*` 变量已不再读取，可以删除；服务端也不再处理 `AI_PROXY`，如模型域名无法直连，请在系统或容器网络层配置代理。

## 测试与构建

```bash
npm test              # 后端 23 项 + 前端 18 项
npm run build         # server tsc + web vue-tsc & vite build
```

后端测试使用临时 MongoDB（27019 端口）并在结束后清理；测试会验证 API 行为、任务状态机、步骤解锁与回退、周复盘校验、选修任务统计、资料核验字段与 JSON 备份导出。

## Docker 部署（宝塔面板 + 域名）

前置条件：域名已解析到服务器；宝塔已安装 Nginx；宿主机 MongoDB 已允许容器访问（见第 5 步）。

### 1. 上传项目并启动容器

```bash
cd /www/wwwroot
# git clone 或上传源码压缩包，解压到 /www/wwwroot/airoad
cd airoad
cp .env.example .env
```

编辑 `.env`，把 `WEB_ORIGIN` 改成浏览器实际访问的地址（含协议，结尾不要带斜杠）：

```dotenv
WEB_ORIGIN=https://learn.example.com
```

```bash
docker compose up -d --build
docker compose ps
curl http://127.0.0.1:8080/api/health
```

返回 `"db":"connected"` 说明容器和 MongoDB 都正常。compose 只启动 `api` 与 `web`，并将 `web` 绑定在 `127.0.0.1:8080`，公网访问统一经过宝塔 Nginx。

- 首次启动检测到 `airoad` 空库会自动写入种子内容，已有数据不覆盖
- 学习数据保存在宿主机 MongoDB，不在容器卷里，升级镜像不会丢失

### 2. 在宝塔添加站点

网站 → 添加站点：

- 域名：`learn.example.com`
- PHP 版本：纯静态
- 不创建数据库、不创建 FTP

### 3. 配置反向代理

站点设置 → 反向代理 → 添加反向代理：

- 代理名称：`airoad`
- 目标 URL：`http://127.0.0.1:8080`
- 发送域名：`$host`

保存后打开该代理的「配置文件」，确认配置中包含：

```nginx
proxy_http_version 1.1;
proxy_set_header Connection "";
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_buffering off;
proxy_cache off;
proxy_read_timeout 300s;
```

`proxy_buffering off` 是 SSE 必需的：缺少时 AI 助手的流式回答会攒到最后一次性出现，长回答还可能超时。

### 4. 开启 HTTPS

站点设置 → SSL → Let's Encrypt 申请证书 → 开启「强制 HTTPS」。然后把 `.env` 改为 `WEB_ORIGIN=https://learn.example.com`，重新创建容器让环境变量生效：

```bash
docker compose up -d
```

注意 `docker compose restart` 不会重新读取 `.env`。

### 5. 防火墙

- 宝塔「安全」和云厂商安全组只放行 80 / 443
- 不要放行 8080 与 27017；compose 已将 web 限制在 `127.0.0.1`
- MongoDB 需监听 Docker 网关（如 `bindIp: 127.0.0.1,172.17.0.1`），或监听 `0.0.0.0` 并用防火墙限制来源

### 6. 更新部署

```bash
cd /www/wwwroot/airoad
git pull                # 或重新上传源码，注意不要覆盖 .env
docker compose up -d --build
```

### 常见问题

| 现象 | 原因与处理 |
| --- | --- |
| 502 Bad Gateway | 容器未启动或端口不对：`docker compose ps`、`docker compose logs api`、`curl http://127.0.0.1:8080/api/health` |
| 接口返回 `Origin not allowed` | `.env` 的 `WEB_ORIGIN` 与地址栏不一致（协议/域名/端口），改完执行 `docker compose up -d` |
| AI 回答不逐字输出 | 宝塔反代缺少 `proxy_buffering off;`，保存后重载 Nginx |
| AI 长回答中途断开 | 反代的 `proxy_read_timeout` 太短，调整为 `300s` |
| 容器连不上 MongoDB | MongoDB 只监听了 `127.0.0.1`，需加入 Docker 网关或监听 `0.0.0.0` 并限制来源 |

> 也可以在宝塔「Docker → 项目/编排」中导入 `docker-compose.yml`，但不同宝塔版本界面差异较大，命令行方式最稳定。

## AI 与安全边界

- API Key 只保存在浏览器 `localStorage`；请求时经请求头交给本机 API 转发，服务端不持久化、不写日志、不通过接口回显。
- 安全取舍：密钥不在服务端，但浏览器存储可被同源脚本读取；本项目按个人单机使用设计，不适用于多用户共用或不可信前端环境。
- AI 上下文按用户选择注入：全局 / 任务 / 阶段 / 项目 / 复盘，只读且经过字段白名单。
- 外部日志、资料内容作为不可信数据处理，不作为指令执行。
- 助手只解释、引导、分析日志和出题；**不会在没有代码、测试或验收证据时自动认定已掌握**。
- 阶段验收由服务端校验：阶段任务未全部完成时拒绝「通过」；证据不足同样拒绝。
- 主项目的安全约束：不存在无限制 Shell / root / Docker 权限；知识检索按租户与可见范围过滤；订单与工单只读；退款、改地址等写操作必须经过服务端策略与人工审批；敏感字段脱敏，审计记录保留。

## 资料核验

资料库只收录官方或高质量免费资源。每条记录包含来源类型、官方标记与核验日期（当前 29 份中 27 份在 2026-10-28 完成联网可达性核验；2 份 GitHub 仓库链接因当前环境无法访问 GitHub 而显示为「未核验」），没有虚构链接；社区资源明确标注为非官方。

## 已知限制

- 计时按任务保存在当前浏览器，刷新或切换任务不丢，但不会跨设备同步。
- AI 对话记录保存在 MongoDB，会随数据库一起备份或删除；API Key 不会进入 MongoDB。
- AI 配置只存在当前浏览器，不会跨设备或跨浏览器同步；清除站点数据后需要重新填写。
- 周复盘只自动汇总客观数据，结论字段必须自己填写才能定稿。
- 单用户本地应用，未实现登录与多租户隔离；部署到公网前请在反向代理层增加认证。
- Docker 部署文件已提供，但本机未安装 Docker，镜像构建与 compose 启动尚未实测。

## 数据重置

```bash
rm -rf server/.data        # 删除内置 MongoDB 数据（Windows: rmdir /s server\.data）
npm run dev                # 重新启动后自动写入种子
```

或使用外部 MongoDB 时删除 `airoad` 数据库。
