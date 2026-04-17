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
