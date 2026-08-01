# CI/CD & IaC

Through *Cloud & Azure Foundations*, *Containers*, *Azure Compute* and *Storage & Config* you built a
real cloud setup — but you built it by hand, one `az` command and portal click at a time. This chapter
turns all of that into code and automation: a pipeline that deploys on every push (*GitHub Actions to
Azure*), files that define your infrastructure (*Bicep*), and telemetry that tells you whether any of
it actually works (*Monitoring*). It's the difference between "I deployed once" and "I run a service."

---

## 1. GitHub Actions to Azure

> ⚠ **Fast-moving area.** Action major versions (`azure/login@v2`, `azure/webapps-deploy@v3`,
> `azure/container-apps-deploy-action`, `actions/checkout@v4`, `actions/setup-dotnet@v4`) bump
> regularly, and the OIDC details keep evolving — GitHub tightens claim shapes, and Azure has been
> rolling out "flexible" federated credentials with pattern matching. The concepts below are stable;
> verify against current docs before relying on them.

### The idea

In *Deployment* (ch. 09) you built a CI workflow: a YAML file in `.github/workflows/` that GitHub runs
on every push — restore, build, test, and fail the pull request if anything is red. That workflow never
touched a server; its job was to stop broken code from merging. The missing half is **CD** — continuous
deployment: when tests pass on `main`, the same pipeline should *ship* the build to Azure, untouched by
human hands.

For that, the workflow must **authenticate to Azure**. The old way was to create a service principal
(a robot account in Microsoft Entra ID — the identity system you met in *Cloud & Azure Foundations*),
generate a password for it, and paste that password into GitHub repository secrets. It works, but now
a long-lived credential that can deploy to your cloud sits in GitHub forever: it can leak in a fork, a
log, or a compromised action, and it silently expires and breaks your pipeline months later.

The modern way is **OIDC federated credentials** — the same idea as the managed identity you used in
*Storage & Config*, extended across companies. You tell Entra ID: "if GitHub presents a signed token
proving *this workflow run comes from repo X on branch Y*, treat it as this identity — no password
needed." Each run, GitHub mints a short-lived token; Azure verifies GitHub's signature and the claims
inside it, then issues a short-lived Azure token in exchange. Nothing long-lived is stored anywhere.
The three IDs you *do* put in GitHub (client, tenant, subscription) are addresses, not secrets —
knowing them grants nothing.

The last piece is **environments**: GitHub lets you name deployment targets (`staging`, `production`)
and attach rules to each — most usefully *required reviewers*, so a deploy job targeting production
pauses until a human clicks Approve. That's how teams get "every merge deploys to staging
automatically, but production needs a sign-off" without any extra tooling.

### In practice

One-time setup, from the shell (you have `az` from *Cloud & Azure Foundations*). First create the
robot identity and let it deploy into your resource group:

```bash
# 1. An Entra ID application + service principal (the identity the workflow will become)
az ad app create --display-name todo-deployer
# note the "appId" in the output — that's your CLIENT_ID
az ad sp create --id <CLIENT_ID>

# 2. Permission: let it manage resources in your resource group (RBAC from ch. 11)
az role assignment create --assignee <CLIENT_ID> --role Contributor \
  --scope /subscriptions/<SUB_ID>/resourceGroups/todo-rg
```

Then the federated credential — the "trust GitHub" rule. The `subject` must match exactly what
GitHub's token will claim about itself:

```bash
az ad app federated-credential create --id <CLIENT_ID> --parameters '{
  "name": "github-main",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:<your-gh-user>/todo-api:ref:refs/heads/main",
  "audiences": ["api://AzureADTokenExchange"]
}'
```

That `subject` reads: only workflow runs from the `todo-api` repo, on the `main` branch. A run from a
fork or another branch presents a different subject and is refused. (If you gate a deploy job behind a
GitHub environment, the subject becomes `repo:<user>/<repo>:environment:<env-name>` instead — create
one federated credential per subject you want to trust.)

Finally, store the three non-secret IDs as repository **variables** (Settings → Secrets and variables
→ Actions → Variables): `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`.

