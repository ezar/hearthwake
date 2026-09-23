// Stroke icons drawn for Hearthwake; all decorative, so screen readers skip them.
import type { ReactNode } from 'react';

function Icon({ size = 22, stroke = 2, children }: { size?: number; stroke?: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

type P = { size?: number };

export const Flame = ({ size = 28 }: P) => (
  <Icon size={size} stroke={1.8}>
    <path d="M12 2.6c2.6 3.4 5.1 5.6 5.1 9.4a5.1 5.1 0 0 1-10.2 0c0-2.2 1-3.8 2.2-5.1.3 1.7 1.2 2.6 2 2.7-.3-2.5.2-4.9.9-7z" />
    <path d="M4.3 21.4h15.4" />
  </Icon>
);
export const Sliders = (p: P) => (
  <Icon {...p} stroke={1.8}>
    <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="8" cy="17" r="2" />
  </Icon>
);
export const Camera = (p: P) => (
  <Icon {...p}>
    <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
    <circle cx="12" cy="13" r="3.5" />
  </Icon>
);
export const Close = (p: P) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);
export const Back = (p: P) => (
  <Icon {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Icon>
);
export const Mic = (p: P) => (
  <Icon {...p}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </Icon>
);
export const Keyboard = (p: P) => (
  <Icon {...p} stroke={1.8}>
    <rect x="2.5" y="6" width="19" height="12" rx="2" />
    <path d="M6 10h1M10 10h1M14 10h1M18 10h0M7 14h10" />
  </Icon>
);
export const Send = (p: P) => (
  <Icon {...p}>
    <path d="M5 12h13M13 6l6 6-6 6" />
  </Icon>
);
export const Check = (p: P) => (
  <Icon {...p} stroke={2.6}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Icon>
);
export const Download = (p: P) => (
  <Icon {...p}>
    <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
  </Icon>
);
export const Phone = (p: P) => (
  <Icon {...p} stroke={1.8}>
    <rect x="7" y="2" width="10" height="20" rx="2" />
    <path d="M11 18h2" />
  </Icon>
);
export const Wave = (p: P) => (
  <Icon {...p}>
    <path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4" />
  </Icon>
);
export const Speaker = (p: P) => (
  <Icon {...p} stroke={1.8}>
    <path d="M4 9v6h4l5 4V5L8 9z" />
    <path d="M16.5 8.5a5 5 0 0 1 0 7" />
  </Icon>
);
export const Pencil = (p: P) => (
  <Icon {...p} stroke={1.8}>
    <path d="M4 20h4L19 9l-4-4L4 16z" />
    <path d="M13.5 6.5l4 4" />
  </Icon>
);
export const Warning = (p: P) => (
  <Icon {...p} stroke={1.8}>
    <path d="M12 3l10 18H2z" />
    <path d="M12 10v5M12 18h0" />
  </Icon>
);
