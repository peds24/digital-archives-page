// Traced from Lucide (lucide.dev, ISC license) — play/pause/skip-back/skip-
// forward — filled rather than their default thin outline, so they stay
// crisp at the small sizes the now-playing bar renders them at.
interface IconProps {
  size?: number;
}

const svgProps = {
  viewBox: '0 0 24 24',
  fill: 'currentColor',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true as const,
};

export function PlayIcon({ size = 16 }: IconProps) {
  return (
    <svg {...svgProps} width={size} height={size}>
      <path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z" />
    </svg>
  );
}

export function PauseIcon({ size = 16 }: IconProps) {
  return (
    <svg {...svgProps} width={size} height={size}>
      <rect x="14" y="3" width="5" height="18" rx="1" />
      <rect x="5" y="3" width="5" height="18" rx="1" />
    </svg>
  );
}

export function SkipBackIcon({ size = 16 }: IconProps) {
  return (
    <svg {...svgProps} width={size} height={size}>
      <path d="M17.971 4.285A2 2 0 0 1 21 6v12a2 2 0 0 1-3.029 1.715l-9.997-5.998a2 2 0 0 1-.003-3.432z" />
      <path d="M3 20V4" />
    </svg>
  );
}

export function SkipForwardIcon({ size = 16 }: IconProps) {
  return (
    <svg {...svgProps} width={size} height={size}>
      <path d="M21 4v16" />
      <path d="M6.029 4.285A2 2 0 0 0 3 6v12a2 2 0 0 0 3.029 1.715l9.997-5.998a2 2 0 0 0 .003-3.432z" />
    </svg>
  );
}
