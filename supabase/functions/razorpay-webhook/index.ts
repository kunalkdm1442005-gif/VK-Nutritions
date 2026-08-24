import { adminClient, hmacSha256Hex, requiredSecret, timingSafeEqual } from "../_shared/razorpay.ts";

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return response(405, { error: "Method not allowed." });
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature") || "";
  const expectedSignature = await hmacSha256Hex(requiredSecret("RAZORPAY_WEBHOOK_SECRET"), rawBody);
  if (!signature || !timingSafeEqual(expectedSignature, signature)) return response(401, { error: "Invalid webhook signature." });

  try {
    const event = JSON.parse(rawBody);
    const eventType = String(event.event || "");
    const eventId = request.headers.get("x-razorpay-event-id") || `${eventType}:${event.payload?.payment?.entity?.id || event.payload?.refund?.entity?.id || event.payload?.order?.entity?.id || crypto.randomUUID()}`;
    const admin = adminClient();
    const { error: eventError } = await admin.from("razorpay_webhook_events").insert({ event_id: eventId, event_type: eventType, payload: event });
    if (eventError?.code === "23505") {
      const previous = await admin.from("razorpay_webhook_events").select("processed_at").eq("event_id", eventId).maybeSingle();
      if (previous.data?.processed_at) return response(200, { received: true, duplicate: true });
      throw new Error("A matching webhook event is already being processed.");
    }
    if (eventError) throw eventError;

    const payment = event.payload?.payment?.entity || {};
    const providerOrder = event.payload?.order?.entity || {};
    const refund = event.payload?.refund?.entity || {};
    const razorpayOrderId = payment.order_id || providerOrder.id;
    const razorpayPaymentId = payment.id || refund.payment_id;
    let order: Record<string, any> | null = null;
    if (razorpayOrderId) {
      const lookup = await admin.from("order_history").select("*").eq("razorpay_order_id", razorpayOrderId).maybeSingle();
      if (lookup.error) throw lookup.error;
      order = lookup.data;
    }
    if (!order && razorpayPaymentId) {
      const lookup = await admin.from("order_history").select("*").eq("razorpay_payment_id", razorpayPaymentId).maybeSingle();
      if (lookup.error) throw lookup.error;
      order = lookup.data;
    }
    if (!order) {
      await admin.from("razorpay_webhook_events").update({ processed_at: new Date().toISOString() }).eq("event_id", eventId);
      return response(200, { received: true, ignored: "No VK Nutrition order matched this event." });
    }

    if (["payment.captured", "order.paid"].includes(eventType)) {
      if (payment.amount && Number(payment.amount) !== Number(order.payment_amount_paise)) throw new Error("Webhook payment amount did not match the VK Nutrition order.");
      if (order.payment_status !== "paid") {
        const update: Record<string, unknown> = {
          status: "placed",
          payment_status: "paid",
          payment_method: payment.method || order.payment_method || "razorpay",
          payment_verified_at: new Date().toISOString(),
          whatsapp_order_prepared_at: new Date().toISOString(),
        };
        if (razorpayPaymentId) update.razorpay_payment_id = razorpayPaymentId;
        await admin.from("order_history").update(update).eq("id", order.id).neq("payment_status", "paid");
      }
    } else if (eventType === "payment.failed") {
      if (order.payment_status !== "paid") {
        await admin.from("order_history").update({
          payment_status: "failed",
          payment_method: payment.method || order.payment_method || "razorpay",
          payment_failure_reason: payment.error_description || payment.error_reason || "Payment was not completed.",
        }).eq("id", order.id).neq("payment_status", "paid");
      }
    } else if (eventType === "refund.processed") {
      await admin.from("order_history").update({
        payment_status: "refunded",
        refund_status: "refunded",
        razorpay_refund_id: refund.id || null,
        refund_amount_paise: refund.amount || null,
        refund_processed_at: new Date().toISOString(),
      }).eq("id", order.id);
    } else if (eventType === "refund.failed") {
      await admin.from("order_history").update({
        refund_status: "failed",
        razorpay_refund_id: refund.id || null,
      }).eq("id", order.id);
    }

    await admin.from("razorpay_webhook_events").update({ processed_at: new Date().toISOString() }).eq("event_id", eventId);

    return response(200, { received: true });
  } catch (error) {
    console.error("[VK Razorpay] webhook processing error", error instanceof Error ? error.message : error);
    return response(500, { error: "Webhook processing failed." });
  }
});
