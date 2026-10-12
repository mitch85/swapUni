/** Design tokens from the SwapUni mockups. */
export const Colors = {
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  primarySoft: '#EFF6FF',
  primaryBorder: '#BFDBFE',
  success: '#10B981',
  successSoft: '#ECFDF5',
  warning: '#F59E0B',
  warningSoft: '#FFFBEB',
  danger: '#EF4444',
  dangerSoft: '#FEF2F2',
  navy: '#0F172A',
  splash: '#17233F',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  border: '#E2E8F0',
  text: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
} as const;

export const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const Radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
export const MaxContentWidth = 560;

export const Font = {
  title: { fontSize: 26, fontWeight: '700' as const, color: Colors.text, letterSpacing: -0.4 },
  heading: { fontSize: 20, fontWeight: '700' as const, color: Colors.text },
  subheading: { fontSize: 16, fontWeight: '600' as const, color: Colors.text },
  body: { fontSize: 15, color: Colors.text },
  small: { fontSize: 13, color: Colors.textSecondary },
  tiny: { fontSize: 11, color: Colors.textSecondary },
};
