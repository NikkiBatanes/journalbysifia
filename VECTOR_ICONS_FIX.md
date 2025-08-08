# 🔧 Vector Icons Fix Guide

## 🚨 Current Issue
```
Unable to resolve module ./vendor/react-native-vector-icons/Fonts/AntDesign.ttf
```

## ✅ Quick Fix Options

### Option 1: Use Only @expo/vector-icons (RECOMMENDED)

1. **Find all imports** of `react-native-vector-icons`:
```bash
grep -r "react-native-vector-icons" src/
```

2. **Replace imports** with @expo/vector-icons:
```typescript
// OLD (causing error):
import Icon from 'react-native-vector-icons/AntDesign';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';

// NEW (working):
import { AntDesign, MaterialIcons } from '@expo/vector-icons';
```

3. **Update usage**:
```typescript
// OLD:
<Icon name="heart" size={20} color="red" />

// NEW:
<AntDesign name="heart" size={20} color="red" />
```

### Option 2: Remove react-native-vector-icons Completely

```bash
cd /Users/nikkimaebatanes/CascadeProjects/siFia
npm uninstall react-native-vector-icons
npx expo start --clear
```

### Option 3: Fix Native Setup (If you need react-native-vector-icons)

For iOS:
```bash
cd ios
pod install
cd ..
```

For Android, add to `android/app/build.gradle`:
```gradle
apply from: "../../node_modules/react-native-vector-icons/fonts.gradle"
```

## 🔍 Find and Replace Script

Create this script to automatically fix imports:

```bash
# Create fix script
cat > fix-vector-icons.sh << 'EOF'
#!/bin/bash
echo "Fixing vector icons imports..."

# Find all files with react-native-vector-icons imports
find src/ -name "*.tsx" -o -name "*.ts" | xargs grep -l "react-native-vector-icons" | while read file; do
  echo "Fixing: $file"
  
  # Replace common imports
  sed -i '' 's/import.*from.*react-native-vector-icons\/AntDesign.*/import { AntDesign } from "@expo\/vector-icons";/g' "$file"
  sed -i '' 's/import.*from.*react-native-vector-icons\/MaterialIcons.*/import { MaterialIcons } from "@expo\/vector-icons";/g' "$file"
  sed -i '' 's/import.*from.*react-native-vector-icons\/Ionicons.*/import { Ionicons } from "@expo\/vector-icons";/g' "$file"
  sed -i '' 's/import.*from.*react-native-vector-icons\/FontAwesome.*/import { FontAwesome } from "@expo\/vector-icons";/g' "$file"
  sed -i '' 's/import.*from.*react-native-vector-icons\/Feather.*/import { Feather } from "@expo\/vector-icons";/g' "$file"
done

echo "✅ Vector icons imports fixed!"
EOF

chmod +x fix-vector-icons.sh
./fix-vector-icons.sh
```

## 🧪 Test the Fix

After applying the fix:

```bash
# Clear cache and restart
npx expo start --clear

# Check if error is gone
# The app should start without vector icons errors
```

## 📱 Common Icon Replacements

| react-native-vector-icons | @expo/vector-icons |
|---------------------------|-------------------|
| `import Icon from 'react-native-vector-icons/AntDesign'` | `import { AntDesign } from '@expo/vector-icons'` |
| `<Icon name="heart" />` | `<AntDesign name="heart" />` |
| `import MaterialIcon from 'react-native-vector-icons/MaterialIcons'` | `import { MaterialIcons } from '@expo/vector-icons'` |
| `<MaterialIcon name="home" />` | `<MaterialIcons name="home" />` |

## ✅ Verification

Your fix is working when:
- ✅ App starts without vector icons errors
- ✅ Icons display correctly in the UI
- ✅ No import errors in the console
- ✅ Metro bundler runs without warnings

Run this after the fix to verify:
```bash
npx expo start --clear
```

The app should start successfully without the vector icons error!
