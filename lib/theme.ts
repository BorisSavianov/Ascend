import { Platform, type TextStyle, type ViewStyle } from 'react-native';

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

export const colors = {
  bg: {
    canvas:         '#060810',
    base:           '#0B1018',
    surface:        '#111822',
    surfaceRaised:  '#172030',
    surfaceOverlay: '#1C2840',
    input:          '#0D1520',
  },
  border: {
    subtle:  '#202A36',
    default: '#2B3644',
    strong:  '#3A4759',
  },
  text: {
    primary:  '#F5F7FA',
    secondary: '#B5BFCA',
    tertiary:  '#8E9BAB',
    disabled:  '#5E6773',
  },
  // Blue accent — nutrition, navigation, calm states
  accent: {
    primary:       '#7EA6FF',
    primaryPressed: '#6B94F0',
    primaryMuted:  'rgba(126, 166, 255, 0.14)',
    primaryGlow:   'rgba(126, 166, 255, 0.06)',
  },
  // Amber accent — workout/intensity states (Move tab, session screen)
  intensity: {
    primary:  '#FF8C3A',
    pressed:  '#E87C2E',
    muted:    'rgba(255, 140, 58, 0.14)',
    glow:     'rgba(255, 140, 58, 0.06)',
  },
  semantic: {
    success: '#30D158',
    warning: '#FFD60A',
    danger:  '#FF453A',
    info:    '#64D2FF',
  },
  overlay: 'rgba(0, 0, 0, 0.58)',
} as const;

// ---------------------------------------------------------------------------
// Spacing
// ---------------------------------------------------------------------------

export const spacing = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 48,
  '5xl': 64,
} as const;

// ---------------------------------------------------------------------------
// Border Radius
// ---------------------------------------------------------------------------

export const radius = {
  xs:   8,
  sm:   12,
  md:   16,
  lg:   20,
  xl:   28,
  pill: 999,
} as const;

// ---------------------------------------------------------------------------
// Typography — font families
// Loaded via expo-font in app/_layout.tsx. These strings match the export
// names from @expo-google-fonts/* packages exactly.
// ---------------------------------------------------------------------------

export const fontFamily = {
  // Headings / display — athletic, condensed
  displayRegular: 'BarlowSemiCondensed_400Regular',
  displayMedium:  'BarlowSemiCondensed_500Medium',
  displaySemi:    'BarlowSemiCondensed_600SemiBold',
  displayBold:    'BarlowSemiCondensed_700Bold',
  // Body / UI — warm, legible
  regular: 'DMSans_400Regular',
  medium:  'DMSans_500Medium',
  // Data / Metrics — tabular, technical
  monoRegular: 'DMMono_400Regular',
  monoMedium:  'DMMono_500Medium',
} as const;

// Fallback families used before fonts load (prevents FOUC)
const _systemBase = Platform.select({
  ios:     'System',
  android: 'sans-serif',
  default: 'System',
});
const _systemMono = Platform.select({
  ios:     'Courier',
  android: 'monospace',
  default: 'Courier',
});

export const fontFamilyFallback = {
  display: _systemBase,
  body:    _systemBase,
  mono:    _systemMono,
} as const;

// ---------------------------------------------------------------------------
// Typography tokens
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
    fontSize:   36,
    lineHeight: 40,
    color:      colors.text.primary,
  },
  h1: {
    fontFamily: fontFamily.displaySemi,
    fontSize:   30,
    lineHeight: 36,
    color:      colors.text.primary,
  },
  h2: {
    fontFamily: fontFamily.displaySemi,
    fontSize:   22,
    lineHeight: 28,
    color:      colors.text.primary,
  },
  h3: {
    fontFamily: fontFamily.medium,
    fontSize:   18,
    lineHeight: 24,
    color:      colors.text.primary,
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize:   16,
    lineHeight: 22,
    color:      colors.text.primary,
  },
  bodySm: {
    fontFamily: fontFamily.regular,
    fontSize:   14,
    lineHeight: 20,
    color:      colors.text.secondary,
  },
  label: {
    fontFamily: fontFamily.medium,
    fontSize:   13,
    lineHeight: 16,
    color:      colors.text.secondary,
  },
  caption: {
    fontFamily: fontFamily.regular,
    fontSize:   12,
    lineHeight: 16,
    color:      colors.text.tertiary,
  },
  // Metric tokens — always DM Mono, always tabular-nums
  metricHero: {
    fontFamily:  fontFamily.monoMedium,
    fontSize:    52,
    lineHeight:  52,
    color:       colors.text.primary,
    fontVariant: ['tabular-nums'],
  },
  metricLg: {
    fontFamily:  fontFamily.monoMedium,
    fontSize:    36,
    lineHeight:  38,
    color:       colors.text.primary,
    fontVariant: ['tabular-nums'],
  },
  metricMd: {
    fontFamily:  fontFamily.monoRegular,
    fontSize:    24,
    lineHeight:  28,
    color:       colors.text.primary,
    fontVariant: ['tabular-nums'],
  },
  metricSm: {
    fontFamily:  fontFamily.monoRegular,
    fontSize:    14,
    lineHeight:  18,
    color:       colors.text.secondary,
    fontVariant: ['tabular-nums'],
  },
};

