# CRITERIA Email API

The API sends project submission summaries through Gmail SMTP. Firebase Hosting serves static files, so the Node.js API must run as a separate service. The API only sends to `NOTIFICATION_EMAIL`; clients cannot choose a recipient.

## Local setup

From the workspace root, install the API dependency and create its local environment file:

```powershell
npm install --prefix email-api
Copy-Item email-api/.env.example email-api/.env
```

Edit `email-api/.env` locally. Set `GMAIL_USER` and `NOTIFICATION_EMAIL` to `mhpk2010@gmail.com`, then put the Gmail App Password in `GMAIL_APP_PASSWORD`. Do not commit or share `.env`.

Start the API in one terminal:

```powershell
npm run dev --prefix email-api
```

Start the existing frontend from the workspace root in another terminal:

```powershell
npm start
```

Open `http://localhost:5501/submit.html`. The local form sends its email notification to `http://localhost:3001/api/project-notification` after its existing Firestore submission attempt.

## Production setup

Cloud Run is the selected Node.js hosting option because Firebase Hosting only serves static files. The frontend calls the Cloud Run URL directly, so no Firebase Hosting rewrite or Firebase plan change is needed. Cloud Run requires a Google Cloud billing account and may incur charges; no service has been created or deployed by this change.

Before deploying, create a Secret Manager secret named `GMAIL_APP_PASSWORD` and add the Gmail App Password using Google Cloud Console. Grant the Cloud Run runtime service account access to that secret. Then deploy from the workspace root:

```powershell
gcloud run deploy criteria-email-api --source email-api --project criteria-18e9d --region us-central1 --allow-unauthenticated --set-env-vars "GMAIL_USER=mhpk2010@gmail.com,NOTIFICATION_EMAIL=mhpk2010@gmail.com,CORS_ORIGINS=https://criteriaa.web.app,NODE_ENV=production" --set-secrets "GMAIL_APP_PASSWORD=GMAIL_APP_PASSWORD:latest"
```

After deployment, replace `https://YOUR_CLOUD_RUN_SERVICE_URL/api/project-notification` in both `submit.html` and `C/public/submit.html` with the service URL printed by Cloud Run. Then deploy only the Hosting files from `C`:

```powershell
firebase deploy --only hosting
```

Do not run the Cloud Run or Firebase deploy commands until you approve the production deployment and any associated billing. Production CORS is restricted to `https://criteriaa.web.app`; local origins are allowed by the local `.env.example` only.