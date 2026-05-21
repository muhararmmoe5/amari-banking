import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { ACCOUNTS, ENTITY_LABELS, BUSINESS_ENTITIES } from '@/constants/accounts';
import NewTransactionForm from './NewTransactionForm';
import { listInflowsOnAccount } from '@/lib/db/queries';
import type { EntityType } from '@/types';

export const dynamic = 'force-dynamic';

export default function NewTransactionPage({
  searchParams,
}: {
  searchParams: { account?: string };
}) {
  const user = requireUser();
  if (user.role !== 'OWNER') redirect('/cap');

  // Preload inflows for the initially-selected account so the form has an
  // option list to render even before the user changes the account.
  const initialAccountId = searchParams.account || ACCOUNTS.find((a) => a.isActive)?.id || ACCOUNTS[0].id;
  const initialInflows = listInflowsOnAccount(initialAccountId, 30);

  const entityOptions: { value: EntityType; label: string }[] = [
    ...BUSINESS_ENTITIES.map((e) => ({ value: e, label: ENTITY_LABELS[e] })),
    { value: 'PERSONAL', label: ENTITY_LABELS.PERSONAL },
  ];

  return (
    <NewTransactionForm
      accounts={ACCOUNTS.filter((a) => a.isActive).map((a) => ({
        id: a.id, last4: a.last4, label: a.label, entity: a.entity,
      }))}
      entityOptions={entityOptions}
      initialAccountId={initialAccountId}
      initialInflows={initialInflows}
    />
  );
}
