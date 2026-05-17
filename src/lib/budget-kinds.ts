export type BudgetKind = 'EXPENSE' | 'INCOME';
export type BudgetStatus = 'ACTIVE' | 'ARCHIVED';

export const BUDGET_SUB_KINDS = {
  INVESTMENT_INCOME: 'Investment income',
  REVENUE: 'Operating revenue',
  REFUND: 'Refund / reimbursement',
  OTHER_INCOME: 'Other income',
  OPERATING: 'Operating expense',
  PAYROLL: 'Payroll',
  MARKETING: 'Marketing',
  COGS: 'Cost of goods sold',
  TAXES: 'Taxes',
  OTHER_EXPENSE: 'Other expense',
} as const;
export type BudgetSubKind = keyof typeof BUDGET_SUB_KINDS;
