@echo off
setlocal EnableExtensions EnableDelayedExpansion
rem ------------------------------------------------------------------
rem  Builds dist\CoD-Configurator.hta from the files in src\ and opens it.
rem  Needs nothing but Windows (no Node, no Python).
rem    build.bat            build, then open the app
rem    build.bat nolaunch   build only (used by push.bat / release.bat)
rem ------------------------------------------------------------------
cd /d "%~dp0"
title CoD Configurator - Build

if not exist "src\00-head.html" (
  echo.
  echo  [ERROR] The "src" folder was not found next to build.bat.
  echo  Extract the whole zip first ^(right-click the zip, Extract All^), then run build.bat
  echo  from the extracted folder, not from inside the zip.
  echo.
  echo  This folder is: !CD!
  echo.
  pause
  exit /b 1
)

set "MISSING="
for %%F in (00-head.html style.css 10-mid.html core.js config.js data.js sys.js ui.js 99-tail.html) do (
  if not exist "src\%%F" set "MISSING=!MISSING! %%F"
)
if defined MISSING (
  echo.
  echo  [ERROR] These files are missing from src: %MISSING%
  echo  Extract the zip again.
  echo.
  pause
  exit /b 1
)

if not exist "dist" mkdir "dist"
if exist "dist\CoD-Configurator.hta" del /q "dist\CoD-Configurator.hta"

rem Order matters: head, CSS, middle, scripts (core, config, data, sys, ui), tail.
copy /b "src\00-head.html"+"src\style.css"+"src\10-mid.html"+"src\core.js"+"src\config.js"+"src\data.js"+"src\sys.js"+"src\ui.js"+"src\99-tail.html" "dist\CoD-Configurator.hta" >nul
if not exist "dist\CoD-Configurator.hta" (
  echo.
  echo  [ERROR] Could not create dist\CoD-Configurator.hta
  echo  Try moving this folder to your Desktop or Documents ^(not Program Files^) and run again.
  echo.
  pause
  exit /b 1
)

rem Game pictures live next to the app in dist\assets
if not exist "dist\assets" mkdir "dist\assets"
for %%E in (jpg jpeg png ico) do (
  if exist "assets\*.%%E" copy /y "assets\*.%%E" "dist\assets\" >nul
)

rem ---- make a real .exe launcher (uses the C# compiler that ships with Windows; optional) ----
set "CSC="
if exist "%windir%\Microsoft.NET\Framework64\v4.0.30319\csc.exe" set "CSC=%windir%\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not defined CSC if exist "%windir%\Microsoft.NET\Framework\v4.0.30319\csc.exe" set "CSC=%windir%\Microsoft.NET\Framework\v4.0.30319\csc.exe"
if exist "dist\CoD-Configurator.exe" del /q "dist\CoD-Configurator.exe"
set "ICO=tools\app.ico"
if exist "assets\app.ico" set "ICO=assets\app.ico"
if defined CSC (
  "!CSC!" /nologo /target:winexe /out:"dist\CoD-Configurator.exe" /win32icon:"!ICO!" /r:System.Windows.Forms.dll "tools\launcher.cs" >"dist\exe-build.log" 2>&1
  if not exist "dist\CoD-Configurator.exe" "!CSC!" /nologo /target:winexe /out:"dist\CoD-Configurator.exe" /r:System.Windows.Forms.dll "tools\launcher.cs" >"dist\exe-build.log" 2>&1
)

echo.
echo  Built: %CD%\dist\CoD-Configurator.hta
if exist "dist\CoD-Configurator.exe" (echo  Built: !CD!\dist\CoD-Configurator.exe  ^(double-click this one^)) else (echo  Note: the .exe could not be made, the app still works - see dist\exe-build.log)
echo.

if /i "%~1"=="nolaunch" goto :done
echo  Opening the app...
rem Opened through mshta directly, so it works even when Windows has no program linked to .hta files.
if exist "%windir%\System32\mshta.exe" (
  start "" "%windir%\System32\mshta.exe" "!CD!\dist\CoD-Configurator.hta"
) else (
  echo  [ERROR] Windows' HTA host mshta.exe was not found on this PC.
  pause
  goto :done
)
ping -n 3 127.0.0.1 >nul
:done
endlocal
