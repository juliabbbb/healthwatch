import { Text, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import type { Style } from "@react-pdf/types";
import type { RiskLevel } from "@/lib/healthwatch/data";
import { pdfStyles, COLORS, riskAccent } from "../styles/pdfStyles";

export interface ComparativeRow {
  region: string;
  short: string;
  reported: number;
  predicted: number;
  lower: number;
  upper: number;
  percentile: number;
  changePct: number;
  risk: RiskLevel;
  unit: string;
}

export interface PDFComparativeTableProps {
  rows: ComparativeRow[];
  status: "predicted" | "reported";
}

const COLS = [
  { key: "region", label: "Region", flex: 5, align: "left" },
  { key: "predicted", label: "Predicted", flex: 3, align: "right" },
  { key: "ci", label: "95% CI", flex: 3, align: "right" },
  { key: "percentile", label: "Percentile", flex: 2.5, align: "right" },
  { key: "trajectory", label: "3-Mo", flex: 2.5, align: "right" },
  { key: "risk", label: "Risk", flex: 3, align: "center" },
] as const;

type ColKey = (typeof COLS)[number]["key"];

const ALIGN_STYLE: Record<"left" | "right" | "center", Style> = {
  left: { alignItems: "flex-start" },
  right: { alignItems: "flex-end" },
  center: { alignItems: "center" },
};

const COL_ALIGNS = Object.fromEntries(COLS.map((c) => [c.key, c.align])) as Record<
  ColKey,
  "left" | "right" | "center"
>;

function Cell({
  fl,
  align,
  children,
}: {
  fl: number;
  align: "left" | "right" | "center";
  children: ReactNode;
}) {
  return (
    <View
      style={[{ flex: fl, paddingHorizontal: 4, justifyContent: "center" }, ALIGN_STYLE[align]]}
    >
      {children}
    </View>
  );
}

export function PDFComparativeTable({ rows, status }: PDFComparativeTableProps) {
  return (
    <View style={pdfStyles.section}>
      <Text style={pdfStyles.sectionTitle}>Comparative Matrix</Text>
      <View style={pdfStyles.table} wrap={false}>
        <View style={pdfStyles.tableHeader}>
          {COLS.map((c) => (
            <Cell key={c.key} fl={c.flex} align={COL_ALIGNS[c.key]}>
              <Text style={pdfStyles.th}>{c.label}</Text>
            </Cell>
          ))}
        </View>
        {rows.map((r, i) => (
          <View
            key={r.short}
            style={[pdfStyles.tableRow, i % 2 === 1 ? { backgroundColor: COLORS.card } : {}]}
          >
            <Cell fl={COLS[0]!.flex} align={COL_ALIGNS.region}>
              <Text style={pdfStyles.td}>
                {r.region} ({r.short})
              </Text>
            </Cell>
            <Cell fl={COLS[1]!.flex} align={COL_ALIGNS.predicted}>
              <Text style={pdfStyles.td}>{r.predicted.toLocaleString()}</Text>
            </Cell>
            <Cell fl={COLS[2]!.flex} align={COL_ALIGNS.ci}>
              <Text style={[pdfStyles.td, { color: COLORS.mutedLight }]}>
                {Math.round(r.lower).toLocaleString()}–{Math.round(r.upper).toLocaleString()}
              </Text>
            </Cell>
            <Cell fl={COLS[3]!.flex} align={COL_ALIGNS.percentile}>
              <Text style={pdfStyles.td}>{r.percentile}th</Text>
            </Cell>
            <Cell fl={COLS[4]!.flex} align={COL_ALIGNS.trajectory}>
              <Text style={[pdfStyles.td, { color: r.changePct >= 0 ? COLORS.high : COLORS.low }]}>
                {r.changePct >= 0 ? "+" : ""}
                {r.changePct}%
              </Text>
            </Cell>
            <Cell fl={COLS[5]!.flex} align={COL_ALIGNS.risk}>
              <View
                style={{
                  backgroundColor: riskAccent(r.risk),
                  borderRadius: 2,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                }}
              >
                <Text
                  style={{
                    color: COLORS.offwhite,
                    fontSize: 7,
                    fontWeight: "bold",
                    textTransform: "uppercase",
                  }}
                >
                  {r.risk}
                </Text>
              </View>
            </Cell>
          </View>
        ))}
      </View>
    </View>
  );
}
