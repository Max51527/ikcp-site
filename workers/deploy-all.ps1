#!/usr/bin/env pwsh
# ==============================================================================
# deploy-all.ps1 — Deploiement automatise des workers IKCP Family Office
# ==============================================================================
#
# Usage :
#   cd workers
#   .\deploy-all.ps1
#
# Options :
#   .\deploy-all.ps1 -SkipPrompt           : pas de confirmation entre etapes
#   .\deploy-all.ps1 -OnlyNew              : ne deploie que les workers nouveaux
#                                            (collector, hermes, lifestyle)
#   .\deploy-all.ps1 -HealthCheckOnly      : check health de tous les workers,
#                                            ne deploie rien
#
# Pre-requis :
#   - wrangler installe (npx wrangler --version)
#   - wrangler login (npx wrangler whoami doit retourner maxime@ikcp.fr)
#   - Cle Anthropic ANTHROPICAPIKEY (pour les workers IA)
#   - Cle Rebrickable REBRICKABLE_API_KEY (gratuite, optionnelle)
#
# ==============================================================================

param(
    [switch]$SkipPrompt,
    [switch]$OnlyNew,
    [switch]$HealthCheckOnly
)

$ErrorActionPreference = 'Stop'
$WorkersRoot = $PSScriptRoot

function Step($msg) {
    Write-Host ""
    Write-Host "==> $msg" -ForegroundColor Cyan
}

function Ok($msg) {
    Write-Host "    OK : $msg" -ForegroundColor Green
}

function Warn($msg) {
    Write-Host "    WARN : $msg" -ForegroundColor Yellow
}

function Err($msg) {
    Write-Host "    ERREUR : $msg" -ForegroundColor Red
}

function Confirm($prompt) {
    if ($SkipPrompt) { return $true }
    $r = Read-Host "    $prompt [O/n]"
    return ($r -eq '' -or $r -match '^[oOyY]')
}

# ── HEALTH CHECK
function HealthCheck() {
    Step "Health check de tous les workers IKCP"
    $workers = @(
        @{ name = 'ikcp-pappers';    url = 'https://ikcp-pappers.maxime-ead.workers.dev/health' },
        @{ name = 'ikcp-chat';       url = 'https://ikcp-chat.maxime-ead.workers.dev/health' },
        @{ name = 'ikcp-codex';      url = 'https://ikcp-codex.maxime-ead.workers.dev/health' },
        @{ name = 'ikcp-hermes';     url = 'https://ikcp-hermes.maxime-ead.workers.dev/health' },
        @{ name = 'ikcp-lifestyle';  url = 'https://ikcp-lifestyle.maxime-ead.workers.dev/health' },
        @{ name = 'ikcp-temoin';     url = 'https://ikcp-temoin.maxime-ead.workers.dev/health' },
        @{ name = 'ikcp-collector';  url = 'https://ikcp-collector.maxime-ead.workers.dev/health' }
    )
    foreach ($w in $workers) {
        try {
            $r = Invoke-RestMethod -Uri $w.url -Method GET -TimeoutSec 10 -ErrorAction Stop
            if ($r.status -eq 'ok') {
                Ok ("{0,-22} OK" -f $w.name)
                if ($r.configured) {
                    $r.configured.PSObject.Properties | ForEach-Object {
                        $icon = if ($_.Value) { 'OK' } else { 'MANQUE' }
                        Write-Host ("        - {0,-22} : {1}" -f $_.Name, $icon)
                    }
                }
            } else {
                Warn ("{0,-22} status={1}" -f $w.name, $r.status)
            }
        } catch {
            Err ("{0,-22} non joignable : {1}" -f $w.name, $_.Exception.Message)
        }
    }
}

if ($HealthCheckOnly) {
    HealthCheck
    return
}

# ── VERIF prerequis
Step "Verification prerequis"
try {
    $whoami = & npx wrangler whoami 2>&1
    if ($whoami -match 'maxime') {
        Ok ("wrangler authentifie : maxime@ikcp.fr")
    } else {
        Warn "wrangler non authentifie. Execute : npx wrangler login"
        if (-not (Confirm "Continuer quand meme ?")) { return }
    }
} catch {
    Err "wrangler indisponible. Installe : npm install -g wrangler"
    return
}

# ── DEPLOYER ikcp-lifestyle (mutualise 8 sub-agents Sonnet 4.6)
if (-not $OnlyNew -or $OnlyNew) {
    Step "1/4 — Deploiement ikcp-lifestyle (8 sub-agents Sonnet 4.6 mutualises)"
    if (Confirm "Deployer ikcp-lifestyle ?") {
        Push-Location (Join-Path $WorkersRoot 'ikcp-lifestyle')
        try {
            # Verif secret ANTHROPICAPIKEY
            $secrets = (& npx wrangler secret list 2>&1) -join "`n"
            if ($secrets -notmatch 'ANTHROPICAPIKEY') {
                Warn "Secret ANTHROPICAPIKEY manquant sur ikcp-lifestyle"
                if (Confirm "Configurer maintenant ? (tu vas devoir coller la cle sk-ant-...)") {
                    & npx wrangler secret put ANTHROPICAPIKEY
                }
            }
            & npx wrangler deploy
            Ok "ikcp-lifestyle deploye"
        } finally { Pop-Location }
    }
}

