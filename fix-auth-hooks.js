// Script to fix all useAuth imports to use useEnhancedAuth
const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing all useAuth imports to useEnhancedAuth...\n');

const filesToFix = [
  'src/screens/DevotionalDetailScreen.tsx',
  'src/utils/api.ts',
  'src/screens/LoginScreen.tsx',
  'src/components/journal/GratitudeListReactQuery.tsx',
  'src/components/journal/DevotionalPrayerListReactQuery.tsx',
  'src/components/journal/EnhancedPrayerListReactQuery.tsx',
  'src/components/journal/TodaysFocusReactQuery.tsx',
  'src/components/journal/PrayerJournalCardReactQuery.tsx',
  'src/components/journal/ReflectionLogReactQuery.tsx',
  'src/components/journal/TodosReactQuery.tsx',
  'src/components/journal/TimeBlockReactQuery.tsx',
  'src/screens/UserProfileScreen.tsx',
  'src/components/journal/TodayWinReactQuery.tsx',
  'src/components/journal/LookingForwardReactQuery.tsx',
  'src/screens/JournalScreen.tsx',
  'src/screens/DevotionalDetailReflectionModal.tsx'
];

let fixedFiles = 0;
let skippedFiles = 0;

filesToFix.forEach(filePath => {
  const fullPath = path.join(__dirname, filePath);
  
  try {
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️  File not found: ${filePath}`);
      skippedFiles++;
      return;
    }
    
    let content = fs.readFileSync(fullPath, 'utf8');
    let modified = false;
    
    // Replace import statement
    if (content.includes("import { useAuth } from '../context/AuthContext';")) {
      content = content.replace(
        "import { useAuth } from '../context/AuthContext';",
        "import { useEnhancedAuth } from '../context/EnhancedAuthContext';"
      );
      modified = true;
    }
    
    if (content.includes("import { useAuth } from '../../context/AuthContext';")) {
      content = content.replace(
        "import { useAuth } from '../../context/AuthContext';",
        "import { useEnhancedAuth } from '../../context/EnhancedAuthContext';"
      );
      modified = true;
    }
    
    // Replace hook usage
    if (content.includes('useAuth()')) {
      content = content.replace(/useAuth\(\)/g, 'useEnhancedAuth()');
      modified = true;
    }
    
    if (modified) {
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`✅ Fixed: ${filePath}`);
      fixedFiles++;
    } else {
      console.log(`ℹ️  No changes needed: ${filePath}`);
      skippedFiles++;
    }
    
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    skippedFiles++;
  }
});

console.log(`\n📊 Summary:`);
console.log(`✅ Fixed files: ${fixedFiles}`);
console.log(`ℹ️  Skipped files: ${skippedFiles}`);
console.log(`📁 Total files processed: ${filesToFix.length}`);

if (fixedFiles > 0) {
  console.log(`\n🎉 Successfully updated ${fixedFiles} files to use useEnhancedAuth!`);
  console.log(`\n📱 The "useAuth must be used within an AuthProvider" error should now be resolved.`);
} else {
  console.log(`\n⚠️  No files were modified. They may already be using the correct import.`);
}
