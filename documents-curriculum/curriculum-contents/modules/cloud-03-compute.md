# Cloud Module 03 — Azure Compute

**Days:** 5 · **Prereq:** Containers · **Checkpoint:** Cloud Checkpoint 1

## Mission brief

Now run your app on Azure and learn to pick the right host. Three PaaS/serverless options cover most .NET workloads: **App Service** (managed web apps, the default), **Azure Functions** (event-driven serverless), and **Container Apps** (managed containers with scale-to-zero + microservice features). Choosing correctly is a real interview/architecture skill.

**Bridges:** App Service ≈ "just host my web API" · Functions ≈ your event handlers, billed per execution · Container Apps ≈ your Docker image, autoscaled, without managing Kubernetes.

---

## Day blocks

### Day 1 — App Service
- [ ] **Do:** deploy your containerized API (from Module 02) to **App Service for Containers**. Configure app settings (env), enable HTTPS, and use a **deployment slot** for zero-downtime swaps.
  - **Done-when:** your API is live on an Azure URL over HTTPS, config comes from app settings, and you can swap a staging slot to production.

### Day 2 — Scaling & configuration
- [ ] **Do:** configure scale-out rules (CPU/requests), understand the App Service Plan (the billing/compute unit), and wire **Key Vault references** for secrets via managed identity.
  - **Done-when:** the app scales under load rules and reads a secret from Key Vault with no secret in config.

### Day 3 — Azure Functions
- [ ] **Build:** an HTTP-triggered and a timer-triggered Function (isolated worker, .NET 10). Understand triggers/bindings and the consumption billing model.
  - **Done-when:** two Functions deployed; you can explain when serverless beats always-on App Service.

### Day 4 — Container Apps
- [ ] **Do:** deploy the same image to **Azure Container Apps**: external ingress, revisions, and **scale-to-zero**. Compare cold-start and cost vs App Service.
  - **Done-when:** the app runs on Container Apps with ingress + at least one revision, and you can articulate the trade-off vs App Service.

### Day 5 — Decision drill + cleanup
- [ ] **Do:** write a one-page "which host and why" for three scenarios (public API, nightly batch job, spiky microservice). Tear everything down.
  - **Done-when:** your choices are defensible on cost + operational model.

---

## Checkpoint — Cloud Checkpoint 1 (closed-book, no AI)
From a fresh shell: containerize a given small API, push to ACR, and deploy it to an Azure compute service of your choice over HTTPS — under time. Pass = a working public URL + a sentence justifying the host.

## Drills
1. **appservice-deploy**: container → App Service + HTTPS from CLI, cold.
2. **func-http**: an isolated-worker HTTP Function from scratch.
3. **host-picker**: justify App Service vs Functions vs Container Apps for 3 workloads.
