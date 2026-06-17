# État réel de la stack IKCP — Beta été 2026

> Mémo 1 page pour Maxime, à relire avant tout RDV prospect / partenaire /
> investisseur. Tient en 5 minutes de lecture. Mis à jour le 16 juin 2026.
>
> © 2026 IKCP — IKIGAÏ Conseil Patrimonial · ORIAS 23001568

---

## Ce qui marche (testé en prod)

```
✅ ikcp-marcel       — Marcel chat Sonnet 4.6, tier-aware Opus 4.7 pour FO
✅ ikcp-codex        — Sub-agent fiscal Opus 4.7
✅ ikcp-pappers      — Cartographie SIREN (cache KV 1h)
✅ ikcp-temoin       — Audit log MIF II D1 Paris
✅ ikcp-client       — Magic-link auth + Stripe + RGPD export/delete
✅ ikcp.eu           — 93 pages SEO Ardèche + Sveltia CMS
```

## Ce qui est codé mais jamais utilisé en prod

```
🟡 ikcp-agents       — Orchestrateur 13 agents Managed Anthropic (jamais
                       déployé, 0 session traitée, custom_tool_use jamais
                       dispatché vers MCP sub-agents)
🟡 ikcp-voice        — TTS VoxCPM2 + STT Voxtral (workers déployé mais
                       VOXCPM_API_URL pas encore set car Modal pas provisionné)
🟡 ikcp-admin        — Cockpit Maxime (déployé ? pas sûr, auth GitHub à wirer)
🟡 ikcp-batisseur    — déployé mais ANTHROPICAPIKEY manquant → live:false
                       dans Marcel orchestrateur
🟡 13 agents YAML    — créés en YAML, jamais envoyés à Anthropic via ant CLI
🟡 Memory stores     — endpoint codé, jamais créé un seul store
🟡 Newsletter cron   — code prêt (vendredi 10h) — risque sur le 1er vendredi
🟡 Vision drag-drop  — code prêt côté composant, jamais testé bout-en-bout
🟡 App Capacitor     — config prête, jamais buildée localement
```

## Ce qui n'est PAS prêt pour beta payant

```
❌ DPA Anthropic Enterprise + ZDR     — Maxime doit signer
❌ Compte Stripe France activé        — Maxime doit créer
❌ 3 prix Stripe à créer              — STRIPE_PRICE_DECOUVERTE/AUGMENTE/BESPOKE
❌ Yousign lettre mission eIDAS       — Maxime doit souscrire
❌ Avenant RC pro mentionnant IA      — Maxime appelle son assureur
❌ DPO externalisé désigné            — Captain DPO 99€/mois recommandé
❌ Onboarding KYC LCB-FT              — Onfido ou France Connect+
❌ App Store + Play Store soumissions — risque rejet Apple 4.2 si Capacitor
```

## La beta gratuite, elle, peut démarrer SANS ces 8 bloqueurs

Pour 25 familles fondatrices en gratuit (juin-août 2026), il suffit de :

1. **Choisir 5 agents Managed MVP** (pas les 13) :
   - documents (OCR avis IR / Kbis)
   - patrimoine (analyse 360°)
   - transmission (donations / Dutreil)
   - fiscalite-impots (extraction case par case 2042)
   - reporting (DER trimestriel)
2. **Provisionner Anthropic** (DPA standard suffit pour beta non-payant)
   - `ant auth login` puis `ant beta:agents create` × 5
3. **Déployer les 3 workers manquants** (ikcp-agents, ikcp-voice, ikcp-admin)
4. **Modal.run pour VoxCPM2** (script `deploy-voxcpm-modal.py` existe)
5. **Provisionner les secrets** (~15 secrets total via `wrangler secret put`)
6. **DNS Cloudflare** 3 sous-domaines (agents, voice, admin)
7. **Sélectionner 3 premiers bêta-testeurs** dans ton réseau (toi + 2)
8. **Lancer la cohort** via `/proposals/beta-activation.html` (codes BETA-FAMI-XXXX)

Time-to-beta : **2-3 semaines** si Maxime fait sa part 6h/semaine.

## Indicateurs cible fin août 2026

- **25 bêta-testeurs** actifs (gratuit, NDA signé via `/legal/beta-nda.html`)
- **0 facture émise** (volontairement — pas Stripe activé encore)
- **≥ 3 témoignages écrits** réutilisables pour la phase commerciale septembre
- **≥ 100 retours feedback** in-app collectés (via `<marcel-feedback>`)
- **≥ 5 cas d'usage réels** documentés (1 famille = 1 cas)
- **0 incident** RGPD ou MIF II

## Lancement commercial : septembre 2026

Quand les 25 bêta-testeurs ont validé pendant 2 mois, on bascule :

- **3 d'entre eux** se convertissent en Découverte 1 800€ → 5 400€ encaissés septembre
- **Phase Stripe + Yousign + Onfido** activée (les 8 bloqueurs sont alors traités)
- **Cohort 2 (payant)** : 10 familles Augmenté 6 800€ d'ici fin décembre 2026
- **ARR cible 31/12/2026** : ~80-100k€

## Les 3 risques majeurs à surveiller cet été

1. **Anthropic plante 48h** → newsletter cron rate, agents inutilisables.
   Pas de circuit breaker au-delà des 3 échecs consécutifs.
   **Mitigation** : monitoring via `marcel-feedback` (les bêta-testeurs
   alertent) + log push_log dans le cockpit.

2. **L'app Capacitor n'est jamais buildée** → impossible TestFlight.
   **Mitigation** : skipper Capacitor pour cet été, PWA "Add to Home Screen"
   suffit. iOS 16.4+ supporte les Web Push.

3. **Un bêta-testeur partage publiquement** un screenshot du dashboard.
   **Mitigation** : NDA signé via `/legal/beta-nda.html` (traçabilité dans
   ikcp-feedback). Pas un dispositif juridique blindé mais un signal.

## Que faire si Maxime tombe malade 2 semaines

SPOF Maxime = la beta s'arrête. Aucun assistant n'a accès aux secrets
Cloudflare ni à la console Anthropic.

**Mitigation Phase Beta** : documenter dans un fichier chiffré
(1Password, Bitwarden) l'inventaire des comptes/secrets + procédure
d'urgence (qui contacter : assistante, fils, comptable, avocat).

**Mitigation Phase Commerciale** : recruter un assistant admin OU une
co-fondatrice tech à part le 1er M€ d'ARR.

## Récap : que faire cette semaine (16-22 juin)

| Maxime | Claude | Durée |
|---|---|---|
| Email DPA Anthropic (standard suffit pour beta) | Vérifier les pages frontend | 30 min |
| Compte Modal.run + lancer `deploy-voxcpm-modal.py` | — | 1h |
| Sélectionner 3 premiers bêta-testeurs dans réseau | Page beta-activation.html (faite ✅) | 30 min |
| Tester `npx wrangler deploy` sur 1 worker | NDA digital (fait ✅) | 30 min |
| Désigner DPO Captain DPO (99€/mois) | Backup memory stores (fait ✅) | 30 min |
| — | Composant feedback in-app (fait ✅) | — |

Total côté Maxime : **3h**. Pour livrer la beta cet été : **15h** sur les
4 prochaines semaines.

---

*Mémo État Réel v1.0 · 2026-06-16*
*© IKCP — IKIGAÏ Conseil Patrimonial · ORIAS 23001568 · CPI L111-1*
