import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import { pdfStyles, COLORS } from "./styles/pdfStyles";
import { PDFHeader, PDFTitleBlock } from "./sections/PDFHeader";
import { PDFFooter } from "./sections/PDFFooter";
import type { RiskLevel } from "@/lib/healthwatch/data";

export interface SeasonalityPdfChart {
  label: string;
  imageDataUrl: string;
}

export interface SeasonalityPdfDocumentProps {
  regionName: string;
  illnessLabel: string;
  forecastPeriod: { start: string; end: string };
  charts: SeasonalityPdfChart[];
  generatedAt: string;
  /** Decomposition summary stats. */
  decomposition: {
    trendDirection: string;
    trendChangePct: number;
    seasonalAmplitude: number;
    residualRange: number;
    seasonalityStrength: number;
    peakMonth: string;
    lag12Acf: number;
    lag6Acf: number;
    dominantCycle: string;
  };
  /** Risk tier classification for the current period. */
  risk: {
    level: RiskLevel;
    value: number;
    unit: string;
    p50: number;
    p75: number;
    cases: number;
  };
  /** Seasonal outbreak indicator (Rule A / Rule B). */
  outbreak?: {
    ruleA: boolean;
    ruleB: boolean;
    combined: boolean;
    season: string;
    trigger: string;
    consecutiveHighN: number;
    seasonAvg: number;
    seasonP75: number;
  } | null;
}

function RiskBadgeInline({ level }: { level: RiskLevel }) {
  const color =
    level === "high" ? COLORS.high : level === "moderate" ? COLORS.moderate : COLORS.low;
  return (
    <View
      style={{
        backgroundColor: color,
        borderRadius: 2,
        paddingHorizontal: 6,
        paddingVertical: 2,
        alignSelf: "flex-start",
      }}
    >
      <Text
        style={{
          color: COLORS.offwhite,
          fontSize: 8,
          fontWeight: "bold",
          textTransform: "uppercase",
        }}
      >
        {level}
      </Text>
    </View>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={pdfStyles.metaRow}>
      <Text style={pdfStyles.metaLabel}>{label}</Text>
      <Text style={pdfStyles.metaValue}>{value}</Text>
    </View>
  );
}

function IndicatorDot({ active }: { active: boolean }) {
  return (
    <View
      style={{
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: active ? COLORS.high : COLORS.low,
        marginRight: 6,
      }}
    />
  );
}

