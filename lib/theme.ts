import { Platform, type TextStyle, type ViewStyle } from 'react-native';

// ---------------------------------------------------------------------------
// Colors — Ascend redesign: warmer blacks, dual domain accents, higher contrast
// ---------------------------------------------------------------------------

export const colors = {
  bg: {
    canvas: '#08090C',
    base: '#0E1014',
    surface: '#15181E',
    surfaceRaised: '#1C2028',
    surfaceOverlay: '#242934',
    input: '#10131A',
  },
  border: {
    subtle: '#1E222B',
    default: '#2A2F3A',
    strong: '#3A414F',
  },
  text: {
    primary: '#F2F4F7',
    secondary: '#C4C9D2',
    tertiary: '#8890A0',
    disabled: '#565D6B',
  },
  // Nutrition domain — cool, calm, data
  accent: {
    primary: '#8FB3FF',
    primaryPressed: '#7A9FEF',
    primaryMuted: 'rgba(143, 179, 255, 0.14)',
    primaryGlow: 'rgba(143, 179, 255, 0.08)',
    ink: '#0A1530',
  },
  // Movement domain — warm, kinetic, effort
  intensity: {
    primary: '#FF9B5A',
    pressed: '#E8864A',
    muted: 'rgba(255, 155, 90, 0.14)',
    glow: 'rgba(255, 155, 90, 0.08)',
    ink: '#2A1508',
  },
  // Neutral CTA — white button used across both domains
  cta: {
    bg: '#F2F4F7',
    pressed: '#D8DDE5',
    ink: '#0E1014',
  },
  semantic: {
    success: '#4ADE80',
    warning: '#FACC15',
    danger: '#FF5C57',
    info: '#7DD3FC',
  },
  overlay: 'rgba(0, 0, 0, 0.58)',
} as const;

// ---------------------------------------------------------------------------
// Spacing
// ---------------------------------------------------------------------------

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 48,
  '5xl': 64,
} as const;

// ---------------------------------------------------------------------------
// Border Radius
// ---------------------------------------------------------------------------

export const radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

// ---------------------------------------------------------------------------
// Typography — IBM Plex Sans (single family) + IBM Plex Mono (numeric data)
// Loaded via expo-font in app/_layout.tsx.
// ---------------------------------------------------------------------------

export const fontFamily = {
  // All display/heading/body — IBM Plex Sans
  displayRegular: 'IBMPlexSans_400Regular',
  displayMedium: 'IBMPlexSans_500Medium',
  displaySemi: 'IBMPlexSans_600SemiBold',
  displayBold: 'IBMPlexSans_700Bold',
  regular: 'IBMPlexSans_400Regular',
  medium: 'IBMPlexSans_500Medium',
  semiBold: 'IBMPlexSans_600SemiBold',
  // Tabular numeric data — IBM Plex Mono
  monoRegular: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
} as const;

// System fallbacks used before fonts load (prevents FOUC)
const _systemBase = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'System',
});
const _systemMono = Platform.select({
  ios: 'Courier',
  android: 'monospace',
  default: 'Courier',
});

export const fontFamilyFallback = {
  display: _systemBase,
  body: _systemBase,
  mono: _systemMono,
} as const;

// ---------------------------------------------------------------------------
// Typography tokens — single-font scale, weight + size carry hierarchy
// ---------------------------------------------------------------------------

export type TypographyToken =
  | 'display'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'body'
  | 'bodySm'
  | 'label'
  | 'caption'
  | 'metricHero'
  | 'metricLg'
  | 'metricMd'
  | 'metricSm';

export const typography: Record<TypographyToken, TextStyle> = {
  display: {
    fontFamily: fontFamily.displayBold,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.5,
    color: colors.text.primary,
  },
  h1: {
    fontFamily: fontFamily.displaySemi,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.4,
    color: colors.text.primary,
  },
  h2: {
    fontFamily: fontFamily.displaySemi,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.2,
    color: colors.text.primary,
  },
  h3: {
    fontFamily: fontFamily.displaySemi,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 0,
    color: colors.text.primary,
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text.primary,
  },
  bodySm: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.text.secondary,
  },
  label: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: colors.text.tertiary,
  },
  caption: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
    color: colors.text.tertiary,
  },
  // Metric tokens — IBM Plex Sans with tabular-nums feature
  metricHero: {
    fontFamily: fontFamily.displayMedium,
    fontSize: 52,
    lineHeight: 52,
    letterSpacing: -1.5,
    color: colors.text.primary,
    fontVariant: ['tabular-nums'],
  },
  metricLg: {
    fontFamily: fontFamily.displayMedium,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -0.8,
    color: colors.text.primary,
    fontVariant: ['tabular-nums'],
  },
  metricMd: {
    fontFamily: fontFamily.displayMedium,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.3,
    color: colors.text.primary,
    fontVariant: ['tabular-nums'],
  },
  metricSm: {
    fontFamily: fontFamily.monoMedium,
    fontSize: 14,
    lineHeight: 18,
    color: colors.text.secondary,
    fontVariant: ['tabular-nums'],
  },
};

// ---------------------------------------------------------------------------
// Motion — timing durations + spring presets
// ---------------------------------------------------------------------------

export const motion = {
  instant: 50,
  fast: 100,
  standard: 220,
  deliberate: 350,
  celebration: 600,
  pressScale: 0.96,
  // Backward-compat aliases
  medium: 140,
  slow: 200,
  spring: {
    snappy: { damping: 28, stiffness: 400, mass: 0.8 },
    default: { damping: 22, stiffness: 280, mass: 0.9 },
    gentle: { damping: 18, stiffness: 200, mass: 1.0 },
    bouncy: { damping: 12, stiffness: 180, mass: 0.8 },
  },
} as const;

// ---------------------------------------------------------------------------
// Shadows & Elevation
// ---------------------------------------------------------------------------

export const shadows = {
  none: {} as ViewStyle,
  sm: {
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  } satisfies ViewStyle,
  md: {
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  } satisfies ViewStyle,
  lg: {
    shadowColor: '#000',
    shadowOpacity: 0.32,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 14,
  } satisfies ViewStyle,
  floating: {
    shadowColor: '#000',
    shadowOpacity: 0.42,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 16 },
    elevation: 20,
  } satisfies ViewStyle,
  accentGlow: {
    shadowColor: '#8FB3FF',
    shadowOpacity: 0.20,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  } satisfies ViewStyle,
  intensityGlow: {
    shadowColor: '#FF9B5A',
    shadowOpacity: 0.20,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  } satisfies ViewStyle,
};

// ---------------------------------------------------------------------------
// Gradient surface stop-pairs
// ---------------------------------------------------------------------------

export const gradients = {
  nutrition: [colors.bg.surface, '#12203A'] as const,
  intensity: [colors.bg.surface, '#1E1408'] as const,
  insights: [colors.bg.surface, '#121A24'] as const,
  raised: [colors.bg.surface, colors.bg.surfaceRaised] as const,
} as const;

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

export function alpha(hexColor: string, opacity: number): string {
  const clean = hexColor.replace('#', '');
  if (clean.length !== 6) return hexColor;
  const value = Math.max(0, Math.min(255, Math.round(opacity * 255)));
  return `#${clean}${value.toString(16).padStart(2, '0')}`;
}

export function metricStyle(size: 'sm' | 'md' | 'lg' | 'hero' = 'sm'): TextStyle {
  const map = {
    hero: typography.metricHero,
    lg: typography.metricLg,
    md: typography.metricMd,
    sm: typography.metricSm,
  } as const;
  return map[size];
}
