import type { Account, Entity, EntityId, Tx } from './types';

export const ENTITIES: Record<EntityId, Entity> = {
  bytes: {
    id: 'bytes', name: 'Bytes AI', short: 'Bytes',
    legal: 'Bytes Restaurant Technologies, Inc.',
    type: 'C-Corp · Delaware',
    status: 'Operating', c: '#c9a87a', init: 'B',
    cash: 328415, cashDelta: -28412,
    arr: 218040, netIncomeMTD: 47290,
    runwayMo: 5.2, runwayWarn: true,
  },
  rocket: {
    id: 'rocket', name: 'Rocket Wireless', short: 'Rocket',
    legal: 'Rocket Wireless Operations LLC',
    type: 'LLC · Wyoming',
    status: 'Operating', c: '#7a9fc9', init: 'R',
    cash: 286120, cashDelta: 18420,
    arr: 842000, netIncomeMTD: 12840,
    runwayMo: 24, runwayWarn: false,
  },
  delicious: {
    id: 'delicious', name: 'Delicious Bytes', short: 'Delicious',
    legal: 'Delicious Bytes Holdings LLC',
    type: 'LLC · Delaware',
    status: 'Watch', c: '#c98a7a', init: 'D',
    cash: 74230, cashDelta: -4120,
    arr: 212400, netIncomeMTD: -2840,
    runwayMo: 6.6, runwayWarn: true,
  },
  amari: {
    id: 'amari', name: 'Amari Ventures', short: 'Amari',
    legal: 'Amari Ventures LP',
    type: 'LP · Delaware',
    status: 'Holding', c: '#b18ac9', init: 'A',
    cash: 219400, cashDelta: 8900,
    arr: 5370000, netIncomeMTD: 8420,
    runwayMo: 60, runwayWarn: false,
  },
};

export const ENTITY_ORDER: EntityId[] = ['bytes', 'rocket', 'delicious', 'amari'];

export const PERSONAL_ACCOUNTS: Account[] = [
  { id: 'chase-checking', inst: 'Chase', instColor: '#1a2238', instFg: '#a8c0e6', type: 'Checking', name: 'Chase Total Checking', mask: '7056', balance: 41780.42, apy: 0, lastSync: '2 min ago', primary: true, kind: 'deposit' },
  { id: 'chase-savings', inst: 'Chase', instColor: '#1a2238', instFg: '#a8c0e6', type: 'Savings', name: 'Chase Premier Savings', mask: '4429', balance: 28400.0, apy: 0.0425, lastSync: '2 min ago', kind: 'deposit' },
  { id: 'sofi-hys', inst: 'SoFi', instColor: '#0e2a3a', instFg: '#7ec9d4', type: 'Savings', name: 'SoFi · High-Yield Savings', mask: '2240', balance: 142800.0, apy: 0.052, lastSync: '7 min ago', kind: 'deposit' },
  { id: 'schwab-broker', inst: 'Schwab', instColor: '#0e2238', instFg: '#9ab8e0', type: 'Brokerage', name: 'Schwab · Taxable Brokerage', mask: '8810', balance: 318640.0, lastSync: '4 min ago', kind: 'investment' },
  { id: 'vanguard-401k', inst: 'Vanguard', instColor: '#2a1d3a', instFg: '#c4a8e0', type: 'Retirement', name: 'Solo 401(k) · VTSAX', mask: 'K-2204', balance: 318000.0, lastSync: 'daily', kind: 'retirement' },
  { id: 'fidelity-roth', inst: 'Fidelity', instColor: '#1d2a1d', instFg: '#a8d4b8', type: 'Retirement', name: 'Roth IRA · Fidelity', mask: 'R-7711', balance: 74000.0, lastSync: 'daily', kind: 'retirement' },
  { id: 'amex-platinum', inst: 'AmEx', instColor: '#1a1a2e', instFg: '#c0c0d4', type: 'Credit', name: 'AmEx Platinum', mask: '81004', balance: -4214.2, limit: 0, lastSync: '15 min ago', kind: 'credit', points: '284,440 MR' },
  { id: 'chase-sapphire', inst: 'Chase', instColor: '#1a2238', instFg: '#a8c0e6', type: 'Credit', name: 'Sapphire Reserve', mask: '4221', balance: -2640.18, limit: 40000, lastSync: '15 min ago', kind: 'credit', points: '148,200 UR' },
  { id: 'ally-checking', inst: 'Ally', instColor: '#2a1d2a', instFg: '#d4a8c4', type: 'Checking', name: 'Ally Spending', mask: '9914', balance: 6280.0, apy: 0.0025, lastSync: '31 min ago', kind: 'deposit' },
  { id: 'coinbase', inst: 'Coinbase', instColor: '#2a201d', instFg: '#d4b89a', type: 'Crypto', name: 'Coinbase · BTC + ETH', mask: 'COIN', balance: 62000.0, lastSync: '1 hr ago', kind: 'crypto' },
];

