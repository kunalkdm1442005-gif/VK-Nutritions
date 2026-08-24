# Checkout and delivery setup

1. Open Supabase Dashboard → SQL Editor.
2. Open `supabase-setup.sql` from this project and run the complete file once.
3. Confirm that `order_history` now includes delivery, payment, cancellation and WhatsApp-preparation fields.
4. Confirm that the `saved_addresses` table exists.

The checkout creates orders with `payment_status: pending` because this project does not currently contain a live payment-gateway integration. Add payment-server code separately before changing an order to `paid`.

WhatsApp notifications use a pre-filled action for `+91 7738963610` only after the order or cancellation has been saved. No WhatsApp API token is stored in the website code.
