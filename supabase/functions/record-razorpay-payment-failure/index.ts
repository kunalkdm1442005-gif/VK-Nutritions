import { adminClient, authenticatedUser, handleOptions, json, razorpayRequest } from "../_shared/razorpay.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return handleOptions(request);
  if (request.method !== "POST") return json(request, { error: "Method not allowed." }, 405);

  try {
    const user = await authenticatedUser(request);
    const body = await request.json();
    const internalOrderId = Number(body.internal_order_id);
    const paymentId = String(body.razorpay_payment_id || "");
    if (!Number.isInteger(internalOrderId) || !paymentId) throw new Error("The failed payment response is incomplete.");

    const admin = adminClient();
    const { data: order, error: orderError } = await admin.from("order_history").select("*").eq("id", internalOrderId).eq("user_id", user.id).single();
    if (orderError || !order) throw new Error("The order could not be found.");
    if (order.payment_status === "paid") return json(request, { ignored: true });

    const payment = await razorpayRequest(`/payments/${encodeURIComponent(paymentId)}`) as Record<string, any>;
    if (payment.order_id !== order.razorpay_order_id || Number(payment.amount) !== Number(order.payment_amount_paise)) {
      throw new Error("The failed payment does not belong to this order.");
    }
    if (payment.status !== "failed") return json(request, { ignored: true });

    const { error: updateError } = await admin.from("order_history").update({
      payment_status: "failed",
      payment_failure_reason: payment.error_description || payment.error_reason || "Payment was not completed.",
      payment_method: payment.method || "razorpay",
    }).eq("id", order.id).eq("user_id", user.id).neq("payment_status", "paid");
    if (updateError) throw updateError;
    return json(request, { recorded: true });
  } catch (error) {
    console.error("[VK Razorpay] record failure error", error instanceof Error ? error.message : error);
    return json(request, { error: error instanceof Error ? error.message : "Could not record the failed payment." }, 400);
  }
});
