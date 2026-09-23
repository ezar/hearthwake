// Names the dominant colours of an image from its pixels, to describe a thing without a vision model.

type Rgba = ArrayLike<number>;

// A plain colour name for one pixel, from its hue, saturation and lightness.
export function colourName(r: number, g: number, b: number): string {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (l > 0.82 && s < 0.35) return 'white';
  if (l < 0.14) return 'black';
  if (s < 0.14) return 'grey';
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const sector = max === rn ? ((gn - bn) / d) % 6 : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
  const h = (sector * 60 + 360) % 360;
  if (h >= 15 && h < 50 && l < 0.42) return 'brown';
  if (h >= 20 && h < 55 && l > 0.7 && s < 0.6) return 'beige';
  if (h < 15 || h >= 345) return l > 0.7 ? 'pink' : 'red';
  if (h < 40) return 'orange';
  if (h < 70) return 'yellow';
  if (h < 165) return 'green';
  if (h < 255) return 'blue';
  if (h < 290) return 'purple';
  return 'pink';
}

// The one or two colours covering at least `minShare` of the sampled pixels, most common first.
export function dominantColours(data: Rgba, step = 4, minShare = 0.25): string[] {
  const counts = new Map<string, number>();
  let total = 0;
  for (let i = 0; i + 3 < data.length; i += 4 * step) {
    if ((data[i + 3] ?? 255) < 128) continue;
    const name = colourName(data[i]!, data[i + 1]!, data[i + 2]!);
    counts.set(name, (counts.get(name) ?? 0) + 1);
    total++;
  }
  if (!total) return [];
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const picked = sorted.filter(([, n]) => n / total >= minShare).slice(0, 2);
  return (picked.length ? picked : sorted.slice(0, 1)).map(([name]) => name);
}

// "A white radiator.", "An orange and black cat."
export function describeThing(label: string, colours: string[]): string {
  const phrase = [colours.join(' and '), label].filter(Boolean).join(' ');
  return `${/^[aeiou]/i.test(phrase) ? 'An' : 'A'} ${phrase}.`;
}
