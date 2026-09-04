export const colors = {
  background: '#0B1020',
  surface: '#151B33',
  surfaceAlt: '#1E2646',
  border: '#2A3358',
  text: '#F2F5FF',
  textMuted: '#98A2C8',
  accent: '#FF7A29',
  good: '#2ED47A',
  warn: '#FFC24B',
  danger: '#FF3B30',
};

export const phaseColors: Record<string, string> = {
  idle: colors.textMuted,
  ok: colors.good,
  slouching: colors.warn,
  scare: colors.accent,
  countdown: colors.accent,
  alarm: colors.danger,
  cooldown: colors.good,
};

export const radius = { sm: 10, md: 16, lg: 24, pill: 999 };
export const spacing = { xs: 6, sm: 10, md: 16, lg: 24, xl: 32 };
