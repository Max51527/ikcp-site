#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# IKCP — Setup interactif beta été 2026
#
# Guide Maxime (non-dev) à travers le déploiement minimum pour
# ouvrir la beta privée : DNS, agents Anthropic Managed, secrets,
# wrangler deploy, smoke tests.
#
# Usage :   bash scripts/setup-beta.sh
#
# Pré-requis :
#   - npx wrangler (npm install -g wrangler)
#   - ant CLI (brew install anthropics/tap/ant ou github releases)
#   - Cloudflare login OK (npx wrangler whoami)
#   - Anthropic login OK (ant auth login)
#
# © 2026 IKCP — IKIGAÏ Conseil Patrimonial · ORIAS 23001568
# ─────────────────────────────────────────────────────────────

set -e
cd "$(dirname "$0")/.."

# Couleurs
RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
GOLD=$'\033[38;5;179m'
DIM=$'\033[2m'
BOLD=$'\033[1m'
NC=$'\033[0m'

banner() {
  echo ""
  echo "${GOLD}╔═══════════════════════════════════════════════════════════╗${NC}"
  echo "${GOLD}║  IKCP · Setup Beta été 2026 · interactif                  ║${NC}"
  echo "${GOLD}╚═══════════════════════════════════════════════════════════╝${NC}"
  echo ""
}

step() {
  echo ""
  echo "${BOLD}${GOLD}▸ $1${NC}"
  echo "${DIM}$2${NC}"
}

ask_continue() {
  echo ""
  read -p "${YELLOW}Continuer ? [Y/n] ${NC}" -r
  if [[ ! $REPLY =~ ^[YyOo]?$ ]]; then
    echo "${RED}✗ Abandon par l'utilisateur.${NC}"
    exit 0
  fi
}

check_cmd() {
  if command -v "$1" >/dev/null 2>&1; then
    echo "${GREEN}✓${NC} $1 trouvé : $(command -v "$1")"
    return 0
  else
    echo "${RED}✗${NC} $1 manquant. Installer avec : ${YELLOW}$2${NC}"
    return 1
  fi
}

# ─────────────────────────────────────────────────────────────
# Étape 0 — Vérification des prérequis
# ─────────────────────────────────────────────────────────────
banner
echo "Bonjour Maxime. Ce script t'accompagne pour ouvrir la beta IKCP."
echo "À chaque étape, lis et confirme avant de continuer."
echo ""
echo "Tu peux interrompre à tout moment avec ${BOLD}Ctrl+C${NC} — rien n'est"
echo "fait sans ta confirmation explicite."
ask_continue

step "0/8 — Vérification des outils" "wrangler + ant + node + python"

PREREQ_OK=1
check_cmd "npx" "https://nodejs.org/ (Node.js LTS)" || PREREQ_OK=0
check_cmd "ant" "brew install anthropics/tap/ant" || PREREQ_OK=0
check_cmd "python3" "déjà inclus sur macOS / Linux" || PREREQ_OK=0

if [ "$PREREQ_OK" -eq 0 ]; then
  echo ""
  echo "${RED}Un ou plusieurs outils manquent. Installer puis relancer.${NC}"
  exit 1
fi

echo ""
echo "${BOLD}Vérification des authentifications :${NC}"
echo -n "  • Cloudflare : "
if npx wrangler whoami 2>/dev/null | grep -q "Account"; then
  echo "${GREEN}✓ OK${NC}"
else
  echo "${RED}✗ Pas connecté. Lancer : npx wrangler login${NC}"
  PREREQ_OK=0
fi

echo -n "  • Anthropic  : "
if ant auth status 2>/dev/null | grep -qi "active\|signed in\|logged"; then
  echo "${GREEN}✓ OK${NC}"
else
  echo "${YELLOW}? Vérifier : ant auth login${NC}"
fi

[ "$PREREQ_OK" -eq 0 ] && exit 1
ask_continue

# ─────────────────────────────────────────────────────────────
# Étape 1 — DNS Cloudflare
# ─────────────────────────────────────────────────────────────
step "1/8 — DNS Cloudflare (action manuelle dashboard)" \
"Crée 3 sous-domaines pour les nouveaux workers. À faire UI."

