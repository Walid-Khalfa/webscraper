# Emploi Agences App (Unified Next.js Portal)

Search German Federal Employment Agency job offers through the public job board API, view normalized salary ranges, and export matching results as CSV.

This project is a unified **Next.js 14 App Router** application hosting both the interactive React dashboard and its Node.js API endpoints.

---

## Technical Features

1. **Job Search & Normalization:** Connects to the public Bundesagentur für Arbeit API with a robust fallback mechanism (supports OAuth and public key API headers). Standardizes response fields, normalizes salary indications to standard Euros (EUR), and handles paging and location filtering.
2. **CSV Export:** Fetches up to 200 jobs across two pages and packages them into a clean, downloadable CSV format with UTF-8 encoding.
3. **SaaS Agency Alerts:** Allows recruitment agencies to:
   - Create a local workspace and obtain an agency API key (`X-Agency-Key`).
   - Subscribe to search criteria (keyword, location, frequency).
   - Receive a daily digest of new matching job offers via email.
4. **Cron Job / Scheduler:** Includes an automated endpoint to trigger digests for all active agency subscriptions.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18.x or v20.x recommended)

### Local Development

1. **Install dependencies:**
   ```powershell
   npm install
   ```

2. **Configure environment variables:**
   Create a `.env.local` file in the root directory (optional, only needed if configuring official BA OAuth, Resend, or Cron security):
   ```text
   # Bundesagentur für Arbeit API (Optional OAuth - falls vorhanden)
   BA_CLIENT_ID=
   BA_CLIENT_SECRET=
   BA_TOKEN_URL=

   # SSL verification fallback (set to false if local certs block public BA API)
   BA_API_VERIFY_SSL=true

   # Email service (Resend API)
   RESEND_API_KEY=
   EMAIL_FROM=BA Job Agent <jobs@example.com>

   # Cron authentication secret
   CRON_SECRET=my_secret_cron_passphrase
   ```

3. **Start the development server:**
   ```powershell
   npm run dev
   ```

4. **Open the browser:**
   Go to [http://localhost:3000](http://localhost:3000). The app is localized in German.

---

## API Documentation

### 1. Job Search
- **Endpoint:** `GET /api/jobs/search`
- **Params:** `keyword` (e.g. `Softwareentwickler`), `location` (e.g. `Berlin`), `page`, `size`, `exactLocation` (boolean)
- **Response:** JSON payload of normalized search results.

### 2. Export CSV
- **Endpoint:** `GET /api/jobs/export/csv`
- **Params:** `keyword`, `location`, `exactLocation`
- **Response:** `text/csv` stream with a dynamically named attachment.

### 3. Agencies & Alert Subscriptions
- **Create Agency Workspace:** `POST /api/agencies`
  - Body: `{"name": "Agency Name", "email": "agency@example.com", "plan": "starter"}`
  - Returns: `{"api_key": "emp_..."}` (required for X-Agency-Key header).
- **Create Alert Subscription:** `POST /api/alerts/subscriptions`
  - Header: `X-Agency-Key: emp_...`
  - Body: `{"keyword": "Softwareentwickler", "location": "Berlin", "frequency": "daily", "max_results": 25}`
- **Trigger Digest Immediately:** `POST /api/alerts/subscriptions/:id/send-now`
  - Header: `X-Agency-Key: emp_...`
  - Delivers (or dry-runs) a custom HTML email digest with the top matching offers.

### 4. Scheduler / Cron
- **Endpoint:** `GET /api/cron/agents`
- **Headers:** `Authorization: Bearer <CRON_SECRET>` (if `CRON_SECRET` is configured in env)
- **Action:** Iterates through all active subscriptions, executes queries, compiles digests, sends emails, and registers delivery statuses in the store.
