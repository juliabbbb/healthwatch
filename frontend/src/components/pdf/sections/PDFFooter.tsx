import { Text, View } from "@react-pdf/renderer";
import { pdfStyles } from "../styles/pdfStyles";

export interface PDFFooterProps {
  generatedAt: string; // PHT timestamp
}

export function PDFFooter({ generatedAt }: PDFFooterProps) {
  return (
    <View style={pdfStyles.footer} fixed>
      <Text>
        Page <Text render={({ pageNumber, totalPages }) => `${pageNumber} of ${totalPages}`} />
        {" · "}
        Generated {generatedAt}
      </Text>
      <Text style={pdfStyles.footerNotice}>
        CONFIDENTIAL — For official DOH surveillance use only. Not for public release.
      </Text>
    </View>
  );
}
