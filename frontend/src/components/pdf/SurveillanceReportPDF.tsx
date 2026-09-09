import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import type { Style } from "@react-pdf/types";
import { pdfStyles, COLORS, riskAccent } from "./styles/pdfStyles";
import { PDFHeader, PDFTitleBlock } from "./sections/PDFHeader";
import { PDFFooter } from "./sections/PDFFooter";
import { PDFComparativeTable, type ComparativeRow } from "./sections/PDFComparativeTable";
import type { MonthPoint, Region, RiskLevel } from "@/lib/healthwatch/data";
import { formatMonthYear } from "@/utils/formatDate";

export type ReportLayout = "executive" | "comprehensive" | "custom";

export interface ExportOptions {
  layout: ReportLayout;
  baseline: string;
  generatedAt: string;
  pathology: string;
  sections: {
    overview: boolean;
    comparative: boolean;
    trajectory: boolean;
    seasonality: boolean;
    performance: boolean;
    recommendations: boolean;
  };
  regions: {
    profile: Region;
    risk: RiskLevel;
    reported: number;
    predicted: number;
    lower: number;
    upper: number;
    percentile: number;
    changePct: number;
    dominantIllness: string;
    unit: string;
    mape: number;
    mae: number;
    rmse: number;
    trajectoryImage?: string | null;
    seasonalityImage?: string | null;
    season: "wet" | "dry";
    driver: string;
    forecastWindow: MonthPoint[];
  }[];
}

const FORECAST_COLS = [
  { key: "month", label: "Month", flex: 1.2, align: "left" },
  { key: "predicted", label: "Predicted Cases", flex: 1.4, align: "right" },
  { key: "lower", label: "Lower Bound", flex: 1, align: "right" },
  { key: "upper", label: "Upper Bound", flex: 1, align: "right" },
  { key: "risk", label: "Risk Tier", flex: 1, align: "center" },
] as const;

const SUMMARY_COLS = [
  { key: "rank", label: "Rank", flex: 0.9, align: "right" },
  { key: "region", label: "Region", flex: 4.2, align: "left" },
  { key: "risk", label: "Risk Tier", flex: 2.2, align: "center" },
  { key: "predicted", label: "Predicted (Next Season)", flex: 3.2, align: "right" },
  { key: "outbreak", label: "Outbreak Flag", flex: 2.8, align: "center" },
] as const;

type ForecastCol = (typeof FORECAST_COLS)[number]["key"];
type SummaryCol = (typeof SUMMARY_COLS)[number]["key"];

const ALIGN_STYLE: Record<"left" | "right" | "center", Style> = {
  left: { alignItems: "flex-start" },
  right: { alignItems: "flex-end" },
  center: { alignItems: "center" },
};

const FORECAST_ALIGNS = Object.fromEntries(FORECAST_COLS.map((c) => [c.key, c.align])) as Record<
  ForecastCol,
  "left" | "right" | "center"
>;

const SUMMARY_ALIGNS = Object.fromEntries(SUMMARY_COLS.map((c) => [c.key, c.align])) as Record<
  SummaryCol,
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