export const BUSINESS_ACCOUNTS: Account[] = [
  // Bytes
  { id: 'bytes-chk', ent: 'bytes', inst: 'JPMorgan Chase', instColor: '#1a2238', instFg: '#a8c0e6', type: 'Checking', name: 'Business Checking', mask: '4429', balance: 218400.28, apy: 0, lastSync: '2 min ago', kind: 'deposit', primary: true },
  { id: 'bytes-svgs', ent: 'bytes', inst: 'Mercury', instColor: '#1a1a2e', instFg: '#c0c0d4', type: 'Treasury', name: 'Mercury Treasury', mask: '8120', balance: 94120.0, apy: 0.0512, lastSync: '4 min ago', kind: 'treasury' },
  { id: 'bytes-cc1', ent: 'bytes', inst: 'AmEx', instColor: '#1a1a2e', instFg: '#c0c0d4', type: 'Credit', name: 'AmEx Business Plat.', mask: '81004', balance: -8420.0, limit: 80000, lastSync: '8 min ago', kind: 'credit', points: '148K MR' },
  { id: 'bytes-cc2', ent: 'bytes', inst: 'Brex', instColor: '#2a1d1d', instFg: '#d4a8a8', type: 'Credit', name: 'Brex Card', mask: '4422', balance: -4180.0, limit: 50000, lastSync: '8 min ago', kind: 'credit' },
  { id: 'bytes-svgs2', ent: 'bytes', inst: 'Wells Fargo', instColor: '#2a1d0e', instFg: '#d4b89a', type: 'Savings', name: 'Reserve · ODP', mask: '5975', balance: 15895.0, apy: 0.011, lastSync: '15 min ago', kind: 'deposit' },
  // Rocket
  { id: 'rocket-op', ent: 'rocket', inst: 'JPMorgan Chase', instColor: '#1a2238', instFg: '#a8c0e6', type: 'Checking', name: 'Operating Checking', mask: '0991', balance: 196140.12, apy: 0, lastSync: '3 min ago', kind: 'deposit', primary: true },
  { id: 'rocket-pay', ent: 'rocket', inst: 'Stripe', instColor: '#2a1d3a', instFg: '#c4a8e0', type: 'Balance', name: 'Stripe Payouts', mask: 'acct_R', balance: 62840.0, lastSync: '8 min ago', kind: 'processor' },
  { id: 'rocket-cc', ent: 'rocket', inst: 'Chase', instColor: '#1a2238', instFg: '#a8c0e6', type: 'Credit', name: 'Ink Business', mask: '8855', balance: -18240.0, limit: 75000, lastSync: '6 min ago', kind: 'credit' },
  { id: 'rocket-wire', ent: 'rocket', inst: 'Wise', instColor: '#1d2e23', instFg: '#a8d4b8', type: 'FX', name: 'Wise · CN/EU vendors', mask: 'WISE', balance: 27000.0, lastSync: '22 min ago', kind: 'fx', reauth: true },
  // Delicious
  { id: 'del-op', ent: 'delicious', inst: 'JPMorgan Chase', instColor: '#1a2238', instFg: '#a8c0e6', type: 'Checking', name: 'Operating Checking', mask: '2871', balance: 74220.5, apy: 0, lastSync: '5 min ago', kind: 'deposit', primary: true },
  { id: 'del-sq', ent: 'delicious', inst: 'Square', instColor: '#0e0e0e', instFg: '#e6e6e6', type: 'Balance', name: 'Square Balance', mask: 'sq_D', balance: 8420.0, lastSync: '4 min ago', kind: 'processor' },
  { id: 'del-dd', ent: 'delicious', inst: 'DoorDash', instColor: '#2a1d1d', instFg: '#e08a78', type: 'Balance', name: 'DoorDash Payouts', mask: 'dd_D', balance: 3140.0, lastSync: '6 min ago', kind: 'processor' },
  { id: 'del-cc', ent: 'delicious', inst: 'AmEx', instColor: '#1a1a2e', instFg: '#c0c0d4', type: 'Credit', name: 'AmEx Business Gold', mask: '81127', balance: -3680.0, limit: 25000, lastSync: '12 min ago', kind: 'credit' },
  // Amari
  { id: 'amari-mm', ent: 'amari', inst: 'Schwab', instColor: '#0e2238', instFg: '#9ab8e0', type: 'Money Mkt', name: 'Schwab Money Market', mask: 'AV-MM', balance: 168400.0, apy: 0.0498, lastSync: 'daily', kind: 'treasury', primary: true },
  { id: 'amari-op', ent: 'amari', inst: 'First Republic', instColor: '#2e1d2a', instFg: '#d4b8d0', type: 'Checking', name: 'FR · Private Client', mask: '7220', balance: 41200.0, apy: 0, lastSync: 'daily', kind: 'deposit' },
  { id: 'amari-wise', ent: 'amari', inst: 'Wise', instColor: '#1d2e23', instFg: '#a8d4b8', type: 'FX', name: 'Wise · multicurrency', mask: 'WISE', balance: 9800.0, lastSync: '3 days ago', kind: 'fx', reauth: true },
];

export const PERSONAL_TRANSACTIONS: Tx[] = [
  { id: 'p1', date: 'May 19', t: '08:42', merchant: "Whole Foods · 38th St", amt: -127.4, acct: 'chase-sapphire', cat: 'Groceries', status: 'confirmed' },
  { id: 'p2', date: 'May 19', t: '07:24', merchant: 'Starbucks · Lamar', amt: -8.2, acct: 'chase-sapphire', cat: 'Coffee', status: 'confirmed' },
  { id: 'p3', date: 'May 18', t: '21:14', merchant: 'Uno Pizzeria', amt: -62.4, acct: 'chase-sapphire', cat: 'Dining', status: 'confirmed' },
  { id: 'p4', date: 'May 18', t: '15:02', merchant: 'Apple.com', amt: -1299.0, acct: 'amex-platinum', cat: 'Electronics', status: 'needs-review' },
  { id: 'p5', date: 'May 18', t: '14:30', merchant: 'Bytes AI · Owner draw', amt: 8000.0, acct: 'chase-checking', cat: 'Owner draw', status: 'confirmed', biz: 'bytes' },
];

export function accountsFor(entId: EntityId): Account[] {
  return BUSINESS_ACCOUNTS.filter((a) => a.ent === entId);
}
