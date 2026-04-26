#!/bin/bash
# Deploy script for Railway

set -e

echo "ChatPlay Mafia - Railway Deployment"
echo "===================================="

# Build frontend
echo ""
echo "Building frontend..."
cd web
npm ci
npm run build
cd ..

# Build backend
echo ""
echo "Building backend..."
cd backend
npm install
npx tsc
cd ..

# Push to GitHub production branch
echo ""
echo "Pushing to GitHub..."
git push origin production

# Deploy to Railway
echo ""
echo "Deploying to Railway..."

if ! command -v railway &> /dev/null; then
    echo "Railway CLI not found. Install with: npm i -g @railway/cli"
    echo "Skipping Railway deployment."
    exit 0
fi

if ! railway whoami &> /dev/null; then
    echo "Not logged in to Railway. Run: railway login"
    echo "Skipping Railway deployment."
    exit 0
fi

railway up --service "ChatPlay-Mafia"

echo ""
echo "Deployment complete!"
echo "Run 'railway open' to view your app."