function RiskBadge({ risk }: { risk: RiskLevel }) {
  return (
    <View
      style={{
        backgroundColor: riskAccent(risk),
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
        {risk}
      </Text>
    </View>
  );
}

export function SurveillanceReportPDF({ options }: { options: ExportOptions }) {
  const { sections } = options;

  const comparativeRows: ComparativeRow[] = options.regions.map((r) => ({
    region: r.profile.name,
    short: r.profile.short,
    reported: r.reported,
    predicted: r.predicted,
    lower: r.lower,
    upper: r.upper,
    percentile: r.percentile,
    changePct: r.changePct,
    risk: r.risk,
    unit: r.unit,
  }));

  const sortedForSummary = [...options.regions].sort((a, b) => b.predicted - a.predicted);

  const forecastStart = options.regions[0]?.forecastWindow[0]?.label;
  const forecastEnd = options.regions[0]?.forecastWindow.at(-1)?.label;
  const forecastPeriod =
    forecastStart && forecastEnd
      ? `${formatMonthYear(forecastStart)} to ${formatMonthYear(forecastEnd)}`
      : "—";

  return (
    <Document
      title={`Epidemiological Report ${formatMonthYear(options.baseline)}`}
      author="HEALTHWATCH — DOH Surveillance Module"
      creator="HEALTHWATCH"
      producer="HEALTHWATCH"
    >
      {/* ── Cover Page ── */}
      <Page size="A4" style={pdfStyles.page}>
        <PDFHeader />
        <PDFTitleBlock
          title="Regional Outbreak Comparison Report"
          generatedAt={options.generatedAt}
          meta={[
            `Illness: ${options.pathology}`,
            `Forecast Period: ${forecastPeriod}`,
            `Regions included: ${options.regions.length}`,
            `Baseline: ${formatMonthYear(options.baseline)} · Source: DOH PIDSR Surveillance Data`,
          ]}
        />

        <Text style={pdfStyles.sectionTitle}>Regions in this export</Text>
        {options.regions.map((r, i) => (
          <View key={r.profile.code} style={pdfStyles.metaRow}>
            <Text style={pdfStyles.metaLabel}>
              {i + 1}. {r.profile.name} ({r.profile.short})
            </Text>
            <RiskBadge risk={r.risk} />
          </View>
        ))}

        <PDFFooter />
      </Page>

      {/* ── Main Content Page ── */}
      <Page size="A4" style={pdfStyles.page}>
        <PDFHeader />

        {sections.comparative && options.regions.length > 0 && (
          <PDFComparativeTable rows={comparativeRows} status="predicted" />
        )}

        {sections.recommendations && (
          <View style={pdfStyles.section}>
            <Text style={pdfStyles.sectionTitle}>Recommendations</Text>
            {options.regions.map((r) => (
              <View key={r.profile.code} style={pdfStyles.card}>
                <View style={pdfStyles.metaRow}>
                  <Text style={pdfStyles.metaValue}>
                    {r.profile.name} ({r.profile.short})
                  </Text>
                  <RiskBadge risk={r.risk} />
                </View>
                <Text style={[pdfStyles.body, { marginTop: 2 }]}>
                  {r.risk === "high"
                    ? "Convene the regional epidemiology and surveillance unit within 48 hours and pre-position medical supplies."
                    : r.risk === "moderate"
                      ? "Heighten passive surveillance and move sentinel sites to monthly reporting."
                      : "Maintain routine PIDSR reporting cadence and continue baseline surveillance."}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Per-Region Pages ── */}
        {options.regions.map((r, index) => (
          <View key={r.profile.code} break={index > 0}>
            <View style={[pdfStyles.section, { marginBottom: 10, marginTop: index > 0 ? 10 : 0 }]}>
              <View style={pdfStyles.metaRow}>
                <Text style={pdfStyles.title}>{r.profile.name}</Text>
                <RiskBadge risk={r.risk} />
              </View>

              <Text style={pdfStyles.sectionTitle}>12-Month Forecast</Text>
              <View style={pdfStyles.table} wrap={false}>
                <View style={pdfStyles.tableHeader}>
                  {FORECAST_COLS.map((c) => (
                    <Cell key={c.key} fl={c.flex} align={FORECAST_ALIGNS[c.key]}>
                      <Text style={pdfStyles.th}>{c.label}</Text>
                    </Cell>
                  ))}
                </View>
                {r.forecastWindow.map((fp, fi) => {
                  const fpValue = r.unit.includes("100k")
                    ? ((fp.cases / r.profile.population) * 100000).toFixed(2)
                    : Math.round(fp.cases).toLocaleString();
                  const fpLower = r.unit.includes("100k")
                    ? ((fp.lower / r.profile.population) * 100000).toFixed(2)
                    : Math.round(fp.lower).toLocaleString();
                  const fpUpper = r.unit.includes("100k")
                    ? ((fp.upper / r.profile.population) * 100000).toFixed(2)
                    : Math.round(fp.upper).toLocaleString();
                  return (
                    <View
                      key={fp.index}
                      style={[
                        pdfStyles.tableRow,
                        fi % 2 === 1 ? { backgroundColor: COLORS.card } : {},
                      ]}
                    >
                      <Cell fl={FORECAST_COLS[0]!.flex} align={FORECAST_ALIGNS.month}>
                        <Text style={pdfStyles.td}>{formatMonthYear(fp.label)}</Text>
                      </Cell>
                      <Cell fl={FORECAST_COLS[1]!.flex} align={FORECAST_ALIGNS.predicted}>
                        <Text style={pdfStyles.td}>{fpValue}</Text>
                      </Cell>
                      <Cell fl={FORECAST_COLS[2]!.flex} align={FORECAST_ALIGNS.lower}>
                        <Text style={pdfStyles.td}>{fpLower}</Text>
                      </Cell>
                      <Cell fl={FORECAST_COLS[3]!.flex} align={FORECAST_ALIGNS.upper}>
                        <Text style={pdfStyles.td}>{fpUpper}</Text>
                      </Cell>
                      <Cell fl={FORECAST_COLS[4]!.flex} align={FORECAST_ALIGNS.risk}>
                        <RiskBadge risk={r.risk} />
                      </Cell>
                    </View>
                  );
                })}
              </View>

              <View style={{ marginTop: 10 }}>
                <Text style={pdfStyles.sectionTitle}>Seasonal Outbreak Indicator</Text>
                <View style={pdfStyles.card}>
                  <Text style={[pdfStyles.body, { fontSize: 9 }]}>
                    Rule A (P75 exceedance):{" "}
                    <Text
                      style={{
                        color: r.risk === "high" ? COLORS.high : COLORS.slate,
                        fontWeight: "bold",
                      }}
                    >
                      {r.percentile >= 75 ? "Fired — outbreak threshold breached" : "Not fired"}
                    </Text>
                  </Text>
                  <Text style={[pdfStyles.body, { fontSize: 9, marginTop: 4 }]}>
                    Rule B (trajectory acceleration):{" "}
                    <Text
                      style={{
                        color: r.changePct >= 10 ? COLORS.moderate : COLORS.slate,
                        fontWeight: "bold",
                      }}
                    >
                      {r.changePct >= 10
                        ? `Fired — ${r.changePct >= 0 ? "+" : ""}${r.changePct}% change`
                        : "Not fired"}
                    </Text>
                  </Text>
                </View>
              </View>
            </View>
          </View>
        ))}

        <PDFFooter />
      </Page>

      {/* ── Summary Page ── */}
      <Page size="A4" style={pdfStyles.page}>
        <PDFHeader />
        <Text style={{ color: COLORS.slate, fontSize: 16, fontWeight: "bold", marginBottom: 12 }}>
          Summary — All Regions
        </Text>

        <View style={pdfStyles.table} wrap={false}>
          <View style={pdfStyles.tableHeader}>
            {SUMMARY_COLS.map((c) => (
              <Cell key={c.key} fl={c.flex} align={SUMMARY_ALIGNS[c.key]}>
                <Text style={pdfStyles.th}>{c.label}</Text>
              </Cell>
            ))}
          </View>
          {sortedForSummary.map((r, i) => {
            const outbreakFired = r.percentile >= 75 || r.changePct >= 10;
            return (
              <View
                key={r.profile.code}
                style={[pdfStyles.tableRow, i % 2 === 1 ? { backgroundColor: COLORS.card } : {}]}
              >
                <Cell fl={SUMMARY_COLS[0]!.flex} align={SUMMARY_ALIGNS.rank}>
                  <Text style={pdfStyles.td}>{i + 1}</Text>
                </Cell>
                <Cell fl={SUMMARY_COLS[1]!.flex} align={SUMMARY_ALIGNS.region}>
                  <Text style={pdfStyles.td}>
                    {r.profile.name} ({r.profile.short})
                  </Text>
                </Cell>
                <Cell fl={SUMMARY_COLS[2]!.flex} align={SUMMARY_ALIGNS.risk}>
                  <RiskBadge risk={r.risk} />
                </Cell>
                <Cell fl={SUMMARY_COLS[3]!.flex} align={SUMMARY_ALIGNS.predicted}>
                  <Text style={pdfStyles.td}>{r.predicted.toLocaleString()}</Text>
                </Cell>
                <Cell fl={SUMMARY_COLS[4]!.flex} align={SUMMARY_ALIGNS.outbreak}>
                  <Text style={[pdfStyles.td, { fontWeight: "bold", color: COLORS.slate }]}>
                    {outbreakFired ? "\u26A0 Yes" : "\u2014"}
                  </Text>
                </Cell>
              </View>
            );
          })}
        </View>

        <PDFFooter />
      </Page>
    </Document>
  );
}
