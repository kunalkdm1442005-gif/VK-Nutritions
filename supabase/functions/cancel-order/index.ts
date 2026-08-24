import { adminClient, authenticatedUser, handleOptions, json } from "../_shared/razorpay.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return handleOptions(request);
  if (request.method !== "POST") return json(request, { error: "Method not allowed." }, 405);

  try {
    const user = await authenticatedUser(request);
    const body = await request.json();
    const orderId = Number(body.order_id);
    const reason = String(body.cancellation_reason || "").trim().slice(0, 500);
    if (!Number.isInteger(orderId)) throw new Error("The order ID is invalid.");

    const admin = adminClient();
    const { data: order, error: orderError } = await admin.from("order_history").select("*").eq("id", orderId).eq("user_id", user.id).single();
    if (orderError || !order) throw new Error("The order could not be found.");
    if (order.status === "cancelled") return json(request, { cancelled: true, already_cancelled: true, order });
    if (["shipped", "delivered"].includes(String(order.status).toLowerCase())) throw new Error("This order can no longer be cancelled online. Please contact support.");

    const cancelledAt = new Date().toISOString();
    const update = {
      status: "cancelled",
      cancelled_at: cancelledAt,
      cancellation_reason: reason || null,
      refund_status: order.payment_status === "paid" ? "review_required" : "not_required",
      whatsapp_cancel_prepared_at: cancelledAt,
    };
    const { data: cancelledOrder, error: updateError } = await admin.from("order_history").update(update).eq("id", order.id).eq("user_id", user.id).select("*").single();
    if (updateError || !cancelledOrder) throw new Error("The order could not be cancelled. Please try again.");
    return json(request, { cancelled: true, order: cancelledOrder });
  } catch (error) {
    console.error("[VK Razorpay] cancel order error", error instanceof Error ? error.message : error);
    return json(request, { error: error instanceof Error ? error.message : "Could not cancel the order." }, 400);
  }
});
