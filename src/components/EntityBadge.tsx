import { ENTITY_COLORS, ENTITY_LABELS } from '@/constants/accounts';
import type { EntityType } from '@/types';

const INITIALS: Record<string, string> = {
  BYTES_AI: 'B',
  ROCKET_WIRELESS: 'R',
  DELICIOUS_BYTES: 'D',
  AMARI_VENTURES: 'A',
  BYTES_REST_TECH: 'T',
  AMARI_HOLDINGS: 'H',
  PERSONAL: 'P',
  MULTI_ENTITY: 'M',
  BUSINESS_SHARED: 'S',
  UNKNOWN: '?',
};

/** Entity badge per the Amari Dash 3 design — a colored left rail, an
 *  italic-serif monogram square in the entity color, and the entity's
 *  name in Geist 500. The pill border is tinted with 26% of the entity
 *  color so each entity reads as its own brand. */
export function EntityBadge({
  entity,
  size = 'md',
}: {
  entity: EntityType | string;
  size?: 'xs' | 'sm' | 'md';
}) {
  const color = (ENTITY_COLORS as Record<string, string>)[entity] || '#6f6e68';
  const label = (ENTITY_LABELS as Record<string, string>)[entity] || String(entity);
  const initial = INITIALS[entity as string] || label.charAt(0).toUpperCase();
  const small = size === 'xs' || size === 'sm';
  const monoSize = small ? 18 : 22;
  const monoFontSize = small ? 11 : 13;
  return (
    <span
      className="inline-flex items-center relative"
      style={{
        padding: small ? '3px 9px 3px 4px' : '4px 10px 4px 4px',
        gap: 7,
        borderRadius: 7,
        background: 'rgba(17,17,20,0.6)',
        border: `0.5px solid color-mix(in oklab, ${color} 26%, rgba(255,255,255,0.055))`,
      }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 2,
          background: color,
          borderRadius: '7px 0 0 7px',
        }}
      />
      <span
        className="grid place-items-center"
        style={{
          width: monoSize,
          height: monoSize,
          borderRadius: 5,
          background: color,
          color: '#1a1a1a',
          fontFamily: 'var(--font-serif, "Instrument Serif", serif)',
          fontStyle: 'italic',
          fontWeight: 500,
          fontSize: monoFontSize,
          lineHeight: 1,
          letterSpacing: '-.04em',
          boxShadow: `inset 0 0 0 0.5px rgba(0,0,0,.25), 0 0 10px -4px ${color}`,
        }}
      >
        {initial}
      </span>
      <span
        style={{
          fontSize: small ? 11 : 11.5,
          color: 'var(--ink, #f0eee9)',
          fontWeight: 500,
          letterSpacing: '-.005em',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
    </span>
  );
}

/** Just the colored dot, when you need a minimal entity indicator. */
export function EntityDot({ entity }: { entity: EntityType }) {
  return (
    <span
      className="inline-block w-2 h-2 rounded-full"
      style={{ backgroundColor: ENTITY_COLORS[entity] }}
      title={ENTITY_LABELS[entity]}
    />
  );
}
