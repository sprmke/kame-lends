export type PushDeliveryAction = "sent" | "prune" | "retry" | "failed";

export function pushDeliveryAction(statusCode: number): PushDeliveryAction {
  if (statusCode >= 200 && statusCode < 300) return "sent";
  if (statusCode === 404 || statusCode === 410) return "prune";
  if (
    statusCode === 408 ||
    statusCode === 425 ||
    statusCode === 429 ||
    statusCode >= 500
  ) {
    return "retry";
  }
  return "failed";
}
