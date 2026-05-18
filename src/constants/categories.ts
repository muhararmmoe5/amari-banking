/**
 * Personal + Business taxonomies for the transaction drawer's
 * Booked Attribution section. Each top-level bucket has a label,
 * a tax-treatment hint (business only), and a list of sub-categories.
 */

export interface CategoryBucket {
  label: string;
  tax?: string;
  subs: string[];
}

export const PERSONAL_CATEGORIES: Record<string, CategoryBucket> = {
  HOUSING: {
    label: 'Housing',
    subs: ['Monthly Rent', 'Mortgage — P+I', 'Home Insurance', 'Property Tax', 'HOA Fees', 'Home Repairs', 'Utilities', 'Furniture'],
  },
  FAMILY: {
    label: 'Family & Personal Care',
    subs: ['Family Support — Parents', 'Family Support — Siblings', 'Child Care', 'School Tuition', 'Clothing', 'Gifts Given', 'Charitable Giving', 'Zakat'],
  },
  FOOD: {
    label: 'Food & Dining',
    subs: ['Grocery Store', 'Halal Grocery', 'Restaurant — Casual', 'Restaurant — Fine Dining', 'Coffee Shop', 'Food Delivery', 'Bars'],
  },
  TRANSPORT: {
    label: 'Transportation',
    subs: ['Gas & Fuel', 'Car Payment', 'Auto Insurance', 'Rideshare — Uber', 'Parking', 'Tolls', 'Flights (Personal)'],
  },
  HEALTH: {
    label: 'Health & Wellness',
    subs: ['Primary Care', 'Pharmacy', 'Health Insurance', 'Mental Health', 'Gym', 'Supplements'],
  },
  ENTERTAINMENT: {
    label: 'Entertainment',
    subs: ['Netflix', 'Spotify', 'Gaming', 'Books', 'Events', 'Vacation — Hotel'],
  },
  SAVINGS: {
    label: 'Savings & Finance',
    subs: ['Emergency Fund', 'Retirement', 'Credit Card Payment', 'Student Loan'],
  },
  OWNER: {
    label: 'Owner Draws',
    subs: ['Monthly Distribution', 'Salary Draw', 'Bonus Draw', 'Reimbursement to Self'],
  },
};

export const BUSINESS_CATEGORIES: Record<string, CategoryBucket> = {
  COGS: {
    label: 'Cost of Goods Sold',
    tax: '100% deductible',
    subs: ['Wireless inventory', 'Food ingredients', 'Delivery platform take rate', 'Fulfillment', 'Direct labor'],
  },
  PAYROLL: {
    label: 'Payroll & Compensation',
    tax: '100% deductible — wages',
    subs: ['Salary — W-2', 'Contractor payment — 1099', 'Payroll taxes', 'Health benefits', 'Bonus / commission', 'Owner salary'],
  },
  SOFTWARE: {
    label: 'Software & Technology',
    tax: '100% deductible',
    subs: ['AI / ML APIs', 'Cloud infrastructure', 'Voice & telephony', 'Product tools', 'Analytics', 'Dev tools'],
  },
  MARKETING: {
    label: 'Marketing & Sales',
    tax: '100% deductible',
    subs: ['Paid ads — Meta', 'Paid ads — Google', 'Content & creative', 'SEO / website', 'Events', 'Sales tools'],
  },
  RENT: {
    label: 'Rent & Facilities',
    tax: '100% deductible',
    subs: ['Office rent', 'Ghost kitchen rent', 'Coworking', 'Equipment lease', 'Storage'],
  },
  PRO: {
    label: 'Professional Services',
    tax: '100% deductible',
    subs: ['Legal', 'Accounting / CPA', 'Consulting', 'Recruiting', 'Business licenses'],
  },
  BANKING: {
    label: 'Banking & Finance',
    tax: '100% deductible',
    subs: ['Bank fees', 'Wire fees', 'FX', 'Merchant processing', 'Loan interest'],
  },
  TRAVEL: {
    label: 'Travel & Entertainment',
    tax: '50-100% deductible',
    subs: ['Business flights', 'Hotels', 'Ground transport', 'Client meals', 'Team meals'],
  },
  TAX: {
    label: 'Taxes',
    tax: 'Not deductible',
    subs: ['Federal income tax', 'State income tax', 'Payroll tax — employer', 'Sales tax', 'Franchise tax'],
  },
  INTERCO: {
    label: 'Inter-Entity',
    tax: 'Track separately',
    subs: ['Loan to related entity', 'Loan repayment', 'Management fee', 'Capital contribution', 'Distribution'],
  },
  CAPEX: {
    label: 'Capital Expenditure',
    tax: 'Depreciate over life',
    subs: ['Computer & hardware', 'Office equipment', 'Furniture', 'Software (capitalized)'],
  },
  OTHER: {
    label: 'Other Business',
    tax: 'Review',
    subs: ['Business insurance', 'Misc subscriptions', 'Office supplies', 'Donations', 'Penalties'],
  },
};
