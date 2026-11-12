import React from "react";
import { createRoot } from "react-dom/client";
import { ResearchComparison } from "../src/components/hw/ResearchComparison";
import "../src/styles.css";

createRoot(document.getElementById("root")!).render(<main className="mx-auto max-w-3xl p-6"><h1 className="mb-4 text-xl font-medium">Local research contract preview</h1><p className="mb-4 text-sm">Actual verified research results; shared database disconnected.</p><ResearchComparison disease="Dengue" region="National" /><ResearchComparison disease="Leptospirosis" region="National" /></main>);