export function SeasonalityPdfDocument({
  regionName,
  illnessLabel,
  forecastPeriod,
  charts,
  generatedAt,
  decomposition,
  risk,
  outbreak,
}: SeasonalityPdfDocumentProps) {
  return (
    <Document title={`HEALTHWATCH Seasonal Pattern Analysis Report — ${regionName}`}>
      {/* Page 1: title block + decomposition summary + risk tier */}
      <Page size="A4" style={pdfStyles.page}>
        <PDFHeader />
        <PDFTitleBlock
          title="Seasonal Pattern Analysis Report"
          generatedAt={generatedAt}
          meta={[
            `Region: ${regionName}`,
            `Illness: ${illnessLabel}`,
            `Forecast Period: ${forecastPeriod.start} – ${forecastPeriod.end}`,
          ]}
        />

        {/* ---- Seasonal Decomposition Summary Table ---- */}
        <Text style={pdfStyles.sectionTitle}>Seasonal Decomposition Summary</Text>
        <View style={pdfStyles.table}>
          <View style={pdfStyles.tableHeader}>
            <View style={[{ flex: 4, paddingHorizontal: 4 }]}>
              <Text style={pdfStyles.th}>Metric</Text>
            </View>
            <View style={[{ flex: 3, paddingHorizontal: 4, alignItems: "flex-end" }]}>
              <Text style={pdfStyles.th}>Value</Text>
            </View>
          </View>
          <View style={pdfStyles.tableRow}>
            <View style={[{ flex: 4, paddingHorizontal: 4 }]}>
              <Text style={pdfStyles.td}>Trend direction</Text>
            </View>
            <View style={[{ flex: 3, paddingHorizontal: 4, alignItems: "flex-end" }]}>
              <Text style={[pdfStyles.td, { fontWeight: "bold" }]}>
                {decomposition.trendDirection} ({decomposition.trendChangePct >= 0 ? "+" : ""}
                {decomposition.trendChangePct}%)
              </Text>
            </View>
          </View>
          <View style={pdfStyles.tableRow}>
            <View style={[{ flex: 4, paddingHorizontal: 4 }]}>
              <Text style={pdfStyles.td}>Seasonal amplitude</Text>
            </View>
            <View style={[{ flex: 3, paddingHorizontal: 4, alignItems: "flex-end" }]}>
              <Text style={[pdfStyles.td, { fontWeight: "bold" }]}>
                {decomposition.seasonalAmplitude.toFixed(1)}
              </Text>
            </View>
          </View>
          <View style={pdfStyles.tableRow}>
            <View style={[{ flex: 4, paddingHorizontal: 4 }]}>
              <Text style={pdfStyles.td}>Residual std. deviation</Text>
            </View>
            <View style={[{ flex: 3, paddingHorizontal: 4, alignItems: "flex-end" }]}>
              <Text style={[pdfStyles.td, { fontWeight: "bold" }]}>
                ±{decomposition.residualRange}
              </Text>
            </View>
          </View>
          <View style={pdfStyles.tableRow}>
            <View style={[{ flex: 4, paddingHorizontal: 4 }]}>
              <Text style={pdfStyles.td}>Seasonality strength</Text>
            </View>
            <View style={[{ flex: 3, paddingHorizontal: 4, alignItems: "flex-end" }]}>
              <Text style={[pdfStyles.td, { fontWeight: "bold" }]}>
                {Math.round(decomposition.seasonalityStrength * 100)}%
              </Text>
            </View>
          </View>
          <View style={pdfStyles.tableRow}>
            <View style={[{ flex: 4, paddingHorizontal: 4 }]}>
              <Text style={pdfStyles.td}>Peak month</Text>
            </View>
            <View style={[{ flex: 3, paddingHorizontal: 4, alignItems: "flex-end" }]}>
              <Text style={[pdfStyles.td, { fontWeight: "bold" }]}>{decomposition.peakMonth}</Text>
            </View>
          </View>
          <View style={pdfStyles.tableRow}>
            <View style={[{ flex: 4, paddingHorizontal: 4 }]}>
              <Text style={pdfStyles.td}>ACF at lag 12</Text>
            </View>
            <View style={[{ flex: 3, paddingHorizontal: 4, alignItems: "flex-end" }]}>
              <Text style={[pdfStyles.td, { fontWeight: "bold" }]}>
                {decomposition.lag12Acf.toFixed(2)}
              </Text>
            </View>
          </View>
          <View style={pdfStyles.tableRow}>
            <View style={[{ flex: 4, paddingHorizontal: 4 }]}>
              <Text style={pdfStyles.td}>ACF at lag 6</Text>
            </View>
            <View style={[{ flex: 3, paddingHorizontal: 4, alignItems: "flex-end" }]}>
              <Text style={[pdfStyles.td, { fontWeight: "bold" }]}>
                {decomposition.lag6Acf.toFixed(2)}
              </Text>
            </View>
          </View>
          <View style={pdfStyles.tableRow}>
            <View style={[{ flex: 4, paddingHorizontal: 4 }]}>
              <Text style={pdfStyles.td}>Dominant cycle</Text>
            </View>
            <View style={[{ flex: 3, paddingHorizontal: 4, alignItems: "flex-end" }]}>
              <Text style={[pdfStyles.td, { fontWeight: "bold" }]}>
                {decomposition.dominantCycle}
              </Text>
            </View>
          </View>
        </View>

        {/* ---- Risk Tier Classification ---- */}
        <Text style={pdfStyles.sectionTitle}>Risk Tier Classification</Text>
        <View
          style={[
            pdfStyles.card,
            {
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginBottom: 6,
            },
          ]}
        >
          <RiskBadgeInline level={risk.level} />
          <Text style={[pdfStyles.value, { fontSize: 14, marginLeft: 4 }]}>
            {risk.level === "high" ? "High" : risk.level === "moderate" ? "Moderate" : "Low"} Risk
          </Text>
        </View>
        <MetaRow label="Current value" value={`${risk.value.toFixed(1)} ${risk.unit}`} />
        <MetaRow label="Reported cases" value={risk.cases.toLocaleString()} />
        <MetaRow label="P50 threshold (seasonal median)" value={risk.p50.toFixed(1)} />
        <MetaRow label="P75 threshold (seasonal upper quartile)" value={risk.p75.toFixed(1)} />

        {/* ---- Seasonal Outbreak Indicator ---- */}
        {outbreak && (
          <>
            <Text style={pdfStyles.sectionTitle}>Seasonal Outbreak Indicator</Text>
            <MetaRow label="Assessment season" value={outbreak.season} />
            <View style={[pdfStyles.metaRow, { alignItems: "center" }]}>
              <Text style={pdfStyles.metaLabel}>Rule A — Consecutive High months</Text>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <IndicatorDot active={outbreak.ruleA} />
                <Text
                  style={[
                    pdfStyles.metaValue,
                    { color: outbreak.ruleA ? COLORS.high : COLORS.low },
                  ]}
                >
                  {outbreak.ruleA ? "Triggered" : "Not triggered"}
                  {outbreak.ruleA ? ` (${outbreak.consecutiveHighN}+ consecutive)` : ""}
                </Text>
              </View>
            </View>
            <View style={[pdfStyles.metaRow, { alignItems: "center" }]}>
              <Text style={pdfStyles.metaLabel}>Rule B — Seasonal average above P75</Text>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <IndicatorDot active={outbreak.ruleB} />
                <Text
                  style={[
                    pdfStyles.metaValue,
                    { color: outbreak.ruleB ? COLORS.high : COLORS.low },
                  ]}
                >
                  {outbreak.ruleB ? "Triggered" : "Not triggered"}
                  {outbreak.ruleB
                    ? ` (avg ${outbreak.seasonAvg.toFixed(0)} > P75 ${outbreak.seasonP75.toFixed(0)})`
                    : ""}
                </Text>
              </View>
            </View>
            <View
              style={[
                pdfStyles.card,
                {
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 4,
                  backgroundColor: outbreak.combined
                    ? "color-mix(in srgb, #b82d2a 8%, white)"
                    : "color-mix(in srgb, #007a54 8%, white)",
                },
              ]}
            >
              <IndicatorDot active={outbreak.combined} />
              <Text style={[pdfStyles.value, { fontSize: 11 }]}>
                Combined outbreak signal:{" "}
                <Text style={{ color: outbreak.combined ? COLORS.high : COLORS.low }}>
                  {outbreak.combined ? "OUTBREAK" : "No outbreak"}
                </Text>
              </Text>
            </View>
          </>
        )}

        {/* First chart on page 1 */}
        {charts.length > 0 && (
          <>
            <Text style={pdfStyles.sectionTitle}>{charts[0]!.label}</Text>
            <Image src={charts[0]!.imageDataUrl} style={pdfStyles.chartImage} />
            <Text style={pdfStyles.caption}>Figure 1. {charts[0]!.label} — Source: DOH PIDSR</Text>
          </>
        )}

        <PDFFooter />
      </Page>

      {/* Remaining charts, one per page */}
      {charts.slice(1).map((chart, i) => (
        <Page key={chart.label} size="A4" style={pdfStyles.page}>
          <PDFHeader />
          <View style={{ marginTop: 8 }}>
            <Text style={pdfStyles.sectionTitle}>{chart.label}</Text>
            <Image src={chart.imageDataUrl} style={pdfStyles.chartImage} />
            <Text style={pdfStyles.caption}>
              Figure {i + 2}. {chart.label} — Source: DOH PIDSR
            </Text>
          </View>
          <PDFFooter />
        </Page>
      ))}
    </Document>
  );
}
