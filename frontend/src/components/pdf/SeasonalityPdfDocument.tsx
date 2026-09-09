import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import { pdfStyles } from "./styles/pdfStyles";
import { PDFHeader, PDFTitleBlock } from "./sections/PDFHeader";
import { PDFFooter } from "./sections/PDFFooter";
import { formatMonthYear } from "@/utils/formatDate";

export interface SeasonalityPdfChart {
  label: string;
  imageDataUrl: string;
}

export interface SeasonalityPdfDocumentProps {
  regionName: string;
  illnessLabel: string;
  forecastPeriod: { start: string; end: string };
  charts: SeasonalityPdfChart[];
  exportTimestamp: string;
}

export function SeasonalityPdfDocument({
  regionName,
  illnessLabel,
  forecastPeriod,
  charts,
  exportTimestamp,
}: SeasonalityPdfDocumentProps) {
  const generatedAt = formatMonthYear(exportTimestamp);

  return (
    <Document title={`HEALTHWATCH Seasonal Pattern Analysis Report — ${regionName}`}>
      {/* Page 1: title block + first chart */}
      <Page size="A4" style={pdfStyles.page}>
        <PDFHeader />
        <PDFTitleBlock
          title="Seasonal Pattern Analysis Report"
          generatedAt={generatedAt}
          meta={[
            `Region: ${regionName}`,
            `Illness: ${illnessLabel}`,
            `Forecast Period: ${formatMonthYear(forecastPeriod.start)} to ${formatMonthYear(forecastPeriod.end)}`,
          ]}
        />

        {charts.length > 0 && (
          <>
            <Text style={pdfStyles.sectionTitle}>{charts[0]!.label}</Text>
            <Image src={charts[0]!.imageDataUrl} style={pdfStyles.chartImage} />
            <Text style={pdfStyles.caption}>
              Figure 1. {charts[0]!.label} — Source: DOH Philippines
            </Text>
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
              Figure {i + 2}. {chart.label} — Source: DOH Philippines
            </Text>
          </View>
          <PDFFooter />
        </Page>
      ))}
    </Document>
  );
}
