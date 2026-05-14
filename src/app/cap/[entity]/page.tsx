import Link from 'next/link';
import { notFound } from 'next/navigation';
import { listPeople, listHoldings, listContributions, listSafes } from '@/lib/db/cap';
import { ENTITY_LABELS, ENTITY_COLORS, BUSINESS_ENTITIES } from '@/constants/accounts';
import type { EntityType } from '@/types';
import { ArrowLeft } from 'lucide-react';
import CapEntityClient from './CapEntityClient';

export const dynamic = 'force-dynamic';

export default function CapEntityPage({ params }: { params: { entity: string } }) {
  const entity = params.entity as EntityType;
  if (!BUSINESS_ENTITIES.includes(entity)) notFound();

  const people = listPeople();
  const holdings = listHoldings(entity);
  const contributions = listContributions(entity);
  const safes = listSafes(entity);

  return (
    <div className="p-8 space-y-5 max-w-[1320px]">
      <div>
        <Link href="/cap" className="inline-flex items-center gap-1 text-xs text-ink-mute hover:text-ink mb-3">
          <ArrowLeft size={12} /> Back to overview
        </Link>
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full" style={{ background: ENTITY_COLORS[entity] }} />
          <h1 className="text-2xl font-semibold">{ENTITY_LABELS[entity]}</h1>
        </div>
        <p className="text-sm text-ink-dim mt-1">Equity, contributions, and SAFEs for this entity.</p>
      </div>

      {people.length === 0 ? (
        <div className="card p-10 text-center space-y-3">
          <p className="text-sm text-ink-dim">Add people on the Team page before assigning equity or contributions.</p>
          <Link href="/team" className="btn btn-primary inline-flex">Go to Team</Link>
        </div>
      ) : (
        <CapEntityClient
          entity={entity}
          people={people}
          initialHoldings={holdings}
          initialContributions={contributions}
          initialSafes={safes}
        />
      )}
    </div>
  );
}
