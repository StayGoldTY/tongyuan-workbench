# TongYuan Workbench

`TongYuan Workbench` is the first implementation slice for `童园`, a private work knowledge website that combines:

- a GitHub Pages friendly React/Vite frontend
- Supabase schema and Edge Functions for auth, retrieval, and chat orchestration
- a local Python collector that discovers, redacts, chunks, and syncs work materials

## Project layout

- `apps/web`
  - React/Vite single-page shell for login, chat, sources, and sync monitoring
- `packages/contracts`
  - shared TypeScript contracts used by the frontend and deployment artifacts
- `collector`
  - local Python pipeline that discovers work repositories and chat data roots
- `supabase`
  - database migration plus Edge Functions for `/chat/query`, `/sources`, `/documents`, `/ingestion/sync`, and `/admin/invite`
- `docs`
  - architecture and deployment notes

## Local prerequisites

- Node `22.14.0` or newer
- Python `3.13` or newer
- Supabase project credentials for deployment
- Optional OpenAI-compatible API credentials for embeddings and answer generation

## Quick start

1. Switch Node with `nvm use 22.14.0`
2. Install the frontend workspace dependencies with `npm install`
3. Copy `apps/web/.env.example` to `apps/web/.env.local`
4. Copy `collector/.env.example` to `collector/.env`
5. Install the collector package with `python -m pip install -e ./collector`
6. Run the frontend with `npm run dev:web`
7. Inspect the collector discovery output with `python -m tongyuan_collector.cli --json discover`

## Handy scripts

- `scripts/bootstrap-local.ps1`
  - installs workspace dependencies, installs the collector package, and copies missing `.env` templates
- `scripts/run-collector-preview.ps1`
  - runs the collector sync in local preview mode unless sync credentials are configured
- `scripts/deploy-supabase.ps1 -ProjectRef <ref>`
  - pushes database migrations and deploys all Edge Functions from a local machine with the Supabase CLI

## Collector modes

- `discover`
  - only scans configured source roots and prints the catalog
- `sync`
  - extracts raw evidence, redacts it, chunks it, optionally embeds it, and posts the sanitized payload to Supabase
- preview mode
  - if no sync endpoint or sync secret is configured, the collector writes a local preview JSON file instead of sending data anywhere

## Security defaults

- raw materials stay on the local machine
- only redacted text and derived metadata are eligible for cloud sync
- frontend never needs a service key
- row-level access is driven by allowlisted emails

More detail lives in [docs/architecture.md](D:\Code\HomeSetting\tongyuan-workbench\docs\architecture.md).
Deployment details live in [docs/deployment.md](D:\Code\HomeSetting\tongyuan-workbench\docs\deployment.md).
