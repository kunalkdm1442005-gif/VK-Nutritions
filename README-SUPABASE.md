# VK Nutrition: email OTP and customer data setup

The browser-safe Supabase URL and publishable key are already configured in `script.js`. Do **not** add a service-role key to this website.

## Required Supabase setup

1. In Supabase Dashboard, open **SQL Editor**.
2. Run the complete contents of `supabase-setup.sql` once.
3. In **Authentication → Providers**, enable **Email**.
4. In **Authentication → Email Templates**, use an email OTP template containing `{{ .Token }}`. Do not use a magic-link-only template.
5. In **Authentication → URL Configuration**, add your deployed website URL as the Site URL and a Redirect URL.

## Authentication behaviour

- Registration asks for name, email, and mobile number, then sends the OTP to the email address.
- Sign-in asks for the same email and mobile number, then sends the OTP only to the registered email address.
- SMS OTP is not used.
- Supabase persists and refreshes the signed-in session until the user chooses Log Out.
- Supabase controls email delivery and rate limits. The website sends the request immediately and adds no artificial wait.

## Customer data

The SQL setup stores each signed-in customer's profile, login events, saved checkout requests, and product view history. Row-level security ensures each customer can read only their own data.

## Run locally

Serve the folder over HTTP(S), not `file://`:

```powershell
py -m http.server 4174
```

Then open `http://127.0.0.1:4174/`.
