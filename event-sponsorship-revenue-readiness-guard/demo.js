const fs = require("fs");
const path = require("path");
const { evaluateSponsorshipRevenueReadiness, summarizeEvaluations } = require("./index");
const { sponsorshipPackets } = require("./sample-data");

const reportsDir = path.join(__dirname, "reports");
fs.mkdirSync(reportsDir, { recursive: true });

const evaluations = sponsorshipPackets.map(evaluateSponsorshipRevenueReadiness);
const summary = summarizeEvaluations(evaluations);

fs.writeFileSync(
  path.join(reportsDir, "event-sponsorship-readiness-report.json"),
  JSON.stringify({ summary, evaluations }, null, 2)
);

const markdown = [
  "# Event Sponsorship Revenue Readiness Guard - Demo Report",
  "",
  "Synthetic reviewer demo for SCIBASE Revenue Infrastructure issue #20.",
  "",
  "## Summary",
  "",
  `- Packets evaluated: ${summary.packet_count}`,
  `- Ready to invoice: ${summary.packets_ready_to_invoice}`,
  `- Needs finance review: ${summary.packets_requiring_review}`,
  `- Held before invoice: ${summary.packets_on_hold}`,
  "",
  "## Decisions",
  "",
  "| Packet | Sponsor | Tier | Decision | Score | Top reasons |",
  "| --- | --- | --- | --- | ---: | --- |",
  ...evaluations.map((item) => {
    const topReasons = item.reasons.slice(0, 3).map((reason) => reason.code).join(", ") || "none";
    return `| ${item.packet_id} | ${item.sponsor_id} | ${item.package_tier} | ${item.decision} | ${item.readiness_score} | ${topReasons} |`;
  }),
  "",
  "## Boundary",
  "",
  "- Synthetic data only.",
  "- No payment processors called.",
  "- No real sponsor/customer data used.",
  "- No external APIs used.",
  "- No credentials, bank data, Stripe, PayPal, ERP, or accounting systems touched.",
  ""
].join("\n");

fs.writeFileSync(path.join(reportsDir, "event-sponsorship-readiness-report.md"), markdown);

const bar = (label, value, color, y) => `
  <text x="52" y="${y - 8}" fill="#111827" font-size="14" font-family="Arial">${label}</text>
  <rect x="52" y="${y}" width="520" height="24" rx="6" fill="#e5e7eb"/>
  <rect x="52" y="${y}" width="${Math.max(1, value * 130)}" height="24" rx="6" fill="${color}"/>
  <text x="${590}" y="${y + 17}" fill="#111827" font-size="14" font-family="Arial">${value}</text>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="520" viewBox="0 0 900 520">
  <rect width="900" height="520" fill="#f8fafc"/>
  <text x="52" y="72" fill="#0f172a" font-size="30" font-weight="700" font-family="Arial">Event Sponsorship Revenue Readiness</text>
  <text x="52" y="106" fill="#475569" font-size="16" font-family="Arial">Synthetic guard demo for invoice release, finance review, and hold decisions.</text>
  ${bar("RELEASE_INVOICE", summary.decision_counts.RELEASE_INVOICE, "#16a34a", 160)}
  ${bar("REVIEW_BEFORE_RELEASE", summary.decision_counts.REVIEW_BEFORE_RELEASE, "#f59e0b", 220)}
  ${bar("HOLD_INVOICE", summary.decision_counts.HOLD_INVOICE, "#dc2626", 280)}
  <rect x="52" y="360" width="796" height="96" rx="10" fill="#ffffff" stroke="#cbd5e1"/>
  <text x="80" y="394" fill="#111827" font-size="16" font-weight="700" font-family="Arial">Boundary</text>
  <text x="80" y="424" fill="#475569" font-size="14" font-family="Arial">Synthetic data only · no payment processors · no external APIs · no credentials</text>
  <text x="80" y="448" fill="#475569" font-size="14" font-family="Arial">Designed to make event sponsorship revenue release auditable before invoice actions.</text>
</svg>`;

fs.writeFileSync(path.join(reportsDir, "event-sponsorship-readiness-summary.svg"), svg.replace(/[ \t]+$/gm, ""));

console.log(JSON.stringify({ summary, report_dir: reportsDir }, null, 2));
