export const COLORS = {
  bg: 0x01040a,
  fog: 0x020813,
  cyan: 0x19e6ff,
  cyanBright: 0x9ff6ff,
  deepBlue: 0x0a3c8c,
  orange: 0xff6a1a,
  orangeHot: 0xffa24a,
  red: 0xff2a3a,
  white: 0xeafcff,
  yellow: 0xffe14d,
  magenta: 0xff3df2,
  lime: 0x6dff8a,
  suit: 0x04080f,
} as const;

export const POWER_COLORS = {
  shield: 0x4aa8ff,
  magnet: COLORS.magenta,
  overclock: COLORS.yellow,
  phase: COLORS.lime,
} as const;
