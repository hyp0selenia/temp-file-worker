# CF Temp Share · Cloudflare 临时文件分享

基于 **Cloudflare Workers + R2 + KV** 的轻量临时文件分享服务。

- 前台 `/`：单文件上传，限制 **100MB / 最多 7 天 / 最多 100 次下载**
- 后台 `/admin`：密码登录后无有效期与次数限制（仍受 CF Free 请求体 100MB 限制）
- 文件存 R2，元数据存 KV，定时清理过期文件
- 纯前端 + 单 Worker，无构建步骤，适合直接绑定 GitHub 仓库部署

## 功能

| 功能 | 公开上传 | 管理上传 |
|------|----------|----------|
| 单文件大小 | ≤ 100 MB | ≤ 100 MB（CF Free 限制） |
| 有效期 | 1–7 天 | 任意天数，0 = 永不过期 |
| 下载次数 | 1–100 次 | 任意次数，0 = 无限 |
| 自动过期清理 | ✓ | ✓ |
| 下载后计数 + 用尽删除 | ✓ | ✓ |

## 快速部署

### 1. 准备 Cloudflare 资源

```bash
# 登录
npx wrangler login

# 创建 R2 桶
npx wrangler r2 bucket create temp-share

# 创建 KV 命名空间
npx wrangler kv namespace create META
# 记下输出的 id，填入 wrangler.toml
```

### 2. 配置 `wrangler.toml`

```toml
name = "cf-temp-share"
main = "src/worker.js"
compatibility_date = "2024-09-23"

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "temp-share"

[[kv_namespaces]]
binding = "META"
id = "你的_KV_NAMESPACE_ID"   # ← 替换

[triggers]
crons = ["0 * * * *"]         # 每小时清理过期

[vars]
MAX_FILE_SIZE = "104857600"
PUBLIC_MAX_DAYS = "7"
PUBLIC_MAX_DOWNLOADS = "100"
```

### 3. 设置管理员密码（Dashboard）

1. 部署 Worker 后，打开 Cloudflare Dashboard
2. 进入 **Workers & Pages** → 你的 Worker → **Settings** → **Variables and Secrets**
3. 点击 **Add** → 选择 **Secret**
4. 变量名填：`ADMIN_PASSWORD`，值填你的密码 → 保存

> 本地开发可在 `.dev.vars` 里写：`ADMIN_PASSWORD=你的密码`

### 4. 部署

```bash
npx wrangler deploy
```

部署成功后访问：

- 前台：`https://cf-temp-share.<你的子域>.workers.dev/`
- 管理：`https://cf-temp-share.<你的子域>.workers.dev/admin`

### 5. 绑定 GitHub 仓库（可选）

1. 把本仓库推到 GitHub
2. Cloudflare Dashboard → Workers & Pages → 创建 → Connect to Git
3. 选择仓库，构建命令留空，输出目录留空（直接用 Worker）
4. 在设置里绑定 R2、KV，并在 Variables and Secrets 中添加 Secret `ADMIN_PASSWORD`

> 若使用 Pages + Worker 绑定，请按 Cloudflare 文档把 R2/KV 绑定到对应 Worker。

## 本地开发

```bash
# 需要本地 R2/KV 模拟（可选）
npx wrangler dev
```

本地开发时也可在 `.dev.vars` 中覆盖：

```
ADMIN_PASSWORD=your-dev-password
```

## API 简述

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 公开上传页面 |
| GET | `/admin` | 管理上传页面 |
| POST | `/api/upload` | 上传文件（multipart） |
| POST | `/api/admin/login` | 管理员登录，返回 token |
| GET | `/d/:id` | 下载文件 |
| GET | `/api/info?id=` | 查询文件元信息 |

上传表单字段：

- `file`：文件
- `days`：有效天数
- `maxDownloads`：最大下载次数
- `admin=1` + `Authorization: Bearer <token>`：管理上传

## 目录结构

```
.
├── README.md
├── wrangler.toml
└── src
    └── worker.js      # 全部逻辑 + 内嵌 HTML
```

## AI
100% AI Generated
