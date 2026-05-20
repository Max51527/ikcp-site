# TODO.md — Backlog vivant IKCP Site
> Source de vérité inter-sessions Claude Code.  
> Mettre à jour à chaque session : statut + date.  
> Format : `- [ ]` ouvert · `- [x]` fait · `- [~]` en cours · `- [!]` bloqué (action Maxime)

---

## 🔴 SPRINT EN COURS (semaine 20/05/2026)

- [x] Supprimer SIREN 947 972 436 du footer family-office.html *(2026-05-20)*
- [x] Marcel hero — bouton minimize touch target 44px + window.toggleMarcelCard exposé *(2026-05-20)*
- [x] body.marcel-open CSS patch — hero card se masque quand panel ouvert *(2026-05-20)*
- [x] askMarcel() unifié → chatbot-widget panel (vs inline modal allégé) *(2026-05-20)*
- [x] Markdown complet dans modal fallback via marked.parse() *(2026-05-20)*
- [x] Bouton "Mon Espace" dans nav principale + menu mobile *(2026-05-20)*
- [x] SPECIALISTS_REGISTRY aligné sur 12 noms FO (Bâtisseur, Codex, Architecte…) *(2026-05-20)*
- [x] System prompt Marcel — noms spécialistes générés dynamiquement *(2026-05-20)*
- [!] **DNS switch** : hPanel Hostinger → CNAME `@` = `ikcp-eu.pages.dev` *(attente Maxime)*
- [ ] **Déployer Marcel** après registry update : `cd workers/ikcp-marcel && npx wrangler deploy`

---

## 🟡 VOICE MARCEL (#7)

- [!] **Maxime** : `npx wrangler secret put ELEVENLABS_API_KEY` (dans workers/ikcp-voice/)
- [!] **Maxime** : `npx wrangler secret put MISTRAL_API_KEY` (optionnel — STT Voxtral)
- [ ] Déployer ikcp-voice worker : `cd workers/ikcp-voice && npx wrangler deploy`
- [ ] Brancher TTS dans index.html : après réception réponse Marcel, appel ikcp-voice → lecture audio
- [ ] Évaluer VoxCPM API (voxcpm.net) comme alternative à ElevenLabs
- [ ] Bouton 🔊 dans le chatbot-widget panel pour activer la lecture vocale

---

## 🔵 SPRINT 2 — Marcel ↔ Codex délégation automatique (#8)

- [ ] Implémenter le routing automatique Marcel → Codex pour questions fiscales complexes
- [ ] Pattern : Marcel détecte "arbitrage multi-dispositifs" / "jurisprudence" → `delegate_to_specialist('codex', ...)`
- [ ] Tests : 5 questions de validation (apport-cession + Dutreil, démembrement usufruit, etc.)
- [ ] Documenter les seuils de délégation dans workers/CLAUDE.md

---

## 🔵 SPRINT 3 — App /app/ flow complet

- [ ] Flow bêta : homepage → "Rejoindre la bêta" CTA visible → /app/beta-invite.html
- [ ] Magic link auth : déployer ikcp-client worker (D1 + secrets Stripe)
  - [!] Créer D1 : `npx wrangler d1 create ikcp-client-db --location weur`
  - [!] Stripe price IDs dans workers/ikcp-client/wrangler.toml (remplacer `price_REPLACE_*`)
- [ ] /app/ navigation : sidebar + breadcrumb cohérent entre toutes les pages app/
- [ ] PWA install prompt : tester sur iOS/Android

---

## 🔵 SPRINT 4 — Workers lifestyle (Architecte, Stratège, Curateur, Concierge…)

- [ ] Déployer ikcp-lifestyle worker mutualisé (1 worker = 8 agents via routing interne)
- [ ] Implémenter routing agent par `X-Agent-Name` header ou param JSON
- [ ] Tester délégation Marcel → Architecte sur "IFI + SCI"
- [ ] Tester délégation Marcel → Curateur sur "valeur montre collection"

---

## 🔵 SPRINT 5 — Hermès (transmission) + Bâtisseur (cartographie 360°)

- [ ] Déployer ikcp-hermes (Opus 4.7, transmission Dutreil, donation-partage)
- [ ] Déployer ikcp-batisseur (Opus 4.7, bilan 360° multi-entités, Pappers intégré)
- [ ] Brancher Bâtisseur dans le funnel SIREN (proposals/marcel-funnel.html)

---

## ⏸ EN ATTENTE / PAUSE

- [ ] ikcp-universign : signature eIDAS (reprendre Sprint 6)
- [ ] Decap CMS : configurer site_domain dans admin/config.yml (Netlify Identity)
- [ ] ikcp-feedback D1 : `npx wrangler d1 create ikcp-feedback-db --location weur`
- [ ] SEO quick wins : réécrire titles+metas top 5 pages (CTR 2% → cible 8%)
- [ ] Backlog SaaS B2B (white-label CGP) : attendre 3 familles fondatrices signées + 60j actives

---

## ✅ DÉJÀ LIVRÉ (archive)

- [x] 4 pages légales : mentions-légales, RGPD, CGU, DER MIF II
- [x] Marcel web search natif + few-shot + logging KV
- [x] Codex sub-agent fiscal (Opus 4.7) · LIVE
- [x] ikcp-temoin audit log D1 Paris · LIVE
- [x] ikcp-pappers cartographie SIREN · LIVE
- [x] og:image correct sur toutes les pages
- [x] deploy-workers.yml fix (path typo worker → workers)
- [x] DER acceptance loggée dans ikcp-temoin (MIF II 5 ans)
- [x] Espace bêta fondateurs : app/beta-invite.html + feedback widget dashboard
- [x] SIREN personnel retiré de tous les mockups client-facing

---

*Dernière mise à jour : 2026-05-20 · Par Claude Code*
