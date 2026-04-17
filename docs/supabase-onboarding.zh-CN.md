# 童园 Supabase 首次接入指南

这份文档是给第一次用 Supabase 的场景准备的，目标不是让你理解一堆平台概念，而是让 `童园` 这套站点尽快跑起来。

## 你会得到什么

跑完下面这套流程后，会完成这些事：

- 创建或绑定一个 Supabase 项目。
- 写好本机的前端配置、采集器配置、Edge Functions 密钥文件。
- 把 GitHub Actions 需要的变量和 Secrets 写进当前仓库。
- 把数据库迁移和 Edge Functions 部署到 Supabase。
- 明确你还需要去后台手动补的 Auth 回跳地址。

## 开始前准备

- GitHub CLI 已登录当前仓库账号。
- 本机已安装 Node.js 22、Python、PowerShell。
- 你需要先准备一个 Supabase Access Token。

Access Token 官方入口：

- 账号 Token 说明：[Supabase Management API Reference](https://supabase.com/docs/reference/api/start)

Supabase 官方文档说明了，管理 API 和 CLI 都需要 Access Token 才能创建项目或列出组织。[来源](https://supabase.com/docs/reference/api/start)

## 最省事的做法

在仓库根目录执行：

```powershell
Set-Location D:\Code\HomeSetting\tongyuan-workbench
powershell -ExecutionPolicy Bypass -File .\scripts\setup-supabase.ps1
```

脚本会按顺序问你这些信息：

1. 是新建 Supabase 项目，还是绑定已有项目。
2. 项目所在组织、区域、数据库密码。
3. `童园` 的 owner 邮箱、允许访问邮箱、管理员邮箱。
4. 你要接的回答模型 `base_url / api_key / chat_model / embedding_model`。

默认推荐：

- 区域先用 `ap-southeast-1`
- 项目名直接用 `tongyuan-workbench`
- 同步密钥直接让脚本自动生成

## 脚本会自动做什么

### 1. 写本地配置

会生成或覆盖这 3 个文件，并自动备份旧文件：

- `apps/web/.env.local`
- `collector/.env`
- `supabase/.env`

### 2. 写 GitHub 仓库变量

如果当前机器已经登录 `gh`，脚本会自动写入：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_FUNCTIONS_URL`

以及这 3 个 GitHub Secrets：

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`
- `SUPABASE_PROJECT_REF`

### 3. 部署 Supabase

脚本会继续执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-supabase.ps1 -ProjectRef <ref> -DbPassword <password>
```

里面会完成：

- `supabase link`
- `supabase db push`
- `supabase secrets set --env-file supabase/.env`
- `supabase functions deploy --use-api`

Supabase 官方文档确认可以直接用 `.env` 文件批量写入 Edge Function secrets。[来源](https://supabase.com/docs/guides/functions/secrets)

## 你还需要手动补的后台设置

脚本做不到的地方，主要只剩 Auth 回跳地址。

去 Supabase 后台：

`Authentication -> URL Configuration`

至少配置这两个地址：

- 生产地址：`https://StayGoldTY.github.io/tongyuan-workbench/`
- 本地开发地址：`http://localhost:5173/tongyuan-workbench/`

Supabase 官方文档要求：Magic Link 或其他登录跳转使用的 `redirectTo`，必须出现在允许列表中；`Site URL` 也会作为默认回跳地址。[来源](https://supabase.com/docs/guides/auth/redirect-urls)

## API Key 去哪里看

如果脚本没能通过 CLI 自动拿到 key，你可以在 Supabase 项目的 Connect 对话框，或者 `Settings -> API Keys` 页面复制。

前端用：

- `publishable key` 或兼容的 `anon key`

后端和 Edge Functions 用：

- `service_role` 或 `secret key`

Supabase 官方对这两类 key 的定位写得很清楚：前端只能放低权限 key，`service_role / secret key` 只能留在后端，不能暴露到浏览器。[来源](https://supabase.com/docs/guides/api/api-keys)

## 跑完后的检查顺序

1. 打开 GitHub Pages 页面，确认登录页能正常加载。
2. 用工作邮箱发一次 Magic Link。
3. 在 Supabase 后台确认 Auth 用户已创建。
4. 执行采集器同步：

```powershell
python -m pip install -e ./collector
$env:PYTHONPATH = "D:\Code\HomeSetting\tongyuan-workbench\collector\src"
python -m tongyuan_collector.cli --json sync
```

5. 回到页面，确认“同步状态”里已经出现真实来源。
6. 问一个业务问题，确认回答是中文、带引用、而且不是纯代码术语。

## 如果你想分步执行

只写配置，不立刻部署：

```powershell
Set-Location D:\Code\HomeSetting\tongyuan-workbench
powershell -ExecutionPolicy Bypass -File .\scripts\setup-supabase.ps1 -SkipDeploy
```

只跳过 GitHub Actions 变量写入：

```powershell
Set-Location D:\Code\HomeSetting\tongyuan-workbench
powershell -ExecutionPolicy Bypass -File .\scripts\setup-supabase.ps1 -SkipGitHub
```

后面单独部署：

```powershell
Set-Location D:\Code\HomeSetting\tongyuan-workbench
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-supabase.ps1 -ProjectRef <ref> -DbPassword <password>
```