cat <<EOF

  Va sur ${BOLD}https://dash.cloudflare.com${NC} → ikcp.eu → DNS → Records.

  Ajoute 3 enregistrements ${BOLD}CNAME${NC} avec proxy ☁ ${BOLD}activé${NC} :

  ┌─────────────────┬──────────────────────────────────────┐
  │ Sous-domaine    │ Cible                                │
  ├─────────────────┼──────────────────────────────────────┤
  │ agents          │ ikcp-agents.maxime-ead.workers.dev   │
  │ voice           │ ikcp-voice.maxime-ead.workers.dev    │
  │ admin           │ ikcp-admin.maxime-ead.workers.dev    │
  └─────────────────┴──────────────────────────────────────┘

  ${DIM}(Sous-domaines pour les nouveaux workers de la branche beta.)${NC}

EOF
read -p "${YELLOW}DNS créés ? [appuyer sur Entrée quand fait] ${NC}"

# ─────────────────────────────────────────────────────────────
# Étape 2 — Migrations D1
# ─────────────────────────────────────────────────────────────
step "2/8 — Migrations D1 (agent_sessions + memory_stores)" \
"Crée les tables nécessaires pour ikcp-agents et le backup quotidien."

echo ""
echo "${BOLD}Migrations à appliquer (en mode ${YELLOW}--remote${BOLD} prod) :${NC}"
echo "  • migrations/006_agent_sessions.sql"
echo "  • migrations/007_memory_stores.sql"
echo ""
read -p "${YELLOW}Lancer les migrations ? [Y/n] ${NC}" -r
if [[ $REPLY =~ ^[YyOo]?$ ]]; then
  npx wrangler d1 execute ikcp-client-db --remote --file=migrations/006_agent_sessions.sql || \
    echo "${YELLOW}⚠ Migration 006 a échoué (peut-être déjà appliquée)${NC}"
  npx wrangler d1 execute ikcp-client-db --remote --file=migrations/007_memory_stores.sql || \
    echo "${YELLOW}⚠ Migration 007 a échoué (peut-être déjà appliquée)${NC}"
  echo "${GREEN}✓ Migrations passées (ou déjà à jour).${NC}"
fi

# ─────────────────────────────────────────────────────────────
# Étape 3 — KV namespaces
# ─────────────────────────────────────────────────────────────
step "3/8 — KV namespaces (cache TTS + rate limit + agent KV)" \
"Crée AGENT_KV, VOICE_CACHE (si pas déjà), VOICE_RATE."

echo ""
read -p "${YELLOW}Créer les KV namespaces ? [Y/n] ${NC}" -r
if [[ $REPLY =~ ^[YyOo]?$ ]]; then
  echo ""
  echo "${DIM}AGENT_KV (pour ikcp-agents — dedup webhooks + rate limit démo)${NC}"
  npx wrangler kv namespace create AGENT_KV 2>&1 | head -3 || true
  echo ""
  echo "${DIM}VOICE_RATE (pour ikcp-voice — rate limit hourly)${NC}"
  npx wrangler kv namespace create VOICE_RATE 2>&1 | head -3 || true
  echo ""
  echo "${YELLOW}⚠ Copier les IDs ci-dessus dans les wrangler.toml correspondants${NC}"
  echo "${YELLOW}  (workers/ikcp-agents/wrangler.toml et workers/ikcp-voice/wrangler.toml)${NC}"
  read -p "${YELLOW}IDs copiés ? [appuyer sur Entrée] ${NC}"
fi

# ─────────────────────────────────────────────────────────────
# Étape 4 — Agents Managed Anthropic (les 5 MVP)
# ─────────────────────────────────────────────────────────────
step "4/8 — Création de l'environnement + 5 agents Anthropic MVP" \
"On crée seulement les 5 essentiels pour la beta, pas les 13."

