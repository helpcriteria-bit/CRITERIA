# Scheduled deliverable cleanup

`deleteExpiredClientDeliverables` runs every 15 minutes. When a handed-over request reaches `deliverablesExpireAt`, it deletes uploaded Cloudinary assets using each file's `public_id` and `resource_type`, then removes successfully deleted file references from the request. Failed deletes remain referenced and are retried on the next run.

This scheduled function requires a Firebase project with Cloud Functions and Cloud Scheduler billing enabled (Blaze plan). Configure the Cloudinary API credentials as Firebase secrets; never place the API secret in browser code or source control.

From the workspace root, run these commands. Firebase CLI prompts for each secret value:

```powershell
firebase functions:secrets:set CLOUDINARY_API_KEY
firebase functions:secrets:set CLOUDINARY_API_SECRET
firebase deploy --only functions:deleteExpiredClientDeliverables
```

Only Cloudinary resources with a resolvable public ID and resource type can be deleted. Direct URLs or files hosted by another service are retained and are not removed by this function.

## Google OAuth code exchange

The Google OAuth client secret is used only by `exchangeGoogleOAuthCode`; it must not be stored in `public/` or sent to the browser. The previously published secret must be revoked and rotated in Google Cloud Console.

Cookie inventory:

- `criteria-cookie-consent`: records whether optional preference cookies were accepted. First-party, host-only, `Path=/`, `SameSite=Lax`, six-month `Max-Age`, `Secure` on HTTPS. It is JavaScript-readable because the consent UI updates it.
- `criteria-theme` and `criteria-accent`: optional visual preferences. First-party, host-only, `Path=/`, `SameSite=Lax`, six-month `Max-Age`, `Secure` on HTTPS. Created only after preference consent; neither contains authentication data.
- `criteria_oauth_state`: short-lived OAuth CSRF state binding cookie. Set by `beginGoogleOAuth`, `HttpOnly`, `SameSite=Lax`, `Path=/api/google-oauth`, ten-minute `Max-Age`, host-only, and `Secure` on HTTPS. It is not an authenticated user session.

Firebase Authentication for customer accounts and the admin/agent portals still use the Firebase browser SDK and client-side Firestore access. They are not converted to cookie sessions here: that requires migrating their Firestore reads/writes behind server endpoints and replacing the current permissive Firestore rules. Do not treat the new OAuth state cookie as authentication or authorization.

Set the replacement secret, then deploy the OAuth functions and Hosting rewrites:

```powershell
firebase functions:secrets:set GOOGLE_OAUTH_CLIENT_SECRET
firebase deploy --only functions:beginGoogleOAuth,functions:exchangeGoogleOAuthCode,hosting
```

For local OAuth testing, run the Hosting and Functions emulators together and configure the local secret with the Firebase CLI's local secret support. The configured Google OAuth client must allow the exact callback URI `http://localhost:5501/callback.html` or `http://127.0.0.1:5501/callback.html`, as well as `https://criteriaa.web.app/callback.html` for production.
