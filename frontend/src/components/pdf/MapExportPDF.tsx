import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import type { Style } from "@react-pdf/types";
import type { RiskLevel } from "@/lib/healthwatch/data";
import { COLORS, pdfStyles, riskAccent } from "./styles/pdfStyles";
import { PDFHeader, PDFTitleBlock } from "./sections/PDFHeader";
import { PDFFooter } from "./sections/PDFFooter";

const RISK_LEGEND: { level: RiskLevel; label: string; note: string }[] = [
  {
    level: "high",
    label: "High risk",
    note: "— above the P75 of the national seasonal distribution",
  },
  {
    level: "moderate",
    label: "Moderate risk",
    note: "— between the P50 and P75 national seasonal thresholds",
  },
  {
    level: "low",
    label: "Low risk",
    note: "— below the P50 national seasonal threshold",
  },
];

const TABLE_COLS = [
  { key: "name", label: "Region", flex: 5, align: "left" },
  { key: "risk", label: "Risk", flex: 3, align: "center" },
  { key: "value", label: "Value", flex: 3.5, align: "right" },
  { key: "cases", label: "Cases", flex: 3, align: "right" },
  { key: "percentile", label: "Percentile", flex: 2.5, align: "right" },
  { key: "trend", label: "3-Mo", flex: 2.5, align: "right" },
] as const;

type ColKey = (typeof TABLE_COLS)[number]["key"];

const ALIGN_STYLE: Record<"left" | "right" | "center", Style> = {
  left: { alignItems: "flex-start" },
  right: { alignItems: "flex-end" },
  center: { alignItems: "center" },
};

const COL_ALIGNS = Object.fromEntries(TABLE_COLS.map((c) => [c.key, c.align])) as Record<
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

export interface MapExportNational {
  tier: RiskLevel;
  monthLabel: string;
  isForecast: boolean;
  incidence: string;
  unit: string;
  illnessLabel: string;
  dominantIllness: string;
  counts: { high: number; moderate: number; low: number };
}

export interface MapExportRegion {
  name: string;
  short: string;
  tier: RiskLevel;
  value: string;
  unit: string;
  cases: string;
  percentile: number;
  changePct: number;
  season: "wet" | "dry";
  forecast: boolean;
}

export interface MapExportRegionRow {
  name: string;
  short: string;
  risk: RiskLevel;
  value: string;
  unit: string;
  cases: string;
  percentile: number;
  changePct: number;
}

export interface MapExportDocumentProps {
  imageDataUrl: string;
  baseline: string;
  generatedAt: string;
  national: MapExportNational;
  region: MapExportRegion | null;
  regions: MapExportRegionRow[];
}

function riskLabel(tier: RiskLevel): string {
  return tier === "high" ? "High" : tier === "moderate" ? "Moderate" : "Low";
}

