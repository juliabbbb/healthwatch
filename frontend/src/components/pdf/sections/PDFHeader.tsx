import { Text, View } from "@react-pdf/renderer";
import { pdfStyles } from "../styles/pdfStyles";
import { formatMonthYear } from "@/utils/formatDate";

export interface PDFHeaderProps {
  title: string;
  generatedAt: string; // PHT timestamp
  baseline: string; // e.g. "2026-09"
  pathology: string;
}

export function PDFHeader({ title, generatedAt, baseline, pathology }: PDFHeaderProps) {
  return (
    <View style={pdfStyles.header} wrap={false}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={pdfStyles.headerTitle}>{title}</Text>
        <Text style={pdfStyles.headerSub}>
          Philippines Department of Health (DOH) · Epidemiology Bureau Surveillance · Generated{" "}
          {generatedAt}
        </Text>
        <Text style={pdfStyles.headerSub}>
          Active baseline: {formatMonthYear(baseline)} · Pathology: {pathology}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={pdfStyles.badge}>HEALTHWATCH</Text>
        <Text style={[pdfStyles.muted, { marginTop: 4 }]}>DOH Surveillance Module</Text>
      </View>
    </View>
  );
}
