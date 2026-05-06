import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { BenchmarkMetrics, EvaluationResult } from "./protocol.js";

export interface ReportConfig {
  title: string;
  subtitle: string;
  author: string;
  outputPath: string;
}

export const DEFAULT_REPORT_CONFIG: ReportConfig = {
  title: "ARES Security Benchmark Report",
  subtitle: "Solana Smart Contract Vulnerability Detection",
  author: "ARES Benchmark Suite",
  outputPath: "ares-security-report.pdf",
};

/**
 * Generate PDF report from benchmark results
 */
export function generateReport(
  metrics: BenchmarkMetrics,
  results: EvaluationResult[],
  config: Partial<ReportConfig> = {}
): Buffer {
  const cfg = { ...DEFAULT_REPORT_CONFIG, ...config };
  const doc = new jsPDF();

  // Title
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(cfg.title, 20, 20);

  // Subtitle
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(cfg.subtitle, 20, 28);

  // Date
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toISOString()}`, 20, 36);

  // Summary metrics
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Detection Metrics", 20, 50);

  const summaryData = [
    ["Metric", "Value"],
    ["Precision", `${(metrics.precision * 100).toFixed(1)}%`],
    ["Recall", `${(metrics.recall * 100).toFixed(1)}%`],
    ["F1 Score", `${(metrics.f1Score * 100).toFixed(1)}%`],
    ["True Positives", metrics.truePositives.toString()],
    ["False Positives", metrics.falsePositives.toString()],
    ["False Negatives", metrics.falseNegatives.toString()],
    ["Total Cases", metrics.totalCases.toString()],
  ];

  autoTable(doc, {
    startY: 55,
    head: [summaryData[0]],
    body: summaryData.slice(1),
    theme: "striped",
    headStyles: { fillColor: [66, 66, 66] },
  });

  // Quality metrics
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Generation Quality", 120, 50);

  const qualityData = [
    ["Metric", "Score"],
    ["Avg PoC Quality", `${(metrics.avgPocQuality * 100).toFixed(1)}%`],
    ["Avg Remediation", `${(metrics.avgRemediationQuality * 100).toFixed(1)}%`],
    ["Avg Confidence", `${(metrics.avgConfidence * 100).toFixed(1)}%`],
    ["Avg Time/Case", `${(metrics.avgElapsedMs / 1000).toFixed(1)}s`],
    ["Cases/Hour", metrics.casesPerHour.toFixed(1)],
  ];

  autoTable(doc, {
    startY: 55,
    margin: { left: 120 },
    head: [qualityData[0]],
    body: qualityData.slice(1),
    theme: "striped",
    headStyles: { fillColor: [66, 66, 66] },
  });

  // Detailed results table
  doc.addPage();
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Detailed Results", 20, 20);

  const detailedResults = results.map(r => [
    r.caseId,
    r.detected ? "Yes" : "No",
    r.truePositive ? "Yes" : "No",
    r.poc ? "Yes" : "No",
    r.remediation ? "Yes" : "No",
    `${(r.confidence * 100).toFixed(0)}%`,
    `${(r.pocQuality * 100).toFixed(0)}%`,
    `${(r.remediationQuality * 100).toFixed(0)}%`,
    `${(r.elapsedMs / 1000).toFixed(1)}s`,
  ]);

  autoTable(doc, {
    startY: 25,
    head: [["Case", "Detected", "TP", "PoC", "Remed", "Conf%", "PoC%", "Remed%", "Time"]],
    body: detailedResults,
    theme: "striped",
    headStyles: { fillColor: [33, 150, 243] },
    styles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 15 },
      2: { cellWidth: 15 },
      3: { cellWidth: 12 },
      4: { cellWidth: 12 },
      5: { cellWidth: 15 },
      6: { cellWidth: 15 },
      7: { cellWidth: 15 },
      8: { cellWidth: 15 },
    },
  });

  // Footnote
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.text(
    `ARES Security Benchmark - ${metrics.totalCases} cases evaluated`,
    20,
    doc.internal.pageSize.height - 10
  );

  return Buffer.from(doc.output("arraybuffer"));
}

/**
 * Generate JSON report
 */
export function generateJsonReport(
  metrics: BenchmarkMetrics,
  results: EvaluationResult[],
  errors: string[]
): object {
  return {
    timestamp: new Date().toISOString(),
    metrics,
    results: results.map(r => ({
      caseId: r.caseId,
      detected: r.detected,
      truePositive: r.truePositive,
      falsePositive: r.falsePositive,
      confidence: r.confidence,
      pocQuality: r.pocQuality,
      remediationQuality: r.remediationQuality,
      elapsedMs: r.elapsedMs,
      findingsCount: r.findings.length,
    })),
    errors,
  };
}