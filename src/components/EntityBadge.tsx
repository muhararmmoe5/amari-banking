import { ENTITY_COLORS, ENTITY_LABELS } from '@/constants/accounts';
import type { EntityType } from '@/types';

export function EntityBadge({ entity, size = 'sm' }: { entity: EntityType; size?: 'sm' | 'xs' }) {
  const color = ENTITY_COLORS[entity];
  const label = ENTITY_LABELS[entity];
  return (
    <span
      className={`pill ${size === 'xs' ? 'text-[10px]' : 'text-xs'}`}
      style={{ backgroundColor: `${color}1f`, color, border: `1px solid ${color}40` }}
    >
      {label}
    </span>
  );
}

export function EntityDot({ entity }: { entity: EntityType }) {
  return (
    <span
      className="inline-block w-2 h-2 rounded-full"
      style={{ backgroundColor: ENTITY_COLORS[entity] }}
      title={ENTITY_LABELS[entity]}
    />
  );
}
