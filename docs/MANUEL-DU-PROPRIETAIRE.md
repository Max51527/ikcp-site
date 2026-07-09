# 📕 Manuel du propriétaire — Marcel IA / ikcp.eu

> Le document de passation. Tout ce qu'il faut pour faire vivre l'application
> **sans développeur et sans abonnement IA** au quotidien.
> Écrit le 12 juillet 2026. À relire une fois par an (voir calendrier).

---

## 1. Ce qui tourne TOUT SEUL (aucune action de ta part)

| Automatisme | Quand | Où le voir |
|---|---|---|
| Mise en ligne après publication | à chaque « Publier » | github.com/Max51527/ikcp-site/actions |
| **Gardien de santé** (14 services + site + app Android) | tous les jours 9h | ⚠️ Si panne → **GitHub t'envoie un e-mail** « Health Monitor failed » |
| Sauvegarde des bases clients → OneDrive | tous les jours 7h30 | OneDrive\IKCP-Backups (30 j de rétention) |
| Remontée dans le temps des bases (Time Travel) | permanent, 30 j | dashboard Cloudflare → D1 |
| Veille marchés/fiscale (digest) | tous les jours 6h | app → Veille |
| Routine SEO | tous les jours 8h | tâche Windows « IKCP-SEO-Daily » |
| Mise à jour de l'app sur les téléphones | automatique (l'app affiche le site) | fermer/rouvrir l'app ×2 |

## 2. Ta boîte à outils (bureau)

- **PILOTAGE-DEV.html** — le cockpit : tout part de là.
- **Voir-et-modifier-mon-app** — travailler en local, invisible du public.
- **Publier-mes-modifications** — publier avec garde-fous (montre les changements, bloque les secrets, demande confirmation).
- **Annuler-la-derniere-publication** — retour arrière en 1 min, rien n'est perdu.
- **Marcel-Play-Assets\** — visuels du Play Store (bannière + captures).

## 3. Si le gardien t'envoie un e-mail de panne

1. **Attends 1 h et relance** : GitHub → Actions → Health Monitor → « Re-run ». 9 fois sur 10 c'est un incident Cloudflare passager qui se répare seul.
2. Toujours en panne ? Regarde QUEL service est ❌ dans le log du run :
   - `ikcp-chat` (Marcel) / agents → dashboard Cloudflare → Workers → le worker → Logs. Cause fréquente : crédit Mistral épuisé → console.mistral.ai → recharger.
   - `ikcp-veille` → crédit Perplexity.
   - `ikcp-client` (connexion/paiement) → vérifier Stripe status.stripe.com et Resend resend.com.
   - `site-vitrine` / `app-login` → dashboard Cloudflare → Pages.
3. Rien ne marche ? → session Claude ponctuelle (voir §6).

## 4. Pannes courantes et remèdes (sans développeur)

| Symptôme | Remède |
|---|---|
| « Paiement momentanément indisponible » | dashboard.stripe.com → le paiement/produit est-il actif ? Sinon §6 |
| L'app du téléphone montre une vieille version | fermer/rouvrir l'app **2 fois** (le cache se renouvelle au 2ᵉ) |
| Un membre ne reçoit pas son lien de connexion | resend.com → Logs (limite : 3 envois/h par adresse — anti-abus normal) |
| Le digest veille ne se met plus à jour | crédits Perplexity, puis relancer le workflow veille dans Actions |
| J'ai publié une bêtise | bouton **Annuler-la-derniere-publication** |
| J'ai supprimé des données client par erreur | D1 Time Travel (30 j) via §6, ou OneDrive\IKCP-Backups |

## 5. 📅 Calendrier du propriétaire

**Chaque mois (10 min)**
- Un coup d'œil : dernier « Health Monitor » vert ? dernier backup OneDrive daté d'aujourd'hui ?
- Crédits API : console.mistral.ai · Perplexity · Resend (100 mails/j gratuits) · Pappers.

**Chaque JANVIER — le plus important pour un CGP ⚠️**
- **Millésime fiscal** : les barèmes (IR, donations, PFU, abattements) sont codés avec les valeurs de la loi de finances. Chaque nouvelle année → session Claude : *« mets à jour les barèmes fiscaux [année] dans les simulateurs et les prompts des agents, sources gouvernementales à l'appui »*. Sans ça, les simulateurs deviennent FAUX (risque professionnel).
- Renouvellement du domaine ikcp.eu (registrar) + vérifier l'échéance de la carte bancaire chez Cloudflare/Stripe.

**Ne JAMAIS perdre**
- Le **keystore Android** (signature de l'app, irremplaçable) — Bitwarden + OneDrive chiffré.
- L'accès au compte Google Play (5546705285337918558) et au compte Cloudflare.

## 6. Faire appel à une session Claude ponctuelle (le bon réflexe)

Pas besoin d'un gros abonnement à l'année : une session ponctuelle (petit palier, ou réabonnement d'un mois quand un chantier le justifie) suffit. Le projet est **auto-documenté** : ouvre Claude Code dans `C:\Users\juven\ikcp-site` et démarre par :

> « Lis CLAUDE.md, docs/INFRA-PRODUCTION.md et docs/MANUEL-DU-PROPRIETAIRE.md. Problème : [symptôme + capture]. »

La session retrouve tout le contexte en 5 minutes (règles, architecture, mémoire du projet).

## 7. Où est quoi (les 7 tableaux de bord)

| Service | Rôle | URL |
|---|---|---|
| GitHub | code source + publications + gardien | github.com/Max51527/ikcp-site |
| Cloudflare | hébergement site + services + bases | dash.cloudflare.com (compte eaddc4cc…) |
| Stripe | paiements/abonnements clients | dashboard.stripe.com |
| Play Console | app Android | play.google.com/console |
| Resend | e-mails de connexion | resend.com |
| Mistral | cerveau des agents (souverain) | console.mistral.ai |
| Notion | doctrine + retours bêta | notion.so |

---
© 2026 IKCP — document vivant, à mettre à jour à chaque évolution majeure.
