import { Colors as OriginalColors } from '../../theme';

declare module '../../theme' {
  export interface Colors extends OriginalColors {
    inactiveIcon: string;
  }
}
