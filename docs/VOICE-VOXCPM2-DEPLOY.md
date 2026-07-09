# 🎙️ Déployer la voix IA premium de Marcel (VoxCPM2 souveraine)

> Décision 9 juil. 2026 : voix souveraine premium (VoxCPM2 auto-hébergée).
> **Le code est déjà prêt** — worker `ikcp-voice` + client `voice.js`. Il ne manque
> qu'UNE chose : l'URL d'un serveur VoxCPM2 (`VOXCPM_API_URL`). Ce guide te dit comment.

---

## Ce qui est déjà fait (rien à coder)
- Worker `ikcp-voice` : `speakVoxCPM()` appelle `POST {VOXCPM_API_URL}/v1/audio/speech` (API standard type OpenAI) → renvoie l'audio.
- Client `app/js/voice.js` : `speakPremium()` lit cet audio ; nettoyage du texte (markdown/emojis/unités) déjà en place ; repli automatique sur la voix de l'appareil si le serveur est absent.
- Repli actuel (tant que VoxCPM2 n'est pas là) : voix de l'appareil, **optimisée** (meilleure voix neuronale + débit posé).

**Il reste 2 gestes** : (1) déployer un serveur VoxCPM2 quelque part, (2) me donner son URL (je pose le secret, ou tu le poses toi-même). C'est tout.

## Le choix d'hébergement (souveraineté vs simplicité)

VoxCPM2 est un modèle **open-source** — tu peux l'héberger où tu veux. Le compromis :

| Option | Souverain | Vitesse de mise en place | Coût |
|---|---|---|---|
| **A — Hébergeur GPU UE (recommandé, cohérent avec ton positionnement)** : Scaleway (🇫🇷), OVHcloud AI (🇫🇷) ou RunPod région EU | ✅ oui, données UE | ~1-2 h (créer une instance GPU, lancer le conteneur) | GPU à l'heure ou à l'usage |
| **B — Modal.com (le plus rapide)** : script `deploy-voxcpm-modal.py` déjà écrit | ⚠️ **non** (infra US) — contredit le claim « 100% souverain » | ~15 min (3 commandes) | ~0,003 $/réponse, à l'usage |

> ⚠️ Tu as choisi la voie **souveraine**. Modal est américain : à réserver éventuellement à un test rapide de qualité, PAS pour la prod si tu tiens au claim souverain. Pour la prod, vise l'**option A (UE)**.

## Option A — Serveur VoxCPM2 sur GPU souverain UE (recommandé)

Le worker attend une API **OpenAI-compatible** : `POST /v1/audio/speech` avec
`{ "model":"openbmb/VoxCPM2", "input":"texte", "voice":"default" }` → `audio/wav`.
N'importe quel serveur qui expose ça convient. Sur un GPU Scaleway/OVH :

1. Crée une instance GPU (ex. Scaleway **RENDER-S** ou OVH **AI Deploy**, région Paris) avec un GPU (L4/A10 suffit).
2. Sers VoxCPM2 derrière cette API (image Docker FastAPI). Le script `deploy-voxcpm-modal.py` du repo contient déjà la logique de synthèse VoxCPM2 (chargement du modèle + endpoint) — il se transpose en conteneur Docker : je peux te l'adapter en `Dockerfile` + `server.py` génériques quand tu me dis « adapte pour Scaleway/OVH ».
3. Récupère l'URL publique (ex. `https://mon-instance.fr-par.scw.cloud`).
4. **Donne-la-moi** → je pose `VOXCPM_API_URL` (+ `VOXCPM_API_KEY` si tu protèges le serveur) en secret sur le worker. Effet immédiat.

## Option B — Modal.com (test rapide, US, non souverain)

```bash
cd C:\Users\juven\ikcp-site\workers\ikcp-voice
pip install modal
modal token new                       # crée un compte Modal (gratuit au départ)
modal deploy deploy-voxcpm-modal.py   # → renvoie une URL https://xxx--voxcpm-tts.modal.run
```
Puis donne-moi l'URL → je pose le secret `VOXCPM_API_URL`.

## Une fois l'URL posée (les deux options)

- Sur `/app/marcel`, active « Mode premium » dans les réglages voix (tier Premium requis).
- Marcel parle alors avec la voix VoxCPM2 (naturelle, signature, identique sur tous les appareils).
- Vérif : `curl POST https://ikcp-voice.maxime-ead.workers.dev/tts -d '{"text":"Bonjour"}'` doit renvoyer un `audio/wav` volumineux (au lieu du 502 actuel).
- Voix disponibles : `default`, `formal`, `warm`, `energetic` (endpoint `/voices`).

## Coût & maîtrise
- Paiement **à l'usage** (uniquement quand un membre écoute), pas d'abonnement fixe.
- Le worker **met en cache** l'audio 7 jours (KV) : une même réponse n'est synthétisée qu'une fois.
- Anti-abus : plafond 120 TTS/h par IP déjà en place.

---
⚡ Prochaine étape : dis-moi **« adapte le déploiement pour [Scaleway/OVH/RunPod] »** et je te fournis le Dockerfile + server.py prêts, ou **« je pars sur Modal pour tester »** et je te guide sur les 3 commandes.
© 2026 IKCP — voix souveraine.
