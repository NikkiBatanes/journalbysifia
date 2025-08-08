#!/usr/bin/env node

/**
 * Revert Vector Icons Script
 * 
 * Reverts @expo/vector-icons imports back to react-native-vector-icons
 * for bare React Native projects
 */

const fs = require('fs');
const path = require('path');

// Icon mappings
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
      if (!['node_modules', '.git', '.expo', 'ios', 'android'].includes(file)) {
        findTSXFiles(filePath, fileList);
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

function revertFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Find @expo/vector-icons imports
  const expoImportRegex = /import\s*{\s*([^}]+)\s*}\s*from\s*['"]@expo\/vector-icons['"];?\s*\n?/g;
  const match = expoImportRegex.exec(content);
  
  if (match) {
    const iconsString = match[1];
    const icons = iconsString.split(',').map(icon => icon.trim());
    
    // Remove the @expo/vector-icons import
    content = content.replace(expoImportRegex, '');
    
    // Add individual react-native-vector-icons imports
    let newImports = '';
    icons.forEach(iconName => {
      if (iconMappings[iconName]) {
        newImports += `import ${iconName} from 'react-native-vector-icons/${iconName}';\n`;
      }
    });
    
    // Find the best place to insert imports (after React import if it exists)
    const reactImportMatch = content.match(/import\s+.*from\s+['"]react['"];?\n/);
    
    if (reactImportMatch) {
      content = content.replace(reactImportMatch[0], reactImportMatch[0] + newImports);
    } else {
      content = newImports + content;
    }
    
    modified = true;
  }
  
  if (modified) {
    // Clean up any duplicate empty lines
    content = content.replace(/\n\n\n+/g, '\n\n');
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Reverted: ${filePath}`);
  }
  
  return modified;
}

function main() {
  console.log('🔄 Reverting to react-native-vector-icons imports...\n');
  
  const srcDir = path.join(__dirname, 'src');
  const files = findTSXFiles(srcDir);
  
  let revertedCount = 0;
  
  files.forEach(file => {
    if (revertFile(file)) {
      revertedCount++;
    }
  });
  
  console.log(`\n🎉 Reverted ${revertedCount} files!`);
  console.log('\n📋 Next steps for bare React Native:');
  console.log('1. For iOS: cd ios && pod install');
  console.log('2. For Android: Check android/app/build.gradle');
  console.log('3. Run: npx react-native start --reset-cache');
  console.log('4. Run: npx react-native run-ios (or run-android)');
}

if (require.main === module) {
  main();
}
