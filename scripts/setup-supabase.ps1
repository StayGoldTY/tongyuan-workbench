[CmdletBinding()]
param(
  [string]$AccessToken,
  [string]$ProjectRef,
  [string]$ProjectName = "tongyuan-workbench",
  [string]$OrgId,
  [string]$Region = "ap-southeast-1",
  [string]$DbPassword,
  [string]$AnonKey,
  [string]$ServiceRoleKey,
  [string]$OwnerEmail,
  [string]$AllowedEmails,
  [string]$AdminEmails,
  [string]$OpenAIBaseUrl,
  [string]$OpenAIApiKey,
  [string]$OpenAIWireApi,
  [string]$ChatModel,
  [string]$EmbeddingModel = "text-embedding-3-small",
  [string]$SyncSecret,
  [switch]$CreateProject,
  [switch]$SkipGitHub,
  [switch]$SkipDeploy
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
if ($PSVersionTable.PSVersion.Major -ge 7) {
  $global:PSNativeCommandUseErrorActionPreference = $false
}

function Write-Section {
  param([string]$Title)
  Write-Host ""
  Write-Host "=== $Title ==="
}

function Test-CommandExists {
  param([string]$Name)
  return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Require-Command {
  param(
    [string]$Name,
    [string]$Hint
  )

  if (-not (Test-CommandExists $Name)) {
    throw "$Name is not available on PATH. $Hint"
  }
}

function New-RandomSecret {
  param([int]$Bytes = 24)

  $buffer = New-Object byte[] $Bytes
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $rng.GetBytes($buffer)
  } finally {
    $rng.Dispose()
  }

  return [Convert]::ToBase64String($buffer).TrimEnd("=").Replace("+", "A").Replace("/", "B")
}

function Normalize-Csv {
  param([string]$Value)

  return (
    ($Value -split ",") |
    ForEach-Object { $_.Trim() } |
    Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
  ) -join ","
}

function ConvertFrom-LooseJson {
  param([string]$Text)

  $trimmed = $Text.Trim()
  foreach ($prefix in @("{", "[")) {
    $startIndex = $trimmed.IndexOf($prefix)
    if ($startIndex -lt 0) {
      continue
    }

    $candidate = $trimmed.Substring($startIndex)
    try {
      return $candidate | ConvertFrom-Json
    } catch {
      continue
    }
  }

  throw "Command returned non-JSON output:`n$trimmed"
}

function Invoke-SupabaseCli {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments,
    [switch]$ExpectJson
  )

  $npxCommand = Get-Command "npx.cmd" -ErrorAction SilentlyContinue
  if (-not $npxCommand) {
    $npxCommand = Get-Command "npx" -ErrorAction Stop
  }

  $quotedArguments = @("--yes", "supabase") + $Arguments | ForEach-Object {
    '"' + ($_ -replace '"', '\"') + '"'
  }
  $startInfo = New-Object System.Diagnostics.ProcessStartInfo
  $startInfo.FileName = $npxCommand.Source
  $startInfo.Arguments = ($quotedArguments -join " ")
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $true

  $process = New-Object System.Diagnostics.Process
  $process.StartInfo = $startInfo
  $null = $process.Start()
  $stdout = $process.StandardOutput.ReadToEnd()
  $stderr = $process.StandardError.ReadToEnd()
  $process.WaitForExit()

  $exitCode = $process.ExitCode
  $text = @($stdout, $stderr) -join [Environment]::NewLine
  $text = $text.Trim()

  if ($exitCode -ne 0) {
    if ($text) {
      throw $text
    }

    throw "Supabase CLI failed: $($Arguments -join ' ')"
  }

  if ($ExpectJson) {
    if (-not $text) {
      return $null
    }

    return ConvertFrom-LooseJson -Text $text
  }

  if ($text) {
    Write-Host $text
  }

  return $text
}

function Invoke-GhCli {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments
  )

  $output = & gh @Arguments 2>&1
  $exitCode = $LASTEXITCODE
  $text = (($output | ForEach-Object { "$_" }) -join [Environment]::NewLine).Trim()

  if ($exitCode -ne 0) {
    if ($text) {
      throw $text
    }

    throw "GitHub CLI failed: $($Arguments -join ' ')"
  }

  return $text
}

