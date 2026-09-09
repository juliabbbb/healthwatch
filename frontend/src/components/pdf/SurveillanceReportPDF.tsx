import { Document, Page, Text, View } from "@react-pdf/renderer";
import { pdfStyles } from "./styles/pdfStyles";
import { PDFHeader } from "./sections/PDFHeader";
import { PDFFooter } from "./sections/PDFFooter";
import { PDFRegionalProfile } from "./sections/PDFRegionalProfile";
import { PDFComparativeTable, type ComparativeRow } from "./sections/PDFComparativeTable";
import { PDFPredictionSection, type PredictionRegion } from "./sections/PDFPredictionSection";
import { PDFSeasonalitySection, type SeasonalityRegion } from "./sections/PDFSeasonalitySection";
import type { Region, RiskLevel } from "@/lib/healthwatch/data";

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
  }[];
}

// "Executive 1-Page Summary" and "Custom Comparison Matrix" keep a compact
// comparative focus; "Comprehensive Technical Report" pulls in full profiles,
// trajectory + seasonality visuals, and backtest metrics.
export function SurveillanceReportPDF({ options }: { options: ExportOptions }) {
  const { sections } = options;
  const status: "predicted" | "reported" = "predicted";

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

  const predictionRegions: PredictionRegion[] = options.regions
    .filter((r) => sections.trajectory || sections.performance)
    .map((r) => ({
      name: r.profile.name,
      short: r.profile.short,
      chartImage: r.trajectoryImage ?? null,
      lower: r.lower,
      upper: r.upper,
      mape: r.mape,
      mae: r.mae,
      rmse: r.rmse,
      unit: r.unit,
    }));

  const seasonalityRegions: SeasonalityRegion[] = options.regions.map((r) => ({
    name: r.profile.name,
    short: r.profile.short,
    chartImage: r.seasonalityImage ?? null,
    season: r.season,
    driver: r.driver,
  }));

  return (
    <Document
      title={`Epidemiological Report ${options.baseline}`}
      author="HEALTHWATCH — DOH Surveillance Module"
      creator="HEALTHWATCH"
      producer="HEALTHWATCH"
    >
      <Page size="A4" style={pdfStyles.page}>
        <PDFHeader
          title="Epidemiological Surveillance Report"
          generatedAt={options.generatedAt}
          baseline={options.baseline}
          pathology={options.pathology}
        />

        {sections.overview && (
          <View style={pdfStyles.section}>
            <Text style={pdfStyles.sectionTitle}>Regional Profiles</Text>
            {options.regions.map((r) => (
              <PDFRegionalProfile
                key={r.profile.code}
                region={r.profile}
                risk={r.risk}
                reported={r.reported}
                predicted={r.predicted}
                percentileRank={r.percentile}
                changePct={r.changePct}
                dominantIllness={r.dominantIllness}
                unit={r.unit}
              />
            ))}
          </View>
        )}

        {sections.comparative && options.regions.length > 0 && (
          <PDFComparativeTable rows={comparativeRows} status={status} />
        )}

        {sections.recommendations && (
          <View style={pdfStyles.section} wrap={false}>
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

        {(sections.trajectory || sections.performance) && predictionRegions.length > 0 && (
          <PDFPredictionSection regions={predictionRegions} />
        )}

        {sections.seasonality && seasonalityRegions.length > 0 && (
          <PDFSeasonalitySection regions={seasonalityRegions} />
        )}

        <PDFFooter generatedAt={options.generatedAt} />
      </Page>
    </Document>
  );
}