Now the full workflow — build, test, then deploy the container to the App Service you created in
*Azure Compute*, via the ACR from *Containers*:

```yaml
name: build-test-deploy
on:
  push:
    branches: [main]

permissions:
  id-token: write      # let this run request an OIDC token from GitHub
  contents: read       # checkout needs to read the repo

jobs:
  build-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '10.0.x'
      - run: dotnet restore
      - run: dotnet build --no-restore -c Release
      - run: dotnet test --no-build -c Release     # red tests stop the pipeline HERE

  deploy:
    needs: build-test                # never deploys if build-test failed
    runs-on: ubuntu-latest
    environment: production          # pauses for approval if the environment requires it
    steps:
      - uses: actions/checkout@v4

      - uses: azure/login@v2         # OIDC exchange happens inside this step
        with:
          client-id: ${{ vars.AZURE_CLIENT_ID }}
          tenant-id: ${{ vars.AZURE_TENANT_ID }}
          subscription-id: ${{ vars.AZURE_SUBSCRIPTION_ID }}

      # Build the image in the cloud (no Docker needed on the runner) and push to ACR
      - run: az acr build --registry todoregistry --image todo-api:${{ github.sha }} .

      # Point the web app at the new tag
      - run: |
          az webapp config container set --name todo-api-<yourname> \
            --resource-group todo-rg \
            --container-image-name todoregistry.azurecr.io/todo-api:${{ github.sha }}
```

Expected output (the Actions tab, condensed):

```text
build-test   ✓  2m 04s   Passed: 17, Failed: 0
deploy       ✓  1m 41s
  Az CLI Login             ✓  Login successful.
  az acr build ...         ✓  Run ID: cb1 was successful after 58s
  az webapp config ...     ✓
```

Details worth noticing:

- `permissions: id-token: write` is what lets the run mint an OIDC token. Forget it and
  `azure/login` fails with a "not able to get a federated token" error.
- Tagging with `${{ github.sha }}` (the commit hash) makes every deploy traceable to an exact commit
  — and rollback is "set the container image back to the previous SHA."
- `needs: build-test` is the ordering guarantee: no green tests, no deploy. Never ship red.
- To require approval: repo Settings → Environments → New environment `production` → Required
  reviewers → add yourself. The deploy job now shows "Waiting for review" until approved — and
  remember the matching `environment:...` federated credential.
- Deploying a *non*-container app? Replace the two `az` steps with `dotnet publish` plus
  `azure/webapps-deploy@v3` (give it `app-name` and a `package:` path to the publish output). For
  the Container Apps flavor from *Azure Compute*, the same login works and the update step becomes
  `az containerapp update --name ... --image ...` (or the `azure/container-apps-deploy-action`,
  which wraps build-and-deploy in one step).

> **C corner:** a workflow file is morally a Makefile that runs on someone else's machine: jobs are
> targets, `needs:` is a dependency edge, and every run starts from a clean tree — so anything not
> committed or produced by a step simply doesn't exist. The habits transfer directly.

**Try it — Azure:** prerequisites: the App Service (or Container App) and ACR from chapters 12–13
still exist, and your API repo is on GitHub. Run the setup commands above, add the workflow, push a
visible change (bump a version string in an endpoint) to `main`, and watch the Actions tab until the
change is live at your public URL. Then add a `production` environment with yourself as required
reviewer (plus its federated credential) and push again — confirm it waits for your approval. Cost:
pipeline minutes are free for public repos (generous free tier for private); Azure cost is unchanged
from what's already running — delete the resource group when done, as always.

**Traps**

- **Pasting a client secret into GitHub anyway.** If a tutorial says "create a secret and store
  `AZURE_CREDENTIALS`," it's showing the legacy path. You now know the better one; use it.
- **Subject mismatch.** The federated credential's `subject` must match the run exactly — branch
  renamed, repo transferred, or deploying via an `environment:` you didn't create a credential for →
  `AADSTS700213`-style "no matching federated identity record" errors. The error message quotes the
  presented subject; it tells you exactly what to trust.
