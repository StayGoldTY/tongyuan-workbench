# Architecture Notes

## Runtime split

- `apps/web`
  - public static shell hosted on GitHub Pages
- `supabase`
  - private API surface and storage layer
- `collector`
  - local-only ingestion process that sees raw data

## Data flow

1. The collector discovers configured code and chat roots.
2. Each source adapter extracts text or metadata from files, Git history, or readable SQLite stores.
3. The redaction pass removes secrets, phone numbers, emails, tokens, cookies, and obvious connection strings.
4. The summarizer derives short descriptions and tags.
5. The chunker prepares retrieval-sized records.
6. The embedder optionally calls an OpenAI-compatible embeddings API.
7. The sync client sends only sanitized payloads to the Supabase ingestion endpoint.
8. The chat query endpoint retrieves matching chunks, calls an OpenAI-compatible chat model, and returns an answer plus citations.

## Key contracts

- `knowledge_unit`
  - the sanitized, source-linked document record
- `knowledge_chunk`
  - the retrieval unit derived from a knowledge unit
- `source_catalog`
  - the discovery record for each code or chat root
- `ingestion_run`
  - an audit-friendly sync summary

## Permission model

- collector writes `allowed_emails` onto every `knowledge_unit`
- Supabase row policies and Edge Functions both enforce the allowlist
- the frontend only calls authenticated endpoints

## Delivery assumptions

- first phase covers `童园` only
- `TY` stays out of this database schema
- image OCR, audio transcription, and large-attachment indexing remain future extensions
