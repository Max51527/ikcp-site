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

### A. Coordonnées fiche (Paramètres de la fiche → Coordonnées → Modifier) — 1 min
- E-mail : `maxime@ikcp.fr` · Site Web : `https://ikcp.eu` · Téléphone : vide.

### B. Classification du contenu (questionnaire IARC) — 3 min
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
**Reco Claude (à faire coder demain, ~45 min)** : compte démo + code d'examen :
- secret worker `DEMO_ACCESS_CODE`, compte `demo-review@ikcp.eu` (tier premium, données fictives),
- sur /app/index : si e-mail = demo-review@ikcp.eu ET code fourni → jeton direct sans e-mail.
- Puis remplir : « Toutes les fonctionnalités ne sont pas accessibles sans identifiants » + username `demo-review@ikcp.eu` + le code + instructions EN/FR.
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
