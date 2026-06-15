# Deployment Guide

This project is configured as a standard Next.js application ready to be deployed on **Vercel**.

## Vercel Deployment

1. **Import the repository:**
   Import the root folder of this repository into a new Vercel project. Vercel will automatically detect the Next.js framework.

2. **Configure Environment Variables:**
   Set the following environment variables in Vercel Project Settings -> Environment Variables:

   ```text
   # SSL verification fallback (keep true in production)
   BA_API_VERIFY_SSL=true

   # Resend Email Integration (required for sending real digests)
   RESEND_API_KEY=re_your_resend_api_key
   EMAIL_FROM=BA Job Agent <jobs@yourverifieddomain.com>

   # Cron endpoint security
   CRON_SECRET=a_secure_random_cron_passphrase
   ```

3. **Deploy:**
   Vercel will build the application using:
   - Framework: `Next.js`
   - Build Command: `npm run build`

---

## Cron Job Scheduling

The application contains a pre-configured cron scheduler in [vercel.json](file:///c:/Users/wkhal/Desktop/WebScraper/vercel.json):

```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "crons": [
    {
      "path": "/api/cron/agents",
      "schedule": "0 6 * * *"
    }
  ]
}
```

Vercel will trigger this cron job automatically at 06:00 UTC daily. 

### Authenticating the Cron Request

To prevent third parties from triggering your digests, the endpoint `/api/cron/agents` verifies the `Authorization` header.

When Vercel calls the cron endpoint, it automatically appends a bearer token to the request. You should check Vercel's documentation on Securing Cron Jobs, or configure the `CRON_SECRET` variable in Vercel to match the secret.
The `/api/cron/agents` route extracts the `CRON_SECRET` and matches the `Authorization: Bearer <CRON_SECRET>` header.

---

## Local Verification before Deploying

To build and run the production bundle locally:

```powershell
npm run build
npm run start
```
