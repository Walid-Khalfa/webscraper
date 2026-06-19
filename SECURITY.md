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
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `BA_CLIENT_ID`
- `BA_CLIENT_SECRET`

`.env.example` dient nur als Strukturvorlage ohne echte Geheimnisse.

## API-Schutz

Die Route-Handler nutzen jetzt:

- Runtime-Input-Validierung mit `zod`
- Rate-Limiting pro Request-Typ

## Rate-Limiting Backend

Produktionsziel:

- `Upstash Redis` als geteilter Rate-Limit-Store fuer Multi-Instance-Deployments

Aktuelles Verhalten:

- wenn `UPSTASH_REDIS_REST_URL` und `UPSTASH_REDIS_REST_TOKEN` gesetzt sind, wird Redis verwendet
- ohne diese Variablen faellt die App lokal auf In-Memory-Rate-Limiting zurueck

Hinweis: Der In-Memory-Fallback ist nur fuer lokale Entwicklung oder einfache Einzelinstanzen geeignet.
