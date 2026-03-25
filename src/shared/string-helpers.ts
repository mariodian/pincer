export interface OklchOptions {
  lightness?: [min: number, max: number];
  chroma?: [min: number, max: number];
}

export function stringToOklch(
  str: string,
  { lightness = [0.55, 0.8], chroma = [0.1, 0.2] }: OklchOptions = {},
): string {
  let h1 = 0;
  let h2 = 0;
  for (let i = 0; i < str.length; i++) {
    h1 = (str.charCodeAt(i) + ((h1 << 5) - h1)) | 0;
    h2 = (str.charCodeAt(i) + ((h2 << 7) - h2)) | 0;
  }

  const hue = ((h1 % 360) + 360) % 360;
  const l =
    lightness[0] +
    ((((h2 % 100) + 100) % 100) / 100) * (lightness[1] - lightness[0]);
  const c =
    chroma[0] +
    (((((h1 ^ h2) % 100) + 100) % 100) / 100) * (chroma[1] - chroma[0]);

  return `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${hue})`;
}
