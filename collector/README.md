# TongYuan Collector

## Install

```powershell
python -m pip install -e .
```

## Useful commands

```powershell
python -m tongyuan_collector.cli --json discover
python -m tongyuan_collector.cli --json sync
python -m unittest discover -s tests -v
```

## Notes

- If `TONGYUAN_SYNC_ENDPOINT` or `TONGYUAN_SYNC_SECRET` is missing, sync runs in preview mode.
- Preview payloads are written to `collector/out/last_sync_preview.json`.
- SQLite chat adapters try readable local stores first and fall back to logs when databases are unreadable or locked.
- 代码仓库同步会额外生成“业务概况 / 模块地图 / 最近改动业务影响”等高优先级知识单元，方便问答先用业务语言解释，再决定要不要下钻到代码。
- OpenAI-compatible 配置除了 `TONGYUAN_*` 变量外，也支持直接读取常见的 `OPENAI_BASE_URL / OPENAI_API_KEY / OPENAI_MODEL / OPENAI_EMBEDDING_MODEL`。
