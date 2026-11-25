@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"
title CoD Configurator - Publish a release

rem ------------------------------------------------------------------
rem  Publishes a new version so the in-app "Check for updates" button
rem  finds it. Needs Git and the GitHub CLI (run: winget install GitHub.cli
rem  then: gh auth login). Run push.bat once first.
rem ------------------------------------------------------------------

where git >nul 2>nul
if errorlevel 1 (
  echo  Git is not installed. https://git-scm.com/download/win
  pause
  exit /b 1
)
where gh >nul 2>nul
if errorlevel 1 (
  echo.
  echo  The GitHub CLI is needed to publish releases.
  echo    1. Run:  winget install GitHub.cli
  echo    2. Close this window, open a new one, run:  gh auth login
  echo    3. Run release.bat again.
  echo.
  pause
  exit /b 1
)
if not exist ".git" (
  echo  Run push.bat first so this folder is connected to GitHub.
  pause
  exit /b 1
)

set "CUR="
for /f "tokens=2 delims='" %%v in ('findstr /c:"var VERSION" "src\data.js"') do set "CUR=%%v"
echo.
echo  Current version: !CUR!

:ask
set "NEW="
set /p "NEW=New version number (for example 1.0.1): "
if not defined NEW goto ask
echo !NEW!| findstr /r /c:"^[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*$" >nul
if errorlevel 1 (
  echo  Use the form 1.2.3 and try again.
  goto ask
)

set "NOTES="
set /p "NOTES=What is new? (one line): "
if not defined NOTES set "NOTES=Update"
set "NOTES=!NOTES:"=!"

set "ART=Y"
set /p "ART=Include the wallpapers in the download zip? (Y/n): "

powershell -NoProfile -ExecutionPolicy Bypass -File "tools\setversion.ps1" -Version "!NEW!"
if errorlevel 1 (
  echo  Could not update the version number.
  pause
  exit /b 1
)

echo.
echo  Building...
call build.bat nolaunch >nul
if not exist "dist\CoD-Configurator.hta" (
  echo  Build failed.
  pause
  exit /b 1
)

if not exist "release" mkdir "release"
if exist "release\CoD-Configurator-v!NEW!.zip" del /q "release\CoD-Configurator-v!NEW!.zip"
set "PSFILES='dist\CoD-Configurator.hta'"
if exist "dist\CoD-Configurator.exe" set "PSFILES=!PSFILES!,'dist\CoD-Configurator.exe'"
if /i not "!ART!"=="N" set "PSFILES=!PSFILES!,'dist\assets'"
powershell -NoProfile -Command "Compress-Archive -Path !PSFILES! -DestinationPath 'release\CoD-Configurator-v!NEW!.zip' -Force"

git add -A
git commit -m "Release v!NEW!"
git tag "v!NEW!"
git push origin main
if errorlevel 1 (
  echo  Push failed. Run push.bat first, then try again.
  pause
  exit /b 1
)
git push origin "v!NEW!"

gh release create "v!NEW!" "dist\CoD-Configurator.hta" "release\CoD-Configurator-v!NEW!.zip" --title "v!NEW!" --notes "!NOTES!"
if errorlevel 1 (
  echo.
  echo  Could not create the release. Run:  gh auth login   and try again.
  pause
  exit /b 1
)

echo.
echo  Released v!NEW!. Installed copies will offer it under Settings, Check for updates.
echo.
pause
endlocal
