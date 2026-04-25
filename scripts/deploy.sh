#!/bin/bash
# Deploy script for Railway

echo "ChatPlay Mafia - Railway Deployment"
echo "===================================="

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "Railway CLI not found. Install with: npm i -g @railway/cli"
    exit 1
fi

# Check login
railway whoami || { echo "Please run: railway login"; exit 1; }

echo "Deploying to Railway..."

# Deploy the project
railway up

echo ""
echo "Deployment complete!"
echo "Run 'railway open' to view your app."