"""
deploy-voxcpm-modal.py — Serveur VoxCPM2 serverless GPU sur Modal.com
=====================================================================

Prérequis :
  pip install modal
  modal token new          ← crée un compte + token (gratuit pour commencer)

Déploiement :
  modal deploy deploy-voxcpm-modal.py

Résultat :
  → URL publique du type : https://xxx--voxcpm-tts.modal.run
  → Copier cette URL dans VOXCPM_API_URL (wrangler.toml ou secret Cloudflare)

Coût estimé (Modal.com, GPU A10G) :
  → ~0,000550 $/seconde GPU actif
  → VoxCPM2 = ~0,3 secondes RTF sur A10G = ~2 tokens audio/seconde
  → Une réponse Marcel typique (300 mots, 20s audio) ≈ 6s GPU ≈ 0,0033$
  → Première frappe (cold start) : +15-30s de warm-up

API exposée (OpenAI-compatible) :
  POST /v1/audio/speech
    { "model": "openbmb/VoxCPM2", "input": "texte", "voice": "default" }
    → audio/wav 48kHz

  GET  /v1/models
    → [{ "id": "openbmb/VoxCPM2" }]

  GET  /health
    → { "status": "ok", "model": "VoxCPM2" }

Note souveraineté :
  Modal.com propose des régions EU. Ajouter region="eu-central-1" (Frankfurt)
  si requis pour conformité RGPD stricte (option payante).
"""

import modal
from pathlib import Path

# ── Image Docker avec VoxCPM2 ──────────────────────────────────────────────
image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "voxcpm>=0.1.0",
        "fastapi>=0.111.0",
        "uvicorn[standard]>=0.29.0",
        "soundfile>=0.12.1",
        "numpy>=1.26.0",
        "torch>=2.5.0",
        "torchaudio>=2.5.0",
    )
)

app = modal.App("ikcp-voxcpm-tts", image=image)

# Volume pour cache des poids modèle (évite re-téléchargement à chaque cold start)
model_volume = modal.Volume.from_name("voxcpm-model-cache", create_if_missing=True)
MODEL_CACHE_DIR = Path("/model-cache")

# ── Classe principale avec cycle de vie GPU ────────────────────────────────
@app.cls(
    gpu="A10G",                          # GPU A10G (~8GB VRAM, adapté VoxCPM2)
    volumes={str(MODEL_CACHE_DIR): model_volume},
    container_idle_timeout=120,          # Garde le container chaud 2 min après usage
    timeout=300,
)
class VoxCPMServer:
    @modal.enter()
    def load_model(self):
        """Chargement du modèle une seule fois par container."""
        import os
        os.environ["HF_HOME"] = str(MODEL_CACHE_DIR)
        from voxcpm import VoxCPM
        print("Chargement VoxCPM2...")
        self.model = VoxCPM.from_pretrained(
            "openbmb/VoxCPM2",
            cache_dir=str(MODEL_CACHE_DIR),
            load_denoiser=True,
        )
        self.sample_rate = self.model.tts_model.sample_rate  # 48000 Hz
        print(f"VoxCPM2 prêt — sample_rate={self.sample_rate}Hz")

    @modal.method()
    def synthesize(self, text: str, voice: str = "default", cfg_value: float = 2.0) -> bytes:
        """Synthèse texte → audio WAV (bytes)."""
        import io
        import soundfile as sf
        import numpy as np

        # Voice Design : si voice est une description textuelle, l'injecter comme prompt
        voice_prompt = None if voice in ("default", "", None) else voice

        wav = self.model.generate(
            text=text,
            voice_prompt=voice_prompt,
            cfg_value=cfg_value,
            inference_timesteps=10,  # 10 = bon équilibre vitesse/qualité
        )

        # Convertir en WAV bytes
        buf = io.BytesIO()
        sf.write(buf, wav, self.sample_rate, format="WAV")
        buf.seek(0)
        return buf.read()


# ── FastAPI web endpoint ────────────────────────────────────────────────────
@app.function()
@modal.asgi_app()
def web():
    from fastapi import FastAPI, HTTPException, Request
    from fastapi.responses import Response, JSONResponse
    import json

    api = FastAPI(title="IKCP VoxCPM2 TTS", version="1.0.0")
    server = VoxCPMServer()

    @api.get("/health")
    def health():
        return {"status": "ok", "model": "openbmb/VoxCPM2", "provider": "modal"}

    @api.get("/v1/models")
    def list_models():
        return {"data": [{"id": "openbmb/VoxCPM2", "object": "model"}], "object": "list"}

    @api.post("/v1/audio/speech")
    async def tts(request: Request):
        try:
            body = await request.json()
        except Exception:
            raise HTTPException(400, "JSON invalide")

        text = body.get("input", "").strip()
        if not text:
            raise HTTPException(400, "Champ 'input' requis")
        if len(text) > 5000:
            text = text[:5000]

        voice = body.get("voice", "default")

        try:
            audio_bytes = server.synthesize.remote(text=text, voice=voice)
        except Exception as e:
            raise HTTPException(502, f"Erreur VoxCPM2: {str(e)[:200]}")

        return Response(
            content=audio_bytes,
            media_type="audio/wav",
            headers={
                "X-Provider": "voxcpm2",
                "X-Model": "openbmb/VoxCPM2",
            },
        )

    return api
