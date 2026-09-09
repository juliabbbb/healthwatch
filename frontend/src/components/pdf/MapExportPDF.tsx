import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { RiskLevel } from "@/lib/healthwatch/data";

const RISK_HEX: Record<RiskLevel, string> = {
  low: "#22c55e",
  moderate: "#f59e0b",
  high: "#ef4444",
};

const INK = "#0f172a";
const MUTED = "#475569";
const BORDER = "#e2e8f0";
const ACCENT = "#0d9488";

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#ffffff",
    color: INK,
    fontFamily: "Helvetica",
    fontSize: 10,
    padding: 36,
    paddingBottom: 56,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 2,
    borderBottomColor: INK,
    paddingBottom: 10,
    marginBottom: 14,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    letterSpacing: 1.5,
  },
  subtitle: {
    fontSize: 11,
    color: MUTED,
    marginTop: 2,
  },
  meta: {
    fontSize: 8,
    color: MUTED,
    marginTop: 2,
  },
  badge: {
    backgroundColor: ACCENT,
    color: "#ffffff",
    borderRadius: 3,
    padding: "5 9",
    fontSize: 8,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  mapImage: {
    width: "100%",
    marginVertical: 12,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    textTransform: "uppercase",
    color: ACCENT,
    letterSpacing: 0.6,
    marginBottom: 6,
    marginTop: 10,
  },
  tier: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 6,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 3,
  },
  statLabel: {
    color: MUTED,
    fontSize: 9,
  },
  statValue: {
    fontWeight: "bold",
    fontSize: 9,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    marginVertical: 10,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 6,
    fontSize: 7,
    color: MUTED,
  },
});

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

export interface MapExportDocumentProps {
  imageDataUrl: string;
  baseline: string;
  generatedAt: string;
  national: MapExportNational;
  region: MapExportRegion | null;
}

export function MapExportDocument({
  imageDataUrl,
  baseline,
  generatedAt,
  national,
  region,
}: MapExportDocumentProps) {
  return (
    <Document title={`HealthWatch PH Outbreak Hotspot Map — ${baseline}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>HEALTHWATCH</Text>
            <Text style={styles.subtitle}>PH Outbreak Hotspot Map</Text>
            <Text style={styles.meta}>
              Export {baseline} · Generated {generatedAt}
            </Text>
          </View>
          <Text style={styles.badge}>DOH PIDSR</Text>
        </View>

        <Image src={imageDataUrl} style={styles.mapImage} />

        <Text style={styles.sectionTitle}>National Risk Tier</Text>
        <Text style={[styles.tier, { color: RISK_HEX[national.tier] }]}>
          {riskLabel(national.tier)}
        </Text>

        <Text style={styles.sectionTitle}>National Snapshot</Text>
        <StatRow
          label="Baseline month"
          value={`${national.monthLabel} (${national.isForecast ? "Predicted" : "Reported"})`}
        />
        <StatRow label="National incidence" value={`${national.incidence} ${national.unit}`} />
        <StatRow
          label="Risk distribution"
          value={`High ${national.counts.high} · Moderate ${national.counts.moderate} · Low ${national.counts.low}`}
        />
        <StatRow label="Pathology" value={national.illnessLabel} />
        <StatRow label="Dominant illness" value={national.dominantIllness} />

        {region && (
          <>
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>
              Selected Region — {region.name} ({region.short})
            </Text>
            <Text style={[styles.tier, { color: RISK_HEX[region.tier] }]}>
              {riskLabel(region.tier)} risk
            </Text>
            <StatRow label="Current value" value={`${region.value} ${region.unit}`} />
            <StatRow label="Reported cases" value={region.cases} />
            <StatRow label="National percentile" value={`${region.percentile}th percentile`} />
            <StatRow
              label="3-month trend"
              value={`${region.changePct >= 0 ? "+" : ""}${region.changePct}%`}
            />
            <StatRow
              label="Season"
              value={`${region.season === "wet" ? "Wet" : "Dry"} · ${region.forecast ? "forecast" : "reported"}`}
            />
          </>
        )}

        <View style={styles.footer}>
          <Text>Generated by HealthWatch | DOH PIDSR Surveillance Data</Text>
        </View>
      </Page>
    </Document>
  );
}

function riskLabel(tier: RiskLevel): string {
  return tier === "high" ? "High" : tier === "moderate" ? "Moderate" : "Low";
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}
