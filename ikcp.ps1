#!/usr/bin/env pwsh
# ==============================================================================
# ikcp.ps1 — Cockpit terminal IKCP Family Office (volet code + efficacité)
# ==============================================================================
# UN seul point d'entrée pour le cycle quotidien. À lancer depuis la racine du repo.
#
#   .\ikcp.ps1 health            # SOUVERAINETÉ : appel réel des agents (Mistral ?)
#   .\ikcp.ps1 sync              # git pull --ff-only  (règle clone unique)
#   .\ikcp.ps1 status            # git status + commits non poussés
#   .\ikcp.ps1 ship "message"    # pull + scan secrets + add -u + commit + push
#   .\ikcp.ps1 deploy [args]     # workers/deploy-all.ps1 (déploie les workers)
#   .\ikcp.ps1 test              # workers/test-suite.ps1 -Quick (tests agents)
#   .\ikcp.ps1 help
#
# Sécurité : `ship` ne stage QUE les fichiers DÉJÀ suivis (git add -u) → n'ajoute
# jamais un fichier non suivi par erreur (ex. un recueil patrimonial client). Les
# nouveaux fichiers s'ajoutent explicitement : git add <fichier> puis .\ikcp.ps1 ship.
# ==============================================================================
param(
  [Parameter(Position = 0)][string]$cmd = 'help',
  [Parameter(Position = 1, ValueFromRemainingArguments = $true)]$rest
)
$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $repo
$BASE = 'https://ikcp-{0}.maxime-ead.workers.dev'

function Color($ok) { if ($ok) { 'Green' } else { 'Red' } }

function Ikcp-Health {
  Write-Host "`n  SOUVERAINETÉ IKCP — vérification live (appels réels)`n" -ForegroundColor Cyan
  # Marcel : provider doit être 'mistral-souverain'
  try {
    $r = Invoke-RestMethod -Uri ($BASE -f 'chat') -Method Post -ContentType 'application/json' `
         -Headers @{ Origin = 'https://ikcp.eu' } -Body '{"message":"Bonjour"}' -TimeoutSec 30
    $ok = $r.provider -eq 'mistral-souverain'
    Write-Host ("  {0,-11} provider = {1}" -f 'marcel', $r.provider) -ForegroundColor (Color $ok)
  } catch { Write-Host ("  marcel      ERREUR : " + $_.Exception.Message) -ForegroundColor Red }

  # Sous-agents (appel réel) : model doit être 'ikcp-souverain'
  foreach ($a in 'codex', 'hermes', 'batisseur') {
    try {
      $r = Invoke-RestMethod -Uri ($BASE -f $a) -Method Post -ContentType 'application/json' `
           -Headers @{ Origin = 'https://ikcp-chat.maxime-ead.workers.dev' } -Body '{"question":"Bonjour"}' -TimeoutSec 30
      $ok = $r.model -eq 'ikcp-souverain'
      Write-Host ("  {0,-11} model    = {1}" -f $a, $r.model) -ForegroundColor (Color $ok)
    } catch { Write-Host ("  {0,-11} ERREUR : {1}" -f $a, $_.Exception.Message) -ForegroundColor Red }
  }

  # Lifestyle (payload {agent,question})
  try {
    $r = Invoke-RestMethod -Uri ($BASE -f 'lifestyle') -Method Post -ContentType 'application/json' `
         -Headers @{ Origin = 'https://ikcp-chat.maxime-ead.workers.dev' } -Body '{"agent":"iris","question":"Bonjour"}' -TimeoutSec 30
    $ok = $r.model -eq 'ikcp-souverain'
    Write-Host ("  {0,-11} model    = {1}" -f 'lifestyle', $r.model) -ForegroundColor (Color $ok)
  } catch { Write-Host ("  lifestyle   (payload différent ou indispo)") -ForegroundColor Yellow }

  # Voice : Voxtral actif (clé Mistral posée) ?
  try {
    $h = Invoke-RestMethod -Uri (($BASE -f 'voice') + '/health') -TimeoutSec 12
    $ok = $h.stt.voxtral -eq $true
    $msg = if ($ok) { 'Voxtral actif' } else { 'Whisper US — pose MISTRAL_API_KEY sur ikcp-voice' }
    Write-Host ("  {0,-11} {1}" -f 'voice', $msg) -ForegroundColor $(if ($ok) { 'Green' } else { 'Yellow' })
  } catch { Write-Host "  voice       (health indispo)" -ForegroundColor Yellow }
  Write-Host ""
}

function Ikcp-Scan {
  # Scan secrets sur les fichiers SUIVIS (hors .md et _archive)
  $files = git ls-files | Where-Object { $_ -notmatch '\.md$' -and $_ -notmatch '^_archive/' }
  $pat = @('sk-ant-[A-Za-z0-9]{20}', 'pplx-[A-Za-z0-9]{20}', 'BEGIN [A-Z ]*PRIVATE KEY')
  $hits = $files | ForEach-Object { Select-String -Path $_ -Pattern $pat -ErrorAction SilentlyContinue }
  if ($hits) {
    Write-Host "  SECRET POSSIBLE détecté — STOP :" -ForegroundColor Red
    $hits | ForEach-Object { Write-Host ("   " + $_.Path + ":" + $_.LineNumber) -ForegroundColor Red }
    return $false
  }
  return $true
}

function Ikcp-Ship([string]$msg) {
  if (-not $msg) { Write-Host 'Usage : .\ikcp.ps1 ship "message de commit"' -ForegroundColor Yellow; return }
  Write-Host "  -> git pull --ff-only origin main" -ForegroundColor Cyan
  git pull --ff-only origin main; if ($LASTEXITCODE -ne 0) { Write-Host "  Pull impossible (divergence ?) — résous d'abord." -ForegroundColor Red; return }
  Write-Host "  -> scan secrets" -ForegroundColor Cyan
  if (-not (Ikcp-Scan)) { return }
  git add -u            # uniquement les fichiers DÉJÀ suivis (pas de nouvel ajout surprise)
  git commit -m $msg; if ($LASTEXITCODE -ne 0) { Write-Host "  Rien à committer ?" -ForegroundColor Yellow; return }
  git push origin main
  if ($LASTEXITCODE -eq 0) { Write-Host "  OK — poussé sur GitHub (la CI déploie automatiquement)." -ForegroundColor Green }
}

switch ($cmd.ToLower()) {
  'health' { Ikcp-Health }
  'sync'   { git pull --ff-only origin main }
  'status' { git status -s; Write-Host "`n  Commits non poussés :" -ForegroundColor Cyan; git log --oneline origin/main..HEAD }
  'ship'   { Ikcp-Ship ($rest -join ' ') }
  'deploy' { Push-Location workers; & ./deploy-all.ps1 @rest; Pop-Location }
  'test'   { Push-Location workers; & ./test-suite.ps1 -Quick; Pop-Location }
  default  {
    Write-Host "`n  ikcp.ps1 — cockpit terminal IKCP`n" -ForegroundColor Cyan
    Write-Host "  health           souveraineté : appel réel des agents (Mistral ?)"
    Write-Host "  sync             git pull --ff-only (clone unique)"
    Write-Host "  status           git status + commits non poussés"
    Write-Host '  ship "message"   pull + scan secrets + commit + push (déploie via CI)'
    Write-Host "  deploy [args]    workers/deploy-all.ps1"
    Write-Host "  test             workers/test-suite.ps1 -Quick`n"
  }
}
