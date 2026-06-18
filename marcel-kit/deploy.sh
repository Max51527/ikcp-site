#!/bin/bash
# Marcel Kit — script de déploiement automatisé
# © 2026 IKCP — IKIGAÏ Conseil Patrimonial · ORIAS 23001568
#
# Usage : ./deploy.sh
# Pré-requis : wrangler installé, compte Cloudflare connecté, clé Anthropic en main

set -e

echo "═══════════════════════════════════════════════════════════════"
echo "  Marcel Kit — déploiement Cloudflare Workers"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Vérification wrangler
if ! command -v wrangler &> /dev/null; then
    echo "❌ wrangler n'est pas installé."
    echo "   Installer : npm install -g wrangler"
    exit 1
fi

echo "✓ wrangler détecté"
echo ""

# Vérification login Cloudflare
if ! wrangler whoami &> /dev/null; then
    echo "🔑 Login Cloudflare requis..."
    wrangler login
fi

echo "✓ Cloudflare authentifié"
echo ""

# Création du KV namespace si pas encore fait
echo "📦 Vérification KV namespace MARCEL_LOGS..."
if ! grep -q "VOTRE_ID_KV" wrangler.toml 2>/dev/null; then
    echo "✓ KV namespace déjà configuré dans wrangler.toml"
else
    echo "Création KV MARCEL_LOGS..."
    KV_OUTPUT=$(wrangler kv:namespace create MARCEL_LOGS 2>&1 || true)
    echo "$KV_OUTPUT"
    KV_ID=$(echo "$KV_OUTPUT" | grep -oP 'id = "\K[^"]+' || echo "")
    if [ -n "$KV_ID" ]; then
        # Update wrangler.toml (compatible macOS + Linux)
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s/VOTRE_ID_KV/$KV_ID/g" wrangler.toml
        else
            sed -i "s/VOTRE_ID_KV/$KV_ID/g" wrangler.toml
        fi
        echo "✓ KV ID inséré dans wrangler.toml : $KV_ID"
    else
        echo "⚠️  Récupérer manuellement l'ID KV et le coller dans wrangler.toml"
    fi
fi
echo ""

# Configuration de la clé Anthropic
echo "🔐 Configuration ANTHROPICAPIKEY..."
if wrangler secret list 2>/dev/null | grep -q "ANTHROPICAPIKEY"; then
    echo "✓ ANTHROPICAPIKEY déjà configurée"
else
    echo "Saisir votre clé Anthropic (sk-ant-...) :"
    wrangler secret put ANTHROPICAPIKEY
fi
echo ""

# Déploiement
echo "🚀 Déploiement..."
wrangler deploy
echo ""

# Test de health
WORKER_URL=$(wrangler deployments list 2>/dev/null | grep -oP 'https://[^ ]+' | head -1 || echo "")
if [ -n "$WORKER_URL" ]; then
    echo "═══════════════════════════════════════════════════════════════"
    echo "  ✅ Marcel déployé sur : $WORKER_URL"
    echo "═══════════════════════════════════════════════════════════════"
    echo ""
    echo "Test rapide :"
    echo "  curl -X POST $WORKER_URL \\"
    echo "    -H 'Origin: https://votre-domaine.com' \\"
    echo "    -H 'Content-Type: application/json' \\"
    echo "    -d '{\"message\":\"Combien donner à mon enfant sans payer de droits ?\"}'"
    echo ""
fi

echo "Prochaines étapes :"
echo "  1. Personnaliser worker.js (cabinet, branding) — chercher [BRAND]"
echo "  2. Ajouter le widget chat sur votre site (chatbot-widget.js)"
echo "  3. Configurer un domaine custom (ex: marcel.votre-domaine.com)"
echo "  4. Activer le rate limit (wrangler kv:namespace create RATE_LIMIT)"
echo ""
echo "Documentation complète : voir README.md"
echo "Support : maxime@ikcp.fr"
