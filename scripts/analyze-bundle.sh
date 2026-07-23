#!/bin/bash

# Build analysis script for idol-pages
# Usage: ./scripts/analyze-bundle.sh

set -e

echo "🔍 Building for bundle analysis..."

# Build with analysis
ANALYZE=true npm run build

echo "✅ Build complete!"
echo "📊 Bundle analysis available at:"
echo "   - dist/_astro/ (client bundles)"
echo "   - functions/ (server bundles)"

# Optional: show bundle sizes
echo ""
echo "📦 Client bundle sizes:"
du -sh dist/_astro/*.js 2>/dev/null | sort -hr | head -20

echo ""
echo "📦 CSS bundle sizes:"
du -sh dist/_astro/*.css 2>/dev/null | sort -hr

echo ""
echo "📦 Server function sizes:"
du -sh functions/*.js 2>/dev/null | sort -hr | head -10

# Check for large files
echo ""
echo "⚠️  Large files (>100KB):"
find dist -name "*.js" -o -name "*.css" | xargs du -h 2>/dev/null | awk '$1+0 > 100' | sort -hr
