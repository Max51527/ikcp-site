# Play Console — configuration restante (kit prêt-à-coller)

> État au 7 juillet 2026, session Claude. **6 des 11 tâches faites par Claude** (voir ✅).
> URL : Play Console → Marcel IA → Tableau de bord → « Terminer la configuration de votre appli ».

## ✅ Déjà enregistré (ne pas refaire)
1. **Règles de confidentialité** = `https://ikcp.eu/politique-confidentialite`
2. **Annonces** = Non, pas d'annonces
3. **Applis gouvernementales** = Non
4. **Fonctionnalités financières** = « Mon appli ne fournit aucune fonctionnalité financière » (liste 100 % transactionnelle : banque/prêts/paiements/trading — Marcel informe, n'exécute rien)
5. **Applis de santé** = « Mon appli ne propose aucune fonctionnalité de santé »
6. **Catégorie** = Appli · **Finance** (paramètres de la fiche)

## 🔲 Restant — réponses préparées

### A. Coordonnées fiche — ✅ FAIT (7 juil.) : e-mail maxime@ikcp.fr + site https://ikcp.eu enregistrés.

### B. Classification du contenu (questionnaire IARC) — ⚠️ À FAIRE EN MANUEL (3 min)
> Le renderer de CE formulaire gèle l'automatisation (champ e-mail refuse la saisie pilotée, aux 2 sessions). À remplir à la main :
- E-mail : `maxime@ikcp.fr` · Catégorie : **« Tous les autres types d'applications »** (déjà pré-rempli par Claude, cliquer Suivant).
- Questionnaire : répondre **Non à tout** (violence, sexualité, langage, substances, jeux d'argent, contenu généré par utilisateurs*, achat de biens numériques → **Oui** pour « produits numériques » si demandé (abonnement Premium), partage de position → Non, infos personnelles → l'app collecte e-mail → suivre l'intitulé exact ; en cas de doute répondre au plus factuel).
- Résultat attendu : PEGI 3 / Tous publics.
- *Le chat Marcel n'est pas du « contenu partagé entre utilisateurs » (conversation privée avec l'IA) → Non.

### C. Sécurité des données (Data safety) — 10 min, le plus long
Déclarer **collecte** : 
- **Adresse e-mail** (obligatoire, finalité : gestion du compte/connexion) — chiffrée en transit, suppression sur demande (bouton dans /app/profil), NON partagée avec des tiers.
- **Infos financières saisies par l'utilisateur** (déclaratif patrimoine) : stockées côté serveur (D1 Paris) pour la synchronisation — finalité : fonctionnalité de l'app. Non partagées, non vendues.
- **Identifiants** : jeton de session. Pas de localisation, pas de contacts, pas de pub, pas de vente de données, pas de données partagées avec des tiers.
- Chiffrement en transit : OUI. Mécanisme de suppression : OUI (profil → Supprimer mon compte).

### D. Informations de connexion (testing credentials) — DÉCISION REQUISE
Notre connexion = lien e-mail → l'examinateur Google ne peut pas recevoir nos e-mails.
**✅ CODÉ (7 juil. soir)** : endpoint `POST /auth/demo` (gated par secret `DEMO_ACCESS_CODE`, rate-limit 5/h/IP, compte `demo-review@ikcp.eu` premium + données fictives seedées) + page `ikcp.eu/app/index.html?review=1` (champ « Reviewer access »).
**Reste 1 geste Maxime** : lancer `pose-code-demo.ps1` (fenêtre préparée) → génère le code + le pose sur le worker + le copie dans le presse-papiers.
**Puis remplir dans Play Console** : « Tout ou partie des fonctionnalités sont limitées » → username `demo-review@ikcp.eu` · password = le code · instructions : `Open https://ikcp.eu/app/index.html?review=1 , enter the access code in the "Reviewer access" box, tap "Entrer". You will be logged into a demo account (fictional data).`
⚠️ Tâche **bloquante pour « Cible et contenu »** (Google l'exige avant).

### E. Cible et contenu — 1 min (après D)
- Tranche d'âge : **18 ans et plus** uniquement. Pas d'attrait pour les enfants.

### F. Fiche Play Store (Présence sur le Play Store → Fiche principale)
- **Nom** : Marcel IA
- **Description courte (80c)** : `Votre copilote patrimonial. Vos chiffres, vos pistes, vos décisions.`
- **Description longue** : reprendre le pitch : app patrimoniale pour dirigeants, libéraux, créateurs, sportifs ; cartographie de votre société par SIREN ; cockpit patrimoine ; simulateurs (barèmes 2026 vérifiés) ; veille augmentée ; information patrimoniale, jamais un conseil personnalisé (art. L.541-1 CoMoFi) ; données hébergées en France. ORIAS 23001568.
- **Visuels PRÊTS** dans `Desktop\Marcel-Play-Assets\` :
  - `feature-graphic-1024x500.png` (bannière)
  - 5 captures téléphone 412×915 (dashboard, patrimoine, univers, simulateurs, marcel)
  - Icône 512 : `app/icons/icon-512.png` du site (déjà dans le repo)
- Upload = drag-drop Maxime (Claude ne peut pas téléverser de fichiers locaux).

## Rappels
- Le **Suivi (Monitor)** et le vrai nom « Marcel IA » pour les testeurs s'activent quand la configuration est terminée.
- La question **Play Billing** (Google exige sa facturation pour les biens numériques dans les apps du Store) reste à trancher AVANT la publication publique — pas bloquant pour les tests internes. Options : masquer le paiement dans la TWA (upgrade via le site uniquement) ou intégrer Play Billing.