export function MapExportDocument({
  imageDataUrl,
  baseline,
  generatedAt,
  national,
  region,
  regions,
}: MapExportDocumentProps) {
  const regionScope = region ? `${region.name} (${region.short})` : "National — all 18 regions";

  return (
    <Document
      title={`HEALTHWATCH — Philippine Outbreak Hotspot Map ${baseline}`}
      author="HEALTHWATCH — DOH Surveillance Module"
      creator="HEALTHWATCH"
      producer="HEALTHWATCH"
    >
      <Page size="A4" style={pdfStyles.page}>
        <PDFHeader />
        <PDFTitleBlock
          title="Philippine Outbreak Hotspot Map"
          generatedAt={generatedAt}
          meta={[
            `Baseline: ${baseline} (${national.isForecast ? "Predicted" : "Reported"})`,
            `Region: ${regionScope}`,
          ]}
        />

        <Image src={imageDataUrl} style={pdfStyles.chartImage} />
        <Text style={pdfStyles.caption}>
          Figure 1. Philippine regional risk classification map — Source: DOH Philippines
        </Text>

        {/* Risk legend */}
        <Text style={pdfStyles.sectionTitle}>Risk Legend</Text>
        {RISK_LEGEND.map((item) => (
          <View key={item.level} style={pdfStyles.legendRow}>
            <View style={[pdfStyles.legendSwatch, { backgroundColor: riskAccent(item.level) }]} />
            <Text style={pdfStyles.legendLabel}>
              <Text style={{ fontWeight: "bold", color: COLORS.slate }}>{item.label}</Text>{" "}
              {item.note}
            </Text>
          </View>
        ))}

        {/* National summary */}
        <Text style={pdfStyles.sectionTitle}>National Snapshot</Text>
        <View style={pdfStyles.metaRow}>
          <Text style={pdfStyles.metaLabel}>National risk tier</Text>
          <Text style={[pdfStyles.metaValue, { color: riskAccent(national.tier) }]}>
            {riskLabel(national.tier)} risk
          </Text>
        </View>
        <View style={pdfStyles.metaRow}>
          <Text style={pdfStyles.metaLabel}>National incidence</Text>
          <Text style={pdfStyles.metaValue}>
            {national.incidence} {national.unit}
          </Text>
        </View>
        <View style={pdfStyles.metaRow}>
          <Text style={pdfStyles.metaLabel}>Risk distribution</Text>
          <Text style={pdfStyles.metaValue}>
            High {national.counts.high} · Moderate {national.counts.moderate} · Low{" "}
            {national.counts.low}
          </Text>
        </View>
        <View style={pdfStyles.metaRow}>
          <Text style={pdfStyles.metaLabel}>Pathology</Text>
          <Text style={pdfStyles.metaValue}>{national.illnessLabel}</Text>
        </View>
        <View style={pdfStyles.metaRow}>
          <Text style={pdfStyles.metaLabel}>Dominant illness</Text>
          <Text style={pdfStyles.metaValue}>{national.dominantIllness}</Text>
        </View>

        {region && (
          <>
            <Text style={pdfStyles.sectionTitle}>Selected Region</Text>
            <View style={pdfStyles.metaRow}>
              <Text style={pdfStyles.metaLabel}>Risk tier</Text>
              <Text style={[pdfStyles.metaValue, { color: riskAccent(region.tier) }]}>
                {riskLabel(region.tier)} risk
              </Text>
            </View>
            <View style={pdfStyles.metaRow}>
              <Text style={pdfStyles.metaLabel}>Current value</Text>
              <Text style={pdfStyles.metaValue}>
                {region.value} {region.unit}
              </Text>
            </View>
            <View style={pdfStyles.metaRow}>
              <Text style={pdfStyles.metaLabel}>Reported cases</Text>
              <Text style={pdfStyles.metaValue}>{region.cases}</Text>
            </View>
            <View style={pdfStyles.metaRow}>
              <Text style={pdfStyles.metaLabel}>National percentile</Text>
              <Text style={pdfStyles.metaValue}>{region.percentile}th percentile</Text>
            </View>
            <View style={pdfStyles.metaRow}>
              <Text style={pdfStyles.metaLabel}>3-month trend</Text>
              <Text style={pdfStyles.metaValue}>
                {region.changePct >= 0 ? "+" : ""}
                {region.changePct}%
              </Text>
            </View>
            <View style={pdfStyles.metaRow}>
              <Text style={pdfStyles.metaLabel}>Season</Text>
              <Text style={pdfStyles.metaValue}>
                {region.season === "wet" ? "Wet" : "Dry"} ·{" "}
                {region.forecast ? "forecast" : "reported"}
              </Text>
            </View>
          </>
        )}

        {/* Full regional classification table */}
        <Text style={pdfStyles.sectionTitle}>Regional Risk Classification</Text>
        <View style={pdfStyles.table} wrap={false}>
          <View style={pdfStyles.tableHeader}>
            {TABLE_COLS.map((c) => (
              <Cell key={c.key} fl={c.flex} align={COL_ALIGNS[c.key]}>
                <Text style={pdfStyles.th}>{c.label}</Text>
              </Cell>
            ))}
          </View>
          {regions.map((r, i) => (
            <View
              key={r.short}
              style={[pdfStyles.tableRow, i % 2 === 1 ? { backgroundColor: COLORS.card } : {}]}
            >
              <Cell fl={TABLE_COLS[0]!.flex} align={COL_ALIGNS.name}>
                <Text style={pdfStyles.td}>
                  {r.name} ({r.short})
                </Text>
              </Cell>
              <Cell fl={TABLE_COLS[1]!.flex} align={COL_ALIGNS.risk}>
                <RiskBadge risk={r.risk} />
              </Cell>
              <Cell fl={TABLE_COLS[2]!.flex} align={COL_ALIGNS.value}>
                <Text style={pdfStyles.td}>{r.value}</Text>
              </Cell>
              <Cell fl={TABLE_COLS[3]!.flex} align={COL_ALIGNS.cases}>
                <Text style={pdfStyles.td}>{r.cases}</Text>
              </Cell>
              <Cell fl={TABLE_COLS[4]!.flex} align={COL_ALIGNS.percentile}>
                <Text style={pdfStyles.td}>{r.percentile}th</Text>
              </Cell>
              <Cell fl={TABLE_COLS[5]!.flex} align={COL_ALIGNS.trend}>
                <Text style={[pdfStyles.td, { textAlign: "right" }]}>
                  {r.changePct >= 0 ? "+" : ""}
                  {r.changePct}%
                </Text>
              </Cell>
            </View>
          ))}
        </View>

        <PDFFooter />
      </Page>
    </Document>
  );
}
