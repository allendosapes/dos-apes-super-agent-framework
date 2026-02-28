---
name: devops
description: Deployment pipelines, environment management, platform-specific
  configuration, CI/CD integration, and secrets management. Load when tasks
  involve deployment, infrastructure setup, or environment configuration.
allowed-tools: Read, Edit, Write, Bash, Grep, Glob
---

# DevOps Skill

Deployment, environments, and infrastructure. Works with the deployment target from CLAUDE.md to generate platform-appropriate configuration.

## Environment Configuration

### The Three Files

| File | Committed | Contains | Purpose |
|------|-----------|----------|---------|
| `.env.example` | Yes | Variable names + descriptions, no values | Documents all env vars the app needs |
| `.env.local` | No (gitignored) | Actual values for local dev | Developer-specific config |
| `.env.production` | No (gitignored) | Production values | Only on deploy platform |

### .env.example Template

```bash
# Required
DATABASE_URL=              # PostgreSQL connection string
API_KEY=                   # External API key (get from team vault)

# Optional
LOG_LEVEL=info             # debug | info | warn | error
PORT=3000                  # Server port
```

Every variable that the app reads must appear in `.env.example`. If a developer clones the repo and copies `.env.example` to `.env.local`, filling in the blanks should be enough to run the app.

### Startup Validation

Fail fast if required variables are missing. Check at app startup, not at first use:

```typescript
// src/config/env.ts
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  databaseUrl: requireEnv("DATABASE_URL"),
  apiKey: requireEnv("API_KEY"),
  port: parseInt(process.env.PORT || "3000", 10),
  logLevel: process.env.LOG_LEVEL || "info",
};
```

### Rules

- Never hardcode URLs, credentials, or config that varies by environment
- Use `config.databaseUrl` everywhere, never `process.env.DATABASE_URL` directly
- Validate once at startup, export typed config object
- Default only non-sensitive, non-environment-specific values (port, log level)

## Platform-Specific Patterns

Read `## Deployment` in CLAUDE.md to determine the target platform.

### Vercel

```json
// vercel.json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": null,
  "functions": {
    "api/**/*.ts": { "memory": 256, "maxDuration": 10 }
  }
}
```

- API routes go in `api/` directory as serverless functions
- Environment variables set via Vercel dashboard or `vercel env pull`
- Preview deployments auto-created for every PR
- Use `vercel.json` rewrites for SPA routing

### Railway

```toml
# railway.toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "npm start"
healthcheckPath = "/health"
healthcheckTimeout = 30
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3
```

- Nixpacks auto-detects Node.js projects; Dockerfile also supported
- Environment variables set via Railway dashboard
- PR deploy previews available via Railway environments
- Use `railway.toml` for build and deploy configuration

### Docker / Self-Hosted

```dockerfile
# Multi-stage build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "dist/index.js"]
```

```yaml
# docker-compose.yml (local dev)
services:
  app:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env.local
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: app_dev
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 3s
      retries: 5
```

```
# .dockerignore
node_modules
.git
.env*
.planning
dist
coverage
```

### Cloud (GCP / AWS / Azure)

Infrastructure as code basics — keep it simple, expand as needed:

- **Container registry:** Push Docker images to the platform's registry
- **Service definition:** GCP Cloud Run / AWS ECS / Azure Container Apps
- **Environment:** Platform-native secret/config management
- **CI deploy:** GitHub Actions workflow pushes image and updates service

```bash
# Example: GCP Cloud Run deploy (in CI)
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME
gcloud run deploy $SERVICE_NAME --image gcr.io/$PROJECT_ID/$SERVICE_NAME --region us-central1
```

Cloud CLI tools are pre-allowed in `settings.json` when the deployment target is GCP/AWS/Azure.

### GitHub Pages

```yaml
# .github/workflows/deploy-pages.yml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci && npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - uses: actions/deploy-pages@v4
```

- Configure `base` in Vite config if deploying to a subpath
- Output directory must match build tool config (`dist/` for Vite, `out/` for Next.js static)

## CI/CD Integration

Connect framework CI workflows to deployment:

```
post-merge-verify.yml (existing)
  └─ All checks pass?
       ├─ Yes → Deploy to staging (automatic)
       │        └─ Staging health check passes?
       │             ├─ Yes → Create "deploy to production" approval
       │             └─ No → Alert, do not promote
       └─ No → Block deploy, fix issues
```

### Rollback

```bash
# Re-deploy the previous known-good version
git checkout $(git describe --tags --abbrev=0 HEAD~1)  # Previous tag
# Re-run the deploy pipeline
```

For container platforms: keep the previous image tagged, redeploy it.

### Environment-Specific Tests

```bash
# Staging: run smoke tests against deployed URL
STAGING_URL=https://staging.example.com npx playwright test tests/smoke/
```

## Startup Verification

After any deployment, verify the service is running:

```bash
# 1. Health check
curl -sf "$DEPLOY_URL/health" | jq .

# 2. Critical routes respond
curl -sf "$DEPLOY_URL/api/status" -o /dev/null -w "%{http_code}" | grep -q 200

# 3. Environment is correct
curl -sf "$DEPLOY_URL/health" | jq -r .version  # Should match deployed tag
```

If any check fails, trigger rollback. Do not proceed with further post-deploy steps.

## Secrets Management

### Rules

- **Never commit secrets** — not in code, not in docker-compose, not in CI config
- Use platform-native secret stores (Vercel env, Railway env, GCP Secret Manager, AWS SSM)
- Reference `scripts/check-secrets.sh` — runs `gitleaks` to catch accidental commits
- Rotate any key immediately if it appears in git history (even if removed later)

### Secret Rotation Checklist

```
1. Generate new credential on the provider's dashboard
2. Update the secret in the deployment platform
3. Redeploy the service
4. Verify health check passes with new credential
5. Revoke the old credential
6. If the old credential was in git: consider it permanently compromised
```

## Anti-Patterns

| Pattern | Problem | Fix |
|---------|---------|-----|
| `fetch("http://localhost:3000/api")` in source | Breaks in every non-local environment | Use `config.apiUrl` from env |
| No `.dockerignore` | 500MB+ image with `node_modules` and `.git` | Add `.dockerignore` with standard excludes |
| No health endpoint | Can't verify deployment succeeded | Add `GET /health` returning `{ status: "ok" }` |
| Secrets in `docker-compose.yml` | Committed to git | Use `env_file: .env.local` (gitignored) |
| No startup env validation | Cryptic runtime errors minutes later | Validate all required vars at startup |
| `npm install` in Dockerfile | Includes devDependencies | Use `npm ci` (or `npm ci --omit=dev` for prod) |
