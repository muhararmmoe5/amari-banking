import type { CategorizationResult, EntityType } from '@/types';
import { EXPENSE_RULES, INCOME_RULES } from '@/constants/merchants';
import { lookupZellePerson } from '@/constants/zelle-persons';
import { getAccount } from '@/constants/accounts';

const INTERNAL_PATTERNS = [
  'ONLINE TRANSFER TO CHK',
  'ONLINE TRANSFER FROM CHK',
  'ONLINE TRANSFER TO SAV',
  'ONLINE TRANSFER FROM SAV',
  'ONLINE TRANSFER FROM MMA',
  'ONLINE TRANSFER TO MMA',
  'ODP TRANSFER',
  'TOT ODP',
];

export function isInternalTransfer(description: string, type: string): boolean {
  const t = (type || '').toUpperCase();
  if (t === 'ACCT_XFER') return true;
  const d = (description || '').toUpperCase();
  return INTERNAL_PATTERNS.some((p) => d.includes(p));
}

export function extractZellePerson(desc: string): string | null {
  if (!desc) return null;
  // "Zelle payment to NAME 12345678" or "Zelle payment to NAME"
  const m1 = desc.match(/Zelle payment to\s+(.+?)(?:\s+[A-Z0-9]{8,})?$/i);
  if (m1) return m1[1].trim();
  const m2 = desc.match(/QUICKPAY\s*(?:WEB\s*ID:?\s*)?(?:TO|FOR)\s+(.+?)(?:\s+[A-Z0-9]{8,})?$/i);
  if (m2) return m2[1].trim();
  return null;
}

function matchesAny(desc: string, patterns: string[]): boolean {
  return patterns.some((p) => desc.includes(p));
}

function cleanMerchantFromDesc(desc: string): string {
  // strip trailing ID-like strings & dates
  return desc.replace(/\s+(WEB ID:?\s*[A-Z0-9]+).*$/i, '')
    .replace(/\s+[A-Z0-9]{10,}\s*$/g, '')
    .trim();
}

