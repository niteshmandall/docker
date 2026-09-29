@echo off
echo Triggering manual Gmail sync for Firefly III...
docker exec -it firefly_iii_gmail_sync node sync.js
echo.
pause
