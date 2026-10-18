import { Text, View } from "@react-pdf/renderer";
import { pdfStyles } from "../styles/pdfStyles";

/**
 * Fixed running header repeated on every page:
 * left — HEALTHWATCH wordmark, right — "Page N of M".
 */
export function PDFHeader() {
  return (
    <View fixed style={pdfStyles.header}>
      <Text style={pdfStyles.brand}>HEALTHWATCH</Text>
      <Text style={pdfStyles.pageNumber}>
        <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </Text>
    </View>
  );
}

export interface PDFTitleBlockProps {
  title: string;
  generatedAt: string;
  meta?: string[];
}

/**
 * Standard title section used on the first page of every export:
 * brand wordmark, surveillance-system label, divider, page title,
 * generation date and optional context lines (region, illness, …).
 */
export function PDFTitleBlock({ title, generatedAt, meta }: PDFTitleBlockProps) {
  return (
    <View style={pdfStyles.titleBlock}>
      <Text style={pdfStyles.titleBrand}>HEALTHWATCH</Text>
      <Text style={pdfStyles.titleSlogan}>Philippine Regional Disease Surveillance System</Text>
      <Text style={pdfStyles.title}>{title}</Text>
      <Text style={pdfStyles.titleMeta}>Generated: {generatedAt}</Text>
      {meta?.map((line) => (
        <Text key={line} style={pdfStyles.titleMeta}>
          {line}
        </Text>
      ))}
    </View>
  );
}
