param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectRef
)

$root = Split-Path -Parent $PSScriptRoot
Push-Location "$root"

try {
  supabase link --project-ref $ProjectRef
  supabase db push
  supabase functions deploy --project-ref $ProjectRef
} finally {
  Pop-Location
}
