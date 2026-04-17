# Deployment Guide

中文版首次接入说明见 [docs/supabase-onboarding.zh-CN.md](/D:/Code/HomeSetting/tongyuan-workbench/docs/supabase-onboarding.zh-CN.md)。

## 1. Supabase project

Create a Supabase project and keep these values ready:

- project ref
- database password
- project URL
- anon or publishable key
- service role key

Apply the SQL in [supabase/migrations/20260417_000001_create_tongyuan_schema.sql](/D:/Code/HomeSetting/tongyuan-workbench/supabase/migrations/20260417_000001_create_tongyuan_schema.sql) with `npx --yes supabase db push` or the SQL editor.

For local deployment, prefer:

```powershell
Set-Location D:\Code\HomeSetting\tongyuan-workbench
powershell -ExecutionPolicy Bypass -File .\scripts\setup-supabase.ps1
```

The setup script writes `apps/web/.env.local`, `collector/.env`, and `supabase/.env`, and can also sync GitHub Actions variables plus deploy Supabase from the same flow.

Set these Edge Function secrets in Supabase:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_API_KEY`
- `CHAT_MODEL`
- `EMBEDDING_MODEL`
- `TONGYUAN_ADMIN_EMAILS`
- `TONGYUAN_SYNC_SECRET`

## 2. GitHub Pages frontend

The Pages workflow is in [.github/workflows/deploy-pages.yml](/D:/Code/HomeSetting/tongyuan-workbench/.github/workflows/deploy-pages.yml).

Set these GitHub repository variables before the first deployment:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_FUNCTIONS_URL`
  - optional when you want a custom API host
- `VITE_API_BASE_URL`
  - optional when you use a custom proxy instead of direct Supabase functions

Enable GitHub Pages with the `GitHub Actions` source.

If you deploy the site under a repository path, keep `VITE_BASE_PATH` equal to `/<repo-name>/`.
If you later move to a custom domain, update the workflow or set a matching build variable.

## 3. Auth redirect URLs

In Supabase Auth, add the Pages site URL to:

- Site URL
- Redirect URLs

Include both:

- the production Pages URL
- the local dev URL such as `http://localhost:5173/tongyuan-workbench/`

## 4. Collector sync

Copy [collector/.env.example](/D:/Code/HomeSetting/tongyuan-workbench/collector/.env.example) to `collector/.env` and set:

- `TONGYUAN_OWNER_EMAIL`
- `TONGYUAN_ALLOWED_EMAILS`
- `TONGYUAN_SYNC_ENDPOINT`
  - for direct Supabase usage this is usually `https://<project-ref>.supabase.co/functions/v1/ingestion-sync`
- `TONGYUAN_SYNC_SECRET`
- optional OpenAI-compatible embedding settings

Then run:

```powershell
python -m pip install -e ./collector
python -m tongyuan_collector.cli --json sync
```

## 5. GitHub secrets for automation

For [.github/workflows/deploy-supabase.yml](/D:/Code/HomeSetting/tongyuan-workbench/.github/workflows/deploy-supabase.yml), configure:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`
- `SUPABASE_PROJECT_REF`

## 6. Smoke checks

After deployment:

1. open the Pages site
2. request a magic link
3. confirm the `/sources` view loads
4. run a collector sync from your machine
5. refresh the site and confirm sync statuses changed
6. ask a grounded question and inspect citation detail
