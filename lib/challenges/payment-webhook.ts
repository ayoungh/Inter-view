import type { Challenge } from "../types";

const jsContent = `const express = require('express');
const orders = require('../services/orders');

const router = express.Router();

router.post('/webhooks/payment', async (req, res) => {
  const event = req.body;

  if (event.type === 'payment.succeeded') {
    const order = await orders.findByPaymentId(event.data.paymentId);
    const amountPaid = event.data.amount / 100;

    if (amountPaid == order.total) {
      await orders.markPaid(order.id);
      await orders.sendConfirmationEmail(order.id);
    }
  }

  res.status(200).json({ received: true });
});

module.exports = router;
`;

const pyContent = `from fastapi import APIRouter, Request

from app.services import orders

router = APIRouter()


@router.post("/webhooks/payment")
async def payment_webhook(request: Request):
    event = await request.json()

    if event["type"] == "payment.succeeded":
        order = await orders.find_by_payment_id(event["data"]["payment_id"])
        amount_paid = event["data"]["amount"] / 100

        if amount_paid == order.total:
            await orders.mark_paid(order.id)
            await orders.send_confirmation_email(order.id)

    return {"received": True}
`;

export const paymentWebhook: Challenge = {
  id: "payment-webhook",
  title: "Payment webhook handler",
  summary:
    "A payment-provider webhook that verifies nothing, re-processes duplicate deliveries, compares money as floats and silently swallows mismatches. Tests understanding of webhooks, idempotency and money handling.",
  prTitle: "Handle payment.succeeded webhooks from the payment provider",
  prDescription:
    "When the payment provider confirms a payment it POSTs us an event. " +
    "This handler marks the matching order as paid and sends the confirmation email. " +
    "The provider retries delivery until it gets a 2xx response. " +
    "Please review as you would a normal PR — leave comments on any lines you have concerns about.",
  fixInstructions:
    "Now harden the handler: verify the event is genuine, make processing idempotent, compare amounts safely, and make sure mismatches and missing orders are surfaced instead of silently acknowledged. You can assume the provider SDK exposes a signature-verification helper and that orders can store a processed event id.",
  findings: [
    {
      id: "wh-no-signature",
      title: "Webhook signature is never verified",
      description:
        "The body is trusted as-is, so anyone who discovers the URL can POST a fake payment.succeeded event and get orders marked as paid for free. The provider's signature header must be verified before processing.",
      category: "security",
      severity: "critical",
    },
    {
      id: "wh-not-idempotent",
      title: "Processing is not idempotent",
      description:
        "Providers deliver events at-least-once. A retry or duplicate delivery re-runs markPaid and sends the confirmation email again. Track processed event ids (or make markPaid conditional) and skip duplicates.",
      category: "bug",
      severity: "major",
    },
    {
      id: "wh-float-money",
      title: "Money compared with floating point (and loose equality)",
      description:
        "Dividing the integer cent amount by 100 produces a float, which is then compared to the order total — classic precision trap (plus loose == in the JS version). Compare integer minor units directly.",
      category: "bug",
      severity: "major",
    },
    {
      id: "wh-missing-order",
      title: "No handling for an unknown payment id",
      description:
        "If no order matches, the lookup returns null/None and reading .total throws, producing a 500 — which makes the provider retry the same broken event forever. Handle the missing-order case explicitly.",
      category: "bug",
      severity: "major",
    },
    {
      id: "wh-silent-mismatch",
      title: "Amount mismatches are silently acknowledged",
      description:
        "When the paid amount does not equal the order total, the handler does nothing yet still returns 200, so the event is acked and the discrepancy is lost forever. Mismatches (and unexpected event types) should be logged/alerted, not swallowed.",
      category: "bug",
      severity: "major",
    },
  ],
  variants: {
    javascript: {
      language: "javascript",
      files: [{ path: "routes/webhooks.js", content: jsContent }],
      anchors: {
        "wh-no-signature": {
          file: "routes/webhooks.js",
          anchor: "const event = req.body;",
        },
        "wh-not-idempotent": {
          file: "routes/webhooks.js",
          anchor: "await orders.markPaid(order.id);",
        },
        "wh-float-money": {
          file: "routes/webhooks.js",
          anchor: "event.data.amount / 100",
        },
        "wh-missing-order": {
          file: "routes/webhooks.js",
          anchor: "orders.findByPaymentId(event.data.paymentId)",
        },
        "wh-silent-mismatch": {
          file: "routes/webhooks.js",
          anchor: "res.status(200).json({ received: true });",
        },
      },
    },
    python: {
      language: "python",
      files: [{ path: "routes/webhooks.py", content: pyContent }],
      anchors: {
        "wh-no-signature": {
          file: "routes/webhooks.py",
          anchor: "event = await request.json()",
        },
        "wh-not-idempotent": {
          file: "routes/webhooks.py",
          anchor: "await orders.mark_paid(order.id)",
        },
        "wh-float-money": {
          file: "routes/webhooks.py",
          anchor: 'event["data"]["amount"] / 100',
        },
        "wh-missing-order": {
          file: "routes/webhooks.py",
          anchor: "orders.find_by_payment_id(",
        },
        "wh-silent-mismatch": {
          file: "routes/webhooks.py",
          anchor: 'return {"received": True}',
        },
      },
    },
  },
};
