# Checkout and delivery setup

1. Open Supabase Dashboard → SQL Editor.
2. Open `supabase-setup.sql` from this project and run the complete file once.
3. Confirm that `order_history` now includes delivery, payment, cancellation and WhatsApp-preparation fields.
4. Confirm that the `saved_addresses` table exists.

Razorpay integration is supplied through Supabase Edge Functions. Follow [RAZORPAY-SUPABASE-SETUP.md](./RAZORPAY-SUPABASE-SETUP.md) to deploy the functions, set Test Mode secrets, configure the webhook and complete payment testing before using Live Mode.

WhatsApp notifications use a pre-filled action for `+91 84259 20360` only after the order or cancellation has been saved. No WhatsApp API token is stored in the website code.
