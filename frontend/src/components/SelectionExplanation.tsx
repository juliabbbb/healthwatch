import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useAiAnalysisSetting } from "@/hooks/use-ai-analysis-setting";
import { explainSelectedText, explainTitle, selectedHeading, selectionCard } from "@/lib/selectionExplanation";

type Selection = { text: string; title: string | null; context: string; left: number; top: number; card: HTMLElement };
const cache = new Map<string, string>();
const API_BASE = import.meta.env["VITE_API_URL"] ?? "http://localhost:8000";

export function SelectionExplanation() {
  const [selected, setSelected] = useState<Selection | null>(null);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [aiEnabled] = useAiAnalysisSetting();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let dragging = false;
    const read = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.rangeCount) { setSelected(null); return; }
      const range = selection.getRangeAt(0);
      const card = selectionCard(range);
      const text = selection.toString().trim();
      if (!card || !text || text.length > 1500) { setSelected(null); return; }
      const rect = range.getBoundingClientRect();
      const context = card.innerText.slice(0, 6000);
      setSelected(previous => previous?.card === card && previous.text === text && previous.context === context ? previous : {
        text, title: selectedHeading(range)?.textContent?.trim() ?? null, context, card,
        left: Math.max(16, Math.min(rect.left, window.innerWidth - 400)),
        top: Math.max(16, Math.min(rect.bottom + 12, window.innerHeight - Math.min(320, window.innerHeight * .45) - 16)),
      });
    };
    const schedule = () => { clearTimeout(timer); if (!dragging) timer = setTimeout(read, 250); };
    const down = (event: PointerEvent) => {
      if ((event.target as Element).closest('[data-selection-popup]')) return;
      dragging = true; clearTimeout(timer);
    };
    const up = () => { dragging = false; schedule(); };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") window.getSelection()?.removeAllRanges();
    };
    document.addEventListener("selectionchange", schedule);
    document.addEventListener("pointerdown", down);
    document.addEventListener("pointerup", up);
    document.addEventListener("keydown", key);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("selectionchange", schedule);
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("keydown", key);
    };
  }, []);

  useEffect(() => {
    setError(false);
    setAnswer("");
    if (!selected) return;
    const definition = selected.title ? explainTitle(selected.title) : explainSelectedText(selected.text);
    if (definition) { setAnswer(definition); return; }
    if (!aiEnabled) {
      setAnswer("A glossary explanation is not available for this selection. Enable AI-assisted analysis in Settings for explanations of other card text.");
      return;
    }
    const key = JSON.stringify([selected.text, selected.context]);
    const saved = cache.get(key);
    if (saved) { setAnswer(saved); return; }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    let current = true;
    fetch(`${API_BASE}/analysis/explain-element`, {
      method: "POST", signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: selected.text, description: `Selected text from a dashboard card. Explain only using this displayed context; do not infer missing facts: ${selected.context}`, illness: null }),
    }).then(async response => {
      if (!response.ok) throw new Error("Explanation unavailable");
      const data = await response.json();
      if (typeof data.narrative !== "string" || !data.narrative.trim()) throw new Error("Empty explanation");
      if (!current) return;
      if (cache.size >= 100) cache.clear();
      cache.set(key, data.narrative);
      setAnswer(data.narrative);
    }).catch(() => { if (current) setError(true); }).finally(() => clearTimeout(timeout));
    return () => { current = false; clearTimeout(timeout); controller.abort(); };
  }, [selected, aiEnabled, attempt]);

  if (!selected) return null;
  return createPortal(
    <aside onPointerDown={(event) => event.preventDefault()} data-selection-popup role="region" aria-label="Selected text explanation"
      className="selection-explanation glass-panel rounded-xl p-4 text-foreground"
      style={{ left: selected.left, top: selected.top }}>
      <div className="flex items-start justify-between gap-3">
        <p className="label-caps">Explanation</p>
        <button type="button" aria-label="Close explanation" onClick={() => window.getSelection()?.removeAllRanges()} className="rounded-md p-1 hover:bg-secondary focus-visible:ring-2 focus-visible:ring-primary"><X className="size-4" /></button>
      </div>
      <p className="mt-2 text-sm font-semibold break-words">{selected.text}</p>
      <div aria-live="polite" className="mt-3 text-sm leading-relaxed">
        {error ? <><p>Explanation unavailable. Please try again.</p><button type="button" className="mt-2 underline" onClick={() => setAttempt(value => value + 1)}>Retry</button></> : answer || "Preparing explanation…"}
      </div>
    </aside>, document.body,
  );
}
