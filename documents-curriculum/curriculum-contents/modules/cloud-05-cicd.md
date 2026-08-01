# Cloud Module 05 — CI/CD & Infrastructure as Code

**Days:** 5 · **Prereq:** Storage & Config · **Checkpoint:** Cloud Checkpoint 2

## Mission brief

Automate everything a human would otherwise click. A pipeline (**GitHub Actions**) builds, tests, and deploys on every push; **Infrastructure as Code** (**Bicep**) defines your Azure resources declaratively so environments are reproducible and reviewable; **monitoring** (Application Insights) tells you what's happening in production. This is the "DevOps" half of the branch and a major hireability signal — "I can take code to production automatically."

**Bridges:** CI/CD ≈ your build+test discipline, triggered automatically · IaC ≈ your resources as version-controlled code (no snowflake environments) · OIDC auth ≈ passwordless CI (no long-lived cloud creds in secrets).

---

## Day blocks

### Day 1 — GitHub Actions: build & test
- [ ] **Build:** a workflow that on push restores, builds, and runs your xUnit tests; fails the PR on red. Cache dependencies.
  - **Done-when:** a failing test blocks merge; green builds are automatic.

### Day 2 — Deploy from CI (OIDC, no secrets)
- [ ] **Build:** extend the workflow to build the container, push to ACR, and deploy to your Azure compute — authenticating with **OIDC federated credentials** (no stored cloud password). Use GitHub **Environments** for a manual prod approval.
  - **Done-when:** a push to main ships to Azure with zero long-lived secrets, gated by an approval.

### Day 3 — Infrastructure as Code with Bicep
- [ ] **Build:** a Bicep template that provisions your app's resources (compute + storage + Key Vault). Deploy it, delete the resource group, redeploy — identical result.
  - **Done-when:** your whole environment stands up from one `az deployment` command, repeatably.

### Day 4 — Monitoring with Application Insights
- [ ] **Do:** wire App Insights into your API (traces, requests, dependencies), add a custom metric, and build an alert (e.g. error-rate spike). Read a live request in the portal.
  - **Done-when:** you can trace a real request end-to-end and an alert fires on a simulated error spike.

### Day 5 — Full loop + cleanup
- [ ] **Do:** push a change and watch it flow test → build → deploy → observe. Tear down via IaC.
  - **Done-when:** one commit visibly travels the whole pipeline to a monitored, live app.

---

## Checkpoint — Cloud Checkpoint 2 (closed-book, no AI)
From scratch: write a Bicep template + a GitHub Actions workflow that provisions and deploys a given small API to Azure, OIDC-authenticated, under time. Pass = one `git push` produces a live, monitored app from code alone.

## Drills
1. **actions-test-gate**: a workflow that blocks merge on a failing test.
2. **oidc-deploy**: passwordless deploy to Azure from Actions.
3. **bicep-idempotent**: destroy + redeploy an environment identically.
