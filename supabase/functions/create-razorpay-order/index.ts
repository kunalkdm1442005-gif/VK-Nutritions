import { catalogueById } from "../_shared/catalogue.ts";
import {
  adminClient,
  amountToPaise,
  authenticatedUser,
  handleOptions,
  json,
  newOrderCode,
  razorpayRequest,
  requiredSecret,
  validateShippingAddress,
} from "../_shared/razorpay.ts";

type CheckoutItem = { product_id: string; quantity: number };

function validRequestId(value: unknown) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(value);
}

function buildServerItems(input: unknown) {
  if (!Array.isArray(input) || !input.length) throw new Error("Your cart is empty.");
  const quantities = new Map<string, number>();
  for (const item of input as CheckoutItem[]) {
    const productId = String(item?.product_id || "");
    const quantity = Number(item?.quantity);
    if (!catalogueById.has(productId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      throw new Error("One or more cart items are invalid. Refresh your cart and try again.");
    }
    quantities.set(productId, (quantities.get(productId) || 0) + quantity);
  }
  return [...quantities].map(([id, qty]) => {
    const product = catalogueById.get(id)!;
    return { id, name: product.name, category: product.category, pack: product.pack, image: product.image, price: product.price, qty };
  });
}

async function createProviderOrder(order: Record<string, any>) {
  const razorpayOrder = await razorpayRequest("/orders", {
    method: "POST",
    body: JSON.stringify({
      amount: Number(order.payment_amount_paise),
      currency: "INR",
      receipt: order.order_code,
      notes: {
        internal_order_id: String(order.id),
        internal_order_code: order.order_code,
        customer_id: order.user_id,
        customer_name: order.customer_name,
        customer_mobile: order.customer_mobile,
        customer_email: order.customer_email,
      },
    }),
  });
  if (typeof razorpayOrder.id !== "string") throw new Error("Razorpay did not return an order ID.");
  const admin = adminClient();
  const { data, error } = await admin
    .from("order_history")
    .update({ razorpay_order_id: razorpayOrder.id, payment_method: "razorpay", payment_status: "pending" })
    .eq("id", order.id)
    .is("razorpay_order_id", null)
    .select()
    .single();
  if (!error && data) return data;

  // A repeated request may have completed in another invocation. Always return the single stored order.
  const { data: stored, error: storedError } = await admin.from("order_history").select("*").eq("id", order.id).single();
  if (storedError || !stored?.razorpay_order_id) throw new Error("Could not prepare the payment. Please try again.");
  return stored;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return handleOptions(request);
  if (request.method !== "POST") return json(request, { error: "Method not allowed." }, 405);

  try {
    const user = await authenticatedUser(request);
    const body = await request.json();
    if (!validRequestId(body.checkout_request_id)) throw new Error("The checkout request is invalid. Please try again.");

    const address = validateShippingAddress(body.shipping_address || {});
    const items = buildServerItems(body.items);
    const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
    const shipping = 0;
    const discount = 0;
    const total = subtotal + shipping - discount;
    const paymentAmountPaise = amountToPaise(total);
    const admin = adminClient();

    let { data: order, error: existingError } = await admin
      .from("order_history")
      .select("*")
      .eq("user_id", user.id)
      .eq("checkout_request_id", body.checkout_request_id)
      .maybeSingle();
    if (existingError) throw existingError;

    if (!order) {
      const payload = {
        user_id: user.id,
        checkout_request_id: body.checkout_request_id,
        order_code: newOrderCode(),
        customer_name: address.full_name,
        customer_email: address.email,
        customer_mobile: `+91${address.mobile}`,
        shipping_address: address,
        items,
        total_amount: total,
        subtotal_amount: subtotal,
        shipping_charge: shipping,
        discount_amount: discount,
        final_amount: total,
        payment_method: "razorpay",
        payment_status: "pending",
        payment_currency: "INR",
        payment_amount_paise: paymentAmountPaise,
        status: "pending",
      };
      const created = await admin.from("order_history").insert(payload).select("*").single();
      if (created.error) {
        // The unique checkout request key makes a double click reuse the same internal order.
        const retry = await admin.from("order_history").select("*").eq("user_id", user.id).eq("checkout_request_id", body.checkout_request_id).maybeSingle();
        if (retry.error || !retry.data) throw created.error;
        order = retry.data;
      } else {
        order = created.data;
      }
    }

    if (order.payment_status === "paid") return json(request, { error: "This order has already been paid." }, 409);
    if (!order.razorpay_order_id) order = await createProviderOrder(order);

    return json(request, {
      key_id: requiredSecret("RAZORPAY_KEY_ID"),
      razorpay_order_id: order.razorpay_order_id,
      amount_paise: Number(order.payment_amount_paise),
      currency: order.payment_currency || "INR",
      order: {
        id: order.id,
        order_code: order.order_code,
        customer_name: order.customer_name,
        customer_email: order.customer_email,
        customer_mobile: order.customer_mobile,
        shipping_address: order.shipping_address,
        items: order.items,
        subtotal_amount: order.subtotal_amount,
        shipping_charge: order.shipping_charge,
        discount_amount: order.discount_amount,
        final_amount: order.final_amount,
      },
    });
  } catch (error) {
    console.error("[VK Razorpay] create order error", error instanceof Error ? error.message : error);
    return json(request, { error: error instanceof Error ? error.message : "Could not prepare payment." }, 400);
  }
});
