# Sicherheit und Secrets

## Secrets

Produktions-Secrets duerfen nicht lokal in `.env` oder im Repository gepflegt werden.

Empfohlene Ablage:

- Vercel Environment Variables fuer Deployment
- 1Password Secrets Automation
- Doppler

Mindestens diese Werte gehoeren in einen Secret-Store:

- `DATABASE_URL`
- `RESEND_API_KEY`
- `CRON_SECRET`
- `BA_CLIENT_ID`
- `BA_CLIENT_SECRET`

`.env.example` dient nur als Strukturvorlage ohne echte Geheimnisse.

## API-Schutz

Die Route-Handler nutzen jetzt:

- Runtime-Input-Validierung mit `zod`
- einfaches In-Memory-Rate-Limiting pro Request-Typ

Hinweis: Das aktuelle Rate-Limiting ist fuer lokale Entwicklung und eine einfache Einzelinstanz geeignet. Fuer eine echte SaaS-Produktion sollte es durch einen zentralen Store ersetzt werden, z. B. Upstash Redis oder Vercel KV.

