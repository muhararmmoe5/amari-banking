import type { EntityType, ZelleType } from '@/types';

export interface ZellePersonInfo {
  match: string[]; // substrings to match (uppercase)
  entity: EntityType;
  type: ZelleType;
  suggestedPurpose: string;
  knownPerson: boolean;
  needs1099?: boolean;
  flagNote?: string;
}

export const ZELLE_PEOPLE: ZellePersonInfo[] = [
  { match: ['NORTH BRIDGE WIRELESS', 'NORTH BRIDGE'], entity: 'ROCKET_WIRELESS', type: 'VENDOR', suggestedPurpose: 'COGS — wireless inventory', knownPerson: true },
  { match: ['NORTH BRIDGE PAYROLL'], entity: 'ROCKET_WIRELESS', type: 'VENDOR', suggestedPurpose: 'Payroll relay — verify classification', knownPerson: true, flagNote: 'Verify' },
  { match: ['SAMI ALBARATI', 'SAMI '], entity: 'MULTI_ENTITY', type: 'CONTRACTOR', suggestedPurpose: 'CRITICAL: Sami $55K+ paid — 1099 REQUIRED. Confirm role and entity allocation.', knownPerson: true, needs1099: true, flagNote: '1099 required' },
  { match: ['MUSTAFA'], entity: 'BYTES_AI', type: 'COMPENSATION', suggestedPurpose: 'COO compensation — confirm W-2 or 1099', knownPerson: true, flagNote: 'Verify W-2/1099' },
  { match: ['MUTHANA'], entity: 'BYTES_AI', type: 'COMPENSATION', suggestedPurpose: 'CTO compensation — confirm W-2 or 1099', knownPerson: true, flagNote: 'Verify W-2/1099' },
  { match: ['EUDELLE'], entity: 'BYTES_AI', type: 'COMPENSATION', suggestedPurpose: 'Client success team', knownPerson: true, flagNote: 'Verify W-2/1099' },
  { match: ['GABRIEL MARQUES'], entity: 'BYTES_AI', type: 'CONTRACTOR', suggestedPurpose: 'Engineering contractor — 1099 required', knownPerson: true, needs1099: true },
  { match: ['MARISTELA MARQUES', 'MARISTELA'], entity: 'AMARI_VENTURES', type: 'CONTRACTOR', suggestedPurpose: 'Contractor — 1099 required', knownPerson: true, needs1099: true },
  { match: ['GABE MAIN', 'GABE '], entity: 'BYTES_AI', type: 'CONTRACTOR', suggestedPurpose: 'GTM / marketing — 1099 if contractor', knownPerson: true, needs1099: true },
  { match: ['NADER'], entity: 'BYTES_AI', type: 'COMPENSATION', suggestedPurpose: 'Co-founder — review equity comp / 1099', knownPerson: true, flagNote: 'Review equity comp' },
  { match: ['IZZY'], entity: 'BYTES_AI', type: 'COMPENSATION', suggestedPurpose: 'Sales — verify W-2/1099', knownPerson: true, flagNote: 'Verify' },
  { match: ['FATHER'], entity: 'PERSONAL', type: 'PERSONAL', suggestedPurpose: 'Personal family transfer', knownPerson: true },
  { match: ['MOE MAIN', 'MOE MUHARRAM', 'MOHAMMED MUHARRAM'], entity: 'PERSONAL', type: 'OWNER_DRAW', suggestedPurpose: 'Owner draw', knownPerson: true },
  { match: ['NYC APPLE DELI'], entity: 'DELICIOUS_BYTES', type: 'VENDOR', suggestedPurpose: 'Food supplier — COGS', knownPerson: true },
  { match: ['MR PIZZA MAN', 'MR. PIZZA MAN'], entity: 'DELICIOUS_BYTES', type: 'VENDOR', suggestedPurpose: 'Food supplier — COGS', knownPerson: true },
  { match: ['CLAUDIA'], entity: 'UNKNOWN', type: 'UNKNOWN', suggestedPurpose: 'Unclassified — confirm role (contractor?)', knownPerson: false, flagNote: 'Classify — possibly 1099' },
  { match: ['JACKY'], entity: 'UNKNOWN', type: 'CONTRACTOR', suggestedPurpose: 'Confirm role and entity — 1099 if contractor', knownPerson: false, flagNote: '1099 if contractor' },
  { match: ['ABDALLAH'], entity: 'UNKNOWN', type: 'UNKNOWN', suggestedPurpose: 'Unclassified — document who this is', knownPerson: false, flagNote: 'Unclassified' },
  { match: ['HAMZAH'], entity: 'UNKNOWN', type: 'UNKNOWN', suggestedPurpose: 'Unclassified — document who this is', knownPerson: false, flagNote: 'Unclassified' },
  { match: ['AHMED ALB', 'HALA'], entity: 'UNKNOWN', type: 'UNKNOWN', suggestedPurpose: 'Unclassified — document who this is', knownPerson: false, flagNote: 'Unclassified' },
  { match: ['SUSANA RIOS'], entity: 'UNKNOWN', type: 'UNKNOWN', suggestedPurpose: 'Unclassified — document who this is', knownPerson: false, flagNote: 'Unclassified' },
  { match: ['LA GUARDIA'], entity: 'UNKNOWN', type: 'UNKNOWN', suggestedPurpose: 'Unclassified — document recipient', knownPerson: false, flagNote: 'Unclassified' },
];

export function lookupZellePerson(name: string | null): ZellePersonInfo {
  if (!name) {
    return { match: [], entity: 'UNKNOWN', type: 'UNKNOWN', suggestedPurpose: 'Unknown recipient — classify', knownPerson: false };
  }
  const n = name.toUpperCase();
  for (const p of ZELLE_PEOPLE) {
    if (p.match.some((m) => n.includes(m) || m.includes(n))) {
      return p;
    }
  }
  return { match: [], entity: 'UNKNOWN', type: 'UNKNOWN', suggestedPurpose: 'Unknown recipient — classify', knownPerson: false };
}
