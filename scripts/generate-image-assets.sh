#!/bin/bash

# Script to generate @2x and @3x versions of all PNG images
# This ensures sharp, non-blurry images on all devices

set -e

echo "🎨 Generating @2x and @3x image assets..."
echo "=========================================="

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counter for generated files
generated_count=0
skipped_count=0

# Function to generate retina versions
generate_retina_versions() {
    local base_image="$1"
    local dir=$(dirname "$base_image")
    local filename=$(basename "$base_image")
    local name="${filename%.*}"
    local ext="${filename##*.}"
    
    # Skip if already a @2x or @3x file
    if [[ "$name" == *"@2x"* ]] || [[ "$name" == *"@3x"* ]]; then
        return
    fi
    
    local image_2x="${dir}/${name}@2x.${ext}"
    local image_3x="${dir}/${name}@3x.${ext}"
    
    # Get original dimensions
    if command -v sips &> /dev/null; then
        # Use sips (built-in macOS tool)
        local width=$(sips -g pixelWidth "$base_image" | grep pixelWidth | awk '{print $2}')
        local height=$(sips -g pixelHeight "$base_image" | grep pixelHeight | awk '{print $2}')
        
        echo -e "${BLUE}📷 Processing: ${filename}${NC}"
        echo "   Original size: ${width}x${height}px"
        
        # Generate @2x (2x size)
        if [ ! -f "$image_2x" ]; then
            local width_2x=$((width * 2))
            local height_2x=$((height * 2))
            echo -e "   ${GREEN}✓${NC} Creating @2x version (${width_2x}x${height_2x}px)..."
            sips -z $height_2x $width_2x "$base_image" --out "$image_2x" > /dev/null 2>&1
            ((generated_count++))
        else
            echo -e "   ${YELLOW}⊘${NC} @2x version already exists, skipping..."
            ((skipped_count++))
        fi
        
        # Generate @3x (3x size)
        if [ ! -f "$image_3x" ]; then
            local width_3x=$((width * 3))
            local height_3x=$((height * 3))
            echo -e "   ${GREEN}✓${NC} Creating @3x version (${width_3x}x${height_3x}px)..."
            sips -z $height_3x $width_3x "$base_image" --out "$image_3x" > /dev/null 2>&1
            ((generated_count++))
        else
            echo -e "   ${YELLOW}⊘${NC} @3x version already exists, skipping..."
            ((skipped_count++))
        fi
        
        echo ""
    else
        echo "❌ Error: sips command not found. This script requires macOS."
        exit 1
    fi
}

# Process icons folder
echo -e "${BLUE}📁 Processing assets/icons...${NC}"
echo ""
if [ -d "assets/icons" ]; then
    for image in assets/icons/*.png; do
        if [ -f "$image" ]; then
            generate_retina_versions "$image"
        fi
    done
else
    echo "⚠️  assets/icons directory not found"
fi

# Process images folder
echo -e "${BLUE}📁 Processing assets/images...${NC}"
echo ""
if [ -d "assets/images" ]; then
    for image in assets/images/*.png; do
        if [ -f "$image" ]; then
            generate_retina_versions "$image"
        fi
    done
else
    echo "⚠️  assets/images directory not found"
fi

# Summary
echo "=========================================="
echo -e "${GREEN}✅ Done!${NC}"
echo ""
echo "📊 Summary:"
echo "   Generated: $generated_count new files"
echo "   Skipped: $skipped_count existing files"
echo ""
echo "💡 Tips:"
echo "   - Base images (@1x) are used as source"
echo "   - @2x images are 2x the size (for iPhone 8-14)"
echo "   - @3x images are 3x the size (for iPhone Plus/Pro Max)"
echo "   - React Native automatically picks the right version"
echo ""
echo "🎯 Next steps:"
echo "   1. Review the generated images"
echo "   2. Test on device to ensure sharpness"
echo "   3. Commit the new @2x and @3x files"
echo ""
