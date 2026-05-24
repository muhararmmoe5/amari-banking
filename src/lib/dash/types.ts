export type Mode = 'personal' | 'business';
export type EntityId = 'bytes' | 'rocket' | 'delicious' | 'amari';

export type Entity = {
  id: EntityId;
  name: string;
  short: string;
  legal: string;
  type: string;
  status: 'Operating' | 'Watch' | 'Holding';
  c: string;
  init: string;
  cash: number;
  cashDelta: number;
  arr: number;
  netIncomeMTD: number;
  runwayMo: number;
  runwayWarn?: boolean;
};

export type AccountKind =
  | 'deposit'
  | 'treasury'
  | 'processor'
  | 'fx'
  | 'credit'
  | 'investment'
  | 'retirement'
  | 'crypto';

export type Account = {
  id: string;
  ent?: EntityId;
  inst: string;
  instColor: string;
  instFg: string;
  type: string;
  name: string;
  mask: string;
  balance: number;
  apy?: number;
  limit?: number;
  lastSync: string;
  kind: AccountKind;
  primary?: boolean;
  points?: string;
  reauth?: boolean;
};

export type Tx = {
  id: string;
  ent?: EntityId;
  date: string;
  t: string;
  merchant: string;
  amt: number;
  acct: string;
  cat: string;
  status: 'confirmed' | 'unreviewed' | 'needs-review' | 'pending';
  flag?: 'low' | 'med' | 'high';
  audit?: number;
  needs?: boolean;
  recurring?: boolean;
  transfer?: boolean;
  biz?: EntityId;
};
