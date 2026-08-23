import { useEffect, useState } from "react";

const timeFmt = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const dateFmt = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

/**
 * Live Philippine-time readout (mission-control chrome). Pure client-side —
 * always Asia/Manila since that is the operational timezone for DOH/PIDSR
 * surveillance, regardless of the viewer's machine.
 */
export function LiveClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-2" aria-label={`Philippine time ${timeFmt.format(now)}`}>
      <span
        className="size-1.5 shrink-0 animate-pulse rounded-full"
        style={{ backgroundColor: "var(--risk-low)" }}
        aria-hidden="true"
      />
      <div className="leading-none">
        <p className="flex items-baseline gap-1">
          <span className="font-mono text-base tabular-nums" style={{ color: "var(--dry)" }}>
            {timeFmt.format(now)}
          </span>
          <span className="text-[9px] tracking-widest text-muted-foreground">PHT</span>
        </p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">{dateFmt.format(now)}</p>
      </div>
    </div>
  );
}
