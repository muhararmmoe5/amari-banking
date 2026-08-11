/**
 * Budget kinds:
 *  - EXPENSE — a spending cap you're tracking against
 *  - INCOME — an income target you're comparing to
 *  - FOUNDER_ALLOWANCE — a monthly personal-spend allowance the company
 *    gives a founder in lieu of salary. Tracks against personal-tagged
 *    expenses where individual matches the person and the source
 *    account belongs to the entity.
 */
export type BudgetKind = 'EXPENSE' | 'INCOME' | 'FOUNDER_ALLOWANCE';
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
