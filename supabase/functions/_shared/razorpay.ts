import { createClient } from "npm:@supabase/supabase-js@2";

const DEFAULT_ORIGINS = [
  "https://vknutrtions.com",
  "https://www.vknutrtions.com",
  "http://localhost:3000",
];

export type ShippingAddress = {
  full_name: string;
  mobile: string;
  email: string;
  address_line_1: string;
  address_line_2: string;
  landmark: string;
  city: string;
  state: string;
  pin_code: string;
  country: string;
};

function configuredOrigins() {
  const configured = Deno.env.get("ALLOWED_ORIGINS");
  return configured
    ? configured.split(",").map((origin) => origin.trim()).filter(Boolean)
    : DEFAULT_ORIGINS;
}

export function corsHeaders(request: Request) {
  const origin = request.headers.get("Origin") || "";
  const allowedOrigins = configuredOrigins();
  const allowedOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
    "Vary": "Origin",
  };
}

export function json(request: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(request) });
}

export function handleOptions(request: Request) {
  return new Response("ok", { headers: corsHeaders(request) });
}

export function requiredSecret(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required server secret: ${name}`);
  return value;
}

export function adminClient() {
  return createClient(
    requiredSecret("SUPABASE_URL"),
    requiredSecret("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function authenticatedUser(request: Request) {
  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) throw new Error("Authentication is required.");
  const token = authorization.slice("Bearer ".length);
  const client = createClient(requiredSecret("SUPABASE_URL"), requiredSecret("SUPABASE_ANON_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new Error("Your session has expired. Please sign in again.");
  return data.user;
}

const clean = (value: unknown) => String(value ?? "").trim();

export function validateShippingAddress(input: Record<string, unknown>): ShippingAddress {
  const address: ShippingAddress = {
    full_name: clean(input.full_name),
    mobile: clean(input.mobile).replace(/\D/g, ""),
    email: clean(input.email).toLowerCase(),
    address_line_1: clean(input.address_line_1),
    address_line_2: clean(input.address_line_2),
    landmark: clean(input.landmark),
    city: clean(input.city),
    state: clean(input.state),
    pin_code: clean(input.pin_code).replace(/\D/g, ""),
    country: clean(input.country) || "India",
  };
  if (!address.full_name || !/^\S+@\S+\.\S+$/.test(address.email) || !address.address_line_1 || !address.city || !address.state || !address.country) {
    throw new Error("Enter all required delivery details.");
  }
  if (address.country.toLowerCase() === "india") {
    if (!/^\d{10}$/.test(address.mobile)) throw new Error("Enter a valid 10-digit mobile number.");
    if (!/^\d{6}$/.test(address.pin_code)) throw new Error("Enter a valid 6-digit PIN code.");
  } else if (!address.mobile || !address.pin_code) {
    throw new Error("Enter a valid mobile number and PIN/postal code.");
  }
  return address;
}

export async function hmacSha256Hex(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export async function razorpayRequest(path: string, init: RequestInit = {}) {
  const keyId = requiredSecret("RAZORPAY_KEY_ID");
  const keySecret = requiredSecret("RAZORPAY_KEY_SECRET");
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...init,
    headers: {
      "Authorization": `Basic ${btoa(`${keyId}:${keySecret}`)}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  let payload: Record<string, unknown> = {};
  try { payload = text ? JSON.parse(text) : {}; } catch { /* Razorpay returned a non-JSON error. */ }
  if (!response.ok) {
    const providerError = payload.error && typeof payload.error === "object" ? payload.error as Record<string, unknown> : {};
    console.error("[VK Razorpay] API request failed", { path, status: response.status, code: providerError.code });
    throw new Error("Razorpay could not process the payment request. Please try again.");
  }
  return payload;
}

export function amountToPaise(amount: number) {
  const paise = Math.round(Number(amount) * 100);
  if (!Number.isSafeInteger(paise) || paise < 100) throw new Error("The order amount is invalid.");
  return paise;
}

export function newOrderCode() {
  const year = new Date().getUTCFullYear();
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  return `VK-${year}-${suffix}`;
}
