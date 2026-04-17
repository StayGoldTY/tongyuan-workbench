[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectRef,

  [Parameter(Mandatory = $true)]
  [string]$DbPassword,

  [string]$SecretsFile
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-SupabaseCommand {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments
  )

  $npxCommand = Get-Command "npx.cmd" -ErrorAction SilentlyContinue
  if (-not $npxCommand) {
    $npxCommand = Get-Command "npx" -ErrorAction Stop
  }

  Write-Host ">> npx --yes supabase $($Arguments -join ' ')"
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

  if ($stdout.Trim()) {
    Write-Host $stdout.Trim()
  }
  if ($stderr.Trim()) {
    Write-Host $stderr.Trim()
  }

  if ($process.ExitCode -ne 0) {
    throw "Supabase CLI failed: $($Arguments -join ' ')"
  }
}

$root = Split-Path -Parent $PSScriptRoot
$resolvedSecretsFile = if ($SecretsFile) { $SecretsFile } else { Join-Path $root "supabase\.env" }

Push-Location $root

try {
  Invoke-SupabaseCommand -Arguments @("link", "--project-ref", $ProjectRef, "--password", $DbPassword)
  Invoke-SupabaseCommand -Arguments @("db", "push", "--password", $DbPassword)

  if (Test-Path $resolvedSecretsFile) {
    Invoke-SupabaseCommand -Arguments @(
      "secrets",
      "set",
      "--env-file",
      $resolvedSecretsFile,
      "--project-ref",
      $ProjectRef
    )
  } else {
    Write-Host ">> Secrets file not found. Skipping secrets set: $resolvedSecretsFile"
  }

  Invoke-SupabaseCommand -Arguments @("functions", "deploy", "--project-ref", $ProjectRef, "--use-api")
} finally {
  Pop-Location
}