// ---------------------------------------------------------------------------
// Motion — timing durations + spring presets
// Easing curves are applied at the call site (import Easing from
// react-native-reanimated) using the semantic names documented below:
//
//   out       → Easing.out(Easing.cubic)       — most UI transitions
//   outQuart  → Easing.out(Easing.poly(4))     — content reveals
//   inOut     → Easing.inOut(Easing.cubic)     — bidirectional (toggles)
//   linear    → Easing.linear                  — continuous (timers, loading)
// ---------------------------------------------------------------------------

export const motion = {
  // Durations (ms)
  instant:     50,   // Haptic-synced micro feedback
  fast:        100,  // Press states, small toggles
  standard:    220,  // Screen element entry, tab content
  deliberate:  350,  // Modals, sheets, significant reveals
  celebration: 600,  // Workout completion, achievements

  // Scale on press — slightly more tactile than before
  pressScale: 0.96,

  // Backward-compat aliases (used by components not yet updated to new tokens)
  medium: 140,
  slow:   200,

  // Spring presets — pass as second arg to withSpring()
  spring: {
    // Gesture snap-to / tab indicator
    snappy:  { damping: 28, stiffness: 400, mass: 0.8 },
    // Standard UI spring
    default: { damping: 22, stiffness: 280, mass: 0.9 },
    // Content reveals
    gentle:  { damping: 18, stiffness: 200, mass: 1.0 },
    // Celebration / achievement
    bouncy:  { damping: 12, stiffness: 180, mass: 0.8 },
  },
} as const;

// ---------------------------------------------------------------------------
// Shadows & Elevation
// ---------------------------------------------------------------------------

export const shadows = {
  none: {} as ViewStyle,
  sm: {
    shadowColor:   '#000',
    shadowOpacity: 0.16,
    shadowRadius:  8,
    shadowOffset:  { width: 0, height: 4 },
    elevation:     4,
  } satisfies ViewStyle,
  md: {
    shadowColor:   '#000',
    shadowOpacity: 0.24,
    shadowRadius:  14,
    shadowOffset:  { width: 0, height: 8 },
    elevation:     8,
  } satisfies ViewStyle,
  lg: {
    shadowColor:   '#000',
    shadowOpacity: 0.32,
    shadowRadius:  20,
    shadowOffset:  { width: 0, height: 12 },
    elevation:     14,
  } satisfies ViewStyle,
  floating: {
    shadowColor:   '#000',
    shadowOpacity: 0.42,
    shadowRadius:  28,
    shadowOffset:  { width: 0, height: 16 },
    elevation:     20,
  } satisfies ViewStyle,
  // Colored glow — for hero cards and feature surfaces
  accentGlow: {
    shadowColor:   '#7EA6FF',
    shadowOpacity: 0.20,
    shadowRadius:  20,
    shadowOffset:  { width: 0, height: 0 },
    elevation:     0,
  } satisfies ViewStyle,
  intensityGlow: {
    shadowColor:   '#FF8C3A',
    shadowOpacity: 0.20,
    shadowRadius:  20,
    shadowOffset:  { width: 0, height: 0 },
    elevation:     0,
  } satisfies ViewStyle,
};

// ---------------------------------------------------------------------------
// Gradient surface stop-pairs
// Pass these to expo-linear-gradient's `colors` prop.
// ---------------------------------------------------------------------------

export const gradients = {
  // Today screen — calorie ring hero card (cool blue depth)
  nutrition: [colors.bg.surface, '#14203A'] as const,
  // Workout session / Move screen cards (warm amber depth)
  intensity: [colors.bg.surface, '#201610'] as const,
  // Insights screen (subtle cool tint)
  insights:  [colors.bg.surface, '#121A24'] as const,
  // Generic elevated surface
  raised:    [colors.bg.surface, colors.bg.surfaceRaised] as const,
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

/** Returns a metric TextStyle, defaulting to metricSm for inline use. */
export function metricStyle(size: 'sm' | 'md' | 'lg' | 'hero' = 'sm'): TextStyle {
  const map = {
    hero: typography.metricHero,
    lg:   typography.metricLg,
    md:   typography.metricMd,
    sm:   typography.metricSm,
  } as const;
  return map[size];
}
