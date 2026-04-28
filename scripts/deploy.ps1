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
npx tsc --force
Set-Location ..

# Commit and push to GitHub production branch
Write-Host ""
Write-Host "Committing and pushing to GitHub production..." -ForegroundColor Yellow
git add -A
$status = git status --porcelain
if ($status) {
    Write-Host ""
    $commitMsg = Read-Host "Enter commit description"
    if ([string]::IsNullOrWhiteSpace($commitMsg)) {
        $commitMsg = "Deploy: $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
    }
    git commit -m "$commitMsg"
}

$commitHash = git rev-parse HEAD
$shortHash = $commitHash.Substring(0, 7)
git push origin HEAD:production --force

Write-Host ""
Write-Host "Deployment complete!" -ForegroundColor Green
Write-Host "Commit pushed: $shortHash" -ForegroundColor Cyan
Write-Host "Railway will deploy automatically from GitHub."