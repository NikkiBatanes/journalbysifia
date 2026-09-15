import { createContext, useContext } from 'react';

// Palette changes belong to Moments, not the siFia editor/carousel.
export const MomentsPaletteContext = createContext(false);
export const useMomentsPalette = () => useContext(MomentsPaletteContext);
