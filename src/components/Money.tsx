import { fmtMoney } from '@/lib/format';

export function Money({ value, signed = true, className = '' }: { value: number; signed?: boolean; className?: string }) {
  const color = value > 0 ? 'text-income' : value < 0 ? 'text-expense' : 'text-ink-dim';
  return (
    <span className={`mono tabnum ${signed ? color : ''} ${className}`}>{fmtMoney(value)}</span>
  );
}
