param()

$root = Split-Path -Parent $PSScriptRoot
Push-Location "$root\collector"

try {
  python -m tongyuan_collector.cli --json sync
} finally {
  Pop-Location
}
