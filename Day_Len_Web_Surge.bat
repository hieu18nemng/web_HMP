@echo off
title DUA WEB LEN INTERNET MIEN PHI VOI SURGE.SH
echo ======================================================================
echo    DUA WEB ON THI CUA BE YEU LEN INTERNET (24/7 MIEN PHI VINH VIEN)
echo ======================================================================
echo.
echo Huong dan:
echo - Neu day la lan dau chay, he thong se hoi Email va Password.
echo   (Ban chi can nhap Email cua ban va dat 1 mat khau tuy y de tao tai khoan mien phi).
echo - Sau do Surge se hoi project path: giu nguyen va an ENTER.
echo - Surge se hoi domain: ban co the dat ten mien de thuong nhu:
echo   on-thi-cung-be-yeu.surge.sh hoac be-yeu-fptu.surge.sh
echo.
pause

cd /d "%~dp0"
cmd /c npx --yes surge .
echo.
echo ======================================================================
echo Neu thanh cong, ban hay copy duong link gui cho co ay nhe!
echo ======================================================================
pause
