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

export function PDFComparativeTable({ rows, status }: PDFComparativeTableProps) {
  return (
    <View style={pdfStyles.section} wrap={false}>
      <Text style={pdfStyles.sectionTitle}>Comparative Matrix</Text>
      <View style={pdfStyles.table}>
        <View style={pdfStyles.tableHeader}>
          <Cell flex={2} text="Region" style={pdfStyles.th} />
          <Cell
            flex={1.3}
            text={status === "predicted" ? "Predicted" : "Reported"}
            style={pdfStyles.th}
            align="right"
          />
          <Cell flex={1.3} text="95% CI" style={pdfStyles.th} align="right" />
          <Cell flex={1} text="Percentile" style={pdfStyles.th} align="right" />
          <Cell flex={1} text="3-Mo" style={pdfStyles.th} align="right" />
          <Cell flex={1} text="Risk" style={pdfStyles.th} center />
        </View>

        {rows.map((r, i) => (
          <View
            key={r.short}
            wrap={false}
            style={[pdfStyles.tableRow, i % 2 === 1 ? { backgroundColor: COLORS.slate } : {}]}
          >
            <Cell flex={2} text={`${r.region} (${r.short})`} style={pdfStyles.td} />
            <Cell
              flex={1.3}
              text={r.reported.toLocaleString()}
              style={[pdfStyles.td, { textAlign: "right" }]}
            />
            <Cell
              flex={1.3}
              text={`${Math.round(r.lower).toLocaleString()}–${Math.round(r.upper).toLocaleString()}`}
              style={[pdfStyles.td, { color: COLORS.muted, textAlign: "right" }]}
            />
            <Cell
              flex={1}
              text={`${r.percentile}th`}
              style={[pdfStyles.td, { textAlign: "right" }]}
            />
            <Cell
              flex={1}
              text={`${r.changePct >= 0 ? "+" : ""}${r.changePct}%`}
              style={[
                pdfStyles.td,
                { textAlign: "right", color: r.changePct >= 0 ? COLORS.high : COLORS.low },
              ]}
            />
            <View style={{ flex: 1, alignItems: "center" }}>
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
  flex,
  text,
  style,
  align,
  center,
}: {
  flex: number;
  text: string;
  style?: StyleProp;
  align?: "right";
  center?: boolean;
}) {
  return (
    <View
      style={{
        flex,
        paddingRight: 4,
        justifyContent: "center",
        ...(center ? { alignItems: "center" as const } : {}),
      }}
    >
      <Text {...(style ? { style } : {})}>{text}</Text>
    </View>
  );
}
