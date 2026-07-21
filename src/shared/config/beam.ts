// shared/config/beam.ts
// Single source of truth for notification beam colors.
// Used by: PrescriptionList, Card, PrescriptionCardBack.

export const BEAM = {
  whatsapp: { color: '#0ACF83', glow: 'rgba(10,207,131,1)', fade: 'rgba(10,207,131,0.55)' },
  call:     { color: '#1862F5', glow: 'rgba(24,98,245,1)',  fade: 'rgba(24,98,245,0.55)' },
} as const;
