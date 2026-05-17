import { listOptionsGrouped, OPTION_FIELDS, OPTION_FIELD_LABELS, type OptionField } from '@/lib/db/options';
import { requireOwner } from '@/lib/auth';
import OptionsClient from './OptionsClient';

const AUTO_NOTES: Partial<Record<OptionField, string>> = {
  individual: 'Auto-populated from people on the Team page (/team). Add ad-hoc names below if a person is not on the team.',
  source_of_money: 'Auto-populated from your business entities (Bytes AI, Rocket Wireless, etc.). Add ad-hoc sources below if the money came from somewhere else.',
  need_to_get_from: 'Auto-populated from your business entities + Team page people. Add ad-hoc sources below.',
};

export const dynamic = 'force-dynamic';

export default function AdminOptionsPage() {
  requireOwner();
  const grouped = listOptionsGrouped();
  return (
    <div className="p-8 space-y-6 max-w-[1200px] mx-auto">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Field options</h1>
        <p className="text-sm text-ink-dim mt-2 max-w-3xl">
          Manage the dropdown values used inside the transaction drawer. Add the values you want to pick from. Drawer dropdowns also let you add new options inline as you go.
        </p>
      </div>
      <OptionsClient
        fields={OPTION_FIELDS.map((f) => ({
          field: f,
          label: OPTION_FIELD_LABELS[f],
          options: grouped[f],
          autoNote: AUTO_NOTES[f],
        }))}
      />
    </div>
  );
}
