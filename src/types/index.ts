export type EntityType =
  | 'BYTES_AI'
  | 'ROCKET_WIRELESS'
  | 'DELICIOUS_BYTES'
  | 'AMARI_VENTURES'
  | 'BYTES_REST_TECH'
  | 'PERSONAL'
  | 'MULTI_ENTITY'
  | 'BUSINESS_SHARED'
  | 'UNKNOWN';

export type CategoryType =
  | 'INCOME_SPACETEL'
  | 'INCOME_TCETRA'
  | 'INCOME_STRIPE'
  | 'INCOME_DOORDASH'
  | 'INCOME_GRUBHUB'
  | 'INCOME_UBEREATS'
  | 'INCOME_WIRE'
  | 'INCOME_ZELLE'
  | 'INCOME_OTHER'
  | 'EXPENSE_PAYROLL'
  | 'EXPENSE_SOFTWARE_BYTES'
  | 'EXPENSE_SOFTWARE_GENERAL'
  | 'EXPENSE_PROCESSING_FEES'
  | 'EXPENSE_COGS_FOOD'
  | 'EXPENSE_COGS_WIRELESS'
  | 'EXPENSE_RENT'
  | 'EXPENSE_TRAVEL'
  | 'EXPENSE_FOOD_DINING'
  | 'EXPENSE_TRANSPORT'
  | 'EXPENSE_FUEL'
  | 'EXPENSE_INSURANCE'
  | 'EXPENSE_WIRE_INTL'
  | 'EXPENSE_WIRE_DOMESTIC'
  | 'EXPENSE_REMITTANCE'
  | 'EXPENSE_ZELLE'
  | 'EXPENSE_APPLE_CASH'
  | 'EXPENSE_PAYPAL'
  | 'EXPENSE_CREDIT_CARD_PMT'
  | 'EXPENSE_BANK_FEES'
  | 'EXPENSE_PERSONAL'
  | 'EXPENSE_MARKETING'
  | 'EXPENSE_CONTRACTORS'
  | 'EXPENSE_CASH_DEPOSIT'
  | 'INTERNAL_TRANSFER'
  | 'UNCATEGORIZED';

export type AuditStatus =
  | 'UNREVIEWED'
  | 'TAGGED'
  | 'NEEDS_RECEIPT'
  | 'CONFIRMED'
  | 'DISPUTED'
  | 'PERSONAL_NO_DEDUCT';

export type IncomeSourceType =
  | 'SPACETEL'
  | 'OMAR_ALGHAZALI'
  | 'TCETRA'
  | 'VIDAPAY'
  | 'STRIPE'
  | 'DOORDASH'
  | 'GRUBHUB'
  | 'UBER_EATS'
  | 'GUSTO'
  | 'WIRE_UNKNOWN'
  | 'ZELLE_IN'
  | 'OTHER';

export type ZelleType =
  | 'VENDOR'
  | 'CONTRACTOR'
  | 'EMPLOYEE'
  | 'OWNER_DRAW'
  | 'PERSONAL'
  | 'COMPENSATION'
  | 'UNKNOWN';

export interface AccountConfig {
  id: string;
  last4: string;
  entity: EntityType;
  label: string;
  purpose: string;
  color: string;
  isActive: boolean;
}

export interface Transaction {
  id: string;
  accountId: string;
  postingDate: string; // YYYY-MM-DD stored
  description: string;
  amount: number; // dollars, positive=credit, negative=debit
  type: string;
  balance: number | null;
  merchantName: string;
  category: CategoryType;
  entityTag: EntityType;
  isInternal: boolean;
  internalLinkedId: string | null;
  incomeSource: IncomeSourceType | null;
  confirmedEntity: EntityType | null;
  confirmedCategory: CategoryType | null;
  businessPurpose: string | null;
  receiptRef: string | null;
  auditStatus: AuditStatus;
  auditFlags: string[];
  auditScore: number;
  notes: string | null;
  zellePerson: string | null;
  zelleType: ZelleType | null;
  individual: string | null;
  subCategory1: string | null;
  subCategory2: string | null;
  sourceOfMoney: string | null;
  needToGetFrom: string | null;
  cpaReviewed: boolean;
  taggedDate: string | null;
  importedAt: number;
  updatedAt: number;
  importBatchId: string;
}

export interface CategorizationResult {
  merchantName: string;
  category: CategoryType;
  entityTag: EntityType;
  isInternal: boolean;
  auditFlags: string[];
  auditScore: number;
  incomeSource: IncomeSourceType | null;
  zellePerson: string | null;
  zelleType: ZelleType | null;
  suggestedPurpose: string;
}

export interface ImportBatch {
  id: string;
  fileName: string;
  accountId: string;
  importedAt: number;
  rowCount: number;
  dateRangeFrom: string;
  dateRangeTo: string;
}

export interface ParsedTransaction {
  accountId: string;
  postingDate: string;
  description: string;
  amount: number;
  type: string;
  balance: number | null;
  category: CategoryType;
  entityTag: EntityType;
  isInternal: boolean;
  merchantName: string;
  auditFlags: string[];
  auditScore: number;
  incomeSource: IncomeSourceType | null;
  zellePerson: string | null;
  zelleType: ZelleType | null;
  suggestedPurpose: string;
}
