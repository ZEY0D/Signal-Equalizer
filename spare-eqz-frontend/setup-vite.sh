#!/bin/bash

# Quick Start Script for React + Vite Conversion
# This script helps you quickly set up the new Vite project

echo "🚀 Starting React + Vite conversion setup..."
echo ""

# Step 1: Backup old package.json
if [ -f "package.json" ]; then
    echo "📦 Backing up old package.json to package-next.json..."
    mv package.json package-next.json
    echo "✅ Backup complete"
else
    echo "⚠️  No existing package.json found"
fi

# Step 2: Use new Vite package.json
if [ -f "package-vite.json" ]; then
    echo "📦 Setting up new Vite package.json..."
    cp package-vite.json package.json
    echo "✅ Package.json updated"
else
    echo "❌ Error: package-vite.json not found!"
    exit 1
fi

# Step 3: Remove old lockfile
if [ -f "pnpm-lock.yaml" ]; then
    echo "🗑️  Removing old pnpm-lock.yaml..."
    rm pnpm-lock.yaml
    echo "✅ Old lockfile removed"
fi

# Step 4: Install dependencies
echo ""
echo "📥 Installing dependencies..."
echo "This may take a minute..."
npm install

# Check if install was successful
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Dependencies installed successfully!"
    echo ""
    echo "🎉 Setup complete! Your project is ready."
    echo ""
    echo "📝 Next steps:"
    echo "   1. Run 'npm run dev' to start the development server"
    echo "   2. Open http://localhost:3000 in your browser"
    echo "   3. Check README-VITE.md for more information"
    echo ""
    echo "📁 File structure:"
    echo "   - src/main.jsx       → Entry point"
    echo "   - src/App.jsx        → Main application"
    echo "   - src/components.jsx → All UI components (1 file!)"
    echo "   - src/utils.js       → Utility functions"
    echo "   - src/index.css      → Styles"
    echo ""
    echo "🗑️  Optional: Clean up old Next.js files"
    echo "   After confirming everything works, you can delete:"
    echo "   - app/ components/ hooks/ lib/ styles/ folders"
    echo "   - next.config.mjs tsconfig.json components.json"
    echo ""
else
    echo ""
    echo "❌ Error: Failed to install dependencies"
    echo "Please check your internet connection and try again"
    exit 1
fi
