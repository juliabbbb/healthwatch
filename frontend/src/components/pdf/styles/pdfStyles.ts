/**
 * Shared professional light theme for all HEALTHWATCH PDF exports.
 * Standardized layout per the export-quality spec:
 *  - A4 portrait, 40pt top/bottom margins, 48pt left/right margins
 *  - Helvetica throughout
 *  - Slate typography scale, dark table headers, light alternating rows
 */
import { StyleSheet } from "@react-pdf/renderer";

export const COLORS = {
  ink: "#0f172a", // slate-900 — strong dark accents / table header
  slate: "#1e293b", // slate-800 — titles
  heading: "#334155", // slate-700 — section headings
  card: "#f8fafc", // slate-50 — alternating rows / card surfaces
  teal: "#0d9488",
  tealBright: "#14b8a6",
  offwhite: "#ffffff",
  muted: "#475569", // slate-600 — body text
  mutedLight: "#64748b", // slate-500 — captions
  footerGray: "#94a3b8", // slate-400 — footers
  border: "#e2e8f0", // slate-200 — borders
  low: "#22c55e",
  moderate: "#f59e0b",
  high: "#ef4444",
};

export const PAGE = {
  width: 595.28, // A4
  height: 841.89,
  /** Legacy alias for horizontal page padding. */
  padding: 48,
  paddingTop: 40,
  paddingBottom: 40,
  paddingHorizontal: 48,
  contentWidth: 595.28 - 48 * 2,
};

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

export const pdfStyles = StyleSheet.create({
  page: {
    backgroundColor: COLORS.offwhite,
    color: COLORS.muted,
    fontFamily: "Helvetica",
    fontSize: 10,
    paddingTop: PAGE.paddingTop,
    paddingBottom: PAGE.paddingBottom,
    paddingHorizontal: PAGE.paddingHorizontal,
  },

  /* ---- Running header (repeats on every page) ---- */
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 6,
    marginBottom: 14,
  },
  brand: {
    color: COLORS.ink,
    fontSize: 14,
    fontWeight: "bold",
    letterSpacing: 1.2,
  },
  pageNumber: {
    color: COLORS.muted,
    fontSize: 8,
  },

  /* ---- Title block ---- */
  titleBlock: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.ink,
    paddingBottom: 10,
    marginBottom: 14,
  },
  titleBrand: {
    color: COLORS.ink,
    fontSize: 14,
    fontWeight: "bold",
    letterSpacing: 1.2,
  },
  titleSlogan: {
    color: COLORS.heading,
    fontSize: 13,
    fontWeight: "bold",
    marginTop: 2,
    marginBottom: 10,
  },
  title: {
    color: COLORS.slate,
    fontSize: 18,
    fontWeight: "bold",
  },
  titleMeta: {
    color: COLORS.muted,
    fontSize: 10,
    marginTop: 4,
  },

  /* ---- Sections ---- */
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    color: COLORS.heading,
    fontSize: 13,
    fontWeight: "bold",
    marginTop: 12,
    marginBottom: 8,
  },
  body: {
    color: COLORS.muted,
    fontSize: 10,
    lineHeight: 1.5,
  },
  caption: {
    color: COLORS.mutedLight,
    fontSize: 8,
    fontStyle: "italic",
    marginTop: 4,
    marginBottom: 10,
  },

  /* ---- Key/value rows ---- */
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  metaLabel: {
    color: COLORS.muted,
    fontSize: 10,
  },
  metaValue: {
    color: COLORS.slate,
    fontSize: 10,
    fontWeight: "bold",
  },

  /* ---- Risk legend ---- */
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 2,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    marginRight: 6,
  },
  legendLabel: {
    color: COLORS.muted,
    fontSize: 9,
  },

  /* ---- Card / metric surfaces (legacy sections) ---- */
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 10,
    marginBottom: 8,
  },
  label: {
    color: COLORS.muted,
    fontSize: 7,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    fontWeight: "bold",
  },
  value: {
    color: COLORS.slate,
    fontSize: 12,
    fontWeight: "bold",
  },
  muted: {
    color: COLORS.muted,
    fontSize: 8,
    lineHeight: 1.4,
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  twoCol: {
    flexDirection: "row",
    width: "50%",
  },
  metricBox: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 6,
  },

  /* ---- Tables ---- */
  table: {
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: COLORS.ink,
    paddingVertical: 6,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 6,
  },
  th: {
    color: COLORS.offwhite,
    fontSize: 9,
    fontWeight: "bold",
  },
  td: {
    color: COLORS.muted,
    fontSize: 9,
  },

  /* ---- Charts Drawings ---- */
  chartImage: {
    width: "100%",
    maxHeight: 400,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  image: {
    width: "100%",
    marginVertical: 6,
  },

  /* ---- Footer (repeats on every page) ---- */
  footer: {
    position: "absolute",
    bottom: 24,
    left: PAGE.paddingHorizontal,
    right: PAGE.paddingHorizontal,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 6,
  },
  footerLine: {
    color: COLORS.footerGray,
    fontSize: 7,
    textAlign: "center",
    lineHeight: 1.4,
  },
  footerNotice: {
    color: COLORS.footerGray,
    fontSize: 6,
    lineHeight: 1.4,
  },
});
