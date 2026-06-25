const sponsorshipPackets = [
  {
    id: "packet-ready-platinum",
    eventId: "deep-events-berlin-2026",
    sponsorId: "sponsor-orion-labs",
    packageTier: "platinum",
    invoiceAmountUsd: 25000,
    contract: {
      signed: true,
      sponsorApproval: true,
      purchaseOrderApproved: true,
      cancellationWindowClosed: true,
      refundExposureUsd: 0
    },
    deliverables: [
      { id: "logo-homepage", label: "Homepage logo placement", required: true, completed: true, sponsorApproved: true },
      { id: "stage-mention", label: "Main-stage sponsor mention", required: true, completed: true, sponsorApproved: true },
      { id: "lead-export", label: "Qualified attendee lead export", required: true, completed: true, sponsorApproved: true }
    ],
    leadGuarantee: {
      promised: 150,
      qualifiedDelivered: 168,
      minimumAcceptable: 140
    },
    exclusivity: {
      category: "AI infrastructure",
      conflicts: []
    },
    evidence: [
      { type: "contract", present: true, reference: "contract:orion-2026" },
      { type: "deliverable_signoff", present: true, reference: "signoff:orion:platinum" },
      { type: "lead_export_hash", present: true, reference: "sha256:lead-export-orion" }
    ]
  },
  {
    id: "packet-review-logo-signoff",
    eventId: "deep-events-paris-2026",
    sponsorId: "sponsor-nova-data",
    packageTier: "gold",
    invoiceAmountUsd: 14000,
    contract: {
      signed: true,
      sponsorApproval: true,
      purchaseOrderApproved: true,
      cancellationWindowClosed: true,
      refundExposureUsd: 0
    },
    deliverables: [
      { id: "logo-homepage", label: "Homepage logo placement", required: true, completed: true, sponsorApproved: false },
      { id: "newsletter-slot", label: "Newsletter sponsor slot", required: true, completed: true, sponsorApproved: true },
      { id: "lead-export", label: "Qualified attendee lead export", required: true, completed: true, sponsorApproved: true }
    ],
    leadGuarantee: {
      promised: 100,
      qualifiedDelivered: 96,
      minimumAcceptable: 90
    },
    exclusivity: {
      category: "Research tooling",
      conflicts: []
    },
    evidence: [
      { type: "contract", present: true, reference: "contract:nova-2026" },
      { type: "deliverable_signoff", present: false, reference: "" },
      { type: "lead_export_hash", present: true, reference: "sha256:lead-export-nova" }
    ]
  },
  {
    id: "packet-hold-exclusivity",
    eventId: "deep-events-lisbon-2026",
    sponsorId: "sponsor-vector-capital",
    packageTier: "platinum",
    invoiceAmountUsd: 30000,
    contract: {
      signed: true,
      sponsorApproval: true,
      purchaseOrderApproved: false,
      cancellationWindowClosed: false,
      refundExposureUsd: 18000
    },
    deliverables: [
      { id: "logo-homepage", label: "Homepage logo placement", required: true, completed: true, sponsorApproved: true },
      { id: "exclusive-category", label: "Exclusive category slot", required: true, completed: false, sponsorApproved: false },
      { id: "lead-export", label: "Qualified attendee lead export", required: true, completed: false, sponsorApproved: false }
    ],
    leadGuarantee: {
      promised: 200,
      qualifiedDelivered: 74,
      minimumAcceptable: 180
    },
    exclusivity: {
      category: "AI infrastructure",
      conflicts: ["sponsor-orion-labs"]
    },
    evidence: [
      { type: "contract", present: true, reference: "contract:vector-2026" },
      { type: "deliverable_signoff", present: false, reference: "" },
      { type: "lead_export_hash", present: false, reference: "" }
    ]
  },
  {
    id: "packet-hold-no-contract",
    eventId: "deep-events-remote-2026",
    sponsorId: "sponsor-signal-harbor",
    packageTier: "silver",
    invoiceAmountUsd: 6500,
    contract: {
      signed: false,
      sponsorApproval: false,
      purchaseOrderApproved: false,
      cancellationWindowClosed: false,
      refundExposureUsd: 6500
    },
    deliverables: [
      { id: "logo-page", label: "Sponsor page logo", required: true, completed: false, sponsorApproved: false },
      { id: "lead-export", label: "Qualified attendee lead export", required: true, completed: false, sponsorApproved: false }
    ],
    leadGuarantee: {
      promised: 40,
      qualifiedDelivered: 0,
      minimumAcceptable: 35
    },
    exclusivity: {
      category: "Event operations",
      conflicts: []
    },
    evidence: [
      { type: "contract", present: false, reference: "" },
      { type: "deliverable_signoff", present: false, reference: "" },
      { type: "lead_export_hash", present: false, reference: "" }
    ]
  }
];

module.exports = { sponsorshipPackets };