function Resolve-ProjectRef {
  param([object]$Value)

  if ($null -eq $Value) {
    return ""
  }

  if ($Value -is [string]) {
    return $Value.Trim()
  }

  foreach ($name in @("project_ref", "projectRef", "ref", "id")) {
    if ($Value.PSObject.Properties.Name -contains $name) {
      $candidate = [string]$Value.$name
      if (-not [string]::IsNullOrWhiteSpace($candidate)) {
        return $candidate.Trim()
      }
    }
  }

  foreach ($name in @("project", "data")) {
    if ($Value.PSObject.Properties.Name -contains $name) {
      $nested = Resolve-ProjectRef -Value $Value.$name
      if ($nested) {
        return $nested
      }
    }
  }

  if ($Value -is [System.Collections.IEnumerable] -and -not ($Value -is [string])) {
    foreach ($item in $Value) {
      $nested = Resolve-ProjectRef -Value $item
      if ($nested) {
        return $nested
      }
    }
  }

  return ""
}

function Resolve-ApiKey {
  param(
    [object]$Keys,
    [string[]]$Needles
  )

  if ($null -eq $Keys) {
    return ""
  }

  $items =
    if ($Keys -is [System.Collections.IEnumerable] -and -not ($Keys -is [string])) {
      @($Keys)
    } else {
      @($Keys)
    }

  foreach ($item in $items) {
    if ($null -eq $item) {
      continue
    }

    $labels = @()
    foreach ($propertyName in @("name", "type", "role", "description", "key_type", "keyType")) {
      if ($item.PSObject.Properties.Name -contains $propertyName) {
        $value = [string]$item.$propertyName
        if (-not [string]::IsNullOrWhiteSpace($value)) {
          $labels += $value.ToLowerInvariant()
        }
      }
    }

    $haystack = $labels -join " "
    $matched = $false
    foreach ($needle in $Needles) {
      if ($haystack.Contains($needle.ToLowerInvariant())) {
        $matched = $true
        break
      }
    }

    if (-not $matched) {
      continue
    }

    foreach ($propertyName in @("api_key", "apiKey", "key", "secret")) {
      if ($item.PSObject.Properties.Name -contains $propertyName) {
        $value = [string]$item.$propertyName
        if (-not [string]::IsNullOrWhiteSpace($value)) {
          return $value.Trim()
        }
      }
    }
  }

  return ""
}

function Backup-FileIfExists {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    return
  }

  $timestamp = Get-Date -Format "yyyyMMddHHmmss"
  Copy-Item $Path "$Path.$timestamp.bak"
}

function Write-EnvFile {
  param(
    [string]$Path,
    [string[]]$Lines
  )

  $directory = Split-Path -Parent $Path
  if (-not (Test-Path $directory)) {
    New-Item -ItemType Directory -Path $directory | Out-Null
  }

  Backup-FileIfExists -Path $Path
  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, ($Lines -join "`r`n"), $encoding)
}

function Get-CodexDefaults {
  $result = @{
    OpenAIBaseUrl = ""
    OpenAIApiKey = ""
    ChatModel = ""
    OpenAIWireApi = ""
  }

  $configPath = Join-Path $env:USERPROFILE ".codex\config.toml"
  $authPath = Join-Path $env:USERPROFILE ".codex\auth.json"

  if (Test-Path $configPath) {
    $configText = Get-Content $configPath -Raw -Encoding UTF8
    if ($configText -match '(?m)^model\s*=\s*"([^"]+)"') {
      $result.ChatModel = $Matches[1]
    }
    if ($configText -match '(?m)^\s*base_url\s*=\s*"([^"]+)"') {
      $result.OpenAIBaseUrl = $Matches[1]
    }
    if ($configText -match '(?m)^\s*wire_api\s*=\s*"([^"]+)"') {
      $result.OpenAIWireApi = $Matches[1]
    }
  }

  if (Test-Path $authPath) {
    try {
      $auth = Get-Content $authPath -Raw -Encoding UTF8 | ConvertFrom-Json
      if ($auth.PSObject.Properties.Name -contains "OPENAI_API_KEY") {
        $result.OpenAIApiKey = [string]$auth.OPENAI_API_KEY
      }
    } catch {
      Write-Host "Skipped Codex auth parse: $($_.Exception.Message)"
    }
  }

  return $result
}

