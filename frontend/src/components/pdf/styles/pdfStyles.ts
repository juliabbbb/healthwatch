/**
 * Modern dark executive theme for the Surveillance Report PDF.
 */
import { StyleSheet } from "@react-pdf/renderer";

export const COLORS = {
  navy: "#0f172a",
  slate: "#1e293b",
  card: "#182234",
  teal: "#0d9488",
  tealBright: "#14b8a6",
  offwhite: "#f8fafc",
  muted: "#94a3b8",
  border: "#334155",
  low: "#22c55e",
  moderate: "#f59e0b",
  high: "#ef4444",
};

export const PAGE = {
  width: 595.28, // A4
  height: 841.89,
  padding: 36,
  contentWidth: 595.28 - 36 * 2,
};

export const pdfStyles = StyleSheet.create({
  page: {
    backgroundColor: COLORS.navy,
    color: COLORS.offwhite,
    fontFamily: "Helvetica",
    fontSize: 9,
    padding: PAGE.padding,
    paddingBottom: 56,
  },
  /* ---- Header ---- */
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 12,
    marginBottom: 14,
  },
  headerTitle: {
    color: COLORS.offwhite,
    fontSize: 18,
    fontWeight: "bold",
  },
  headerSub: {
    color: COLORS.muted,
    fontSize: 8,
    marginTop: 3,
  },
  badge: {
    backgroundColor: COLORS.teal,
    color: "#ffffff",
    borderRadius: 3,
    padding: "4 8",
    fontSize: 8,
    fontWeight: "bold",
  },
  /* ---- Section ---- */
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    color: COLORS.tealBright,
    fontSize: 11,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 10,
    marginBottom: 8,
  },
  /* ---- Text ---- */
  label: {
    color: COLORS.muted,
    fontSize: 7,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    fontWeight: "bold",
  },
  value: {
    color: COLORS.offwhite,
    fontSize: 12,
    fontWeight: "bold",
  },
  muted: {
    color: COLORS.muted,
    fontSize: 8,
    lineHeight: 1.4,
  },
  /* ---- Grids ---- */
  row: {
    flexDirection: "row",
    gap: 8,
  },
  twoCol: {
    flexDirection: "row",
    width: "50%",
  },
  metricBox: {
    backgroundColor: COLORS.slate,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 6,
  },
  /* ---- Table ---- */
  table: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: COLORS.slate,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  tableRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  th: {
    color: COLORS.muted,
    fontSize: 7,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  td: {
    color: COLORS.offwhite,
    fontSize: 8,
  },
  /* ---- Footer ---- */
  footer: {
    position: "absolute",
    bottom: 20,
    left: PAGE.padding,
    right: PAGE.padding,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 8,
    fontSize: 7,
    color: COLORS.muted,
  },
  footerNotice: {
    color: COLORS.muted,
    fontSize: 6,
    lineHeight: 1.4,
  },
  image: {
    width: "100%",
    marginVertical: 6,
  },
});

export function riskAccent(risk: string): string {
  switch (risk) {
    case "high":
      return COLORS.high;
    case "moderate":
      return COLORS.moderate;
    default:
      return COLORS.low;
  }
}