export function categorize(
  description: string,
  amount: number,
  accountId: string,
  type: string,
): CategorizationResult {
  const d = (description || '').toUpperCase();
  const acct = getAccount(accountId);

  // 1) INTERNAL TRANSFERS FIRST
  if (isInternalTransfer(description, type)) {
    return {
      merchantName: 'Internal Transfer',
      category: 'INTERNAL_TRANSFER',
      entityTag: acct?.entity || 'UNKNOWN',
      isInternal: true,
      auditFlags: [],
      auditScore: 0,
      incomeSource: null,
      zellePerson: null,
      zelleType: null,
      suggestedPurpose: 'Inter-account transfer',
    };
  }

  // 2) INCOME (positive amounts)
  if (amount > 0) {
    for (const rule of INCOME_RULES) {
      if (matchesAny(d, rule.match)) {
        return {
          merchantName: rule.merchantName,
          category: rule.category,
          entityTag: rule.entityTag,
          isInternal: false,
          auditFlags: rule.auditFlags ? [...rule.auditFlags] : [],
          auditScore: rule.baseAuditScore ?? 0,
          incomeSource: rule.incomeSource,
          zellePerson: null,
          zelleType: null,
          suggestedPurpose: rule.suggestedPurpose,
        };
      }
    }
    // Zelle inbound (positive amount with zelle in description)
    if (d.includes('ZELLE PAYMENT FROM') || d.includes('QUICKPAY') && d.includes('FROM')) {
      return {
        merchantName: 'Zelle inbound',
        category: 'INCOME_ZELLE',
        entityTag: acct?.entity || 'UNKNOWN',
        isInternal: false,
        auditFlags: ['CONFIRM_INCOME_SOURCE'],
        auditScore: 35,
        incomeSource: 'ZELLE_IN',
        zellePerson: null,
        zelleType: null,
        suggestedPurpose: 'Zelle inbound — confirm sender and entity',
      };
    }
    // Generic wire credit
    if (d.includes('FEDWIRE CREDIT') || d.includes('CHIPS CREDIT') || d.includes('WIRE TRANSFER')) {
      return {
        merchantName: 'Wire credit (unknown source)',
        category: 'INCOME_WIRE',
        entityTag: 'UNKNOWN',
        isInternal: false,
        auditFlags: ['UNKNOWN_WIRE_SOURCE', 'NEEDS_DOCUMENTATION'],
        auditScore: 80,
        incomeSource: 'WIRE_UNKNOWN',
        zellePerson: null,
        zelleType: null,
        suggestedPurpose: 'Wire credit — identify sender and entity allocation',
      };
    }
    // Cash deposit
    if (d.includes('DEPOSIT') && !d.includes('DOORDASH') && !d.includes('STRIPE')) {
      return {
        merchantName: cleanMerchantFromDesc(description),
        category: 'INCOME_OTHER',
        entityTag: acct?.entity || 'UNKNOWN',
        isInternal: false,
        auditFlags: ['UNKNOWN_DEPOSIT_SOURCE'],
        auditScore: 30,
        incomeSource: 'OTHER',
        zellePerson: null,
        zelleType: null,
        suggestedPurpose: 'Deposit — document source',
      };
    }
    // Default income
    return {
      merchantName: cleanMerchantFromDesc(description),
      category: 'INCOME_OTHER',
      entityTag: acct?.entity || 'UNKNOWN',
      isInternal: false,
      auditFlags: ['UNKNOWN_INCOME'],
      auditScore: 30,
      incomeSource: 'OTHER',
      zellePerson: null,
      zelleType: null,
      suggestedPurpose: 'Unclassified income — document source',
    };
  }

  // 3) EXPENSES (negative amounts) — Zelle first (extracts recipient)
  const absAmt = Math.abs(amount);
  if (d.includes('ZELLE PAYMENT TO') || (d.includes('QUICKPAY') && d.includes('TO'))) {
    const person = extractZellePerson(description);
    const info = lookupZellePerson(person);
    const flags: string[] = [];
    let score = 0;
    if (!info.knownPerson) {
      flags.push('UNCLASSIFIED_ZELLE_RECIPIENT', 'NEEDS_CLASSIFICATION');
      score = 70;
    } else if (info.needs1099 || absAmt >= 600) {
      flags.push('CHECK_1099_THRESHOLD');
      score = 40;
    }
    return {
      merchantName: person ? `Zelle → ${person}` : 'Zelle payment',
      category: 'EXPENSE_ZELLE',
      entityTag: info.entity,
      isInternal: false,
      auditFlags: flags,
      auditScore: score,
      incomeSource: null,
      zellePerson: person,
      zelleType: info.type,
      suggestedPurpose: info.suggestedPurpose,
    };
  }

  // Outbound wire transfers
  if ((d.includes('WIRE TRANSFER') || d.includes('FEDWIRE') || d.includes('BOOK TRANSFER')) && amount < 0) {
    return {
      merchantName: 'Domestic wire transfer',
      category: 'EXPENSE_WIRE_DOMESTIC',
      entityTag: 'UNKNOWN',
      isInternal: false,
      auditFlags: ['WIRE_TRANSFER', 'NEEDS_RECIPIENT', 'NEEDS_PURPOSE'],
      auditScore: 85,
      incomeSource: null,
      zellePerson: null,
      zelleType: null,
      suggestedPurpose: 'Document recipient name, business purpose, supporting invoice',
    };
  }

  // Loop over rules in priority order
  for (const rule of EXPENSE_RULES) {
    if (matchesAny(d, rule.match)) {
      return {
        merchantName: rule.merchantName,
        category: rule.category,
        entityTag: rule.entityTag,
        isInternal: false,
        auditFlags: rule.auditFlags ? [...rule.auditFlags] : [],
        auditScore: rule.baseAuditScore ?? 0,
        incomeSource: null,
        zellePerson: null,
        zelleType: null,
        suggestedPurpose: rule.suggestedPurpose,
      };
    }
  }

  // Account-specific defaults
  let defaultEntity: EntityType = acct?.entity || 'UNKNOWN';
  // Account 7056 (personal) — default to PERSONAL with a "classify" flag
  const personalAcctFlag = accountId === '7056' && absAmt > 50;

  return {
    merchantName: cleanMerchantFromDesc(description),
    category: 'UNCATEGORIZED',
    entityTag: defaultEntity,
    isInternal: false,
    auditFlags: personalAcctFlag
      ? ['PERSONAL_ACCOUNT_OUTFLOW', 'NEEDS_CLASSIFICATION']
      : absAmt > 200
        ? ['NEEDS_CATEGORIZATION']
        : [],
    auditScore: personalAcctFlag
      ? Math.max(35, absAmt > 200 ? 38 : 35)
      : absAmt > 1000
        ? 55
        : absAmt > 200
          ? 38
          : 10,
    incomeSource: null,
    zellePerson: null,
    zelleType: null,
    suggestedPurpose: 'Uncategorized — review and classify',
  };
}
