# Start the Fastify server
Write-Host "Starting server..."
if (-not (Test-Path 'data')) { New-Item -ItemType Directory -Path 'data' -Force }

# Run node in background
$process = Start-Process -FilePath "node" -ArgumentList "index.ts" -PassThru -NoNewWindow -RedirectStandardOutput "server.log" -RedirectStandardError "server.log" -WorkingDirectory "D:/Claude Code/Asynchronous/async-card-game/packages/server"
Write-Host "Server process started with PID: $($process.Id)"