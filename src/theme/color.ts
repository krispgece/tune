// Colour helpers for the theme: sRGB hex, WCAG contrast and an OKLCH round trip.

export type Rgb = [number, number, number];

export function rgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function toHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((v) =>
        Math.round(Math.min(255, Math.max(0, v)))
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}

/** `#rgb` or `#rrggbb` in any case, as lower-case `#rrggbb`; anything else gives `null`. */
export function normalizeHex(value: string): string | null {
  const v = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  if (/^#[0-9a-f]{3}$/.test(v)) return '#' + [...v.slice(1)].map((c) => c + c).join('');
  return null;
}

const linear = (v: number) => {
  const x = v / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
};

export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map(linear) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1 to 21. */
export function contrast(a: string, b: string): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

export function mix(a: string, b: string, t: number): string {
  const p = rgb(a);
  const q = rgb(b);
  return toHex(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t);
}

/** Moves `color` toward `toward` until it reaches `target` contrast against every colour in `against`. */
export function ensure(color: string, against: string[], target: number, toward: string): string {
  let x = color;
  for (let i = 0; i < 80 && Math.min(...against.map((b) => contrast(x, b))) < target; i++) x = mix(x, toward, 0.05);
  return x;
}

export const INK_DARK = '#0c0d11';
export const INK_LIGHT = '#ffffff';

/** The near-black or the white text colour, whichever reads better on `bg`. */
export function bestText(bg: string): string {
  return contrast(INK_DARK, bg) >= contrast(INK_LIGHT, bg) ? INK_DARK : INK_LIGHT;
}

export function toOklch(hex: string): [number, number, number] {
  const [r, g, b] = rgb(hex).map(linear) as Rgb;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, Math.hypot(A, B), Math.atan2(B, A)];
}

/** The sRGB colour for an OKLCH value, or `null` when it falls outside sRGB. */
export function fromOklch(L: number, C: number, h: number): string | null {
  const A = C * Math.cos(h);
  const B = C * Math.sin(h);
  const l = Math.pow(L + 0.3963377774 * A + 0.2158037573 * B, 3);
  const m = Math.pow(L - 0.1055613458 * A - 0.0638541728 * B, 3);
  const s = Math.pow(L - 0.0894841775 * A - 1.291485548 * B, 3);
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  if (lin.some((v) => v < -0.0005 || v > 1.0005)) return null;
  const [r, g, b] = lin.map((v) => {
    const x = Math.min(1, Math.max(0, v));
    return 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
  }) as Rgb;
  return toHex(r, g, b);
}

/** Keeps the hue and darkens in OKLCH (a little more chroma, clipped to sRGB) until `ok` accepts the colour. */
export function deepen(hex: string, ok: (candidate: string) => boolean): string {
  const [L0, C0, h] = toOklch(hex);
  for (let L = Math.min(L0, 0.8); L >= 0; L -= 0.01) {
    let C = Math.min(C0 * 1.2, 0.26);
    let x = fromOklch(L, C, h);
    while (!x && C > 0.004) {
      C -= 0.004;
      x = fromOklch(L, C, h);
    }
    x ??= fromOklch(L, 0, h);
    if (x && ok(x)) return x;
  }
  return '#000000';
}

export type HueName =
  | 'white'
  | 'black'
  | 'grey'
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'turquoise'
  | 'blue'
  | 'purple'
  | 'pink';

/** A rough everyday name for a colour, for the mouse preview's screen-reader label. */
export function hueName(hex: string): HueName {
  const [r, g, b] = rgb(hex).map((v) => v / 255) as Rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  if (d < 0.1) return l > 0.85 ? 'white' : l < 0.15 ? 'black' : 'grey';
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  if (h < 15 || h >= 340) return 'red';
  if (h < 45) return 'orange';
  if (h < 70) return 'yellow';
  if (h < 160) return 'green';
  if (h < 195) return 'turquoise';
  if (h < 250) return 'blue';
  if (h < 290) return 'purple';
  return 'pink';
}