Require-Command -Name "npx" -Hint "Install Node.js 22 first."
Require-Command -Name "powershell" -Hint "Run this script in Windows PowerShell."

$root = Split-Path -Parent $PSScriptRoot
$deployScriptPath = Join-Path $root "scripts\deploy-supabase.ps1"
$webEnvPath = Join-Path $root "apps\web\.env.local"
$collectorEnvPath = Join-Path $root "collector\.env"
$supabaseEnvPath = Join-Path $root "supabase\.env"
$repoDefaultName = Split-Path -Leaf $root
$codexDefaults = Get-CodexDefaults

$repoFullName = ""
$repoUrl = ""
if (Test-CommandExists "gh") {
  try {
    $repoInfo = Invoke-GhCli -Arguments @("repo", "view", "--json", "nameWithOwner,url") | ConvertFrom-Json
    $repoFullName = $repoInfo.nameWithOwner
    $repoUrl = $repoInfo.url
  } catch {
    Write-Host "Skipped GitHub repo auto-detect: $($_.Exception.Message)"
  }
}

$repoName = if ($repoFullName) { ($repoFullName -split "/")[1] } else { $repoDefaultName }
$repoOwner = if ($repoFullName) { ($repoFullName -split "/")[0] } else { "" }
$basePath = "/$repoName/"
$pagesUrl = if ($repoOwner) { "https://$repoOwner.github.io/$repoName/" } else { "" }
$localUrl = "http://localhost:5173$basePath"

if (-not $OwnerEmail) {
  try {
    $OwnerEmail = (git -C $root config user.email).Trim()
  } catch {
    $OwnerEmail = ""
  }
}
if (-not $AllowedEmails) {
  $AllowedEmails = $OwnerEmail
}
if (-not $AdminEmails) {
  $AdminEmails = $AllowedEmails
}
if (-not $OpenAIBaseUrl) {
  $OpenAIBaseUrl = $codexDefaults.OpenAIBaseUrl
}
if (-not $OpenAIApiKey) {
  $OpenAIApiKey = $codexDefaults.OpenAIApiKey
}
if (-not $ChatModel) {
  $ChatModel = if ($codexDefaults.ChatModel) { $codexDefaults.ChatModel } else { "gpt-5.4" }
}
if (-not $OpenAIWireApi) {
  $OpenAIWireApi = $codexDefaults.OpenAIWireApi
}
if (-not $SyncSecret) {
  $SyncSecret = New-RandomSecret
}
if (-not $DbPassword -and (($CreateProject.IsPresent) -or (-not $ProjectRef))) {
  $DbPassword = New-RandomSecret
}

$AllowedEmails = Normalize-Csv -Value $AllowedEmails
$AdminEmails = Normalize-Csv -Value $AdminEmails

Write-Section "TongYuan Supabase Setup"
Write-Host "Repository root: $root"
if ($repoFullName) {
  Write-Host "GitHub repo: $repoFullName"
}

if (-not $AccessToken) {
  $AccessToken = $env:SUPABASE_ACCESS_TOKEN
}

if ($AccessToken) {
  Invoke-SupabaseCli -Arguments @("login", "--token", $AccessToken, "--yes") | Out-Null
} else {
  try {
    $null = Invoke-SupabaseCli -Arguments @("projects", "list", "--output", "json") -ExpectJson
  } catch {
    throw "Supabase access token is required for automated setup. Pass -AccessToken or set SUPABASE_ACCESS_TOKEN."
  }
}

$projects = @()
try {
  $projects = @(Invoke-SupabaseCli -Arguments @("projects", "list", "--output", "json") -ExpectJson)
} catch {
  Write-Host "Could not load project list: $($_.Exception.Message)"
}

if (-not $ProjectRef) {
  $shouldCreateProject = $true
} else {
  $shouldCreateProject = $CreateProject.IsPresent
}

