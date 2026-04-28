# ChatPlay Mafia - Deploy Script
# Pushes changes to GitHub production branch
# Railway deployment happens automatically via GitHub integration
Write-Host "ChatPlay Mafia - Deploy Script v2" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan

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

# Commit and push to GitHub production branch
Write-Host ""
Write-Host "Committing and pushing to GitHub production..." -ForegroundColor Yellow
git add -A
$status = git status --porcelain
if ($status) {
    git commit -m "Deploy: $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
}
git push origin production --force

Write-Host ""
Write-Host "Deployment complete!" -ForegroundColor Green
Write-Host "Railway will deploy automatically from GitHub."