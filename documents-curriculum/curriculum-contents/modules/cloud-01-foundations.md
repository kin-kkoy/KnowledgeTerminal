# Cloud Module 01 — Cloud & Azure Foundations

**Days:** 4 · **Prereq:** SPECIALIZE crossroad · **Cert path:** AZ-900 (optional warm-up) → AI-200

## Cert reality check (2026)

Microsoft is reorganizing Azure certs around AI. **AZ-204 (Developing Solutions for Azure) retires 2026-07-31.** Its successor is **AI-200 (Azure AI Cloud Developer Associate)** — ~60% overlap, but the role is re-scoped to assume AI integration is core, and its current study guide leans on Python. **Guidance:** if you're nearly ready, AZ-204 before the deadline is still a valid credential; if you're starting fresh, build the *durable Azure developer skills* below (they don't expire when a cert does) and track AI-200. Either way, the skills — compute, storage, security, CI/CD, monitoring — are what actually get you hired.

## Mission brief

Orientation before you deploy anything. Understand the cloud service model, navigate Azure with the portal *and* the CLI (scriptable = professional), grasp the resource hierarchy (subscription → resource group → resource), identity (Entra ID / RBAC), and cost control so you don't get a surprise bill while learning.

**Bridges:** resource groups ≈ a project folder for cloud stuff · RBAC ≈ authorization you learned in Module 08, at infra scale · IaaS/PaaS/serverless ≈ "how much of the stack do I manage."

---

## Day blocks

### Day 1 — The cloud model & Azure map
- [ ] **Read + note:** IaaS vs PaaS vs serverless; regions & availability zones; the core service categories (compute, storage, networking, databases, identity). Make a one-page personal map of the ~15 services you'll actually touch.
  - **Done-when:** you can explain, with an example each, when you'd pick a VM vs App Service vs Functions.

### Day 2 — Portal, CLI & the resource model
- [ ] **Do:** create a free Azure account (mind the free tier + set a budget). Create a resource group two ways — portal and `az group create`. Deploy and delete a trivial resource via CLI. Learn tagging.
  - **Done-when:** you can create/list/delete resources from the `az` CLI without the portal.

### Day 3 — Identity & RBAC
- [ ] **Do:** explore Entra ID basics, assign a role to a scope, and understand **managed identities** (your app's identity — no secrets in code). This is the security backbone for everything later.
  - **Done-when:** you can explain how an App Service authenticates to Key Vault *without* a stored password.

### Day 4 — Cost, budgets & cleanup discipline
- [ ] **Do:** set a budget + cost alert. Learn to read the cost analysis blade. Establish a habit: tear down what you're not using (`az group delete`).
  - **Done-when:** a budget alert is configured and you have a one-command teardown for each lab.

---

## Drills
1. **rg-lifecycle**: create → tag → list → delete a resource group via CLI, cold.
2. **service-picker**: given 3 app scenarios, name the right compute service and why.
3. **managed-identity-explain**: describe the passwordless auth flow aloud.

## Where this goes
Everything downstream deploys *into* this foundation. Next: containerize your app (the unit the cloud runs).
