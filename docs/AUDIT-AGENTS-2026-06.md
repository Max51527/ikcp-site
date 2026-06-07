# 🧠 Audit des agents IA — 2026-06-07

> Audit live (`/health` de chaque worker) + lien Anthropic Console.
> Interface temps réel : **`/app/agents`** (centre de contrôle).

---

## État par agent

| Agent | Rôle | Modèle | Fournisseur | Clé | Statut |
|---|---|---|---|---|---|
| **Marcel** (ikcp-chat) | Chef d'orchestre · point d'entrée | Sonnet 4.6 · Opus (FO) | Anthropic | ✅ | 🟢 |
| **Codex** | Fiscalité approfondie | Opus 4.7 | Anthropic | ✅ | 🟢 |
| **Hermès** | Transmission & succession | Opus 4.7 | Anthropic | ✅ | 🟢 |
| **Bâtisseur** | Patrimoine 360° multi-entités | Opus 4.7 | Anthropic | 🔴 **manquante** | 🟡 déployé, non relié |
| **Lifestyle ×9** | Art de vivre / conciergerie | Sonnet 4.6 | Anthropic | ✅ | 🟢 |
| **Veille** | Temps réel (loi de finances, jurisprudence) | Perplexity Pro | Perplexity | ✅ | 🟢 |
| **Voix** | STT (dictée) + lecture | STT/TTS | souverain | n/a | 🟢 |
| **Pappers** | Cartographie SIREN | API | Pappers FR | ✅ | 🟢 |
| **Client** | Auth · tiers · quotas · mémoire | D1/KV | Cloudflare | n/a | 🟢 |
| **Témoin** | Audit MIF II (D1 Paris) | D1 | Cloudflare | n/a | 🟢 (R2 off, admin_token off) |
| **Collector** | Cotations collection (cron) | cron | Cloudflare | n/a | 🟢 (rebrickable off) |

**Bilan : 10/11 agents IA opérationnels et reliés à Claude.** Seul Bâtisseur n'est pas relié.

---

## 🔴 Action requise (Maxime — credential, je ne peux pas la faire)
**Relier Bâtisseur à Claude Console :**
```bash
cd workers/ikcp-batisseur
npx wrangler secret put ANTHROPICAPIKEY   # coller la clé depuis console.anthropic.com/settings/keys
```
Puis dans `workers/ikcp-marcel/worker.js`, passer Bâtisseur en `live:true` (≈ ligne 54).
→ Bâtisseur devient le 11ᵉ agent actif (cartographie patrimoniale 360° en délégation).

## 🟡 À noter (non bloquant)
- **ikcp-feedback** : aucune intégration configurée (brevo/anthropic/d1 = false). **Doublon legacy** — le feedback bêta passe déjà par `ikcp-client`. → à supprimer au nettoyage.
- **Témoin** : R2 (stockage pièces) et admin_token non configurés — optionnels.
- **Collector** : clé Rebrickable (cote LEGO) non configurée — optionnel.

## 🔗 Anthropic Console (suivi)
- Usage & coût : https://console.anthropic.com/settings/usage
- Clés API : https://console.anthropic.com/settings/keys
- Limites : https://console.anthropic.com/settings/limits

## 💡 Reco modèles (coût/latence)
- Opus 4.7 réservé aux délégations complexes (Codex, Hermès, Bâtisseur) — coût ×5 vs Sonnet.
- Marcel en Sonnet par défaut ; Opus seulement en mode FO (premium). Surveiller la latence FO (≈20-26 s sur requêtes web) — cf. piste *streaming*.

---

© 2026 IKCP — Maxime Juveneton · ORIAS 23001568
