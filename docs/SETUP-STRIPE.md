# 💳 Activer les paiements Stripe — guide Maxime

> Le code est prêt (Checkout + Portail + Webhook dans `ikcp-client`, UI dans le profil).
> Il reste à créer le compte, les produits, et poser les secrets. **~20 min, à faire toi-même** (Claude ne touche jamais aux clés de paiement).

---

## Étape 1 — Compte Stripe (lié à ton compte PRO)
1. [dashboard.stripe.com](https://dashboard.stripe.com) → créer le compte (ou se connecter).
2. Renseigner l'entreprise (IKCP / SIREN 947 972 436), le **compte bancaire PRO** pour les versements (KYC Stripe : quelques minutes).
3. Reste en **mode Test** pour valider, puis bascule en **mode Live** quand tout marche.

## Étape 2 — Créer le produit & les prix
Produits → **+ Add product** :
- **Nom** : `IKCP Premium`
- **Prix 1** : mensuel récurrent — ex. **59 €/mois** → copie l'ID `price_...` (= `PREMIUM_MONTHLY`)
- **Prix 2** : annuel récurrent — ex. **590 €/an** (2 mois offerts) → copie l'ID `price_...` (= `PREMIUM_YEARLY`)

*(FO = « sur recommandation », pas de produit self-serve : accordé via la console admin.)*

## Étape 3 — Clé API
Développeurs → **Clés API** → copie la **clé secrète** (`sk_test_...` en test, `sk_live_...` en live).

## Étape 4 — Webhook
Développeurs → **Webhooks** → **+ Add endpoint** :
- **URL** : `https://ikcp-client.maxime-ead.workers.dev/stripe/webhook`
- **Événements** : `checkout.session.completed`, `customer.subscription.deleted`, `invoice.payment_failed`
- Crée → copie le **Signing secret** (`whsec_...`)

## Étape 5 — Poser les secrets sur ikcp-client
Cloudflare → Workers & Pages → **ikcp-client** → Settings → **Variables and Secrets** → + Add (type **Secret**) :

| Nom du secret | Valeur |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_...` (étape 3) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` (étape 4) |
| `STRIPE_PRICE_PREMIUM_MONTHLY` | `price_...` mensuel (étape 2) |
| `STRIPE_PRICE_PREMIUM_YEARLY` | `price_...` annuel (étape 2) |

*(Optionnel : `FRONT_URL` = `https://ikcp.eu` — déjà la valeur par défaut.)*
→ Deploy. Les secrets sont actifs immédiatement (pas besoin de redéployer le code).

## Étape 6 — Tester (mode Test)
1. Connecte-toi à l'espace membre en tier `free` (ou crée un compte test).
2. Profil → **Abonnement** → « Passer Premium · mensuel ».
3. Page Stripe → carte test `4242 4242 4242 4242`, date future, CVC quelconque.
4. Retour dashboard → ton tier doit passer **Premium** (le webhook a fait l'upgrade).
5. Profil → « Gérer mon abonnement » → le portail Stripe s'ouvre.

## ✅ Quand tout marche en test → bascule en Live
Refais étapes 3-5 avec les clés **Live** (`sk_live_...`, nouveau `whsec_...`, prix Live).

---

⚠️ **Avant le 1ᵉʳ paiement réel** : valider les CGV (`/cgv.html`) avec un conseil juridique. Claude n'est pas avocat — les CGV sont un projet à valider.

© 2026 IKCP · ORIAS 23001568
