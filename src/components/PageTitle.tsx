/**
 * Two-span page title pattern: first 3–4 letters in Instrument Serif italic
 * at 28px, the remainder in Geist Medium at 22px, no space between.
 * Example: <PageTitle accent="Dash">board</PageTitle> → "Dashboard"
 */
export function PageTitle({ accent, children }: { accent: string; children: React.ReactNode }) {
  return (
    <h1 className="page-title">
      <em>{accent}</em>{children}
    </h1>
  );
}
