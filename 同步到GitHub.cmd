@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo   同步工作区到 GitHub
echo   mantou1233321/STC15F2K60S2_visual_simulator
echo ============================================
echo.
echo [1/3] 暂存改动...
git add -A
echo.
echo 本次将提交的改动：
git status --short
echo.
set "msg="
set /p "msg=请输入提交说明（直接回车 = 更新）："
if "%msg%"=="" set "msg=更新"
echo.
echo [2/3] 提交...
git commit -m "%msg%"
if errorlevel 1 echo （没有新改动需要提交）
echo.
echo [3/3] 推送到 GitHub...
git push
echo.
echo 完成。若上面提示认证失败，请在普通终端里手动执行一次 git push 并登录。
pause