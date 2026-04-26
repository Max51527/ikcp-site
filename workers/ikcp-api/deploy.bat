@echo off
echo ========================================
echo   IKCP-API Worker - Deploy Script
echo ========================================
echo.
cd /d "%~dp0"
echo === 1. Wrangler login (le navigateur va s'ouvrir) ===
call npx wrangler login
if errorlevel 1 goto :error
echo.
echo === 2. Deploy du worker ===
call npx wrangler deploy
if errorlevel 1 goto :error
echo.
echo ========================================
echo  OK ! Worker deploye sur :
echo  https://ikcp-api.maxime-ead.workers.dev
echo.
echo  Etapes suivantes (manuelles) :
echo  1. Cloudflare Dashboard - Workers - ikcp-api - Settings - Variables and Secrets
echo  2. Ajouter les secrets : NOTION_TOKEN, RESEND_API_KEY
echo  3. Ajouter les variables : NOTION_DB_ID, RESEND_FROM, RESEND_TO
echo ========================================
pause
exit /b 0

:error
echo.
echo XX ERREUR pendant le deploy. Voir ci-dessus.
pause
exit /b 1