# ── DEPLOYER ikcp-hermes (Opus 4.7 transmission)
Step "2/4 — Deploiement ikcp-hermes (Opus 4.7 transmission)"
if (Confirm "Deployer ikcp-hermes ?") {
    Push-Location (Join-Path $WorkersRoot 'ikcp-hermes')
    try {
        $secrets = (& npx wrangler secret list 2>&1) -join "`n"
        if ($secrets -notmatch 'ANTHROPICAPIKEY') {
            Warn "Secret ANTHROPICAPIKEY manquant sur ikcp-hermes"
            if (Confirm "Configurer maintenant ?") {
                & npx wrangler secret put ANTHROPICAPIKEY
            }
        }
        & npx wrangler deploy
        Ok "ikcp-hermes deploye"
    } finally { Pop-Location }
}

# ── DEPLOYER ikcp-collector (avec D1 Paris)
Step "3/4 — Deploiement ikcp-collector (agent veille marches + D1 Paris)"
if (Confirm "Deployer ikcp-collector ?") {
    Push-Location (Join-Path $WorkersRoot 'ikcp-collector')
    try {
        # Verif D1 binding
        $wranglerToml = Get-Content 'wrangler.toml' -Raw
        if ($wranglerToml -match 'TO_BE_FILLED_AFTER_CREATE') {
            Warn "D1 ikcp_collector_db pas encore creee"
            if (Confirm "Creer la D1 Paris maintenant ?") {
                $createOutput = & npx wrangler d1 create ikcp_collector_db --location weur 2>&1
                Write-Host $createOutput
                $uuidMatch = $createOutput -join "`n" | Select-String -Pattern 'database_id\s*=\s*"([a-f0-9-]+)"'
                if ($uuidMatch.Matches.Count -gt 0) {
                    $uuid = $uuidMatch.Matches[0].Groups[1].Value
                    Ok "D1 creee, UUID = $uuid"
                    $newToml = $wranglerToml -replace 'TO_BE_FILLED_AFTER_CREATE', $uuid
                    Set-Content -Path 'wrangler.toml' -Value $newToml -Encoding utf8
                    Ok "wrangler.toml mis a jour avec UUID"
                } else {
                    Warn "Impossible d'extraire l'UUID automatiquement. Copie-le manuellement dans wrangler.toml"
                    return
                }
            } else {
                Warn "Skip deploiement collector (D1 manquante)"
                return
            }
        }

        if (Confirm "Initialiser le schema D1 (schema.sql) ?") {
            & npx wrangler d1 execute ikcp_collector_db --remote --file=schema.sql
            Ok "Schema D1 initialise"
        }

        $secrets = (& npx wrangler secret list 2>&1) -join "`n"
        if ($secrets -notmatch 'ADMIN_TOKEN') {
            Warn "Secret ADMIN_TOKEN manquant sur ikcp-collector"
            if (Confirm "Configurer maintenant ? (genere un token long ex: openssl rand -hex 32)") {
                & npx wrangler secret put ADMIN_TOKEN
            }
        }
        if ($secrets -notmatch 'REBRICKABLE_API_KEY') {
            Warn "Secret REBRICKABLE_API_KEY manquant (optionnel, gratuit : https://rebrickable.com/api/)"
            if (Confirm "Configurer maintenant ?") {
                & npx wrangler secret put REBRICKABLE_API_KEY
            }
        }

        & npx wrangler deploy
        Ok "ikcp-collector deploye"
    } finally { Pop-Location }
}

# ── DEPLOYER ikcp-marcel (avec COLLECTOR_ADMIN_TOKEN)
Step "4/4 — Deploiement ikcp-chat (Marcel + 4 tools collector)"
if (Confirm "Deployer ikcp-marcel ?") {
    Push-Location (Join-Path $WorkersRoot 'ikcp-marcel')
    try {
        $secrets = (& npx wrangler secret list 2>&1) -join "`n"
        if ($secrets -notmatch 'COLLECTOR_ADMIN_TOKEN') {
            Warn "Secret COLLECTOR_ADMIN_TOKEN manquant sur ikcp-marcel"
            Warn "Important : utilise le MEME token que celui configure sur ikcp-collector"
            if (Confirm "Configurer maintenant ?") {
                & npx wrangler secret put COLLECTOR_ADMIN_TOKEN
            }
        }
        & npx wrangler deploy
        Ok "ikcp-marcel deploye"
    } finally { Pop-Location }
}

# ── HEALTH CHECK final
Start-Sleep -Seconds 3
HealthCheck

Write-Host ""
Write-Host "==> Deploiement termine." -ForegroundColor Cyan
Write-Host "    Etapes suivantes recommandees :" -ForegroundColor Cyan
Write-Host "    1. Remplir workers/ikcp-collector/profile-template.json avec tes passions"
Write-Host "    2. POST le profil : voir workers/ikcp-collector/README.md"
Write-Host "    3. Tester Marcel : https://ikcp-chat.maxime-ead.workers.dev/health"
Write-Host ""
