import type { EntityType } from './index';

export type PersonRole =
  | 'FOUNDER'
  | 'INVESTOR'
  | 'EMPLOYEE'
  | 'CONTRACTOR'
  | 'ADVISOR'
  | 'OTHER';

export type HolderType = 'PARTNER' | 'TEAM_MEMBER' | 'OBSERVER';

export interface Person {
  id: string;
  name: string;
  email: string | null;
  role: PersonRole;
  notes: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface EquityHolding {
  id: string;
  entity: EntityType;
  personId: string;
  percent: number;            // 0–100
  shares: number | null;      // optional share count
  holderType: HolderType;
  grantDate: string | null;   // YYYY-MM-DD
  vestingCliffMonths: number | null;  // null = no vesting (fully owned)
  vestingTotalMonths: number | null;  // typically 48
  vestingStart: string | null;        // YYYY-MM-DD
  notes: string | null;
  createdAt: number;
  updatedAt: number;
}

export type ValuationType = 'LAST_ROUND' | 'INTERNAL' | 'MANUAL' | 'EXIT' | '409A';

export interface EntityValuation {
  id: string;
  entity: EntityType;
  valuationCents: number;
  asOfDate: string;           // YYYY-MM-DD
  type: ValuationType;
  notes: string | null;
  createdAt: number;
}

export type ContributionType = 'CASH' | 'LOAN' | 'SWEAT' | 'NOTE_CONVERSION';

export interface CashContribution {
  id: string;
  entity: EntityType;
  personId: string;
  amountCents: number;
  contributionDate: string;  // YYYY-MM-DD
  type: ContributionType;
  linkedTransactionId: string | null;
  notes: string | null;
  createdAt: number;
}

export type SafeStatus = 'OUTSTANDING' | 'CONVERTED' | 'CANCELED';

export interface SafeNote {
  id: string;
  entity: EntityType;
  personId: string;
  amountCents: number;
  issueDate: string;                // YYYY-MM-DD
  valuationCapCents: number | null; // post or pre cap
  discountPct: number | null;       // 0–100
  mfn: boolean;
  noteType: 'SAFE' | 'CONVERTIBLE_NOTE';
  interestRatePct: number | null;   // only for notes
  maturityDate: string | null;
  status: SafeStatus;
  convertedAt: string | null;
  convertedHoldingId: string | null;
  notes: string | null;
  createdAt: number;
}

export interface EntityCapSummary {
  entity: EntityType;
  totalEquityPct: number;
  totalShares: number;
  holderCount: number;
  totalCashCents: number;
  contributorCount: number;
  outstandingSafeCents: number;
  outstandingSafeCount: number;
  currentValuationCents: number | null;
  currentValuationDate: string | null;
}