- **Missing `permissions:` block.** Adding *any* explicit `permissions:` key resets everything not
  listed to none. `id-token: write` must be present for the workflow (or the job) doing the login.
- **Deploying from pull requests.** Trigger CD from `push` to `main` (or releases), never from
  `pull_request` — PR builds run untrusted code; they should test, not touch, your cloud.

---

## 2. Infrastructure as Code (Bicep)

> ⚠ **Fast-moving area.** Resource `@api-version` strings churn constantly (the ones below were
> current at time of writing), and the Bicep language itself gains functions and decorators several
> times a year. The concepts below are stable; verify against current docs — and let the VS Code
> Bicep extension suggest current API versions — before relying on them.

### The idea

Everything you've provisioned since *Cloud & Azure Foundations* — the plan, the web app, the
registry, Key Vault — exists only because you once typed the right commands in the right order.
That has three failure modes. You can't **reproduce** it: standing up an identical staging
environment means re-remembering every step. You can't **review** it: nobody can code-review a portal
click. And it **drifts**: six months of "quick fixes" in the portal, and nobody knows what the
environment actually is anymore, let alone how to rebuild it after a disaster.

**Infrastructure as Code** fixes all three: describe the *desired end state* of your infrastructure
in files, commit them next to your app, and have a tool make reality match the files. Note the shape:
IaC is **declarative** — you say *what should exist*, not the steps to create it. That's what makes it
**idempotent**: apply the same file twice and the second run changes nothing, because reality already
matches. A script of `az create` commands doesn't have that property — run it twice and it errors on
things that already exist.

Azure's native engine for this is **ARM** (Azure Resource Manager) — every portal click and `az`
command you've ever issued ultimately became an ARM API call. ARM accepts desired-state *templates*,
but its native template format is verbose JSON. **Bicep** is a clean language that compiles to those
templates: same engine, same resources, human-friendly syntax. (The main alternative, Terraform, is
the same idea with its own language, working across cloud providers; learn Bicep and the concepts
transfer wholesale.)

### In practice

Here is a real `main.bicep` defining the core of your to-do infrastructure — the App Service plan and
web app from *Azure Compute* plus the container registry from *Containers*. Read it, then the
line-by-line notes below.

```bicep
// ---- Parameters: the knobs callers can turn ----
param location string = resourceGroup().location   // default: same region as the resource group
param appName string                               // no default → must be supplied
@allowed(['B1', 'P0v3'])                           // decorator: restrict legal values
param skuName string = 'B1'

// ---- Variables: computed once, used below ----
var registryName = replace('${appName}registry', '-', '')  // ACR names: alphanumeric only

// ---- Resources: what must exist ----
resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: registryName
  location: location
  sku: { name: 'Basic' }
}

resource plan 'Microsoft.Web/serverfarms@2024-11-01' = {
  name: '${appName}-plan'
  location: location
  kind: 'linux'
  sku: { name: skuName }
  properties: { reserved: true }        // 'reserved' is ARM-speak for a Linux plan
}

resource site 'Microsoft.Web/sites@2024-11-01' = {
  name: appName
  location: location
  properties: {
    serverFarmId: plan.id               // referencing plan.id creates the dependency:
    siteConfig: {                       // Bicep deploys the plan first, automatically
      linuxFxVersion: 'DOCKER|${acr.properties.loginServer}/todo-api:latest'
    }
    httpsOnly: true
  }
  identity: { type: 'SystemAssigned' }  // managed identity, as used in ch. 14 for Key Vault
}

// ---- Outputs: values the caller gets back ----
output siteUrl string = 'https://${site.properties.defaultHostName}'
output registryLoginServer string = acr.properties.loginServer
```

Reading a `resource` block: the symbolic name (`acr`, `plan`, `site`) is how *other lines in this
file* refer to it; the string after it — `'Microsoft.Web/sites@2024-11-01'` — is the resource **type
and API version** (which version of Azure's contract for that type you're writing against); the body
is the desired state. When one resource references another (`plan.id`, `acr.properties.loginServer`),
Bicep infers the deployment order for you — no manual "depends on" bookkeeping. String interpolation
is `'${expr}'` inside single quotes, and `//` comments work — neither exists in the JSON ARM format,
which is half the reason Bicep exists.

