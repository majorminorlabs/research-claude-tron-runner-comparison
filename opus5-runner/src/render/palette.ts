/** Tron-ish palette: cold cyan for the player's side, hot orange for hazards. */
export const PALETTE = {
  void: '#02050b',
  deep: '#040d18',
  horizon: '#0a2a46',
  grid: '#0b4f6e',
  gridBright: '#18b7d8',
  cyan: '#39e7ff',
  cyanSoft: '#7df4ff',
  white: '#e8feff',
  amber: '#ff8a1e',
  amberSoft: '#ffc168',
  violet: '#b85cff',
  danger: '#ff3355',
  shield: '#5effc2',
  boost: '#ffe95c',
} as const;

export function rgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}
