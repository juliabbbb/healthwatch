export function ProvisionalTag({ note }: { note?: string | undefined }) {
  return (
    <span
      title={note}
      className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium normal-case tracking-normal text-muted-foreground"
    >
      Provisional
    </span>
  );
}