if ($shouldCreateProject -and -not $ProjectRef) {
  Write-Section "Create Supabase Project"

  $orgs = @(Invoke-SupabaseCli -Arguments @("orgs", "list", "--output", "json") -ExpectJson)
  if (-not $OrgId) {
    if ($orgs.Count -eq 1) {
      $OrgId = Resolve-ProjectRef -Value $orgs[0]
    } else {
      $OrgId = Resolve-ProjectRef -Value ($orgs | Select-Object -First 1)
    }
  }

  if (-not $OrgId) {
    throw "Could not determine Supabase org id automatically."
  }

  $createResult = Invoke-SupabaseCli -Arguments @(
    "projects",
    "create",
    $ProjectName,
    "--org-id",
    $OrgId,
    "--region",
    $Region,
    "--db-password",
    $DbPassword,
    "--output",
    "json"
  ) -ExpectJson

  $ProjectRef = Resolve-ProjectRef -Value $createResult
  if (-not $ProjectRef) {
    Start-Sleep -Seconds 8
    $projects = @(Invoke-SupabaseCli -Arguments @("projects", "list", "--output", "json") -ExpectJson)
    $candidate = $projects | Where-Object {
      ($_.PSObject.Properties.Name -contains "name") -and ([string]$_.name -eq $ProjectName)
    } | Select-Object -First 1
    $ProjectRef = Resolve-ProjectRef -Value $candidate
  }

  if (-not $ProjectRef) {
    throw "Project was created but project ref could not be resolved automatically."
  }
}

if (-not $ProjectRef) {
  throw "Project ref is still empty. Provide -ProjectRef or allow the script to create a project."
}

if (-not $DbPassword -and -not $SkipDeploy.IsPresent) {
  throw "DbPassword is required for deployment. Pass -DbPassword or rerun with -SkipDeploy."
}

Write-Section "Read API Keys"
$apiKeys = $null
for ($attempt = 1; $attempt -le 5; $attempt++) {
  try {
    $apiKeys = Invoke-SupabaseCli -Arguments @(
      "projects",
      "api-keys",
      "--project-ref",
      $ProjectRef,
      "--output",
      "json"
    ) -ExpectJson
    if ($apiKeys) {
      break
    }
  } catch {
    if ($attempt -eq 5) {
      throw
    }
    Start-Sleep -Seconds 6
  }
}

$anonKey = if ($AnonKey) { $AnonKey } else { Resolve-ApiKey -Keys $apiKeys -Needles @("anon", "publishable") }
$serviceRoleKey = if ($ServiceRoleKey) { $ServiceRoleKey } else { Resolve-ApiKey -Keys $apiKeys -Needles @("service_role", "service role", "secret") }

if (-not $anonKey -or -not $serviceRoleKey) {
  throw "Could not resolve Supabase publishable/service key automatically."
}

$supabaseUrl = "https://$ProjectRef.supabase.co"
$functionsUrl = "$supabaseUrl/functions/v1"
$syncEndpoint = "$functionsUrl/ingestion-sync"

Write-Section "Write Local Env Files"
Write-EnvFile -Path $webEnvPath -Lines @(
  "VITE_BASE_PATH=$basePath",
  "VITE_API_BASE_URL=",
  "VITE_SUPABASE_FUNCTIONS_URL=$functionsUrl",
  "VITE_SUPABASE_URL=$supabaseUrl",
  "VITE_SUPABASE_ANON_KEY=$anonKey"
)

Write-EnvFile -Path $collectorEnvPath -Lines @(
  "TONGYUAN_OWNER_EMAIL=$OwnerEmail",
  "TONGYUAN_ALLOWED_EMAILS=$AllowedEmails",
  "TONGYUAN_SYNC_ENDPOINT=$syncEndpoint",
  "TONGYUAN_SYNC_SECRET=$SyncSecret",
  "OPENAI_BASE_URL=$OpenAIBaseUrl",
  "OPENAI_API_KEY=$OpenAIApiKey",
  "OPENAI_WIRE_API=$OpenAIWireApi",
  "CHAT_MODEL=$ChatModel",
  "EMBEDDING_MODEL=$EmbeddingModel",
  "TONGYUAN_PERMISSION_SCOPES=owner_only,redacted",
  "TONGYUAN_WECHAT_ROOT=D:/WeChat Files",
  "TONGYUAN_WECHAT_ACCOUNT=shangerty"
)

