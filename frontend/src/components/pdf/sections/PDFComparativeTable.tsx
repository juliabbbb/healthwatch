import { Text, View } from "@react-pdf/renderer";
import type { StyleProp } from "@react-pdf/types";
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

const COL_WIDTHS = {
  region: 140,
  predicted: 90,
  ci: 95,
  percentile: 60,
  trajectory: 60,
  risk: 70,
} as const;

export function PDFComparativeTable({ rows, status }: PDFComparativeTableProps) {
  return (
    <View style={pdfStyles.section}>
      <Text style={pdfStyles.sectionTitle}>Comparative Matrix</Text>
      <View style={pdfStyles.table}>
        <View style={pdfStyles.tableHeader}>
          <Cell width={COL_WIDTHS.region} text="Region" style={pdfStyles.th} />
          <Cell
            width={COL_WIDTHS.predicted}
            text={status === "predicted" ? "Predicted" : "Reported"}
            style={pdfStyles.th}
            alignRight
          />
          <Cell width={COL_WIDTHS.ci} text="95% CI" style={pdfStyles.th} alignRight />
          <Cell width={COL_WIDTHS.percentile} text="Percentile" style={pdfStyles.th} alignRight />
          <Cell width={COL_WIDTHS.trajectory} text="3-Mo" style={pdfStyles.th} alignRight />
          <Cell width={COL_WIDTHS.risk} text="Risk" style={pdfStyles.th} center />
        </View>

        {rows.map((r, i) => (
          <View
            key={r.short}
            wrap={false}
            style={[pdfStyles.tableRow, i % 2 === 1 ? { backgroundColor: COLORS.slate } : {}]}
          >
            <Cell
              width={COL_WIDTHS.region}
              text={`${r.region} (${r.short})`}
              style={pdfStyles.td}
            />
            <Cell
              width={COL_WIDTHS.predicted}
              text={r.predicted.toLocaleString()}
              style={[pdfStyles.td, { textAlign: "right" }]}
            />
            <Cell
              width={COL_WIDTHS.ci}
              text={`${Math.round(r.lower).toLocaleString()}–${Math.round(r.upper).toLocaleString()}`}
              style={[pdfStyles.td, { color: COLORS.muted, textAlign: "right" }]}
            />
            <Cell
              width={COL_WIDTHS.percentile}
              text={`${r.percentile}th`}
              style={[pdfStyles.td, { textAlign: "right" }]}
            />
            <Cell
              width={COL_WIDTHS.trajectory}
              text={`${r.changePct >= 0 ? "+" : ""}${r.changePct}%`}
              style={[
                pdfStyles.td,
                { textAlign: "right", color: r.changePct >= 0 ? COLORS.high : COLORS.low },
              ]}
            />
            <View
              style={{ width: COL_WIDTHS.risk, alignItems: "center", justifyContent: "center" }}
            >
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
                    color: "#0f172a",
                    fontSize: 7,
                    fontWeight: "bold",
                    textTransform: "uppercase",
                  }}
                >
                  {r.risk}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function Cell({
  width,
  text,
  style,
  alignRight,
  center,
}: {
  width: number;
  text: string;
  style?: StyleProp;
  alignRight?: boolean;
  center?: boolean;
}) {
  return (
    <View
      style={{
        width,
        paddingRight: 4,
        justifyContent: "center",
        ...(center ? { alignItems: "center" as const } : {}),
        ...(alignRight ? { alignItems: "flex-end" as const } : {}),
      }}
    >
      <Text {...(style ? { style } : {})}>{text}</Text>
    </View>
  );
}
