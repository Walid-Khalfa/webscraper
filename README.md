# Emploi Agences App

Search German Federal Employment Agency job offers through the public job board API and export matching results as CSV.

The current public Jobsuche frontend uses:

```text
https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v6/jobs
```

with the public frontend header:

```text
X-API-Key: jobboerse-jobsuche
```

## Create The Project Structure

```powershell
mkdir emploi-agences-app
cd emploi-agences-app
mkdir backend\app\api, backend\app\models, backend\app\services, backend\app\db, backend\tests
npm create vite@latest frontend -- --template react
```

This workspace already contains the generated application under `backend/` and `frontend/`.

## Backend Setup

Use Python 3.11 for the pinned dependency set.

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Health check:

```text
http://localhost:8000/health
```

Swagger UI:

```text
http://localhost:8000/docs
```

Search endpoint:

```text
http://localhost:8000/api/jobs/search?keyword=Softwareentwickler&location=Berlin&page=1&size=25
```

CSV export endpoint:

```text
http://localhost:8000/api/jobs/export/csv?keyword=Softwareentwickler&location=Berlin
```

## SaaS Agency Alerts

The SaaS layer lets each employment agency create an isolated workspace, store search subscriptions, and receive updated offers by email.

Local email delivery is safe by default. If SMTP variables are empty, the backend records a dry-run delivery instead of sending a real email.

SMTP environment variables:

```text
SMTP_HOST=
SMTP_PORT=587
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_FROM_EMAIL=
SMTP_USE_TLS=true
BA_API_VERIFY_SSL=true
```

If your local Windows/corporate certificate store blocks the public BA API during a demo, set `BA_API_VERIFY_SSL=false` locally only. Keep it `true` in production.

Create an agency workspace:

```powershell
curl -X POST http://localhost:8000/api/agencies `
  -H "Content-Type: application/json" `
  -d '{"name":"Berlin Talent Partners","email":"agency@example.com","plan":"starter"}'
```

The response includes an `api_key`. Store it securely. Use it as `X-Agency-Key` for agency-scoped alert endpoints.

Create a daily search subscription:

```powershell
curl -X POST http://localhost:8000/api/alerts/subscriptions `
  -H "Content-Type: application/json" `
  -H "X-Agency-Key: emp_your_key_here" `
  -d '{"keyword":"Softwareentwickler","location":"Berlin","frequency":"daily","max_results":25}'
```

List subscriptions:

```powershell
curl http://localhost:8000/api/alerts/subscriptions `
  -H "X-Agency-Key: emp_your_key_here"
```

Send a digest immediately:

```powershell
curl -X POST http://localhost:8000/api/alerts/subscriptions/1/send-now `
  -H "X-Agency-Key: emp_your_key_here"
```

For production scheduling, call the digest endpoint from Railway Cron, GitHub Actions, or another managed scheduler. Keep SMTP credentials in environment variables, not in source code.

## Frontend Setup

```powershell
cd frontend
npm install
npm install axios lucide-react
npm run dev
```

Open:

```text
http://localhost:5173
```

For production builds, set the API base URL without changing code:

```powershell
$env:VITE_API_BASE_URL="https://your-backend.example.com/api/jobs"
npm run build
```

## Deployment

Railway/Vercel deployment files are included:

```text
backend/railway.json
backend/Procfile
backend/runtime.txt
frontend/vercel.json
frontend/.env.production.example
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for the exact Railway and Vercel steps.
