const crypto = require("crypto");

const DECISIONS = Object.freeze({
  RELEASE: "RELEASE_INVOICE",
  REVIEW: "REVIEW_BEFORE_RELEASE",
  HOLD: "HOLD_INVOICE"
});

const SEVERITY_WEIGHT = Object.freeze({
  info: 0,
  review: 1,
  hold: 3
});

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function stableHash(value) {
  return crypto
    .createHash("sha256")
    .update(stableStringify(value))
    .digest("hex");
}

function reason(code, severity, message, remediation) {
  return { code, severity, message, remediation };
}

function missingRequiredDeliverables(packet) {
  return (packet.deliverables || []).filter((item) => item.required && !item.completed);
}

function unsignedRequiredDeliverables(packet) {
  return (packet.deliverables || []).filter(
    (item) => item.required && item.completed && !item.sponsorApproved
  );
}

function missingEvidence(packet) {
  return (packet.evidence || []).filter((item) => !item.present);
}

function evaluateSponsorshipRevenueReadiness(packet) {
  const reasons = [];
  const financeActions = [];
  const contract = packet.contract || {};
  const leadGuarantee = packet.leadGuarantee || {};
  const exclusivity = packet.exclusivity || {};
  const missingDeliverables = missingRequiredDeliverables(packet);
  const unsignedDeliverables = unsignedRequiredDeliverables(packet);
  const evidenceGaps = missingEvidence(packet);
  const delivered = Number(leadGuarantee.qualifiedDelivered || 0);
  const promised = Number(leadGuarantee.promised || 0);
  const minimumAcceptable = Number(leadGuarantee.minimumAcceptable || 0);
  const leadShortfall = Math.max(0, minimumAcceptable - delivered);

  if (!contract.signed) {
    reasons.push(
      reason(
        "SPONSOR_CONTRACT_UNSIGNED",
        "hold",
        "Sponsorship contract is not signed.",
        "Collect signed sponsorship agreement before invoicing or releasing revenue."
      )
    );
    financeActions.push("hold invoice until contract is signed");
  }

  if (!contract.purchaseOrderApproved) {
    reasons.push(
      reason(
        "PURCHASE_ORDER_NOT_APPROVED",
        contract.signed ? "review" : "hold",
        "Purchase order or finance approval is missing.",
        "Attach approved PO or finance approval before invoice release."
      )
    );
    financeActions.push("request PO or finance approval evidence");
  }

  if (!contract.sponsorApproval) {
    reasons.push(
      reason(
        "SPONSOR_APPROVAL_MISSING",
        "hold",
        "Sponsor has not approved the final package state.",
        "Obtain sponsor signoff for package scope before recognizing revenue readiness."
      )
    );
    financeActions.push("collect sponsor package approval");
  }

  if (!contract.cancellationWindowClosed || Number(contract.refundExposureUsd || 0) > 0) {
    reasons.push(
      reason(
        "REFUND_WINDOW_OR_EXPOSURE_OPEN",
        "hold",
        "Cancellation or refund exposure is still open.",
        "Defer invoice release or record finance review until refund exposure is cleared."
      )
    );
    financeActions.push("defer release until cancellation/refund exposure closes");
  }

  if ((exclusivity.conflicts || []).length > 0) {
    reasons.push(
      reason(
        "SPONSOR_EXCLUSIVITY_CONFLICT",
        "hold",
        "Sponsor category exclusivity conflicts with another sponsor.",
        "Resolve category conflict or amend sponsorship package before release."
      )
    );
    financeActions.push("route exclusivity conflict to sponsorship owner");
  }

  for (const deliverable of missingDeliverables) {
    reasons.push(
      reason(
        "REQUIRED_DELIVERABLE_INCOMPLETE",
        "hold",
        `Required deliverable is incomplete: ${deliverable.label}.`,
        "Complete the deliverable or reduce the invoiceable package scope."
      )
    );
  }

  for (const deliverable of unsignedDeliverables) {
    reasons.push(
      reason(
        "DELIVERABLE_SIGNOFF_MISSING",
        "review",
        `Required deliverable lacks sponsor signoff: ${deliverable.label}.`,
        "Collect sponsor signoff or mark the line item for manual finance review."
      )
    );
  }

  if (leadShortfall > 0) {
    const severity = delivered < promised * 0.75 ? "hold" : "review";
    reasons.push(
      reason(
        "ATTENDEE_LEAD_GUARANTEE_SHORTFALL",
        severity,
        `Qualified leads delivered (${delivered}) are below the acceptable floor (${minimumAcceptable}).`,
        "Deliver remaining qualified leads, apply make-good credit, or reduce invoice amount."
      )
    );
    financeActions.push("calculate make-good credit or revised invoice amount");
  }

  for (const gap of evidenceGaps) {
    reasons.push(
      reason(
        "PROOF_ARTIFACT_MISSING",
        "review",
        `Proof artifact is missing: ${gap.type}.`,
        "Attach proof artifact before revenue packet is marked audit-ready."
      )
    );
  }

  const highestWeight = reasons.reduce(
    (weight, item) => Math.max(weight, SEVERITY_WEIGHT[item.severity] || 0),
    0
  );
  const decision =
    highestWeight >= SEVERITY_WEIGHT.hold
      ? DECISIONS.HOLD
      : highestWeight >= SEVERITY_WEIGHT.review
        ? DECISIONS.REVIEW
        : DECISIONS.RELEASE;

  const completedRequired = (packet.deliverables || []).filter(
    (item) => item.required && item.completed && item.sponsorApproved
  ).length;
  const totalRequired = (packet.deliverables || []).filter((item) => item.required).length;
  const deliverableReadiness = totalRequired === 0 ? 100 : Math.round((completedRequired / totalRequired) * 100);
  const leadReadiness =
    minimumAcceptable === 0 ? 100 : Math.min(100, Math.round((delivered / minimumAcceptable) * 100));
  const evidenceReadiness =
    (packet.evidence || []).length === 0
      ? 0
      : Math.round((((packet.evidence || []).length - evidenceGaps.length) / (packet.evidence || []).length) * 100);

  const readinessScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        deliverableReadiness * 0.35 +
          leadReadiness * 0.25 +
          evidenceReadiness * 0.2 +
          (contract.signed ? 10 : 0) +
          (contract.purchaseOrderApproved ? 10 : 0)
      )
    )
  );

  return {
    schema_version: "event_sponsorship_revenue_readiness_guard_v1",
    packet_id: packet.id,
    event_id: packet.eventId,
    sponsor_id: packet.sponsorId,
    package_tier: packet.packageTier,
    invoice_amount_usd: packet.invoiceAmountUsd,
    decision,
    readiness_score: readinessScore,
    reason_count: reasons.length,
    reasons,
    finance_actions: [...new Set(financeActions)],
    metrics: {
      deliverable_readiness_percent: deliverableReadiness,
      lead_readiness_percent: leadReadiness,
      evidence_readiness_percent: evidenceReadiness,
      lead_shortfall: leadShortfall,
      exclusivity_conflict_count: (exclusivity.conflicts || []).length,
      refund_exposure_usd: Number(contract.refundExposureUsd || 0)
    },
    audit_packet: {
      synthetic_data_only: true,
      external_apis_used: false,
      payment_processors_called: false,
      private_customer_data_used: false,
      packet_sha256: stableHash(packet)
    }
  };
}

function summarizeEvaluations(evaluations) {
  const counts = evaluations.reduce(
    (acc, item) => {
      acc[item.decision] = (acc[item.decision] || 0) + 1;
      return acc;
    },
    { [DECISIONS.RELEASE]: 0, [DECISIONS.REVIEW]: 0, [DECISIONS.HOLD]: 0 }
  );

  return {
    schema_version: "event_sponsorship_revenue_readiness_summary_v1",
    packet_count: evaluations.length,
    decision_counts: counts,
    packets_ready_to_invoice: counts[DECISIONS.RELEASE],
    packets_requiring_review: counts[DECISIONS.REVIEW],
    packets_on_hold: counts[DECISIONS.HOLD],
    audit_note:
      "Synthetic event sponsorship packets only; no payment processors, bank data, credentials, or external APIs used."
  };
}

module.exports = {
  DECISIONS,
  evaluateSponsorshipRevenueReadiness,
  summarizeEvaluations
};
