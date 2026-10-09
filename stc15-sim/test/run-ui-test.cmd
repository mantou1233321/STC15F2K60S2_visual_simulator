@echo off
rem Screenshot helper for the simulator UI (headless Edge).
rem Usage: run-ui-test.cmd            -> runs DOM self-test, writes dom.txt, screenshots pages into shots\
setlocal
set EDGE="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
set PROF=%TEMP%\edgeprof-shot
set PROF2=%TEMP%\edgeprof-test
if not exist "%PROF%" mkdir "%PROF%"
if not exist "%PROF2%" mkdir "%PROF2%"
if not exist "%~dp0shots" mkdir "%~dp0shots"
set BASE=http://127.0.0.1:8099
set SHOT=%~dp0shots

%EDGE% --headless=new --disable-gpu --no-first-run --user-data-dir="%PROF2%" --virtual-time-budget=8000 --dump-dom %BASE%/test/ui-selftest.html > "%~dp0dom.txt" 2>&1

%EDGE% --headless=new --disable-gpu --no-first-run --user-data-dir="%PROF%" --virtual-time-budget=5000 --hide-scrollbars --window-size=1700,1150 --screenshot="%SHOT%\iram.png" %BASE%/ >nul 2>&1
%EDGE% --headless=new --disable-gpu --no-first-run --user-data-dir="%PROF%" --virtual-time-budget=5000 --hide-scrollbars --window-size=1700,1150 --screenshot="%SHOT%\sfr.png" "%BASE%/test/ui-shot.html?space=sfr&hover=208" >nul 2>&1
%EDGE% --headless=new --disable-gpu --no-first-run --user-data-dir="%PROF%" --virtual-time-budget=5000 --hide-scrollbars --window-size=1700,1150 --screenshot="%SHOT%\xram.png" "%BASE%/test/ui-shot.html?space=xram&hover=256" >nul 2>&1
%EDGE% --headless=new --disable-gpu --no-first-run --user-data-dir="%PROF%" --virtual-time-budget=5000 --hide-scrollbars --window-size=1280,800 --screenshot="%SHOT%\iram-small-scrolled.png" "%BASE%/test/ui-shot.html?space=iram&scroll=bottom&w=1280&h=780" >nul 2>&1
echo done
