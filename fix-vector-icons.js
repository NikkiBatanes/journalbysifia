#!/usr/bin/env node

/**
 * Fix Vector Icons Script
 * 
 * Automatically replaces all react-native-vector-icons imports
 * with @expo/vector-icons equivalents
 */

const fs = require('fs');
const path = require('path');

// Icon mappings from react-native-vector-icons to @expo/vector-icons
const iconMappings = {
  'Ionicons': 'Ionicons',
  'MaterialCommunityIcons': 'MaterialCommunityIcons', 
  'MaterialIcons': 'MaterialIcons',
  'Entypo': 'Entypo',
  'FontAwesome': 'FontAwesome',
  'FontAwesome5': 'FontAwesome5',
  'AntDesign': 'AntDesign',
  'Feather': 'Feather',
  'Foundation': 'Foundation',
  'SimpleLineIcons': 'SimpleLineIcons',
  'Octicons': 'Octicons',
  'Zocial': 'Zocial'
};

function findTSXFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Skip node_modules and other directories
      if (!['node_modules', '.git', '.expo', 'ios', 'android'].includes(file)) {
        findTSXFiles(filePath, fileList);
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  let usedIcons = new Set();
  
  // Find all react-native-vector-icons imports
  Object.keys(iconMappings).forEach(iconName => {
    const oldImportRegex = new RegExp(`import\\s+${iconName}\\s+from\\s+['"]react-native-vector-icons/${iconName}['"];?`, 'g');
    
    if (oldImportRegex.test(content)) {
      usedIcons.add(iconName);
      // Remove the old import
      content = content.replace(oldImportRegex, '');
      modified = true;
    }
  });
  
  // If we found any icons, add the new @expo/vector-icons import
  if (usedIcons.size > 0) {
    const iconsList = Array.from(usedIcons).join(', ');
    const newImport = `import { ${iconsList} } from '@expo/vector-icons';`;
    
    // Find the best place to insert the import (after React import if it exists)
    const reactImportMatch = content.match(/import\s+.*from\s+['"]react['"];?\n/);
    
    if (reactImportMatch) {
      // Insert after React import
      content = content.replace(reactImportMatch[0], reactImportMatch[0] + newImport + '\n');
    } else {
      // Insert at the beginning
      content = newImport + '\n' + content;
    }
    
    modified = true;
  }
  
  if (modified) {
    // Clean up any duplicate empty lines
    content = content.replace(/\n\n\n+/g, '\n\n');
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Fixed: ${filePath}`);
    console.log(`   Icons: ${Array.from(usedIcons).join(', ')}`);
  }
  
  return modified;
}

function main() {
  console.log('🔧 Fixing react-native-vector-icons imports...\n');
  
  const srcDir = path.join(__dirname, 'src');
  const files = findTSXFiles(srcDir);
  
  let fixedCount = 0;
  
  files.forEach(file => {
    if (fixFile(file)) {
      fixedCount++;
    }
  });
  
  console.log(`\n🎉 Fixed ${fixedCount} files!`);
  console.log('\n📋 Next steps:');
  console.log('1. Run: npx expo start --clear');
  console.log('2. Test your app to make sure icons display correctly');
  console.log('3. If any icons are missing, check the @expo/vector-icons documentation');
}

if (require.main === module) {
  main();
}
