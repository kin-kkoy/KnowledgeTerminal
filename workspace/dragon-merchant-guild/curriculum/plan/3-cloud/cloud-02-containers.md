# Cloud Module 02 — Containers

**Days:** 4 · **Prereq:** Cloud Foundations · **Tools:** Docker, Azure Container Registry

## Mission brief

A container is the portable unit modern cloud runs: your app + its exact runtime, identical on your laptop and in Azure. You touched Docker in backend Module 09; here you do it *properly* for .NET — small, secure, multi-stage images — and push to a registry so cloud compute can pull it. "Works on my machine" dies here.

**Bridges:** a Dockerfile ≈ a reproducible build script + environment · image layers ≈ caching · registry ≈ a package feed for whole apps.

---

## Day blocks

### Day 1 — Dockerize .NET the right way
- [ ] **Build:** a **multi-stage** Dockerfile for your API (SDK image builds/publishes, tiny runtime image runs). Target a minimal base (e.g. `aspnet` chiseled/Alpine), run as **non-root**, expose the port, add a `HEALTHCHECK`.
  - **Done-when:** `docker build` + `docker run` serves your API locally, image is small, and it runs as a non-root user.
- [ ] ⭐ Stretch: compare image size before/after multi-stage + chiseled; explain the attack-surface win.

### Day 2 — Compose & configuration
- [ ] **Build:** a `docker-compose.yml` running your API + a Postgres container together, wired by env vars. Confirm config comes from environment, not baked-in secrets.
  - **Done-when:** `docker compose up` gives you API + DB talking, with connection strings injected as env.

### Day 3 — Azure Container Registry (ACR)
- [ ] **Do:** create an ACR, tag your image, `az acr build` (or push), and pull it back. Understand tags/digests and why `latest` is a trap in production.
  - **Done-when:** your image lives in ACR and you can pull it by digest.

### Day 4 — Registry auth & cleanup
- [ ] **Do:** authenticate a pull using a **managed identity** (not admin creds). Set a retention/cleanup policy. Tear down.
  - **Done-when:** a pull works via managed identity with no stored registry password.

---

## Drills
1. **multistage-min**: write a multi-stage .NET Dockerfile from scratch, non-root, healthcheck.
2. **compose-api-db**: API + Postgres via compose, env-configured.
3. **acr-push-pull**: build → push → pull-by-digest via CLI.

## Where this goes
This image is what Azure compute runs next — App Service, Functions, or Container Apps.
