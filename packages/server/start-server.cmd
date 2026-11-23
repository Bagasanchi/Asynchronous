@echo off
cd /d "D:\Claude Code\Asynchronous\async-card-game\packages\server"
if not exist data mkdir data
node index.js > server.log 2>&1
echo Server started, PID: %ERRORLEVEL%