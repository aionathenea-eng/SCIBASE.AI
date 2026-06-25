# Event Sponsorship Revenue Readiness Guard

This module is a self-contained revenue-infrastructure slice for event sponsorship packages. It determines whether a sponsorship packet is ready to invoice, needs finance review, or must be held before release.

It is intentionally aligned with the event-oriented surface of this repository (`get-event-sponsorship`, event CRM, and event operations) rather than adding another generic billing ledger.

## What It Checks

- Sponsorship contract signature and sponsor approval
- Purchase order or finance approval readiness
- Required sponsorship deliverables and sponsor signoff
- Attendee lead guarantees and make-good risk
- Sponsor category exclusivity conflicts
- Cancellation/refund exposure windows
- Proof artifacts required for audit-ready invoicing

## Decisions

- `RELEASE_INVOICE`: evidence is complete enough to invoice or release revenue.
- `REVIEW_BEFORE_RELEASE`: finance or sponsorship owner should review before release.
- `HOLD_INVOICE`: material blocker exists; invoice/revenue release should not proceed.

## Run

```bash
npm run check
npm test
npm run demo
```

The demo writes:

- `reports/event-sponsorship-readiness-report.json`
- `reports/event-sponsorship-readiness-report.md`
- `reports/event-sponsorship-readiness-summary.svg`
- `reports/demo.mp4`

## Requirement Mapping

| Issue #20 requirement | Module coverage |
| --- | --- |
| Subscription and institutional revenue controls | Sponsor package readiness and finance approval controls |
| Usage/value-aligned monetization | Lead guarantee and deliverable evidence checks before invoice release |
| Licensing/API analytics revenue discipline | Proof-artifact and approval gates for sponsor-facing revenue claims |
| Predictable recurring revenue | Prevents premature invoicing, refund exposure, and exclusivity conflicts |
| Secure payment integrations | Does not call payment processors; emits hold/release decisions before finance action |

## Safety Boundary

This module uses synthetic data only. It does not call Stripe, PayPal, banks, ERPs, CRMs, sponsor portals, payment processors, external APIs, or accounting systems. It reads no credentials and contains no real sponsor/customer data.
