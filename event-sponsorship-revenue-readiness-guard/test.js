const assert = require("assert");
const { DECISIONS, evaluateSponsorshipRevenueReadiness, summarizeEvaluations } = require("./index");
const { sponsorshipPackets } = require("./sample-data");

function byId(id) {
  return sponsorshipPackets.find((packet) => packet.id === id);
}

const ready = evaluateSponsorshipRevenueReadiness(byId("packet-ready-platinum"));
assert.strictEqual(ready.decision, DECISIONS.RELEASE);
assert.strictEqual(ready.reason_count, 0);
assert.strictEqual(ready.metrics.lead_shortfall, 0);
assert.strictEqual(ready.audit_packet.payment_processors_called, false);

const review = evaluateSponsorshipRevenueReadiness(byId("packet-review-logo-signoff"));
assert.strictEqual(review.decision, DECISIONS.REVIEW);
assert(review.reasons.some((item) => item.code === "DELIVERABLE_SIGNOFF_MISSING"));
assert(review.reasons.some((item) => item.code === "PROOF_ARTIFACT_MISSING"));
assert(review.readiness_score >= 70);

const hold = evaluateSponsorshipRevenueReadiness(byId("packet-hold-exclusivity"));
assert.strictEqual(hold.decision, DECISIONS.HOLD);
assert(hold.reasons.some((item) => item.code === "SPONSOR_EXCLUSIVITY_CONFLICT"));
assert(hold.reasons.some((item) => item.code === "REFUND_WINDOW_OR_EXPOSURE_OPEN"));
assert(hold.reasons.some((item) => item.code === "ATTENDEE_LEAD_GUARANTEE_SHORTFALL"));
assert(hold.metrics.exclusivity_conflict_count === 1);

const unsigned = evaluateSponsorshipRevenueReadiness(byId("packet-hold-no-contract"));
assert.strictEqual(unsigned.decision, DECISIONS.HOLD);
assert(unsigned.reasons.some((item) => item.code === "SPONSOR_CONTRACT_UNSIGNED"));
assert(unsigned.reasons.some((item) => item.severity === "hold"));

const evaluations = sponsorshipPackets.map(evaluateSponsorshipRevenueReadiness);
const summary = summarizeEvaluations(evaluations);
assert.strictEqual(summary.packet_count, 4);
assert.strictEqual(summary.decision_counts[DECISIONS.RELEASE], 1);
assert.strictEqual(summary.decision_counts[DECISIONS.REVIEW], 1);
assert.strictEqual(summary.decision_counts[DECISIONS.HOLD], 2);

for (const evaluation of evaluations) {
  assert.strictEqual(evaluation.audit_packet.synthetic_data_only, true);
  assert.strictEqual(evaluation.audit_packet.external_apis_used, false);
  assert.match(evaluation.audit_packet.packet_sha256, /^[a-f0-9]{64}$/);
  if (evaluation.decision !== DECISIONS.RELEASE) {
    assert(evaluation.reasons.length > 0, `${evaluation.packet_id} must explain non-release decisions`);
  }
}

const tampered = JSON.parse(JSON.stringify(byId("packet-ready-platinum")));
tampered.leadGuarantee.qualifiedDelivered = 149;
const originalHash = ready.audit_packet.packet_sha256;
const tamperedHash = evaluateSponsorshipRevenueReadiness(tampered).audit_packet.packet_sha256;
assert.notStrictEqual(tamperedHash, originalHash, "packet hash should change when nested evidence changes");

console.log("event-sponsorship-revenue-readiness-guard tests passed");
