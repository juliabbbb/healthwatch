import { Text, View } from "@react-pdf/renderer";
import type { Region, RiskLevel } from "@/lib/healthwatch/data";
import { pdfStyles, riskAccent } from "../styles/pdfStyles";

export interface PDFRegionalProfileProps {
  region: Region;
  risk: RiskLevel;
  reported: number;
  predicted: number;
  percentileRank: number;
  changePct: number;
  dominantIllness: string;
  unit: string;
}

export function PDFRegionalProfile({
  region,
  risk,
  reported,
  predicted,
  percentileRank,
  changePct,
  dominantIllness,
  unit,
}: PDFRegionalProfileProps) {
  const accent = riskAccent(risk);
  return (
    <View style={[pdfStyles.card, { borderLeftWidth: 3, borderLeftColor: accent }]} wrap={false}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View>
          <Text style={pdfStyles.value}>{region.name}</Text>
          <Text style={pdfStyles.muted}>
            {region.short} · {region.island} · {region.classification}
          </Text>
        </View>
        <View
          style={{
            backgroundColor: accent,
            borderRadius: 3,
            padding: "3 8",
          }}
        >
          <Text
            style={{
              color: "#0f172a",
              fontSize: 8,
              fontWeight: "bold",
              textTransform: "uppercase",
            }}
          >
            {risk}
          </Text>
        </View>
      </View>

      <View style={[pdfStyles.row, { marginTop: 8 }]}>
        <View style={[pdfStyles.metricBox, { flex: 1 }]}>
          <Text style={pdfStyles.label}>Population</Text>
          <Text style={[pdfStyles.value, { fontSize: 9 }]}>
            {region.population.toLocaleString()}
          </Text>
        </View>
        <View style={[pdfStyles.metricBox, { flex: 1 }]}>
          <Text style={pdfStyles.label}>Density</Text>
          <Text style={[pdfStyles.value, { fontSize: 9 }]}>
            {region.density.toLocaleString()} /km²
          </Text>
        </View>
        <View style={[pdfStyles.metricBox, { flex: 1 }]}>
          <Text style={pdfStyles.label}>Reported ({unit})</Text>
          <Text style={[pdfStyles.value, { fontSize: 9 }]}>{reported.toLocaleString()}</Text>
        </View>
        <View style={[pdfStyles.metricBox, { flex: 1 }]}>
          <Text style={pdfStyles.label}>Predicted ({unit})</Text>
          <Text style={[pdfStyles.value, { fontSize: 9 }]}>{predicted.toLocaleString()}</Text>
        </View>
      </View>

      <View style={[pdfStyles.row, { marginTop: 6 }]}>
        <View style={[pdfStyles.metricBox, { flex: 1 }]}>
          <Text style={pdfStyles.label}>Nat'n Percentile</Text>
          <Text style={[pdfStyles.value, { fontSize: 9 }]}>{percentileRank}th</Text>
        </View>
        <View style={[pdfStyles.metricBox, { flex: 1 }]}>
          <Text style={pdfStyles.label}>3-Mo Trajectory</Text>
          <Text style={[pdfStyles.value, { fontSize: 9 }]}>
            {changePct >= 0 ? "+" : ""}
            {changePct}%
          </Text>
        </View>
        <View style={[pdfStyles.metricBox, { flex: 1 }]}>
          <Text style={pdfStyles.label}>Dominant Pathology</Text>
          <Text style={[pdfStyles.value, { fontSize: 9 }]}>{dominantIllness}</Text>
        </View>
      </View>
    </View>
  );
}
