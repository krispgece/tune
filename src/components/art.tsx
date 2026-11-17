// The app's own drawings: the logo, the mouse preview and the unplugged cable. No vendor artwork.
import type { Zones } from '../backend/types';
import { useI18n } from '../i18n/context';

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 32 32">
      <rect x="1" y="1" width="30" height="30" rx="9" style={{ fill: 'var(--accent-fill)' }} />
      <g fill="none" strokeLinecap="round" style={{ stroke: 'var(--on-accent)' }}>
        <circle cx="16" cy="17.5" r="7" strokeWidth="2" />
        <path d="M16 17.5 L20 13.5" strokeWidth="2.2" />
        <path d="M9 9.5h.01M16 6.75h.01M23 9.5h.01" strokeWidth="2.4" />
      </g>
    </svg>
  );
}

const OUTLINE =
  'M130 52 C 170 52, 192 78, 194 120 C 196 170, 198 220, 198 254 C 198 306, 168 338, 130 338 C 92 338, 62 306, 62 254 C 62 220, 64 170, 66 120 C 68 78, 90 52, 130 52 Z';

const OUTER = {
  front: ['M66 120 C 68 78, 90 52, 130 52 C 170 52, 192 78, 194 120'],
  middle: ['M194.6 138 C 196 180, 198 220, 198 240', 'M65.4 138 C 64 180, 62 220, 62 240'],
  rear: ['M198 258 C 198 306, 168 338, 130 338 C 92 338, 62 306, 62 258'],
};

const INNER = {
  front: ['M75 121 C 77 84, 96 61, 130 61 C 164 61, 183 84, 185 121'],
  middle: ['M186.6 139 C 188 178, 189 218, 189 240', 'M73.4 139 C 72 178, 71 218, 71 240'],
  rear: ['M189 258 C 189 300, 163 329, 130 329 C 97 329, 71 300, 71 258'],
};

const ZONE_KEYS = ['front', 'middle', 'rear'] as const;

function Strips({ paths, colors }: { paths: typeof OUTER; colors: Zones | null }) {
  return (
    <>
      {ZONE_KEYS.flatMap((zone) =>
        paths[zone].map((d) => <path key={d} d={d} stroke={colors ? colors[zone] : 'var(--mouse-unlit)'} />),
      )}
    </>
  );
}

/** A top view of a three-zone mouse with its light strips; `colors` is `null` with the lights off. */
export function MousePreview({ colors, label }: { colors: Zones | null; label: string }) {
  const { t } = useI18n();
  const lit = colors !== null;
  return (
    <svg role="img" aria-label={label} viewBox="-10 0 280 400">
      <defs>
        <filter id="preview-halo" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="11" />
        </filter>
        <filter id="preview-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4.5" />
        </filter>
      </defs>
      <g transform="translate(0 10)">
        <g
          filter="url(#preview-halo)"
          fill="none"
          strokeWidth="16"
          strokeLinecap="round"
          style={{ opacity: lit ? 'var(--halo-op)' : 0, transition: 'opacity 200ms' }}
        >
          <Strips paths={OUTER} colors={colors} />
        </g>
        <g strokeWidth="1.5" style={{ fill: 'var(--mouse-part)', stroke: 'var(--mouse-line)' }}>
          <rect x="54" y="150" width="14" height="36" rx="6" />
          <rect x="54" y="192" width="14" height="36" rx="6" />
        </g>
        <path d={OUTLINE} strokeWidth="2" style={{ fill: 'var(--mouse-body)', stroke: 'var(--mouse-line)' }} />
        <path
          d="M66 120 C 68 78, 90 52, 130 52 C 170 52, 192 78, 194 120 L 195.9 170 L 180 170 Q 130 188 80 170 L 64.1 170 Z"
          style={{ fill: 'var(--mouse-part)' }}
        />
        <path d={OUTLINE} fill="none" strokeWidth="2" style={{ stroke: 'var(--mouse-line)' }} />
        <path
          d="M67 206 C 67 178, 67.5 150, 69 122 C 71 84, 92 58, 126 56"
          fill="none"
          strokeWidth="1.5"
          strokeLinecap="round"
          stroke="rgba(255, 255, 255, 0.14)"
        />
        <g
          filter="url(#preview-glow)"
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          style={{ opacity: lit ? 0.9 : 0, transition: 'opacity 200ms' }}
        >
          <Strips paths={INNER} colors={colors} />
        </g>
        <g fill="none" strokeWidth="4" strokeLinecap="round">
          <Strips paths={INNER} colors={colors} />
        </g>
        <g fill="none" strokeWidth="2" strokeLinecap="round" style={{ stroke: 'var(--mouse-detail)' }}>
          <path d="M130 54 V 179" />
          <path d="M80 170 Q 130 188 180 170" />
        </g>
        <g strokeWidth="1.5" style={{ fill: 'var(--mouse-part)', stroke: 'var(--mouse-line)' }}>
          <rect x="121" y="78" width="18" height="40" rx="9" />
          <rect x="123" y="128" width="14" height="20" rx="5" />
        </g>
        <path
          d="M125 90 H 135 M125 98 H 135 M125 106 H 135"
          fill="none"
          strokeWidth="1.5"
          strokeLinecap="round"
          style={{ stroke: 'var(--mouse-detail)' }}
        />
      </g>
      <g fontSize="15" fontWeight="600" textAnchor="middle" style={{ fill: 'var(--stage-text)' }}>
        <text x="130" y="18">
          {t('zFront')}
        </text>
        <text x="246" y="214">
          {t('zMiddle')}
        </text>
        <text x="130" y="396">
          {t('zRear')}
        </text>
      </g>
    </svg>
  );
}

/** A small outline with one zone filled in, next to that zone's colour picker. */
export function ZoneGlyph({ zone, color }: { zone: keyof Zones; color: string }) {
  return (
    <svg aria-hidden width="20" height="34" viewBox="44 36 172 318">
      <path d={OUTLINE} fill="none" strokeWidth="12" style={{ stroke: 'var(--border-strong)' }} />
      {OUTER[zone].map((d) => (
        <path key={d} d={d} fill="none" strokeWidth="30" strokeLinecap="round" stroke={color} />
      ))}
    </svg>
  );
}

export function UnpluggedArt() {
  return (
    <svg aria-hidden className="art" viewBox="0 0 240 150">
      <g fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: 'var(--text-2)' }}>
        <path d="M62 44 C 80 44 90 56 90 72 L 90 110 C 90 128 78 138 62 138 C 46 138 34 128 34 110 L 34 72 C 34 56 44 44 62 44 Z" />
        <path d="M62 46 V 82" />
        <path d="M36 80 Q 62 92 88 80" />
        <rect x="58" y="56" width="8" height="16" rx="4" />
        <path d="M62 44 C 62 22 96 16 112 30 C 122 39 126 58 140 64" />
        <rect x="140" y="56" width="26" height="16" rx="3" />
        <path d="M166 59 H 176 V 69 H 166" />
      </g>
      <g fill="none" strokeWidth="2.5" strokeLinecap="round" style={{ stroke: 'var(--muted)' }}>
        <path d="M186 52 L 192 46" />
        <path d="M188 64 H 196" />
        <path d="M186 76 L 192 82" />
      </g>
      <g fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: 'var(--border-strong)' }}>
        <path d="M224 22 V 118" />
        <rect x="206" y="54" width="18" height="20" rx="2" />
      </g>
    </svg>
  );
}
