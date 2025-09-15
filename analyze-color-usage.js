const fs = require('fs');
const path = require('path');

// All colors from the current theme
const themeColors = [
  'anchorBlue', 'anchorBlueLight', 'modalBlue', 'faithGold', 'growthGreen', 
  'alertCoral', 'devotionalPurple', 'spiritualPink', 'playbookBlue', 'lightPurple',
  'text', 'textGray', 'error', 'white', 'black', 'hopeWhite', 'lightGray', 
  'lightBlue', 'darkGray', 'trustGrey', 'inputBackground', 'inputBorder', 
  'cardBackground', 'cardBorder', 'darkBackground', 'warning', 'lightBackground', 
  'borderLight', 'backgroundBlue', 'wisdomIndigo', 'reflectionGray', 'sanctuaryWhite', 
  'gentleBorder', 'scriptureText', 'treasureGold', 'prosperityGreen', 'warningAmber', 
  'mysticalViolet', 'clarityTeal', 'revelationBlue', 'truthBlue', 'meditationGray', 
  'wisdomText', 'guidanceText', 'whisperText', 'echoText', 'divineVeil', 'holyGlow', 
  'gentlePresence', 'whisperOverlay', 'shadowOfPeace', 'quietReflection', 
  'deepMeditation', 'restfulShadow', 'prayerPurple', 'reflectionBlue', 'gratitudeRed', 
  'winGold', 'timeblockGreen', 'debtRed', 'actionBackground'
];

function findFilesRecursively(dir, extensions = ['.tsx', '.ts']) {
  let results = [];
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
      results = results.concat(findFilesRecursively(filePath, extensions));
    } else if (extensions.some(ext => file.endsWith(ext))) {
      results.push(filePath);
    }
  }
  
  return results;
}

function analyzeColorUsage() {
  const srcDir = './src';
  const files = findFilesRecursively(srcDir);
  
  const colorUsage = {};
  const unusedColors = new Set(themeColors);
  
  // Initialize usage tracking
  themeColors.forEach(color => {
    colorUsage[color] = { count: 0, files: [] };
  });
  
  console.log(`Analyzing ${files.length} files for color usage...`);
  
  files.forEach(filePath => {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      
      themeColors.forEach(color => {
        const regex = new RegExp(`Colors\\.${color}\\b`, 'g');
        const matches = content.match(regex);
        
        if (matches) {
          colorUsage[color].count += matches.length;
          colorUsage[color].files.push({
            file: filePath.replace('./src/', ''),
            occurrences: matches.length
          });
          unusedColors.delete(color);
        }
      });
    } catch (error) {
      console.warn(`Error reading file ${filePath}:`, error.message);
    }
  });
  
  // Sort colors by usage count
  const sortedColors = Object.entries(colorUsage)
    .sort(([,a], [,b]) => b.count - a.count);
  
  console.log('\n=== COLOR USAGE ANALYSIS ===');
  console.log(`Total colors in theme: ${themeColors.length}`);
  console.log(`Colors actually used: ${themeColors.length - unusedColors.size}`);
  console.log(`Unused colors: ${unusedColors.size}`);
  console.log(`Usage efficiency: ${((themeColors.length - unusedColors.size) / themeColors.length * 100).toFixed(1)}%`);
  
  console.log('\n=== MOST USED COLORS ===');
  sortedColors.slice(0, 15).forEach(([color, data]) => {
    console.log(`${color}: ${data.count} uses across ${data.files.length} files`);
  });
  
  console.log('\n=== UNUSED COLORS ===');
  if (unusedColors.size > 0) {
    Array.from(unusedColors).sort().forEach(color => {
      console.log(`❌ ${color} - NEVER USED`);
    });
  } else {
    console.log('✅ All colors are being used!');
  }
  
  console.log('\n=== LIGHTLY USED COLORS (1-3 uses) ===');
  sortedColors
    .filter(([, data]) => data.count > 0 && data.count <= 3)
    .forEach(([color, data]) => {
      console.log(`⚠️  ${color}: ${data.count} uses in ${data.files.map(f => f.file).join(', ')}`);
    });
  
  // Detailed breakdown for unused colors
  if (unusedColors.size > 0) {
    console.log('\n=== REMOVAL CANDIDATES ===');
    console.log('These colors can be safely removed from the theme:');
    Array.from(unusedColors).sort().forEach((color, index) => {
      console.log(`${index + 1}. ${color}`);
    });
    
    const potentialSavings = (unusedColors.size / themeColors.length * 100).toFixed(1);
    console.log(`\nPotential reduction: ${unusedColors.size} colors (${potentialSavings}%)`);
  }
  
  return { colorUsage, unusedColors, sortedColors };
}

// Run the analysis
analyzeColorUsage();