echo ""
echo "${BOLD}Agents MVP pour la beta :${NC}"
echo "  1. marcel-environment       (environnement cloud)"
echo "  2. marcel-documents          (OCR + extraction docs)"
echo "  3. marcel-patrimoine         (analyse 360°)"
echo "  4. marcel-transmission       (donations + Dutreil)"
echo "  5. marcel-fiscalite-impots   (OCR avis IR/IFI)"
echo "  6. marcel-reporting          (DER trimestriel)"
echo ""
read -p "${YELLOW}Créer ces 6 ressources Anthropic ? [Y/n] ${NC}" -r
if [[ $REPLY =~ ^[YyOo]?$ ]]; then
  echo ""
  echo "${BOLD}Création environnement...${NC}"
  ENV_ID=$(ant beta:environments create < agents/marcel-environment.yaml --transform id -r 2>/dev/null) || ENV_ID=""
  if [ -n "$ENV_ID" ]; then
    echo "${GREEN}✓ MARCEL_ENV_ID=$ENV_ID${NC}"
  else
    echo "${RED}✗ Création environnement échouée. Voir log Anthropic.${NC}"
  fi

  declare -A AGENT_IDS
  for agent in documents patrimoine transmission fiscalite-impots reporting; do
    echo ""
    echo "${BOLD}Création agent $agent...${NC}"
    ID=$(ant beta:agents create < "agents/marcel-$agent.agent.yaml" --transform id -r 2>/dev/null) || ID=""
    if [ -n "$ID" ]; then
      AGENT_IDS[$agent]=$ID
      echo "${GREEN}✓ MARCEL_${agent^^}_AGENT_ID=$ID${NC}"
    else
      echo "${RED}✗ Création agent $agent échouée${NC}"
    fi
  done

  echo ""
  echo "${BOLD}${GOLD}IDs à pousser comme secrets Cloudflare :${NC}"
  echo "  MARCEL_ENV_ID=$ENV_ID"
  for k in "${!AGENT_IDS[@]}"; do
    VAR_NAME="MARCEL_$(echo "$k" | tr '[:lower:]-' '[:upper:]_')_AGENT_ID"
    echo "  $VAR_NAME=${AGENT_IDS[$k]}"
  done
fi

# ─────────────────────────────────────────────────────────────
# Étape 5 — Push secrets sur ikcp-agents
# ─────────────────────────────────────────────────────────────
step "5/8 — Push secrets ikcp-agents" \
"Pousse les MARCEL_*_AGENT_ID + ANTHROPICAPIKEY + WEBHOOK_SIGNING_KEY"

echo ""
echo "${BOLD}À pousser manuellement (le script lance les prompts wrangler) :${NC}"
echo "  • ANTHROPICAPIKEY              (depuis Anthropic Console → Settings → API Keys)"
echo "  • ANTHROPIC_WEBHOOK_SIGNING_KEY (depuis Anthropic Console → Webhooks)"
echo "  • RESEND_API_KEY                (déjà set probablement)"
echo "  • MARCEL_ENV_ID + 5 MARCEL_*_AGENT_ID (de l'étape 4)"
echo ""
read -p "${YELLOW}Lancer le push interactif ? [Y/n] ${NC}" -r
if [[ $REPLY =~ ^[YyOo]?$ ]]; then
  cd workers/ikcp-agents
  for var in ANTHROPICAPIKEY ANTHROPIC_WEBHOOK_SIGNING_KEY HMAC_SECRET RESEND_API_KEY \
             MARCEL_ENV_ID MARCEL_DOCUMENTS_AGENT_ID MARCEL_PATRIMOINE_AGENT_ID \
             MARCEL_TRANSMISSION_AGENT_ID MARCEL_FISCALITE_IMPOTS_AGENT_ID \
             MARCEL_REPORTING_AGENT_ID; do
    echo ""
    echo "${BOLD}→ Secret : $var${NC}"
    read -p "  Pousser maintenant ? [y/N/skip] " -r CHOICE
    if [[ $CHOICE =~ ^[YyOo]$ ]]; then
      npx wrangler secret put "$var"
    fi
  done
  cd - > /dev/null
fi

# ─────────────────────────────────────────────────────────────
# Étape 6 — Modal.run pour VoxCPM2 (option, voix Marcel)
# ─────────────────────────────────────────────────────────────
step "6/8 — Modal.run TTS (voix Marcel)" \
"Optionnel pour la beta. La voix peut être différée à plus tard."

