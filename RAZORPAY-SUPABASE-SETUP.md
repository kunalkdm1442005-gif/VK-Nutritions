# Razorpay + Supabase secure checkout setup

## Security first

The Razorpay Key Secret and Webhook Secret must never be placed in `index.html`, `script.js`, GitHub Pages variables, or committed to GitHub. Because production secrets were shared outside Razorpay, rotate the Key Secret and Webhook Secret in the Razorpay Dashboard before continuing.

Start in **Razorpay Test Mode**. Do not use Live Mode until successful payment, failed payment, retry, webhook delivery and cancellation have each been checked.

## 1. Apply the database update

In Supabase Dashboard → **SQL Editor**, run the entire updated `supabase-setup.sql` file.

This adds the Razorpay IDs, payment/refund state, idempotency keys and `razorpay_webhook_events` table. It also removes browser permission to create or alter orders, which prevents a customer from changing an order to `Paid` from DevTools.

## 2. Set Supabase Edge Function secrets

In Supabase Dashboard → **Edge Functions** → **Secrets**, add these values using newly generated **Test Mode** Razorpay credentials:

```text
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=use_a_new_random_webhook_secret
ALLOWED_ORIGINS=https://vknutrtions.com,https://www.vknutrtions.com,http://localhost:3000
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are supplied to hosted Supabase Edge Functions. Do not copy the service-role key into this repository.

For local CLI work only, copy `supabase/.env.example` to an untracked `supabase/.env` file and insert the same Test Mode values.

## 3. Deploy the Edge Functions

Install/login to the Supabase CLI, link the project, then deploy the five functions:

```powershell
supabase login
supabase link --project-ref owpgbkrnimhwvgqntggq
supabase functions deploy create-razorpay-order
supabase functions deploy verify-razorpay-payment
supabase functions deploy record-razorpay-payment-failure
supabase functions deploy cancel-order
supabase functions deploy razorpay-webhook
```

Only `razorpay-webhook` disables JWT verification; it validates Razorpay's raw-body HMAC signature instead. Customer-facing payment and cancellation functions require a valid Supabase session.

## 4. Configure the Razorpay Test Mode webhook

In Razorpay Dashboard → **Test Mode** → Webhooks, add this URL:

```text
https://owpgbkrnimhwvgqntggq.supabase.co/functions/v1/razorpay-webhook
```

Set the webhook secret to the **same new value** stored as `RAZORPAY_WEBHOOK_SECRET` in Supabase. Enable:

```text
payment.captured
payment.failed
order.paid
refund.processed
refund.failed
```

The endpoint records the Razorpay event ID before handling it and marks it processed only after a successful update, so repeated webhook deliveries cannot create duplicate orders or payment notifications.

## 5. Test before going live

Use only Razorpay's Test Mode credentials and test payment methods first.

1. Place an order from a logged-in account. Confirm a pending VK order and Razorpay order are created once, even after repeat clicks.
2. Complete a test payment. Verify the order becomes `Payment: Paid` and `Order: Placed` only after server verification.
3. Trigger or simulate a failed payment. Confirm it remains unpaid and the same order can be retried.
4. Confirm the webhook events are recorded in `razorpay_webhook_events` and do not duplicate status changes.
5. Cancel a pending and a paid order. A paid cancellation is marked `Refund: review_required`; no automatic refund is issued.
6. If a refund is created from the Razorpay Dashboard after policy review, confirm the refund webhook updates the order.

## 6. Go live

After every Test Mode check passes, replace only the three Razorpay secrets in Supabase with newly generated **Live Mode** values, then configure the same webhook URL in Razorpay Live Mode with a new Live webhook secret. No website JavaScript change is needed.

## WhatsApp behaviour

This project does not contain a server-side WhatsApp Business API integration. After a payment is verified or an order is successfully cancelled, the website prepares a pre-filled WhatsApp action for the configured business number. It does not pretend to send a WhatsApp message silently from browser JavaScript.
