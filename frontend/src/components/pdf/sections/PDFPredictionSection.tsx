import { Image, Text, View } from "@react-pdf/renderer";
import { pdfStyles, COLORS } from "../styles/pdfStyles";

export interface PredictionRegion {
  name: string;
  short: string;
  chartImage?: string | null; // PNG data-URI
  lower: number;
  upper: number;
  mape: number;
  mae: number;
  rmse: number;
  unit: string;
}

export interface PDFPredictionSectionProps {
  regions: PredictionRegion[];
}

export function PDFPredictionSection({ regions }: PDFPredictionSectionProps) {
  return (
    <View style={pdfStyles.section}>
      <Text style={pdfStyles.sectionTitle}>Predicted Trajectory & Model Performance</Text>
      {regions.map((r) => (
        <View key={r.short} style={[pdfStyles.card, { marginBottom: 10 }]} wrap={false}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
            <Text style={pdfStyles.value}>{r.name}</Text>
            <Text style={pdfStyles.muted}>
              95% CI {r.lower.toLocaleString()}–{r.upper.toLocaleString()} {r.unit}
            </Text>
          </View>

          {r.chartImage ? (
            <Image src={r.chartImage} style={pdfStyles.image} />
          ) : (
            <View style={[pdfStyles.metricBox, { paddingVertical: 20, alignItems: "center" }]}>
              <Text style={pdfStyles.muted}>Chart visual unavailable</Text>
            </View>
          )}

          <View style={[pdfStyles.row, { marginTop: 6 }]}>
            <Metric label="MAPE" value={`${r.mape}%`} />
            <Metric label="MAE" value={r.mae.toFixed(1)} />
            <Metric label="RMSE" value={r.rmse.toFixed(1)} />
          </View>
        </View>
      ))}
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={[pdfStyles.metricBox, { flex: 1 }]}>
      <Text style={pdfStyles.label}>{label}</Text>
      <Text style={[pdfStyles.value, { fontSize: 10, color: COLORS.tealBright }]}>{value}</Text>
    </View>
  );
}
