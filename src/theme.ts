// Legacy theme file - now exports from new theme system
// This maintains backward compatibility while using the new organized theme structure
import { Colors as NewColors } from './theme/colors';
import { Fonts as NewFonts, defaultTextStyle } from './theme/fonts';

// Export Colors from new theme system for backward compatibility
export const Colors = NewColors;

// Export Fonts from new theme system for backward compatibility
// Important: expose the full Fonts object so top-level shorthands (regular, medium, semiBold, bold)
// map to DEFAULT_FONT_FAMILY defined in theme/fonts (Lexend by default)
export const Fonts = NewFonts;
export const defaultFontFamily = defaultTextStyle.fontFamily;

// Shared card padding constants (preserved for backward compatibility)
export const CARD_HORIZONTAL_PADDING = 14;
export const CARD_CONTENT_PADDING = 30;
