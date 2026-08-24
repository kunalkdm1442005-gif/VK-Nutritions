import {
  adminClient,
  authenticatedUser,
  handleOptions,
  hmacSha256Hex,
  json,
  razorpayRequest,
  requiredSecret,
  timingSafeEqual,
} from "../_shared/razorpay.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return handleOptions(request);
  if (request.method !== "POST") return json(request, { error: "Method not allowed." }, 405);

  try {
    const user = await authenticatedUser(request);
    const body = await request.json();
    const internalOrderId = Number(body.internal_order_id);
    const paymentId = String(body.razorpay_payment_id || "");
    const returnedOrderId = String(body.razorpay_order_id || "");
    const returnedSignature = String(body.razorpay_signature || "");
    if (!Number.isInteger(internalOrderId) || !paymentId || !returnedOrderId || !returnedSignature) {
      throw new Error("The payment response is incomplete.");
    }

    const admin = adminClient();
    const { data: order, error: orderError } = await admin
      .from("order_history")
      .select("*")
      .eq("id", internalOrderId)
      .eq("user_id", user.id)
      .single();
    if (orderError || !order) throw new Error("The order could not be found.");
    if (order.payment_status === "paid") {
      return json(request, { verified: true, order, already_verified: true });
    }
    if (!order.razorpay_order_id || order.razorpay_order_id !== returnedOrderId) {
      throw new Error("The payment does not belong to this order.");
    }

    // Razorpay requires the stored server order ID, not an untrusted browser value, for this check.
    const expectedSignature = await hmacSha256Hex(
      requiredSecret("RAZORPAY_KEY_SECRET"),
      `${order.razorpay_order_id}|${paymentId}`,
    );
    if (!timingSafeEqual(expectedSignature, returnedSignature)) {
      throw new Error("Payment verification failed. Your order was not marked as paid.");
    }

    // Verify the captured amount and payment status with Razorpay before fulfilling the order.
    const payment = await razorpayRequest(`/payments/${encodeURIComponent(paymentId)}`) as Record<string, any>;
    if (
      payment.order_id !== order.razorpay_order_id ||
      Number(payment.amount) !== Number(order.payment_amount_paise) ||
      payment.currency !== (order.payment_currency || "INR")
    ) {
      throw new Error("The payment amount or currency did not match this order.");
    }
    if (payment.status !== "captured") {
      return json(request, { verified: false, pending: true, error: "Payment is still being confirmed. Please check Order History shortly." }, 202);
    }

    const verifiedAt = new Date().toISOString();
    const { data: verifiedOrder, error: updateError } = await admin
      .from("order_history")
      .update({
        status: "placed",
        payment_status: "paid",
        payment_method: payment.method || "razorpay",
        razorpay_payment_id: payment.id,
        payment_verified_at: verifiedAt,
        payment_failure_reason: null,
        whatsapp_order_prepared_at: verifiedAt,
      })
      .eq("id", order.id)
      .eq("user_id", user.id)
      .neq("payment_status", "paid")
      .select("*")
      .single();
    if (updateError || !verifiedOrder) throw new Error("Payment was verified but the order could not be updated. Contact support with your payment ID.");

    return json(request, { verified: true, order: verifiedOrder });
  } catch (error) {
    console.error("[VK Razorpay] verify payment error", error instanceof Error ? error.message : error);
    return json(request, { error: error instanceof Error ? error.message : "Payment verification failed." }, 400);
  }
});
