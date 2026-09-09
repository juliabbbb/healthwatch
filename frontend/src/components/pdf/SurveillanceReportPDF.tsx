import { Document, Page, Text, View } from "@react-pdf/renderer";
import { pdfStyles, COLORS, PAGE } from "./styles/pdfStyles";
import { PDFHeader } from "./sections/PDFHeader";
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

const FORECAST_COL_WIDTHS = {
  month: 100,
  predictedCases: 110,
  lowerBound: 100,
  upperBound: 100,
  riskTier: 105,
} as const;

const SUMMARY_COL_WIDTHS = {
  rank: 30,
  region: 120,
  riskTier: 70,
  predictedCases: 140,
  outbreakFlag: 155,
} as const;

const RISK_COLORS: Record<string, string> = {
  high: COLORS.high,
  moderate: COLORS.moderate,
  low: COLORS.low,
};

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

  return (
    <Document
      title={`Epidemiological Report ${formatMonthYear(options.baseline)}`}
      author="HEALTHWATCH — DOH Surveillance Module"
      creator="HEALTHWATCH"
      producer="HEALTHWATCH"
    >
      {/* ── Cover Page ── */}
      <Page size="A4" style={pdfStyles.page}>
        <View style={{ marginTop: 120 }}>
          <Text
            style={{
              color: COLORS.tealBright,
              fontSize: 28,
              fontWeight: "bold",
              marginBottom: 6,
            }}
          >
            HEALTHWATCH
          </Text>
          <Text
            style={{
              color: COLORS.offwhite,
              fontSize: 18,
              fontWeight: "bold",
              marginBottom: 24,
            }}
          >
            Regional Outbreak Comparison Report
          </Text>

          <View style={{ marginBottom: 32 }}>
            <CoverField label="Illness" value="Dengue" />
            <CoverField
              label="Forecast Period"
              value={
                forecastStart && forecastEnd
                  ? `${formatMonthYear(forecastStart)} to ${formatMonthYear(forecastEnd)}`
                  : "—"
              }
            />
            <CoverField label="Regions Included" value={`${options.regions.length} regions`} />
            <CoverField label="Generated" value={formatMonthYear(options.baseline)} />
            <CoverField label="Source" value="DOH PIDSR Surveillance Data" />
          </View>

          <View
            style={{
              borderBottomWidth: 1,
              borderBottomColor: COLORS.border,
              marginBottom: 20,
            }}
          />

          <Text
            style={{
              color: COLORS.offwhite,
              fontSize: 11,
              fontWeight: "bold",
              marginBottom: 10,
            }}
          >
            Regions in this export:
          </Text>
          {options.regions.map((r, i) => (
            <Text
              key={r.profile.code}
              style={{ color: COLORS.muted, fontSize: 9, marginBottom: 4, paddingLeft: 8 }}
            >
              {i + 1}. {r.profile.name} ({r.profile.short})
            </Text>
          ))}
        </View>

        <PDFFooter generatedAt={options.generatedAt} />
      </Page>

      {/* ── Main Content Page ── */}
      <Page size="A4" style={pdfStyles.page}>
        <PDFHeader
          title="Epidemiological Surveillance Report"
          generatedAt={options.generatedAt}
          baseline={options.baseline}
          pathology={options.pathology}
        />

        {sections.comparative && options.regions.length > 0 && (
          <PDFComparativeTable rows={comparativeRows} status="predicted" />
        )}

        {sections.recommendations && (
          <View style={pdfStyles.section}>
            <Text style={pdfStyles.sectionTitle}>Recommendations</Text>
            {options.regions.map((r) => (
              <View key={r.profile.code} style={pdfStyles.card}>
                <Text style={[pdfStyles.value, { fontSize: 9 }]}>
                  {r.profile.name} ({r.profile.short})
                </Text>
                <Text style={[pdfStyles.muted, { marginTop: 3 }]}>
                  Risk tier: <Text style={{ color: "#f8fafc", fontWeight: "bold" }}>{r.risk}</Text>{" "}
                  —
                  {r.risk === "high"
                    ? " Convene the regional epidemiology and surveillance unit within 48 hours and pre-position medical supplies."
                    : r.risk === "moderate"
                      ? " Heighten passive surveillance and move sentinel sites to monthly reporting."
                      : " Maintain routine PIDSR reporting cadence and continue baseline surveillance."}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Per-Region Pages ── */}
        {options.regions.map((r, index) => (
          <View key={r.profile.code} break={index > 0}>
            <View style={[pdfStyles.section, { marginBottom: 10 }]}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                <Text style={{ color: COLORS.offwhite, fontSize: 18, fontWeight: "bold" }}>
                  {r.profile.name}
                </Text>
                <View
                  style={{
                    backgroundColor: RISK_COLORS[r.risk] ?? COLORS.low,
                    borderRadius: 3,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    marginLeft: 10,
                  }}
                >
                  <Text
                    style={{
                      color: "#ffffff",
                      fontSize: 9,
                      fontWeight: "bold",
                      textTransform: "uppercase",
                    }}
                  >
                    {r.risk}
                  </Text>
                </View>
              </View>

              <Text style={pdfStyles.sectionTitle}>12-Month Forecast</Text>
              <View style={pdfStyles.table}>
                <View style={pdfStyles.tableHeader}>
                  <ForecastCell width={FORECAST_COL_WIDTHS.month} text="Month" />
                  <ForecastCell width={FORECAST_COL_WIDTHS.predictedCases} text="Predicted Cases" />
                  <ForecastCell width={FORECAST_COL_WIDTHS.lowerBound} text="Lower Bound" />
                  <ForecastCell width={FORECAST_COL_WIDTHS.upperBound} text="Upper Bound" />
                  <ForecastCell width={FORECAST_COL_WIDTHS.riskTier} text="Risk Tier" />
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
                        fi % 2 === 1 ? { backgroundColor: COLORS.slate } : {},
                      ]}
                    >
                      <ForecastCell
                        width={FORECAST_COL_WIDTHS.month}
                        text={formatMonthYear(fp.label)}
                      />
                      <ForecastCell
                        width={FORECAST_COL_WIDTHS.predictedCases}
                        text={fpValue}
                        alignRight
                      />
                      <ForecastCell
                        width={FORECAST_COL_WIDTHS.lowerBound}
                        text={fpLower}
                        alignRight
                      />
                      <ForecastCell
                        width={FORECAST_COL_WIDTHS.upperBound}
                        text={fpUpper}
                        alignRight
                      />
                      <View
                        style={{
                          width: FORECAST_COL_WIDTHS.riskTier,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <View
                          style={{
                            backgroundColor: RISK_COLORS[r.risk] ?? COLORS.low,
                            borderRadius: 2,
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                          }}
                        >
                          <Text
                            style={{
                              color: "#ffffff",
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
                  );
                })}
              </View>

              <View style={{ marginTop: 10 }}>
                <Text style={pdfStyles.sectionTitle}>Seasonal Outbreak Indicator</Text>
                <View style={pdfStyles.card}>
                  <Text style={[pdfStyles.muted, { fontSize: 9 }]}>
                    Rule A (P75 exceedance):{" "}
                    <Text
                      style={{
                        color: r.risk === "high" ? COLORS.high : COLORS.offwhite,
                        fontWeight: "bold",
                      }}
                    >
                      {r.percentile >= 75 ? "Fired — outbreak threshold breached" : "Not fired"}
                    </Text>
                  </Text>
                  <Text style={[pdfStyles.muted, { fontSize: 9, marginTop: 4 }]}>
                    Rule B (trajectory acceleration):{" "}
                    <Text
                      style={{
                        color: r.changePct >= 10 ? COLORS.moderate : COLORS.offwhite,
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

              <View
                style={{
                  borderBottomWidth: 1,
                  borderBottomColor: COLORS.border,
                  marginTop: 12,
                }}
              />
            </View>
          </View>
        ))}

        <PDFFooter generatedAt={options.generatedAt} />
      </Page>

      {/* ── Summary Page ── */}
      <Page size="A4" style={pdfStyles.page}>
        <Text
          style={{ color: COLORS.offwhite, fontSize: 16, fontWeight: "bold", marginBottom: 12 }}
        >
          Summary — All Regions
        </Text>

        <View style={pdfStyles.table}>
          <View style={pdfStyles.tableHeader}>
            <SummaryCell width={SUMMARY_COL_WIDTHS.rank} text="Rank" />
            <SummaryCell width={SUMMARY_COL_WIDTHS.region} text="Region" />
            <SummaryCell width={SUMMARY_COL_WIDTHS.riskTier} text="Risk Tier" />
            <SummaryCell width={SUMMARY_COL_WIDTHS.predictedCases} text="Predicted (Next Season)" />
            <SummaryCell width={SUMMARY_COL_WIDTHS.outbreakFlag} text="Outbreak Flag" />
          </View>
          {sortedForSummary.map((r, i) => {
            const outbreakFired = r.percentile >= 75 || r.changePct >= 10;
            return (
              <View
                key={r.profile.code}
                style={[pdfStyles.tableRow, i % 2 === 1 ? { backgroundColor: COLORS.slate } : {}]}
              >
                <SummaryCell width={SUMMARY_COL_WIDTHS.rank} text={`${i + 1}`} />
                <SummaryCell
                  width={SUMMARY_COL_WIDTHS.region}
                  text={`${r.profile.name} (${r.profile.short})`}
                />
                <View
                  style={{
                    width: SUMMARY_COL_WIDTHS.riskTier,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <View
                    style={{
                      backgroundColor: RISK_COLORS[r.risk] ?? COLORS.low,
                      borderRadius: 2,
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                    }}
                  >
                    <Text
                      style={{
                        color: "#ffffff",
                        fontSize: 7,
                        fontWeight: "bold",
                        textTransform: "uppercase",
                      }}
                    >
                      {r.risk}
                    </Text>
                  </View>
                </View>
                <SummaryCell
                  width={SUMMARY_COL_WIDTHS.predictedCases}
                  text={r.predicted.toLocaleString()}
                  alignRight
                />
                <SummaryCell
                  width={SUMMARY_COL_WIDTHS.outbreakFlag}
                  text={outbreakFired ? "\u26A0 Yes" : "\u2014"}
                />
              </View>
            );
          })}
        </View>

        <PDFFooter generatedAt={options.generatedAt} />
      </Page>
    </Document>
  );
}

function CoverField({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", marginBottom: 6 }}>
      <Text style={{ color: COLORS.muted, fontSize: 9, width: 120 }}>{label}:</Text>
      <Text style={{ color: COLORS.offwhite, fontSize: 9, fontWeight: "bold" }}>{value}</Text>
    </View>
  );
}

function ForecastCell({
  width,
  text,
  alignRight,
}: {
  width: number;
  text: string;
  alignRight?: boolean;
}) {
  return (
    <View
      style={{
        width,
        justifyContent: "center",
        paddingRight: 4,
        ...(alignRight ? { alignItems: "flex-end" as const } : {}),
      }}
    >
      <Text style={[pdfStyles.td, { fontSize: 9 }]}>{text}</Text>
    </View>
  );
}

function SummaryCell({
  width,
  text,
  alignRight,
}: {
  width: number;
  text: string;
  alignRight?: boolean;
}) {
  return (
    <View
      style={{
        width,
        justifyContent: "center",
        paddingRight: 4,
        ...(alignRight ? { alignItems: "flex-end" as const } : {}),
      }}
    >
      <Text style={[pdfStyles.td, { fontSize: 9 }]}>{text}</Text>
    </View>
  );
}
