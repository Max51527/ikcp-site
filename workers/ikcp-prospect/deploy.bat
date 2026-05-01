@echo off
echo ========================================
echo   IKCP-PROSPECT Worker - Deploy v1.3
echo ========================================
echo.
cd /d "%~dp0"

REM Install local wrangler if missing
if not exist node_modules\wrangler (
  echo === Installation de wrangler ===
  call npm install --save-dev wrangler
  if errorlevel 1 goto :error
)

REM Login si besoin
echo === Verification login Cloudflare ===
call npx wrangler whoami
if errorlevel 1 (
  echo === Login Cloudflare requis ===
  call npx wrangler login
  if errorlevel 1 goto :error
)

echo.
echo === Deploy ikcp-prospect v1.3 ===
call npx wrangler deploy
if errorlevel 1 goto :error

echo.
echo ========================================
echo  OK ! Worker ikcp-prospect deploye
echo  v1.3 — Marcel synthesis email actif
echo ========================================
pause
exit /b 0

:error
echo.
echo XX ERREUR pendant le deploy. Voir messages ci-dessus.
pause
exit /b 1
