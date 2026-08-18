# VK Nutrition — Supabase email OTP with Brevo

The website is already configured to request a code with `signInWithOtp()` and verify the code with `verifyOtp()`. No SMTP secret is stored in the website source.

## Important: do not use the localhost OAuth address

`http://localhost:3000/oauth/consent` is an OAuth callback address. It is **not** an email OTP URL, should not be pasted into the Supabase email template, and is not needed for Brevo SMTP. This project uses code-only authentication, so it does not need an email redirect URL.

## 1. Set up Brevo

1. In Brevo, open **Settings → SMTP & API → SMTP**.
2. Verify the email address or domain that will send the messages.
3. Copy the **SMTP Login** shown by Brevo. It normally ends in `@smtp-brevo.com`.
4. Create and copy an **SMTP key**. Do not use an API key, your Brevo account password, or `smtp-relay.brevo.com` as the username.

## 2. Connect Brevo in Supabase

Open **Supabase Dashboard → Authentication → SMTP Settings** and enter:

| Supabase field | Value |
| --- | --- |
| Sender email address | A sender verified in Brevo, for example `support@yourdomain.com` |
| Sender name | `VK Nutrition` |
| Host | `smtp-relay.brevo.com` |
| Port number | `587` |
| Username | The Brevo **SMTP Login** from step 1 |
| Password | The Brevo **SMTP key** from step 1 |

Save the settings and send a test email if the dashboard provides that option. Port 587 is the normal non-SSL/TLS relay port; do not select SSL/TLS for port 587. Use port 465 only if you select SSL/TLS.

## 3. Change every authentication email that this site uses to a code

Open **Supabase Dashboard → Authentication → Email Templates**.

### Confirm signup

- Subject: `VK Nutrition — Your verification code`
- Replace the body with the complete contents of `supabase-email-otp-template.html`.

### Magic link or OTP

- Subject: `VK Nutrition — Your sign-in code`
- Replace the body with the complete contents of `supabase-email-otp-template.html`.

The template must contain `{{ .Token }}` and must not contain `{{ .ConfirmationURL }}`. Do not leave an `<a>` sign-in link in either template. Save both templates.

## 4. Database setup

In **Supabase Dashboard → SQL Editor**, run `supabase-setup.sql` once. It creates the protected profile, login, order, and product-view history tables used by the site.

## Test

1. Deploy or serve the website through HTTP(S), not by opening `index.html` as a `file://` URL.
2. Create an account and select **Send Email OTP**.
3. The email should be from **VK Nutrition**, show a numeric code, and contain no sign-in link.
4. Enter that code in the site to complete signup or sign in.
