import { POSITION_COORDS, POSITION_LABELS, POSITIONS } from '@um/engine';
import { familiarityLabel } from '@/lib/game-format';

function dotColor(f: number): string | null {
  if (f >= 20) return 'var(--color-success)';
  if (f >= 15) return 'var(--color-attr-4)';
  if (f >= 10) return 'var(--color-warning)';
  if (f >= 6) return 'var(--color-attr-2)';
  return null;
}

/** Top-down pitch (attacking upwards) showing where a player can play. */
export function PositionsMap({ positions }: { positions: number[] }) {
  return (
    <figure className="flex flex-col items-center gap-2">
      <svg
        viewBox="0 0 68 105"
        className="h-56 w-auto"
        role="img"
        aria-label="Positions the player can play"
      >
        <rect x="0" y="0" width="68" height="105" rx="2" fill="#1d3b2a" />
        <g fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.5">
          <rect x="2" y="2" width="64" height="101" />
          <line x1="2" y1="52.5" x2="66" y2="52.5" />
          <circle cx="34" cy="52.5" r="9" />
          <rect x="14" y="2" width="40" height="16" />
          <rect x="14" y="87" width="40" height="16" />
        </g>
        {POSITIONS.map((pos, i) => {
          const f = positions[i] ?? 1;
          const color = dotColor(f);
          const c = POSITION_COORDS[pos];
          // Engine coords: x = own goal → opponent goal; draw attacking upwards.
          const cx = 4 + c.y * 60;
          const cy = 101 - c.x * 97;
          return (
            <g key={pos}>
              <title>{`${POSITION_LABELS[pos]}: ${familiarityLabel(f)}`}</title>
              <circle
                cx={cx}
                cy={cy}
                r={4}
                fill={color ?? 'rgba(255,255,255,0.08)'}
                stroke="rgba(0,0,0,0.35)"
                strokeWidth="0.4"
              />
              <text
                x={cx}
                y={cy + 1.2}
                textAnchor="middle"
                fontSize="2.8"
                fontWeight="700"
                fill={color ? '#0b0e13' : 'rgba(255,255,255,0.45)'}
              >
                {pos}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-2xs text-fg-muted">
        {[20, 15, 10, 6].map((f) => (
          <span key={f} className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full" style={{ background: dotColor(f)! }} />
            {familiarityLabel(f)}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
