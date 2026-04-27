# ChatPlay Mafia - Railway Deployment
Write-Host "ChatPlay Mafia - Railway Deployment" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

# Build frontend
Write-Host ""
Write-Host "Building frontend..." -ForegroundColor Yellow
Set-Location web
npm ci
npm run build
Set-Location ..

# Build backend
Write-Host ""
Write-Host "Building backend..." -ForegroundColor Yellow
Set-Location backend
npm install
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue
npx tsc
Set-Location ..

# Push to GitHub production branch
Write-Host ""
Write-Host "Pushing to GitHub..." -ForegroundColor Yellow
git push origin production

# Deploy to Railway
Write-Host ""
Write-Host "Deploying to Railway..." -ForegroundColor Yellow

$railwayExists = Get-Command railway -ErrorAction SilentlyContinue
if (-not $railwayExists) {
    Write-Host "Railway CLI not found. Install with: npm i -g @railway/cli" -ForegroundColor Red
    Write-Host "Skipping Railway deployment."
    exit 0
}

$railwayLoggedIn = railway whoami 2>$null
if (-not $LASTEXITCODE -eq 0) {
    Write-Host "Not logged in to Railway. Run: railway login" -ForegroundColor Red
    Write-Host "Skipping Railway deployment."
    exit 0
}

railway up --service "ChatPlay-Mafia"

Write-Host ""
Write-Host "Deployment complete!" -ForegroundColor Green
Write-Host "Run 'railway open' to view your app."