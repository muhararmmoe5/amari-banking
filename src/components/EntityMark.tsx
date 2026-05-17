import { ENTITY_COLORS } from '@/constants/accounts';
import type { EntityType } from '@/types';

const MARKS: Partial<Record<EntityType, string>> = {
  BYTES_AI: 'B',
  ROCKET_WIRELESS: 'R',
  DELICIOUS_BYTES: 'D',
  AMARI_VENTURES: 'A',
  BYTES_REST_TECH: 'BR',
  PERSONAL: 'P',
  MULTI_ENTITY: 'M',
  BUSINESS_SHARED: 'BS',
  UNKNOWN: '?',
};

export function EntityMark({ entity, size = 22 }: { entity: EntityType; size?: number }) {
  const color = ENTITY_COLORS[entity] || '#6f6e68';
  const mark = MARKS[entity] || entity[0];
  return (
    <span
      className="inline-grid place-items-center font-bold"
      style={{
        width: size,
        height: size,
        borderRadius: 6,
        background: color,
        color: '#0a0a0c',
        fontSize: size <= 18 ? 9 : 11,
        letterSpacing: '-0.01em',
        flex: `0 0 ${size}px`,
        boxShadow: `0 0 0 1px rgba(255,255,255,.05), 0 0 ${size * 0.7}px -6px ${color}66`,
      }}
    >
      {mark}
    </span>
  );
}
