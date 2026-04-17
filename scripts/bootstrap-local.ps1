param()

$root = Split-Path -Parent $PSScriptRoot
$npmCommand = (Get-Command npm -ErrorAction SilentlyContinue)

if (-not $npmCommand) {
  throw "npm was not found on PATH. Switch to Node 22 first, for example with 'nvm use 22.14.0'."
}

Write-Host "Installing workspace dependencies..."
& $npmCommand.Source install --prefix $root

Write-Host "Installing collector in editable mode..."
python -m pip install -e "$root\collector"

if (-not (Test-Path "$root\apps\web\.env.local")) {
  Copy-Item "$root\apps\web\.env.example" "$root\apps\web\.env.local"
}

if (-not (Test-Path "$root\collector\.env")) {
  Copy-Item "$root\collector\.env.example" "$root\collector\.env"
}

Write-Host "Bootstrap complete."
