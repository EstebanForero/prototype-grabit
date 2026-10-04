import type { Alert, Decision, ModuleEvent } from "../contract.ts";
import { alertKey } from "../contract.ts";
import { STATUS_LABEL } from "../contract.ts";

export function eventsFromDecision(decision: Decision): ModuleEvent[] {
  if (decision.outcome === "apply") {
    return [
      {
        kind: "state_applied",
        urgency: decision.status === "delivered" ? "action" : "notice",
        productId: decision.productId,
        status: decision.status,
        message: `Se aplicó ${STATUS_LABEL[decision.status]}. ${decision.reason}`,
      },
    ];
  }
  return [
    {
      kind: "state_held",
      urgency: "action",
      productId: decision.productId,
      status: decision.status,
      message: `Se retuvo ${STATUS_LABEL[decision.status]}: ${decision.holdReason}`,
    },
  ];
}

export function eventsFromAlerts(before: Alert[], after: Alert[], productId: string): ModuleEvent[] {
  const previous = new Map(before.filter((item) => item.productId === productId).map((item) => [alertKey(item), item]));
  const next = new Map(after.filter((item) => item.productId === productId).map((item) => [alertKey(item), item]));
  const events: ModuleEvent[] = [];
  for (const [key, alert] of next) {
    if (!previous.has(key)) {
      events.push({
        kind: "alert_raised",
        urgency: "action",
        productId,
        alertKind: alert.kind,
        message: alert.message,
      });
    }
  }
  for (const [key, alert] of previous) {
    if (!next.has(key)) {
      events.push({
        kind: "alert_cleared",
        urgency: "notice",
        productId,
        alertKind: alert.kind,
        message: `Se apagó la alerta: ${alert.message}`,
      });
    }
  }
  return events;
}
