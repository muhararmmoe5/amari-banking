import { redirect } from 'next/navigation';
import { requireUser, hasEditAccess } from '@/lib/auth';
import { suggestForPending } from '@/lib/db/bulk-suggest';
import { ENTITY_LABELS, BUSINESS_ENTITIES } from '@/constants/accounts';
import BulkReviewClient from './BulkReviewClient';
import type { EntityType } from '@/types';

export const dynamic = 'force-dynamic';

export default function BulkReviewPage() {
  const user = requireUser();
  if (!hasEditAccess(user)) redirect('/cap');

  const suggestions = suggestForPending(200);

  const entityOptions: { value: EntityType; label: string }[] = [
    ...BUSINESS_ENTITIES.map((e) => ({ value: e, label: ENTITY_LABELS[e] })),
    { value: 'PERSONAL', label: ENTITY_LABELS.PERSONAL },
    { value: 'UNKNOWN', label: ENTITY_LABELS.UNKNOWN },
  ];

  return <BulkReviewClient suggestions={suggestions} entityOptions={entityOptions} />;
}
