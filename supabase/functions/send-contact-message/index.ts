const ALLOWED_ORIGINS = ["https://vknutrtions.com", "https://www.vknutrtions.com", "http://localhost:3000"];
const SUPPORT_EMAIL = "vknutrition26@gmail.com"; // 

function cors(request: Request) {
  const origin = request.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors(request) });
  if (request.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed." }), { status: 405, headers: cors(request) });

  try {
    const body = await request.json();
    const name = String(body.name || "").trim().slice(0, 200);
    const email = String(body.email || "").trim().slice(0, 200);
    const mobile = String(body.mobile || "").trim().slice(0, 50);
    const orderNumber = String(body.order_number || "").trim().slice(0, 100);
    const subject = String(body.subject || "").trim().slice(0, 200);
    const message = String(body.message || "").trim().slice(0, 5000);

    if (!name || !email || !subject || !message) throw new Error("Missing required fields.");

    const apiKey = Deno.env.get("BREVO_API_KEY");
    if (!apiKey) throw new Error("Email service is not configured.");

    const html = `
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Mobile:</strong> ${mobile || "-"}</p>
      <p><strong>Order Number:</strong> ${orderNumber || "-"}</p>
      <p><strong>Subject:</strong> ${subject}</p>
      <p><strong>Message:</strong><br>${message.replace(/\n/g, "<br>")}</p>
    `;

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        sender: { name: "VK Nutrition Website", email: "no-reply@vknutrtions.com" }, // must be a verified Brevo sender
        to: [{ email: SUPPORT_EMAIL }],
        replyTo: { email, name },
        subject: `Contact Form: ${subject}`,
        htmlContent: html,
      }),
    });

    if (!res.ok) throw new Error(`Email provider error: ${await res.text()}`);

    return new Response(JSON.stringify({ sent: true }), { status: 200, headers: cors(request) });
  } catch (error) {
    console.error("[VK Contact] send error", error instanceof Error ? error.message : error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Could not send message." }), { status: 400, headers: cors(request) });
  }
});