Deploy it into a resource group (create the group first — that's the one thing the file doesn't do,
because a *group-scoped* deployment happens inside one):

```bash
az group create --name todo-rg --location southeastasia
az deployment group create \
  --resource-group todo-rg \
  --template-file main.bicep \
  --parameters appName=todo-api-yourname
```

Expected output (heavily trimmed — the real thing is a large JSON document):

```text
{
  "properties": {
    "provisioningState": "Succeeded",
    "outputs": {
      "siteUrl": { "value": "https://todo-api-yourname.azurewebsites.net" },
      "registryLoginServer": { "value": "todoapiyournameregistry.azurecr.io" }
    }
  }
}
```

Run the exact same command again: it completes faster and changes nothing — reality already matches
the file. *That* is idempotency, and it's why teams run their Bicep on every release (often as a step
in the section-1 pipeline, right after `azure/login`): the deploy doubles as a drift-repair.

Before applying a change, preview it. **What-if** asks ARM to diff the file against reality without
touching anything:

```bash
az deployment group what-if --resource-group todo-rg \
  --template-file main.bicep --parameters appName=todo-api-yourname skuName=P0v3
```

```text
Resource changes: 1 to modify, 2 no change.

  ~ Microsoft.Web/serverfarms/todo-api-yourname-plan
    ~ sku.name: "B1" => "P0v3"
```

`~` modify, `+` create, `-` delete. Reading a what-if before every infra deploy is the IaC equivalent
of reading a diff before committing — and it's how you catch "this change would *delete* the
database" before it happens.

> **C corner:** declarative-vs-imperative has a C-adjacent analogue: a Bicep file is to `az` commands
> what a `.h`-described data layout is to the `malloc`/assignment sequence that builds it. You state
> the invariant; the toolchain figures out the operations. And `what-if` is your `-Wall` — free
> warnings, always on.

**Try it — Azure:** prerequisites: `az` logged in; add Bicep support with `az bicep install` (and the
Bicep VS Code extension if you're editing locally — its autocomplete for resource properties is the
best documentation there is). Save the file above, deploy it into a fresh `todo-rg2`, and open the
outputs' `siteUrl`. Then the payoff move: `az group delete --name todo-rg2 --yes`, wait, and redeploy
from the same file — the identical environment comes back from code. Finish by changing `skuName` and
running `what-if` to see the diff *without* applying it. Cost: B1 is a few dollars a month prorated
hourly and Basic ACR similar — delete the group the same day and it's cents.

**Traps**

- **Mixing portal edits with IaC.** Once a resource is in Bicep, hand-edits are drift the next deploy
  silently reverts. The rule: change the file, redeploy — never "just quickly fix it in the portal."
