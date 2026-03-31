import { Platform, type TextStyle, type ViewStyle } from 'react-native';

export const colors = {
  bg: {
    canvas: '#07090D',
    base: '#0D1117',
    surface: '#121821',
    surfaceRaised: '#171F2A',
    surfaceOverlay: '#1C2430',
    input: '#10161F',
  },
  border: {
    subtle: '#202A36',
    default: '#2B3644',
    strong: '#3A4759',
  },
  text: {
    primary: '#F5F7FA',
    secondary: '#B5BFCA',
    tertiary: '#7D8896',
    disabled: '#5E6773',
  },
  accent: {
    primary: '#8EA8FF',
    primaryPressed: '#7B96F4',
    primaryMuted: 'rgba(142, 168, 255, 0.16)',
  },
  semantic: {
    success: '#47C97E',
    warning: '#E3A64D',
    danger: '#F06A6A',
    info: '#6CB6FF',
  },
  overlay: 'rgba(0, 0, 0, 0.58)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
} as const;

export const radius = {
  sm: 12,
  md: 16,
  lg: 20,
  pill: 999,
} as const;

const baseFontFamily = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'System',
});

const mediumFontFamily = Platform.select({
  ios: 'System',
  android: 'sans-serif-medium',
  default: 'System',
});

export const fontFamily = {
  regular: baseFontFamily,
  medium: mediumFontFamily,
  semibold: mediumFontFamily,
} as const;

export type TypographyToken =
  | 'display'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'body'
  | 'bodySm'
  | 'label'
  | 'caption'
  | 'metricLg';

export const typography: Record<TypographyToken, TextStyle> = {
  display: {
    fontFamily: fontFamily.semibold,
    fontSize: 32,
    lineHeight: 38,
    color: colors.text.primary,
  },
  h1: {
    fontFamily: fontFamily.semibold,
    fontSize: 28,
    lineHeight: 34,
    color: colors.text.primary,
  },
  h2: {
    fontFamily: fontFamily.semibold,
    fontSize: 22,
    lineHeight: 28,
    color: colors.text.primary,
  },
  h3: {
    fontFamily: fontFamily.medium,
    fontSize: 18,
    lineHeight: 24,
    color: colors.text.primary,
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text.primary,
  },
  bodySm: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.secondary,
  },
  label: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    lineHeight: 16,
    color: colors.text.secondary,
  },
  caption: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    lineHeight: 16,
    color: colors.text.tertiary,
  },
  metricLg: {
    fontFamily: fontFamily.semibold,
    fontSize: 36,
    lineHeight: 38,
    color: colors.text.primary,
    fontVariant: ['tabular-nums'],
  },
};

export const motion = {
  fast: 80,
  medium: 140,
  slow: 200,
  pressScale: 0.98,
  spring: {
    damping: 22,
    stiffness: 280,
    mass: 0.9,
  },
} as const;

export const shadows = {
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0.24,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  } satisfies ViewStyle,
  floating: {
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 14,
  } satisfies ViewStyle,
};

export function alpha(hexColor: string, opacity: number): string {
  const clean = hexColor.replace('#', '');
  if (clean.length !== 6) return hexColor;
  const value = Math.max(0, Math.min(255, Math.round(opacity * 255)));
  return `#${clean}${value.toString(16).padStart(2, '0')}`;
}

export function metricStyle(size: 'sm' | 'lg' = 'sm'): TextStyle {
  return {
    ...(size === 'lg' ? typography.metricLg : typography.h3),
    fontVariant: ['tabular-nums'],
  };
}
