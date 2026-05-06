@echo off
setlocal
echo ==============================================
echo   IKCP-CLIENT — Setup espace client portal
echo ==============================================
echo.

cd /d "%~dp0"

REM 0. Install wrangler local si manquant
if not exist node_modules\wrangler (
  echo === Install wrangler ===
  call npm install --save-dev wrangler
  if errorlevel 1 goto :error
)

REM 1. Verif login Cloudflare
echo === Login Cloudflare ===
call npx wrangler whoami >nul 2>&1
if errorlevel 1 (
  call npx wrangler login
  if errorlevel 1 goto :error
)

REM 2. Créer D1 si pas déjà fait
echo.
echo === D1 database ===
echo Si 'ikcp-client-db' n'existe pas encore, créez-la :
echo   npx wrangler d1 create ikcp-client-db
echo Puis copiez l'ID retourné dans wrangler.toml (database_id).
echo.

REM 3. Créer KV
echo === KV namespace ===
echo Si TOKENS n'existe pas encore :
echo   npx wrangler kv namespace create CLIENT_TOKENS
echo Puis copiez l'ID dans wrangler.toml (kv_namespaces.id).
echo.

echo Quand wrangler.toml est rempli, appuyez sur ENTREE pour continuer...
pause >nul

REM 4. Migrate schema
echo === Migration schema D1 ===
call npx wrangler d1 execute ikcp-client-db --file=schema.sql --remote
if errorlevel 1 (
  echo XX Migration échouée — vérifiez database_id dans wrangler.toml
  goto :error
)

REM 5. Pousser les secrets
echo.
echo === Secrets ===
echo Generation JWT_SECRET (64 chars random)...
for /f "tokens=*" %%i in ('powershell -Command "[Convert]::ToHexString((1..32 ^| ForEach-Object {Get-Random -Maximum 256}))"') do set JWT=%%i
echo %JWT% | call npx wrangler secret put JWT_SECRET
if errorlevel 1 goto :error

echo.
echo Maintenant la cle Resend (depuis https://resend.com/api-keys) :
call npx wrangler secret put RESEND_API_KEY
if errorlevel 1 goto :error

REM 6. Deploy
echo.
echo === Deploy worker ===
call npx wrangler deploy
if errorlevel 1 goto :error

echo.
echo ==============================================
echo  OK ! Worker ikcp-client deploye.
echo  URL : https://ikcp-client.maxime-ead.workers.dev
echo  Domaine custom : add via Dashboard
echo                   (Workers - ikcp-client - Domains)
echo                   ex : client.ikcp.eu
echo ==============================================
pause
exit /b 0

:error
echo.
echo XX ERREUR. Voir messages ci-dessus.
pause
exit /b 1
