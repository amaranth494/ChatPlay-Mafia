# ChatPlay Mafia - Log Grabbing Script
# Pulls logs from the GitHub Repo (web) service
#
# LIMITATION: The Railway CLI cannot access Redis and Postgres logs when they are 
# provisioned as attached databases (not standalone services). Only the main web
# service has a service ID that can be used with `railway logs`.
#
# To get database logs, you need to:
# 1. Access the Railway dashboard: https://railway.com/project/d63603a8-d176-441b-8ced-93aef6d5ff83
# 2. Or install psql/redis-cli locally and use `railway connect postgres` / `railway connect redis`
#
# Available service: ChatPlay-Mafia (6696c39d-4e06-4faf-8f90-6118d5cf38fc)

param(
    [int]$Lines = 50,
    [string]$Since = "1h"
)

$PROJECT_ID = "d63603a8-d176-441b-8ced-93aef6d5ff83"
$ENVIRONMENT = "production"

Write-Host "ChatPlay Mafia - Log Grabbing Script" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# Get the most recent commit hash
$COMMIT_HASH = git log -1 --format=%H
$SHORT_HASH = $COMMIT_HASH.Substring(0, 7)
Write-Host "Most recent commit: $SHORT_HASH" -ForegroundColor Yellow

# Create output directory
$OUTPUT_DIR = "logs"
if (-not (Test-Path $OUTPUT_DIR)) {
    New-Item -ItemType Directory -Path $OUTPUT_DIR | Out-Null
}

Write-Host ""
Write-Host "Project: $PROJECT_ID" -ForegroundColor Yellow
Write-Host "Environment: $ENVIRONMENT" -ForegroundColor Yellow

# Get logs from Web/Repo (the main service - this is our GitHub repo deployment)
Write-Host ""
Write-Host "Getting Web/Repo logs..." -ForegroundColor Yellow
$WEB_SERVICE = "6696c39d-4e06-4faf-8f90-6118d5cf38fc"
$WEB_FILE = "$OUTPUT_DIR/${SHORT_HASH}_web.log"
try {
    $result = railway logs -s $WEB_SERVICE -e production -n $Lines 2>&1
    $result | Out-File -FilePath $WEB_FILE -Encoding utf8
    Write-Host "Web logs saved to: $WEB_FILE" -ForegroundColor Green
} catch {
    Write-Host "Could not get Web logs: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "NOTE: Redis and Postgres logs require Railway dashboard access" -ForegroundColor Yellow
Write-Host "Dashboard: https://railway.com/project/$PROJECT_ID" -ForegroundColor Yellow

Write-Host ""
Write-Host "Log collection complete!" -ForegroundColor Green
Write-Host "Output directory: $OUTPUT_DIR" -ForegroundColor Cyan