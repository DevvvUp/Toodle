export const theme = {
  colors: {
    canvas: '#090909',
    surface1: '#141414',
    surface2: '#1c1c1c',
    hairline: '#262626',
    hairlineSoft: '#1a1a1a',
    ink: '#ffffff',
    inkMuted: '#999999',
    primary: '#ffffff',
    onPrimary: '#000000',
    accentBlue: '#0099ff',
    success: '#22c55e',
    risk: {
      critical: '#ef4444',
      criticalMuted: '#f87171',
      criticalDarkText: '#fca5a5',
      criticalBg: 'rgba(239, 68, 68, 0.1)',
      criticalBorder: 'rgba(239, 68, 68, 0.3)',
      criticalDarkBg: '#7f1d1d',
      warning: '#f59e0b',
      warningOrange: '#fb923c',
      warningBg: 'rgba(249, 115, 22, 0.1)',
      warningBorder: 'rgba(249, 115, 22, 0.2)',
      normal: '#22c55e',
      normalLight: '#4ade80',
      normalBg: 'rgba(34, 197, 94, 0.15)',
      normalBorder: 'rgba(34, 197, 94, 0.3)',
    },
  },
  radii: {
    xs: 4,
    sm: 6,
    md: 10,
    lg: 15,
    xl: 20,
    xxl: 30,
    pill: 100,
    full: 9999,
  },
  typography: {
    display: {
      fontFamily: 'Inter_600SemiBold',
      fontWeight: '600' as const,
      letterSpacing: -1.0,
    },
    displayCompact: {
      fontFamily: 'Inter_600SemiBold',
      fontWeight: '600' as const,
      letterSpacing: -0.8,
    },
    headline: {
      fontFamily: 'Inter_700Bold',
      fontWeight: '700' as const,
      letterSpacing: -0.8,
    },
    bodyLg: {
      fontFamily: 'Inter_400Regular',
      fontWeight: '400' as const,
      letterSpacing: -0.18,
    },
    body: {
      fontFamily: 'Inter_400Regular',
      fontWeight: '400' as const,
      letterSpacing: -0.15,
    },
    bodySm: {
      fontFamily: 'Inter_500Medium',
      fontWeight: '500' as const,
      letterSpacing: -0.14,
    },
    caption: {
      fontFamily: 'Inter_500Medium',
      fontWeight: '500' as const,
      letterSpacing: -0.13,
    },
    micro: {
      fontFamily: 'Inter_400Regular',
      fontWeight: '400' as const,
      letterSpacing: -0.12,
    },
    button: {
      fontFamily: 'Inter_500Medium',
      fontWeight: '500' as const,
      letterSpacing: -0.14,
    },
    mono: {
      fontFamily: 'FiraCode_400Regular',
    },
  },
} as const;

export type Theme = typeof theme;