- **Treating deletion as symmetric.** By default, removing a resource *from the file* does **not**
  delete it from Azure (that's "incremental" deployment mode). Deleting things is a deliberate act —
  `az resource delete`, or a complete-mode deployment that makes the file the whole truth. Know which
  mode you're in before you assume.
- **Hardcoding names that must be globally unique.** Web app and registry names share global
  namespaces (they become URLs). Parameterize them, or derive them with
  `uniqueString(resourceGroup().id)` — a Bicep function that hashes the group ID into a stable
  13-character suffix.
- **Secrets in parameters.** Never put a password in a `.bicep` or parameters file headed for git.
  Mark such params `@secure()` and feed them at deploy time — or better, avoid secret-shaped config
  entirely with managed identity + Key Vault, as in *Storage & Config*.

---

## 3. Monitoring

> ⚠ **Fast-moving area.** Azure's telemetry stack is mid-migration: the classic Application Insights
> SDK is legacy, and the **Azure Monitor OpenTelemetry Distro** is the recommended path for new .NET
> apps, with package names, defaults, and agent-based options still evolving. The concepts below are
> stable; verify against current docs before relying on them.

### The idea

A deployed service you can't see into is a liability: your first sign of trouble is a user complaint,
and your debugging tool is guesswork. **Observability** is the fix, and it rests on three kinds of
signal, worth keeping distinct:

- **Logs** — timestamped statements about discrete events ("order 4123 rejected: card declined").
  You've emitted these since *ASP.NET Core* via `ILogger`. Great for *what happened*; expensive to
  read in bulk.
- **Metrics** — cheap numbers over time (requests/sec, p95 latency, error rate, CPU). Great for *is
  it healthy right now* and for alerting; useless for *why*.
- **Traces** — the path of one request through the system, split into timed spans ("HTTP POST /todos
  120 ms, of which SQL INSERT 90 ms"). Great for *where the time went*, including across services.

**Application Insights** is Azure's service for all three. Your app sends telemetry to an Application
Insights resource, which stores it in a **Log Analytics workspace** (the storage-and-query backend —
"workspace-based" is the only mode that matters now; the old standalone "classic" mode is retired)
and gives you dashboards, search, and alerting on top. The direction of travel: apps emit telemetry
via **OpenTelemetry** — the vendor-neutral industry standard for all three signals — and Application
Insights is one possible backend for it. That's why the recommended .NET package is Microsoft's
OpenTelemetry *distro* (a curated bundle of OpenTelemetry pieces plus an Azure exporter) rather than
a proprietary SDK.

The habit this section is really teaching: **check the telemetry before guessing.** "It's probably
the database" is a hypothesis; the dependency chart is an answer.

### In practice

Create the resources and get the connection string (the address your app sends telemetry to — put it
in App Service settings like any config value from *Storage & Config*):

```bash
az monitor log-analytics workspace create --resource-group todo-rg --workspace-name todo-logs
az monitor app-insights component create --app todo-ai --resource-group todo-rg \
  --location southeastasia --workspace todo-logs
az monitor app-insights component show --app todo-ai --resource-group todo-rg \
  --query connectionString --output tsv
```

```text
InstrumentationKey=1a2b3c4d-...;IngestionEndpoint=https://southeastasia-1.in.applicationinsights.azure.com/;...
```

Wire it into the API — one package, one line:

```bash
dotnet add package Azure.Monitor.OpenTelemetry.AspNetCore
```

```csharp
using Azure.Monitor.OpenTelemetry.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

// Reads APPLICATIONINSIGHTS_CONNECTION_STRING from configuration.
builder.Services.AddOpenTelemetry().UseAzureMonitor();

var app = builder.Build();
app.MapGet("/todos", (ILogger<Program> log) =>
{
    log.LogInformation("Listing todos");          // ILogger flows to App Insights automatically
    return Results.Ok(new[] { "ship it" });
});
app.Run();
```

That single `UseAzureMonitor()` call gets you, with zero further code: every **incoming request**
(URL, status, duration), every **dependency call** (outbound HTTP via `HttpClient`, SQL via EF Core —
with timings), every **unhandled exception** with stack trace, standard **metrics**, your
**`ILogger` logs**, and **distributed tracing** — if your API calls another instrumented service, the
correlation ID travels in the HTTP headers and the whole journey appears as one trace.

To *ask questions* of that telemetry you use **KQL** (Kusto Query Language) in the resource's
**Logs** blade. It reads like LINQ piped through a shell: a table name, then `|`-chained operators.
Three queries and what they answer:

```kql
// "What's failing right now?" — failed requests in the last hour, worst first
requests
| where timestamp > ago(1h) and success == false
| summarize count() by name, resultCode
| order by count_ desc
```

```kql
// "Which endpoints are slow?" — p50/p95 duration per endpoint over 24h
requests
| where timestamp > ago(24h)
| summarize p50 = percentile(duration, 50), p95 = percentile(duration, 95) by name
| order by p95 desc
```

```kql
// "Is it us or the database?" — time spent in dependencies, by target
dependencies
| where timestamp > ago(24h)
| summarize avg(duration), count() by target, type
```

Expected output for the second (a table; append `| render barchart` for a picture):

```text
name                p50     p95
GET /todos          41.2    187.9
POST /todos         55.0    612.3
```

A p95 ten times the p50 on `POST /todos` is a *finding* — some requests hit a slow path. Click into
one slow request's end-to-end trace and the span breakdown shows which dependency ate the time.
That's "check the telemetry before guessing," operationalized.

Finally, **alerts** — so the telemetry checks *you*. An alert rule is a metric or query + threshold +
action (email, webhook, on-call page):

```bash
az monitor metrics alert create --name high-error-rate \
  --resource-group todo-rg \
  --scopes $(az monitor app-insights component show --app todo-ai -g todo-rg --query id -o tsv) \
  --condition "count requests/failed > 5" \
  --window-size 5m --evaluation-frequency 1m \
  --description "More than 5 failed requests in 5 minutes"
```

Add an *action group* (Portal: Monitor → Alerts → Action groups) with your email, attach it to the
rule, and a burst of failures now lands in your inbox before it lands in a user's tweet.

**Try it — Azure:** prerequisites: the deployed API from section 1 and ~15 minutes (telemetry
ingestion lags a few minutes — that's normal, not breakage). Create the workspace + App Insights
resource, set `APPLICATIONINSIGHTS_CONNECTION_STRING` in App Service configuration, add the package
and `UseAzureMonitor()`, and let your section-1 pipeline ship it. Generate traffic — a shell loop of
`curl` against your endpoints, including a nonexistent route for 404s and, ideally, a temporary
endpoint that throws. Then: find the exception with its stack trace in the portal, run the three KQL
queries, and create the alert + action group and trip it with a failure burst. Cost: App Insights
bills per GB ingested with a monthly free grant a lab won't dent; Log Analytics likewise. Delete the
resource group when done.

**Traps**

- **Following pre-OpenTelemetry tutorials.** Anything built on the
  `Microsoft.ApplicationInsights.AspNetCore` package and `AddApplicationInsightsTelemetry()` still
  works but is the legacy path. New code: OpenTelemetry distro. (⚠ names here churn — this is the
  fast-moving part.)
- **Expecting telemetry instantly.** Minutes of ingestion delay are normal. The one live view is
  **Live Metrics** in the portal — use it during a deploy, use Logs for everything else.
- **Logging noise, alerting on everything.** If every deploy pages you, you'll ignore the page that
  matters. Alert on user-visible symptoms (error rate, latency), not on every internal warning; keep
  log levels honest (`LogInformation` for events, `LogDebug` for spelunking).
- **Cost surprise under real load.** Telemetry is billed by volume; a busy service can ingest a lot.
  The knob is **sampling** (keeping a statistically fair fraction of telemetry) — the distro supports
  it; know it exists before you get the bill.

---

## Check yourself

One honest question per topic — if the answer is yes, tick the node; when all three are ticked, tick
the chapter.

- Could you take a repo with working CI and, without a guide, get it deploying to Azure on merge —
  federated credential set up, OIDC login in the workflow, image tagged by commit SHA, production
  gated behind an approval? If yes, tick *GitHub Actions to Azure* above.
- Could you write a Bicep file for a plan + web app + registry from scratch, deploy it, explain why
  running it twice is safe, and use `what-if` to preview a change — and could you recreate your whole
  environment after deleting the resource group? If yes, tick *Infrastructure as Code (Bicep)* above.
- Could you wire Application Insights into an ASP.NET Core app via the OpenTelemetry distro, say what
  you get without writing code, answer "what's slow and what's failing" with KQL instead of guessing,
  and set an alert that fires before users complain? If yes, tick *Monitoring* above.

All three ticked? Tick the chapter. Ahead sits the second cloud checkpoint, **cpc2** — standing up an
environment cold, from Bicep plus a pipeline, closed-book. See *Checkpoints & Defenses* for the
format, and give yourself a day before attempting it: this chapter is exactly the kind of material
that feels learned until you try it from memory.
