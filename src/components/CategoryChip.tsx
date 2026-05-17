import { Tag } from 'lucide-react';
import { ENTITY_COLORS } from '@/constants/accounts';
import type { EntityType } from '@/types';

export function CategoryChip({
  category,
  entity,
}: {
  category: string | null | undefined;
  entity?: EntityType | null;
}) {
  if (!category) {
    return (
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-medium text-ink-mute"
        style={{ background: 'transparent', border: '1px dashed rgba(255,255,255,0.16)' }}
      >
        <Tag size={10} /> Tag
      </span>
    );
  }
  const color = entity ? ENTITY_COLORS[entity] : '#6f6e68';
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-2xs font-medium text-ink-dim"
      style={{
        background: 'rgba(22,22,26,0.8)',
        border: '1px solid rgba(255,255,255,0.055)',
        maxWidth: 160,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      <span
        className="rounded-full shrink-0"
        style={{ width: 5, height: 5, background: color }}
      />
      {category}
    </span>
  );
}
