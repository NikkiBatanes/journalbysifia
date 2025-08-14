# Font Setup Instructions

## Required Google Fonts

Download the following fonts and place them in `assets/fonts/`:

### 1. Poppins
- Download from: https://fonts.google.com/specimen/Poppins
- Required weights: Regular (400), Medium (500), SemiBold (600), Bold (700)
- Files needed:
  - `Poppins-Regular.ttf`
  - `Poppins-Medium.ttf`
  - `Poppins-SemiBold.ttf`
  - `Poppins-Bold.ttf`

### 2. Nunito Sans
- Download from: https://fonts.google.com/specimen/Nunito+Sans
- Use Variable Font (single file with all weights)
- Files needed:
  - `NunitoSans-VariableFont_YTLC,opsz,wdth,wght.ttf`

### 3. Lora
- Download from: https://fonts.google.com/specimen/Lora
- Required weights: Regular (400), Medium (500), SemiBold (600), Bold (700)
- Files needed:
  - `Lora-Regular.ttf`
  - `Lora-Medium.ttf`
  - `Lora-SemiBold.ttf`
  - `Lora-Bold.ttf`

### 4. Lexend (Dyslexia-friendly)
- Download from: https://fonts.google.com/specimen/Lexend
- Required weights: Regular (400), Medium (500), SemiBold (600), Bold (700)
- Files needed:
  - `Lexend-Regular.ttf`
  - `Lexend-Medium.ttf`
  - `Lexend-SemiBold.ttf`
  - `Lexend-Bold.ttf`

## Installation Steps

1. Download all font files above
2. Place them in `assets/fonts/` directory
3. Run `npx react-native-asset` to link fonts
4. Clean and rebuild the app:
   ```bash
   npx react-native start --reset-cache
   cd ios && pod install && cd ..
   npx react-native run-ios
   npx react-native run-android
   ```

## Font Usage

Fonts are automatically integrated into the theme system. Users can select fonts in Profile > Settings > Font.

## Accessibility

- **Lexend** is specifically designed for improved reading proficiency and is recommended for users with dyslexia
- All fonts meet WCAG accessibility guidelines for readability
