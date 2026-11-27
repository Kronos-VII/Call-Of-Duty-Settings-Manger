@echo off
rem Double-clicked: run again inside a window that stays open, so every message can be read.
if not "%~1"=="--inner" cmd /k call "%~f0" --inner & exit /b

setlocal EnableDelayedExpansion
cd /d "%~dp0"
title CoD Configurator - Push to GitHub

rem ------------------------------------------------------------------
rem  One-click push. First run asks for your GitHub repo link, then it:
rem    1. sets up git in this folder
rem    2. saves the repo name into src\config.js (so the in-app update button works)
rem    3. builds the app, commits everything and pushes to GitHub
rem  Needs Git for Windows: https://git-scm.com/download/win
rem ------------------------------------------------------------------

where git >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Git is not installed. Get it from https://git-scm.com/download/win
  echo  then run push.bat again.
  echo.
  pause
  exit /b 1
)

if not exist ".git" (
  git init >nul 2>nul
  git symbolic-ref HEAD refs/heads/main >nul 2>nul
)

rem ---- who is committing? ----
set "GN="
for /f "delims=" %%i in ('git config user.name 2^>nul') do set "GN=%%i"
if not defined GN (
  set /p "GN=Your name for commits: "
  if not defined GN set "GN=CoD Configurator"
  git config user.name "!GN!"
)
set "GE="
for /f "delims=" %%i in ('git config user.email 2^>nul') do set "GE=%%i"
if not defined GE (
  set /p "GE=Your email (Enter to use a private GitHub address): "
  if not defined GE set "GE=!GN: =!@users.noreply.github.com"
  git config user.email "!GE!"
)

rem ---- remote ----
set "REMOTE="
for /f "delims=" %%i in ('git remote get-url origin 2^>nul') do set "REMOTE=%%i"
if not defined REMOTE (
  set "REMOTE=https://github.com/Kronos-VII/Call-Of-Duty-Settings-Manger.git"
  git remote add origin "!REMOTE!"
)

rem ---- work out owner/name from the link ----
set "R=!REMOTE!"
set "R=!R:https://github.com/=!"
set "R=!R:http://github.com/=!"
set "R=!R:git@github.com:=!"
if /i "!R:~-4!"==".git" set "R=!R:~0,-4!"
if "!R:~-1!"=="/" set "R=!R:~0,-1!"
if "!R!"=="!R:/=!" (
  echo.
  echo  That does not look like a GitHub repo link: !REMOTE!
  echo  Fix it with:  git remote set-url origin https://github.com/yourname/yourrepo
  pause
  exit /b 1
)

> "src\config.js" echo /* config.js - written by push.bat so the update button knows where to look. */
>> "src\config.js" echo var Config = { REPO: '!R!' };

echo.
echo  Building...
cmd /c build.bat nolaunch > "dist-build.log" 2>&1
if exist "dist\CoD-Configurator.hta" del /q "dist-build.log" >nul 2>nul
if not exist "dist\CoD-Configurator.hta" (
  echo  Build failed. What build.bat said:
  type "dist-build.log"
  pause
  exit /b 1
)

echo.
set "MSG="
set /p "MSG=What changed? (Enter = Update): "
if not defined MSG set "MSG=Update"
set "MSG=!MSG:"=!"

rem Line endings are handled by .gitattributes; this stops the "LF will be replaced by CRLF" warnings.
git config core.autocrlf false
git config core.safecrlf false

rem Clear anything left over from an earlier push that stopped halfway.
git rebase --abort >nul 2>nul
git merge --abort >nul 2>nul
if exist ".git\rebase-merge" rmdir /s /q ".git\rebase-merge"
if exist ".git\rebase-apply" rmdir /s /q ".git\rebase-apply"

git add -A
set "CHANGED="
git diff --cached --quiet || set "CHANGED=1"
if defined CHANGED git commit -q -m "!MSG!"
if not defined CHANGED echo  Nothing new to commit.

echo.
echo  Pushing to !R! ...
git push -u origin main
if not errorlevel 1 goto :pushed

rem GitHub has commits this folder does not have (pushed from another copy, or edited on the website).
rem Join the two histories but keep this folder's files exactly as they are. GitHub's commits stay in the
rem history, so nothing is lost and no force-push is needed.
echo.
echo  GitHub has changes that are not in this folder. Joining them so this folder's version is published.
echo  GitHub's earlier version stays in the history, nothing is deleted.
git fetch origin main
if errorlevel 1 goto :pushfail
git merge -s ours --allow-unrelated-histories --no-edit -m "Publish this folder's version (earlier GitHub changes kept in history)" FETCH_HEAD
if errorlevel 1 goto :pushfail
git push -u origin main
if errorlevel 1 goto :pushfail

:pushed
echo.
echo  Done. Your code is on GitHub: https://github.com/!R!
echo  To publish a new version to users, run release.bat
echo.
pause
endlocal
exit

:pushfail
git rebase --abort >nul 2>nul
git merge --abort >nul 2>nul
echo.
echo  Push failed. Read the git message above. Check that you are signed in to GitHub
echo  - a sign-in window opens the first time - and that you can write to the repo.
pause
endlocal
exit /b 1
