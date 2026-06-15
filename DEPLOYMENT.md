# Deployment Guide

This project is prepared for a Railway backend and a Vercel frontend.

## 1. Backend On Railway

Deploy the `backend/` directory as the Railway service root.

Railway environment variables:

```text
DATABASE_URL=<Railway PostgreSQL DATABASE_URL>
FRONTEND_ORIGINS=http://localhost:5173
SMTP_HOST=
SMTP_PORT=587
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_FROM_EMAIL=
SMTP_USE_TLS=true
BA_API_VERIFY_SSL=true
```

For a production-like demo, add a Railway PostgreSQL database and use its `DATABASE_URL`.

Railway will use:

```text
backend/runtime.txt
backend/railway.json
backend/Procfile
```

Health check after deploy:

```text
https://<your-railway-backend>/health
```

Swagger:

```text
https://<your-railway-backend>/docs
```

## 2. Frontend On Vercel

Deploy the `frontend/` directory as the Vercel project root.

Set this Vercel environment variable:

```text
VITE_API_BASE_URL=https://<your-railway-backend>/api/jobs
```

Vercel will use:

```text
frontend/vercel.json
```

After the frontend deploys, copy the Vercel production URL and update Railway:

```text
FRONTEND_ORIGINS=https://<your-vercel-frontend>
```

Then redeploy/restart the Railway backend so CORS uses the final frontend origin.

## Vercel-Only Demo Mode

The repository root can also be deployed directly to Vercel. This publishes:

```text
frontend/dist -> static SPA
api/index.py -> FastAPI serverless function
```

In this mode the backend uses in-memory SQLite unless you configure a durable `DATABASE_URL`. It is acceptable for a demo, but agency subscriptions are not durable across serverless cold starts.

Root Vercel deployment:

```powershell
vercel --prod
```

## 3. CLI Deployment Commands

Railway:

```powershell
npm install -g @railway/cli
railway login
cd backend
railway init
railway up
```

Vercel:

```powershell
npm install -g vercel
vercel login
cd frontend
vercel --prod
```

## 4. Demo Checklist

Backend:

```text
GET /health -> {"status":"ok"}
GET /api/jobs/search?keyword=Softwareentwickler&location=Berlin&page=1&size=25
GET /api/jobs/export/csv?keyword=Softwareentwickler&location=Berlin
```

Frontend:

```text
Search returns job cards.
Export CSV downloads a file.
Agency workspace creation returns an agency key.
Email alert creation shows a subscription.
Send now returns dry_run unless SMTP is configured.
```

## 5. Production Notes

Keep `BA_API_VERIFY_SSL=true` in production.

Configure SMTP before claiming that real e-mails are delivered:

```text
SMTP_HOST
SMTP_PORT
SMTP_USERNAME
SMTP_PASSWORD
SMTP_FROM_EMAIL
SMTP_USE_TLS
```

For paid SaaS, add Stripe or another billing provider before opening public subscriptions.