Write-EnvFile -Path $supabaseEnvPath -Lines @(
  "SUPABASE_URL=$supabaseUrl",
  "SUPABASE_ANON_KEY=$anonKey",
  "SUPABASE_SERVICE_ROLE_KEY=$serviceRoleKey",
  "OPENAI_BASE_URL=$OpenAIBaseUrl",
  "OPENAI_API_KEY=$OpenAIApiKey",
  "OPENAI_WIRE_API=$OpenAIWireApi",
  "CHAT_MODEL=$ChatModel",
  "EMBEDDING_MODEL=$EmbeddingModel",
  "TONGYUAN_ADMIN_EMAILS=$AdminEmails",
  "TONGYUAN_SYNC_SECRET=$SyncSecret"
)

if (-not $SkipGitHub.IsPresent) {
  Write-Section "Sync GitHub Actions Settings"

  if (-not (Test-CommandExists "gh")) {
    Write-Host "gh is not installed. Skip GitHub sync."
  } elseif (-not $repoFullName) {
    Write-Host "GitHub repo was not detected. Skip GitHub sync."
  } else {
    $tempDirectory = Join-Path $env:TEMP "tongyuan-supabase-setup"
    if (-not (Test-Path $tempDirectory)) {
      New-Item -ItemType Directory -Path $tempDirectory | Out-Null
    }

    $timestamp = Get-Date -Format "yyyyMMddHHmmss"
    $publicEnvFile = Join-Path $tempDirectory "github-vars-$timestamp.env"
    $secretEnvFile = Join-Path $tempDirectory "github-secrets-$timestamp.env"

    try {
      $publicVars = @(
        "VITE_SUPABASE_URL=$supabaseUrl",
        "VITE_SUPABASE_ANON_KEY=$anonKey",
        "VITE_SUPABASE_FUNCTIONS_URL=$functionsUrl"
      )
      Write-EnvFile -Path $publicEnvFile -Lines $publicVars

      Write-EnvFile -Path $secretEnvFile -Lines @(
        "SUPABASE_ACCESS_TOKEN=$AccessToken",
        "SUPABASE_DB_PASSWORD=$DbPassword",
        "SUPABASE_PROJECT_REF=$ProjectRef"
      )

      Invoke-GhCli -Arguments @("variable", "set", "-f", $publicEnvFile, "-R", $repoFullName) | Out-Null
      Invoke-GhCli -Arguments @("secret", "set", "-f", $secretEnvFile, "-R", $repoFullName) | Out-Null

      Write-Host "GitHub Actions vars and secrets were updated for $repoFullName"
    } finally {
      Remove-Item $publicEnvFile -ErrorAction SilentlyContinue
      Remove-Item $secretEnvFile -ErrorAction SilentlyContinue
    }
  }
}

if (-not $SkipDeploy.IsPresent) {
  Write-Section "Deploy Database And Edge Functions"
  & $deployScriptPath -ProjectRef $ProjectRef -DbPassword $DbPassword -SecretsFile $supabaseEnvPath
} else {
  Write-Section "Deploy Skipped"
  Write-Host "Run this later if needed:"
  Write-Host "powershell -ExecutionPolicy Bypass -File .\scripts\deploy-supabase.ps1 -ProjectRef $ProjectRef -DbPassword [your-db-password]"
}

Write-Section "Manual Steps Still Required"
Write-Host "1. Open Supabase Dashboard -> Authentication -> URL Configuration."
if ($pagesUrl) {
  Write-Host "2. Set Site URL to: $pagesUrl"
  Write-Host "3. Add Redirect URLs: $pagesUrl and $localUrl"
} else {
  Write-Host "2. Set Site URL to your real GitHub Pages URL."
  Write-Host "3. Add Redirect URLs for both production and local dev: $localUrl"
}
Write-Host "4. If GitHub Pages is new for this repo, set Pages source to GitHub Actions."

Write-Section "Summary"
Write-Host "Project ref: $ProjectRef"
Write-Host "Supabase URL: $supabaseUrl"
Write-Host "Web env: $webEnvPath"
Write-Host "Collector env: $collectorEnvPath"
Write-Host "Function secrets env: $supabaseEnvPath"
if ($repoUrl) {
  Write-Host "GitHub repo: $repoUrl"
}
