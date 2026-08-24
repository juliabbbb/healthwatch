/**
 * Small technical provenance pill — the MotherDuck-style "Connected ·
 * US-East-1" detail. Mono, muted, purely informational.
 */
export function StatusChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
      {children}
    </span>
  );
}

export function StatusChipRow({ items }: { items: string[] }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {items.map((item) => (
        <StatusChip key={item}>{item}</StatusChip>
      ))}
    </span>
  );
}
