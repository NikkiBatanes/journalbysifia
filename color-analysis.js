const colors = {
  // Core Brand Colors
  anchorBlue: '#1a3c6d',
  anchorBlueLight: '#E8EDFF',
  modalBlue: '#274674',
  faithGold: '#F5A623',
  growthGreen: '#4CAF50',
  alertCoral: '#FF6B6B',
  devotionalPurple: '#6A0DAD',
  spiritualPink: '#E91E63',
  playbookBlue: '#2196F3',
  lightPurple: '#F3E5F5',

  // Standard UI Colors
  text: '#1A1A1A',
  textGray: '#9E9E9E',
  error: '#FF3B30',

  // Grayscale
  white: '#FFFFFF',
  black: '#000000',
  hopeWhite: '#F2F5F7',
  lightGray: '#E0E0E0',
  lightBlue: '#E8F4FD',
  darkGray: '#424242',
  trustGrey: '#B0B8C1',

  // UI Colors
  inputBackground: '#264777',
  inputBorder: '#3d5e8d',
  cardBackground: 'rgba(255, 255, 255, 0.95)',
  cardBorder: 'rgba(0, 0, 0, 0.05)',

  // Backgrounds
  darkBackground: '#121212',

  // Status
  warning: '#FFC107',

  // Semantic colors
  lightBackground: '#f8f9fa',
  borderLight: '#e1e5e9',
  backgroundBlue: '#f0f8ff',

  // Admin & Dashboard Colors
  wisdomIndigo: '#6366F1',
  reflectionGray: '#6B7280',
  sanctuaryWhite: '#F9FAFB',
  gentleBorder: '#E5E7EB',
  scriptureText: '#1F2937',
  peaceGray: '#F3F4F6',
  treasureGold: '#D4AF37',
  journeyGray: '#e0e0e0',

  // Status & Interactive Colors
  prosperityGreen: '#10B981',
  warningAmber: '#F59E0B',
  urgentRed: '#EF4444',
  mysticalViolet: '#8B5CF6',
  clarityTeal: '#06B6D4',
  revelationBlue: '#5196f4',
  sacrificeRed: '#DC2626',
  truthBlue: '#2563EB',
  contemplationGray: '#9CA3AF',

  // Text Hierarchy
  meditationGray: '#374151',
  wisdomText: '#333333',
  guidanceText: '#666666',
  whisperText: '#555555',
  echoText: '#888888',

  // ActionStepsCard colors
  prayerPurple: '#9B59B6',
  reflectionBlue: '#3498DB',
  gratitudeRed: '#E74C3C',
  winGold: '#F39C12',
  timeblockGreen: '#2ECC71',
  budgetingGreen: '#27AE60',
  tithingPurple: '#8E44AD',
  debtRed: '#C0392B',
  actionBackground: '#d9dfe7',
  heartRed: '#FF6B6B',
};

// Function to convert hex to RGB
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : null;
}

// Function to calculate color difference using Delta E (simplified)
function colorDifference(color1, color2) {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  if (!rgb1 || !rgb2) {return 1000;}

  const deltaR = rgb1.r - rgb2.r;
  const deltaG = rgb1.g - rgb2.g;
  const deltaB = rgb1.b - rgb2.b;

  return Math.sqrt(deltaR * deltaR + deltaG * deltaG + deltaB * deltaB);
}

// Find similar colors
const colorEntries = Object.entries(colors).filter(([_, value]) => typeof value === 'string' && value.startsWith('#'));
const similarities = [];

for (let i = 0; i < colorEntries.length; i++) {
  for (let j = i + 1; j < colorEntries.length; j++) {
    const [name1, hex1] = colorEntries[i];
    const [name2, hex2] = colorEntries[j];
    const diff = colorDifference(hex1, hex2);

    // Consider colors similar if difference is less than 50 (very similar) or 80 (somewhat similar)
    if (diff < 80) {
      const similarity = Math.max(0, (80 - diff) / 80 * 100);
      similarities.push({
        color1: name1,
        hex1,
        color2: name2,
        hex2,
        difference: diff,
        similarity: similarity.toFixed(1) + '%',
      });
    }
  }
}

// Sort by similarity (lowest difference = highest similarity)
similarities.sort((a, b) => a.difference - b.difference);

console.log('=== SIMILAR COLORS ANALYSIS ===');
console.log('Total colors analyzed:', colorEntries.length);
console.log('Similar color pairs found:', similarities.length);
console.log('');

if (similarities.length > 0) {
  console.log('| Color 1 | Hex 1 | Color 2 | Hex 2 | Similarity | Difference |');
  console.log('|---------|-------|---------|-------|------------|------------|');

  similarities.forEach(sim => {
    console.log(`| ${sim.color1} | ${sim.hex1} | ${sim.color2} | ${sim.hex2} | ${sim.similarity} | ${sim.difference.toFixed(1)} |`);
  });
} else {
  console.log('No similar colors found within threshold.');
}

// Calculate potential savings
const potentialSavings = Math.floor(similarities.length / 2); // Assuming we can merge half the similar pairs
const currentCount = colorEntries.length;
const newCount = currentCount - potentialSavings;
const savingsPercentage = ((potentialSavings / currentCount) * 100).toFixed(1);

console.log('\n=== CONSOLIDATION POTENTIAL ===');
console.log(`Current colors: ${currentCount}`);
console.log(`Potential consolidations: ${potentialSavings}`);
console.log(`New color count: ${newCount}`);
console.log(`Potential savings: ${savingsPercentage}%`);
