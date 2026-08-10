import { redirect } from 'next/navigation';
import { listPeople, portfolioByPerson } from '@/lib/db/cap';
import { requireUser, hasEditAccess } from '@/lib/auth';
import TeamClient from './TeamClient';

export const dynamic = 'force-dynamic';

export default function TeamPage() {
  const user = requireUser();
  if (!hasEditAccess(user)) {
    if (user.personId) redirect(`/team/${user.personId}`);
    redirect('/cap');
  }
  const people = listPeople();
  const portfolio = portfolioByPerson();
  const portfolioMap: Record<string, number> = {};
  for (const [id, v] of portfolio) portfolioMap[id] = v;
  return (
    <div className="p-8 space-y-5 max-w-[1200px]">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Team & investors</h1>
        <p className="text-sm text-ink-dim mt-1">
          Everyone with a stake in any entity — founders, employees, contractors, advisors, investors. Click a name to see their full portfolio.
        </p>
      </div>
      <TeamClient initialPeople={people} portfolioMap={portfolioMap} />
    </div>
  );
}
