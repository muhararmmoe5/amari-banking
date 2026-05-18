/** Bank account identifier chip — gold-bordered with bank monogram +
 *  wordmark + last 4. Used in the transactions list filter and the
 *  transaction detail header. Identifies the underlying bank account,
 *  not the card visual. */
export default function BankChip({
  bank = 'CHASE',
  monogram = 'J',
  mask,
  tone = '#a8c0e6',
  bg = 'linear-gradient(135deg,#1d2742,#0d1426)',
  size = 'sm',
}: {
  bank?: string;
  monogram?: string;
  mask: string;
  tone?: string;
  bg?: string;
  size?: 'xs' | 'sm';
}) {
  const px = size === 'xs' ? '4px 9px' : '6px 11px';
  return (
    <span
      className="inline-flex items-center gap-2"
      style={{
        padding: px,
        borderRadius: 6,
        background: bg,
        border: '0.5px solid color-mix(in oklab, var(--gold, #c9a87a) 22%, rgba(255,255,255,0.10))',
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: '.04em',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.03), 0 0 12px -6px rgba(201,168,122,.4)',
      }}
    >
      <span
        className="grid place-items-center font-medium"
        style={{
          width: 16,
          height: 16,
          borderRadius: 3,
          background: bg,
          color: tone,
          fontFamily: 'var(--font-serif, "Instrument Serif", serif)',
          fontStyle: 'italic',
          fontSize: 13,
          lineHeight: 1,
          letterSpacing: '-.04em',
        }}
      >
        {monogram}
      </span>
      <span
        style={{
          color: 'var(--gold, #c9a87a)',
          fontSize: 10.5,
          letterSpacing: '.16em',
          fontWeight: 700,
          fontFamily: 'var(--font-serif, "Instrument Serif", serif)',
          fontStyle: 'italic',
        }}
      >
        {bank}
      </span>
      <span className="num" style={{ color: 'var(--ink-2)', fontSize: 11.5 }}>
        •{mask}
      </span>
    </span>
  );
}
