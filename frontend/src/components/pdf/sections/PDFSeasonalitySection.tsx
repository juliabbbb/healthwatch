import { Image, Text, View } from "@react-pdf/renderer";
import type { Season } from "@/lib/healthwatch/data";
import { pdfStyles } from "../styles/pdfStyles";

export interface SeasonalityRegion {
  name: string;
  short: string;
  chartImage?: string | null; // PNG data-URI
  season: Season;
  driver: string;
}

export interface PDFSeasonalitySectionProps {
  regions: SeasonalityRegion[];
}

export function PDFSeasonalitySection({ regions }: PDFSeasonalitySectionProps) {
  return (
    <View style={pdfStyles.section}>
      <Text style={pdfStyles.sectionTitle}>Seasonality & Environmental Drivers</Text>
      {regions.map((r) => (
        <View key={r.short} style={pdfStyles.card} wrap={false}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
            <Text style={pdfStyles.value}>{r.name}</Text>
            <Text style={[pdfStyles.muted, { textTransform: "uppercase" }]}>
              Season: {r.season} · Driver: {r.driver}
            </Text>
          </View>
          {r.chartImage ? (
            <Image src={r.chartImage} style={pdfStyles.image} />
          ) : (
            <View style={[pdfStyles.card, { paddingVertical: 16, alignItems: "center" }]}>
              <Text style={pdfStyles.muted}>Seasonality visual unavailable</Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}
