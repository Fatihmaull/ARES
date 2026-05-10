import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export interface ReportFindingRow {
  agent: string;
  layer: string;
  severity: string;
  title: string;
  detail: Record<string, unknown>;
}

const SEVERITY_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  informational: 4,
  info: 5,
};

function rankSeverity(s: string): number {
  const k = s.toLowerCase();
  return k in SEVERITY_RANK ? SEVERITY_RANK[k]! : 99;
}

/** Pull human-readable evidence from stored finding.detail JSON. */
function evidenceFromDetail(detail: Record<string, unknown>): string {
  if (!detail || typeof detail !== "object") return "";
  const parts: string[] = [];

  const desc = detail.description;
  if (typeof desc === "string" && desc.trim()) parts.push(desc.trim());

  const rationale = detail.rationale;
  if (typeof rationale === "string" && rationale.trim()) parts.push(`Rationale: ${rationale.trim()}`);

  const remediation = detail.remediation;
  if (typeof remediation === "string" && remediation.trim())
    parts.push(`Remediation: ${remediation.trim()}`);

  const err = detail.error;
  if (typeof err === "string" && err.trim()) parts.push(err.trim());

  if (parts.length) return parts.join("\n\n");

  try {
    const j = JSON.stringify(detail);
    return j.length > 600 ? `${j.slice(0, 597)}...` : j;
  } catch {
    return "";
  }
}

function truncateCell(text: string, max = 420): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 3)}...`;
}

function countBySeverity(rows: ReportFindingRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const k = r.severity.toLowerCase();
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

/**
 * Branded defense-assurance PDF aligned with the engine `generate_pdf_report` styling,
 * fed from persisted scan findings (not LLM-generated layout).
 */
export function renderAresDefenseReportPdf(input: {
  headline: string;
  parentRunId: string;
  scanTarget: string | null;
  findings: ReportFindingRow[];
}): ArrayBuffer {
  const sorted = [...input.findings].sort(
    (a, b) => rankSeverity(a.severity) - rankSeverity(b.severity),
  );
  const counts = countBySeverity(sorted);
  const summaryParts = [
    counts.critical ? `${counts.critical} critical` : null,
    counts.high ? `${counts.high} high` : null,
    counts.medium ? `${counts.medium} medium` : null,
    counts.low ? `${counts.low} low` : null,
    counts.informational ? `${counts.informational} informational` : null,
    counts.info ? `${counts.info} info` : null,
  ].filter(Boolean);

  const execIntro =
    sorted.length === 0
      ? "No structured findings were recorded for the parent run. This may indicate a clean pass, an incomplete scan, or findings not yet persisted to the assurance store."
      : `This document synthesizes ${sorted.length} assurance finding(s) from the parent scan into a single defense posture record for stakeholders. ` +
        `Severity distribution: ${summaryParts.join(", ")}. ` +
        `Review detailed rows below and prioritize remediation starting at critical/high.`;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(30, 30, 28);
  doc.rect(0, 0, pageWidth, 44, "F");

  doc.setTextColor(250, 249, 245);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("ARES DEFENSE POSTURE REPORT", 15, 22);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const targetLine = input.scanTarget
    ? `Scope: ${input.scanTarget}`
    : `Parent run: ${input.parentRunId}`;
  doc.text(targetLine, 15, 31);
  doc.text(`Generated (UTC): ${new Date().toISOString()}`, pageWidth - 15, 31, { align: "right" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  const headSub = doc.splitTextToSize(input.headline, pageWidth - 30);
  doc.text(headSub, 15, 39);

  let y = 54;
  doc.setTextColor(30, 30, 28);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Executive summary", 15, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const execLines = doc.splitTextToSize(execIntro, pageWidth - 30);
  doc.text(execLines, 15, y);
  y += execLines.length * 5 + 12;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Detailed findings", 15, y);
  y += 6;

  const tableData = sorted.map((f) => {
    const ev = truncateCell(evidenceFromDetail(f.detail));
    const source = `${f.layer} / ${f.agent}`.replace(/\s+/g, " ");
    return [
      f.severity.toUpperCase(),
      truncateCell(f.title, 200),
      truncateCell(source, 120),
      ev || "—",
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [["Severity", "Finding", "Source (layer / agent)", "Evidence"]],
    body: tableData.length ? tableData : [["—", "No findings", "—", "—"]],
    theme: "striped",
    headStyles: { fillColor: [45, 45, 43], fontStyle: "bold" },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 22, fontStyle: "bold" },
      1: { cellWidth: 52 },
      2: { cellWidth: 38 },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 0) {
        const raw = String(data.cell.raw).toLowerCase();
        if (raw.includes("critical")) data.cell.styles.textColor = [200, 50, 50];
        else if (raw.includes("high")) data.cell.styles.textColor = [200, 100, 50];
        else if (raw.includes("medium")) data.cell.styles.textColor = [180, 140, 40];
      }
    },
  });

  const docAny = doc as unknown as { lastAutoTable?: { finalY: number } };
  const finalY = (docAny.lastAutoTable?.finalY ?? y + 40) + 14;

  doc.setTextColor(55, 55, 52);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Defense posture notes", 15, finalY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const notes = doc.splitTextToSize(
    [
      "ARES correlates scanner output across layers (orchestrator, sub-agents, worker) into this artifact.",
      "Use it for governance, incident readiness, and vendor assurance — pair with continuous monitoring and manual review for high-risk changes.",
      "Structured rows reflect persisted findings only; narrative risk context may appear in the product console separately.",
    ].join(" "),
    pageWidth - 30,
  );
  doc.text(notes, 15, finalY + 6);

  return doc.output("arraybuffer") as ArrayBuffer;
}
