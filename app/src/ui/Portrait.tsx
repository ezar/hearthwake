// A soul's portrait: its photo, or its initial for things woken from a description, in its own colour.
import type { CSSProperties } from 'react';
import { hashName } from '../engine/voice';
import type { Soul } from '../store/souls';

// Ring and fill per tint; the ring colours differ in lightness as well as hue.
export const TINTS = [
  { tint: '#F08A4B', bg: '#3A2619' },
  { tint: '#8FBF93', bg: '#1F2A22' },
  { tint: '#C3A2E0', bg: '#2B2033' },
  { tint: '#8FB3E0', bg: '#1E2733' },
  { tint: '#E8A0B4', bg: '#33202A' },
];

export const tintOf = (soul: Pick<Soul, 'name' | 'createdAt'>) =>
  TINTS[hashName(`${soul.name}${soul.createdAt}`) % TINTS.length]!;

export function Portrait({
  soul,
  size = 56,
  ring = 2,
}: {
  soul: Pick<Soul, 'name' | 'createdAt' | 'thumbnail'>;
  size?: number;
  ring?: number;
}) {
  const { tint, bg } = tintOf(soul);
  const style = {
    '--size': `${size}px`,
    '--tint': tint,
    '--tint-bg': bg,
    borderWidth: ring,
  } as CSSProperties;
  return (
    <span className="portrait" style={style} aria-hidden="true">
      {soul.thumbnail ? <img src={soul.thumbnail} alt="" /> : (soul.name[0] ?? '?').toUpperCase()}
    </span>
  );
}
