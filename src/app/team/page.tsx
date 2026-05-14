import { listPeople } from '@/lib/db/cap';
import TeamClient from './TeamClient';

export const dynamic = 'force-dynamic';

export default function TeamPage() {
  const people = listPeople();
  return (
    <div className="p-8 space-y-5 max-w-[1200px]">
      <div>
        <h1 className="text-2xl font-semibold">Team & investors</h1>
        <p className="text-sm text-ink-dim mt-1">
          Everyone with a stake in any entity — founders, employees, contractors, advisors, investors.
        </p>
      </div>
      <TeamClient initialPeople={people} />
    </div>
  );
}
