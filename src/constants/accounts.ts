import type { AccountConfig, EntityType } from '@/types';

export const ENTITY_LABELS: Record<EntityType, string> = {
  BYTES_AI: 'Bytes AI',
  ROCKET_WIRELESS: 'Rocket Wireless',
  DELICIOUS_BYTES: 'Delicious Bytes LLC',
  AMARI_VENTURES: 'Amari Ventures',
  BYTES_REST_TECH: 'Bytes Restaurant Tech',
  PERSONAL: 'Personal',
  MULTI_ENTITY: 'Multi-entity',
  BUSINESS_SHARED: 'Business (shared)',
  UNKNOWN: 'Unknown',
};

export const ENTITY_COLORS: Record<EntityType, string> = {
  BYTES_AI: '#C8F060',
  ROCKET_WIRELESS: '#60C8F0',
  DELICIOUS_BYTES: '#F0A060',
  AMARI_VENTURES: '#C060F0',
  BYTES_REST_TECH: '#A0D840',
  PERSONAL: '#E8D8FF',
  MULTI_ENTITY: '#F0F060',
  BUSINESS_SHARED: '#A0A0FF',
  UNKNOWN: '#888888',
};

export const ACCOUNTS: AccountConfig[] = [
  { id: '0320', last4: '0320', entity: 'AMARI_VENTURES', label: 'Amari Ventures Hub', purpose: 'Main hub — receives Spacetel wires, distributes to all entities', color: '#C060F0', isActive: true },
  { id: '0709', last4: '0709', entity: 'ROCKET_WIRELESS', label: 'Rocket Wireless Ops', purpose: 'Operations account', color: '#60C8F0', isActive: true },
  { id: '0717', last4: '0717', entity: 'PERSONAL', label: 'Personal / Holding', purpose: 'Secondary personal', color: '#E8D8FF', isActive: true },
  { id: '2127', last4: '2127', entity: 'BYTES_AI', label: 'Bytes AI Secondary', purpose: 'Uber Eats, Facebook Ads', color: '#C8F060', isActive: true },
  { id: '2151', last4: '2151', entity: 'DELICIOUS_BYTES', label: 'Delicious Bytes Secondary', purpose: 'Secondary ghost kitchen', color: '#F0A060', isActive: true },
  { id: '2305', last4: '2305', entity: 'ROCKET_WIRELESS', label: 'Rocket Wireless Secondary', purpose: 'TCETRA processing', color: '#60C8F0', isActive: true },
  { id: '2871', last4: '2871', entity: 'DELICIOUS_BYTES', label: 'Delicious Bytes Main', purpose: 'DoorDash/Grubhub main account', color: '#F0A060', isActive: true },
  { id: '5975', last4: '5975', entity: 'AMARI_VENTURES', label: 'Savings / ODP Reserve', purpose: 'Overdraft protection only', color: '#888888', isActive: true },
  { id: '6562', last4: '6562', entity: 'BYTES_AI', label: 'Bytes AI Main', purpose: 'Main tech operations, Stripe revenue', color: '#C8F060', isActive: true },
  { id: '6612', last4: '6612', entity: 'BYTES_REST_TECH', label: 'Bytes Rest Tech — Payroll', purpose: 'Gusto payroll pass-through only', color: '#A0D840', isActive: true },
  { id: '6798', last4: '6798', entity: 'AMARI_VENTURES', label: 'Holding / Dormant', purpose: 'Essentially closed', color: '#666666', isActive: false },
  { id: '7056', last4: '7056', entity: 'PERSONAL', label: 'Personal — Moe Main', purpose: 'Personal hub, all business draws land here', color: '#D880FF', isActive: true },
  { id: '9190', last4: '9190', entity: 'BYTES_AI', label: 'Bytes AI / Delicious Bytes Mixed', purpose: 'Stripe revenue + ghost kitchen ops', color: '#B0E860', isActive: true },
  { id: '9810', last4: '9810', entity: 'ROCKET_WIRELESS', label: 'Rocket Wireless Funding', purpose: 'Funding account', color: '#40A8D0', isActive: true },
  { id: '9828', last4: '9828', entity: 'ROCKET_WIRELESS', label: 'Rocket Wireless / TCETRA Main', purpose: 'Highest volume — main TCETRA account', color: '#20A0D8', isActive: true },
];

export function getAccount(id: string): AccountConfig | undefined {
  return ACCOUNTS.find((a) => a.id === id);
}