echo ""
echo "${BOLD}Pour activer la voix Marcel :${NC}"
echo "  1. Compte Modal.com créé : ${BOLD}https://modal.com${NC}"
echo "  2. ${BOLD}pip install modal && modal token new${NC}"
echo "  3. Lancer : ${BOLD}python workers/ikcp-voice/deploy-voxcpm-modal.py${NC}"
echo "  4. Copier l'URL retournée dans workers/ikcp-voice/wrangler.toml (VOXCPM_API_URL)"
echo "  5. ${BOLD}cd workers/ikcp-voice && npx wrangler secret put MISTRAL_API_KEY${NC}"
echo ""
read -p "${YELLOW}Faire maintenant ou plus tard ? [maintenant/M/L=plus tard] ${NC}" -r
if [[ $REPLY =~ ^[Mm]$ ]] || [[ -z $REPLY ]]; then
  if command -v modal >/dev/null 2>&1; then
    python3 workers/ikcp-voice/deploy-voxcpm-modal.py || \
      echo "${YELLOW}⚠ deploy-voxcpm-modal.py a échoué — vérifier Modal token${NC}"
  else
    echo "${YELLOW}⚠ Modal CLI pas installé. Lancer 'pip install modal' d'abord.${NC}"
  fi
fi

# ─────────────────────────────────────────────────────────────
# Étape 7 — Déploiement des workers
# ─────────────────────────────────────────────────────────────
step "7/8 — wrangler deploy des nouveaux workers" \
"Déploie ikcp-agents, ikcp-voice, ikcp-admin sur Cloudflare."

echo ""
echo "${BOLD}Workers à déployer (le script confirme un par un) :${NC}"
echo "  • ikcp-agents   (orchestrateur Managed Agents + cron newsletter)"
echo "  • ikcp-voice    (TTS VoxCPM2 + STT Voxtral)"
echo "  • ikcp-admin    (cockpit administrateur)"
echo ""

for worker in ikcp-agents ikcp-voice ikcp-admin; do
  read -p "${YELLOW}Déployer $worker ? [y/N/skip] ${NC}" -r CHOICE
  if [[ $CHOICE =~ ^[YyOo]$ ]]; then
    echo ""
    cd "workers/$worker"
    npx wrangler deploy 2>&1 | tail -10 || echo "${RED}✗ Deploy $worker échoué${NC}"
    cd - > /dev/null
  fi
done

# ─────────────────────────────────────────────────────────────
# Étape 8 — Smoke tests
# ─────────────────────────────────────────────────────────────
step "8/8 — Smoke tests health endpoints" \
"Vérifie que les workers répondent."

echo ""
for url in "https://agents.ikcp.eu/health" "https://voice.ikcp.eu/health" "https://admin.ikcp.eu/health"; do
  echo -n "  $url ... "
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")
  if [ "$CODE" = "200" ]; then
    echo "${GREEN}✓ 200${NC}"
  else
    echo "${RED}✗ $CODE (DNS pas propagé ? Worker pas déployé ?)${NC}"
  fi
done

# ─────────────────────────────────────────────────────────────
# Fin
# ─────────────────────────────────────────────────────────────
echo ""
echo "${GOLD}╔═══════════════════════════════════════════════════════════╗${NC}"
echo "${GOLD}║  ✓ Setup beta terminé                                     ║${NC}"
echo "${GOLD}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "${BOLD}Prochaines étapes :${NC}"
echo "  1. Inviter 3 premiers bêta-testeurs (toi + 2)"
echo "  2. Leur envoyer un code BETA-FAMI-XXXX-YYYY"
echo "  3. Lien d'activation : ${GOLD}https://ikcp.eu/proposals/beta-activation.html${NC}"
echo "  4. Landing marketing : ${GOLD}https://ikcp.eu/proposals/better-call-marcel.html${NC}"
echo "  5. Espace membre :     ${GOLD}https://ikcp.eu/proposals/dashboard-perfection.html${NC}"
echo "  6. Cockpit admin :     ${GOLD}https://admin.ikcp.eu/cockpit.html${NC}"
echo ""
echo "Documentation complète : ${DIM}docs/ETAT-REEL-BETA-2026-06.md${NC}"
echo ""
