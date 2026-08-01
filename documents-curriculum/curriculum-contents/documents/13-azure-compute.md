# Azure Compute

In *Containers* you pushed your to-do API's image to ACR; in *Cloud & Azure Foundations* you learned
the IaaS→PaaS→serverless ladder. This chapter is where those meet: **three managed ways to run that
same API** — App Service (classic PaaS), Azure Functions (serverless, event-driven), Container Apps
(serverless containers). Each is taught from zero; the real skill is the closing comparison — being
able to *justify* which host a given workload belongs on.

| | App Service | Azure Functions | Container Apps |
|---|---|---|---|
| Unit you deploy | an app (code or container) | individual functions | a container image |
| Runs | always on (per plan) | per event | per demand, can idle at zero |
| Billing shape | per plan-hour | per execution/instance time | per vCPU-second + requests |
| Scale to zero | no | yes | yes (optional) |
| Best at | ordinary always-on web APIs | bursty, event/timer-driven jobs | microservices, workers, growth |

---

## 1. App Service

> ⚠ **Fast-moving area.** Plan SKU names and prices churn (Basic/Standard/Premium generations get
> replaced), and the runtime picker lags each .NET release — a new major version can wear a
> "Preview" tag on App Service for months after it's GA everywhere else. The concepts below are
> stable; verify against current Azure docs before relying on them.

### The idea

**Azure App Service** is PaaS for web apps: you hand it your app — either source code or the
container image you built last chapter — and it owns the OS, the web server, TLS certificates,
patching, and restarts. Your ASP.NET Core app runs exactly as it did locally; only the hosting is
outsourced. (If you deploy *source*, the platform also controls exactly which .NET patch version
you run — one more reason the container route you already know is the predictable one.)

The one structural concept is the **App Service plan**. The *plan* is the actual compute — a set of
VM-backed workers of some size — and your *web apps* are tenants on it. You pay for the plan
whether apps are busy or not, and several apps can share one plan. Plans come in tiers (**SKUs**):

- **Free (F1)** — shared compute, minutes-per-day quota. For kicking tires only.
- **Basic (B1…)** — dedicated small VMs. Cheapest tier that runs custom containers. No slots.
- **Standard (S1…)** — adds **deployment slots** and autoscale. The historic "production floor".
- **Premium (v3/v4…)** — faster hardware, more slots, VNet features. The generation letters are
  exactly the kind of thing that churns; the *tier ladder* concept doesn't.

Two features you will use constantly:

**App settings are environment variables.** In *ASP.NET Core* you saw that `IConfiguration` layers
`appsettings.json` under environment variables. App Service injects its "app settings" as
environment variables, so cloud config overrides your JSON with **zero code changes**. Nesting uses
a double underscore: the env var `ConnectionStrings__Db` arrives as `ConnectionStrings:Db`.

**Deployment slots** are parallel copies of your app on the same plan (e.g. `staging`). You deploy
to the slot, warm it up, smoke-test it on its own URL, then **swap** — Azure repoints production at
the warmed slot instantly. Bad release? Swap back. That's zero-downtime deploys plus instant
rollback, for free (given Standard or above).

Finally, two different words both called "scaling":

- **Scale up** — a bigger SKU (B1 → S1 → P…): more CPU/RAM per worker. Vertical. Changes the price
  per hour.
- **Scale out** — more instances of the same SKU behind the built-in load balancer. Horizontal.
  This is the one autoscale rules drive (CPU %, request queue length).

### In practice

Deploy the `todo-api:v1` image you pushed to ACR in *Containers*. Everything below is the `az` CLI
from *Cloud & Azure Foundations*; run it in any shell where you've done `az login`.

```bash
az group create --name todo-rg --location southeastasia

# The plan = the compute. B1 Linux: cheapest tier that runs custom containers (~$13/mo — delete after!).
az appservice plan create --name todo-plan --resource-group todo-rg \
    --sku B1 --is-linux

# The web app = your container on that plan.
az webapp create --name todo-api-<yourname> --resource-group todo-rg \
    --plan todo-plan \
    --container-image-name todoregistry.azurecr.io/todo-api:v1 \
    --assign-identity [system] --acr-use-identity --acr-identity [system]
```

App names are globally unique (they become `<name>.azurewebsites.net`), hence the `<yourname>`
suffix. The identity flags let the app pull from your private ACR using a **managed identity** — an
Azure-issued identity for the app itself, so no registry password lives anywhere. Expected tail of
the output (JSON, abridged):

```text
{
  "defaultHostName": "todo-api-<yourname>.azurewebsites.net",
  "state": "Running",
  ...
}
```

Now configuration and a first request:

```bash
az webapp config appsettings set --name todo-api-<yourname> --resource-group todo-rg \
    --settings ConnectionStrings__Db="Host=...;Database=todo" Jwt__Key="dev-only-key"

curl https://todo-api-<yourname>.azurewebsites.net/todos
```

```text
[]
```

An empty JSON array from your own API on a public HTTPS URL — TLS certificate included, nothing
configured. (The first hit may take ~30 s while the image is pulled and the container starts.)

Slots and the swap (needs `--sku S1` or higher on the plan):

```bash
az webapp deployment slot create --name todo-api-<yourname> --resource-group todo-rg \
    --slot staging
az webapp config container set --name todo-api-<yourname> --resource-group todo-rg \
    --slot staging --container-image-name todoregistry.azurecr.io/todo-api:v2

curl https://todo-api-<yourname>-staging.azurewebsites.net/todos   # smoke-test v2

az webapp deployment slot swap --name todo-api-<yourname> --resource-group todo-rg \
    --slot staging --target-slot production
```

After the swap, production serves `:v2` with no dropped requests; `staging` now holds `:v1` — your
instant rollback. Scaling, both directions:

```bash
az appservice plan update --name todo-plan --resource-group todo-rg --sku S1   # up
az appservice plan update --name todo-plan --resource-group todo-rg \
    --number-of-workers 3                                                      # out
```

> **C corner:** an App Service plan is like a machine you've leased by the hour: the meter runs
> whether your process is busy or `select()`-blocked at 0% CPU. Scale-out is `fork()` onto more
> leased machines behind a load balancer — same binary, more copies. The serverless services below
> are the opposite deal: no lease, you pay per call.

### Try it — Azure

*Prerequisites: an Azure subscription with the free-account credit (from Foundations), `az login`,
and your ACR images from Containers. Cost note: B1 is **not** free (~$0.02/hr) — this whole
exercise costs cents if you delete the resource group the same day.*

1. Run the walkthrough above: plan (B1), web app from your `:v1` image, app settings for the
   connection string and JWT key, `curl` the public URL.
2. Scale up to S1, create a `staging` slot, point it at `:v2`, and swap. Confirm production changed
   *without an error in between* by curling in a loop during the swap.
3. Tear down: `az group delete --name todo-rg --yes` — this is the habit that keeps Azure cheap.

### Traps

- **Paying for the plan, not the app.** Deleting a web app but keeping the plan keeps billing. The
  plan is the money; always check `az appservice plan list` when hunting costs.
- **`:` instead of `__` in app settings.** `ConnectionStrings:Db` is an invalid env-var name on
  Linux; the setting silently never arrives and your app falls back to `appsettings.json`. Always
  double-underscore.
- **Swapping a cold slot.** The point of a slot is swapping something *warm*. Deploy, hit it a few
  times, then swap — or the "zero-downtime" deploy greets users with a cold start anyway.
- **Scaling out a stateful app.** With 3 instances, in-memory session/cache state exists on one of
  them. Your API is fine *because* you kept it stateless with JWTs (*Auth & Security*) — keep it
  that way.

**Verdict — when to pick App Service:** a normal, always-on web API or site, one team, minimal
platform learning. It's the least-surprise default for exactly the kind of app your to-do API is.

---

## 2. Azure Functions

> ⚠ **Fast-moving area.** Hosting plans churn hardest here: the classic Consumption plan is legacy
> (Linux Consumption is scheduled to retire outright), **Flex Consumption** is the recommended
> serverless plan, and the old **in-process** C# model is retired — support ends 10 November 2026,
> and it never supported .NET 10 at all. Only the **isolated worker** model carries forward.
> Trigger attribute names occasionally shift between package versions. The concepts below are
> stable; verify against current Azure docs before relying on them.

### The idea

App Service runs an *app* that waits for requests. **Azure Functions** inverts that: you write
individual methods, declare what *event* should run each one, and Azure runs a method **only when
its event fires** — billing you for execution, scaling to zero when idle, and scaling out
automatically under load. This is the FaaS rung of the ladder from *Cloud & Azure Foundations*.

Two words carry the whole model:

- A **trigger** is the event that *starts* a function — an HTTP request, a timer, a queue message
  arriving, a blob being uploaded. Exactly one per function, declared as an attribute on a
  parameter.
- A **binding** is declarative plumbing for input/output — "also hand me this blob", "whatever I
  return, write it to that queue" — again attributes, no SDK boilerplate.

The **isolated worker model** is what those words run in, and it matters for your C#: your function
app is a **normal .NET console project that you own**. It has a `Program.cs`; you build a host with
the same builder pattern as ASP.NET Core; you register services in the same DI container you know
from *ASP.NET Core*. The Functions *host* (Azure's process) sits in front, listens for events, and
forwards each invocation to your worker process over gRPC. Because the worker is yours, you pick
the .NET version (this book's .NET 10 is fine) and no Azure assembly versions are forced into your
process — which is precisely why the older model, where your code was loaded *inside* the host, was
retired.

On hosting: Functions can technically run on an App Service plan (always-on, no cold starts, but
you're back to paying for idle). The serverless default to reach for is **Flex Consumption** —
per-execution billing with a monthly free grant, faster scale-out, and milder cold starts than the
legacy Consumption plan it replaces. It only accepts the isolated worker model, which settles that
choice too.

**Cold starts** are the tax for scale-to-zero: after idle, the first event must wait for Azure to
allocate an instance and start your worker — typically a noticeable sub-second-to-seconds pause.
Irrelevant for a queue worker or a nightly job; user-visible on a latency-sensitive API.

### In practice

A function app is scaffolded by the **Azure Functions Core Tools** (`func`, a free local CLI —
installable via winget/apt/brew; this is the one extra tool this chapter needs):

```bash
func init NotifyFunctions --worker-runtime dotnet-isolated
cd NotifyFunctions
func new --template "HTTP trigger" --name Hello
```

The `Program.cs` it generates is the isolated model in miniature — recognizably the same shape as
your API's:

```csharp
using Microsoft.Azure.Functions.Worker.Builder;
using Microsoft.Extensions.Hosting;

var builder = FunctionsApplication.CreateBuilder(args);
builder.ConfigureFunctionsWebApplication();   // ASP.NET Core integration for HTTP triggers
// builder.Services.AddSingleton<...>();      // your DI registrations, as in ASP.NET Core
builder.Build().Run();
```

An HTTP-triggered function — note it's a plain class; `[Function]` names it, `[HttpTrigger]` is the
trigger attribute on the request parameter, and thanks to the ASP.NET Core integration you return
the `IActionResult` types you already know:

```csharp
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;

public class Hello
{
    [Function("Hello")]
    public IActionResult Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get")] HttpRequest req)
    {
        string name = req.Query["name"].ToString();
        return new OkObjectResult($"Hello, {(name == "" ? "world" : name)}!");
    }
}
```

Run it locally — no Azure needed:

```bash
func start
```

```text
Functions:

        Hello: [GET] http://localhost:7071/api/Hello

curl "http://localhost:7071/api/Hello?name=Facet"
Hello, Facet!
```

A timer trigger — the classic "nightly cleanup" that would be silly as an always-on API. The
schedule is a six-field cron expression (seconds first): `0 0 3 * * *` = every day at 03:00 UTC.

```csharp
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;

public class NightlyPurge
{
    [Function("NightlyPurge")]
    public void Run([TimerTrigger("0 0 3 * * *")] TimerInfo timer, FunctionContext ctx)
    {
        // real version: delete completed todos older than 30 days via your DbContext
        ctx.GetLogger("NightlyPurge").LogInformation("Purge ran at {Now}", DateTime.UtcNow);
    }
}
```

Deploying to a Flex Consumption app (Functions needs a storage account for its own bookkeeping —
timers, keys, state):

```bash
az storage account create --name todofuncsa<yourname> --resource-group todo-rg \
    --location southeastasia --sku Standard_LRS
az functionapp create --name todo-funcs-<yourname> --resource-group todo-rg \
    --storage-account todofuncsa<yourname> --flexconsumption-location southeastasia \
    --runtime dotnet-isolated
func azure functionapp publish todo-funcs-<yourname>
```

```text
Deployment completed successfully.
Functions in todo-funcs-<yourname>:
    Hello - [httpTrigger]
        Invoke url: https://todo-funcs-<yourname>.azurewebsites.net/api/hello
    NightlyPurge - [timerTrigger]
```

**When Functions beat an always-on API — and when they don't.** They win when work is *bursty,
event-driven, or scheduled*: webhooks, queue processing, "when a file lands, resize it", nightly
jobs — anything idle most of the day, where per-execution billing rounds to pennies and cold starts
land on no user. They lose for a chatty, latency-sensitive, always-busy API: cold starts hit real
users, per-execution cost meets a steady load (an always-on plan is *cheaper* past a threshold),
and warm in-memory caches don't survive scale-to-zero. Your to-do API stays on App Service or
Container Apps; its *nightly purge* is a Function.

> **C corner:** a trigger attribute is a declarative `epoll` loop you didn't write. In C you'd own
> the socket/timerfd, the wait loop, and the dispatch switch; here the host owns all of that and
> gRPCs your process one call per event. You write only the handler body.

### Try it — Azure

*Prerequisites: Azure Functions Core Tools (`func --version` ≥ 4), plus `az login` for step 3.
Cost note: steps 1–2 are fully local and free; step 3 fits comfortably in Flex Consumption's
monthly free execution grant — pennies at worst if you delete the resource group after.*

1. Scaffold `NotifyFunctions` as above; make the HTTP trigger echo the query string and add a timer
   trigger on `*/15 * * * * *` (every 15 s) that logs a tick. Watch both under `func start`.
2. Change the timer back to a sane nightly schedule and make it log what a real purge *would*
   delete (fake data is fine — the trigger mechanics are the lesson).
3. Deploy with the three commands above, `curl` the cloud URL twice — the first call after a few
   idle minutes is your first *measured* cold start; the second is warm. Then delete the resource
   group.

### Traps

- **Building on the retired in-process model.** Older tutorials show functions with no
  `Program.cs` and `FunctionName`/`ILogger` signatures compiled into the host. That model is
  retired — if a sample has no host builder of its own, it's teaching the past.
- **Fighting cold starts after choosing scale-to-zero.** Pinging your function every minute to keep
  it warm means you wanted an always-on host. Choose per workload, don't retrofit.
- **A long-running function.** Serverless plans cap execution duration; a 3-hour batch job will be
  killed mid-flight. Long work belongs in a container (next section) or gets split into queue-sized
  pieces.
- **Skipping the storage account's role.** Timers and keys live there; deleting "that unused
  storage account" while the app runs breaks the app in confusing ways.

**Verdict — when to pick Functions:** event-driven, scheduled, or bursty work with real idle time.
Not for your main always-on API; perfect for the jobs orbiting it.

---

## 3. Container Apps

> ⚠ **Fast-moving area.** This is Azure's youngest of the three, and features land constantly —
> workload-profile shapes (Consumption vs Dedicated, plus preview profiles in between), GPU, jobs,
> sidecar capabilities, and CLI flags all churn. The concepts below are stable; verify against
> current Azure docs before relying on them.

### The idea

**Azure Container Apps (ACA)** answers: "I have a container image — run it, scale it (to zero if
idle), give it HTTPS — and do *not* make me learn Kubernetes."

Position it against its neighbors:

- **vs App Service:** App Service is app-first (the container is one deploy option, on an always-on
  plan you size yourself). ACA is container-first and *serverless*: consumption billing per
  vCPU-second, event-driven autoscale, optional scale-to-zero, and it's built for *several*
  cooperating containers — microservices, background workers — not one web app.
- **vs raw Kubernetes (AKS):** ACA actually *runs on* Kubernetes and its ecosystem — you just never
  see it. Clusters, node pools, YAML manifests, ingress controllers, and **KEDA** (the
  Kubernetes-native autoscaler that watches event sources like queues) are all managed for you. You
  give up cluster-level control; you skip a profession's worth of operations. Full AKS is for
  platform teams with requirements ACA can't express — rarely a junior's problem.

The vocabulary you'll meet:

- **Environment** — the secure boundary a set of container apps shares (network, logging). Think
  "the cluster, abstracted".
- **Container app** — your image plus its configuration: CPU/memory per replica, scale rules,
  ingress.
- **Ingress** — managed HTTPS in. External (public URL, TLS termination, load balancing across
  replicas) or internal (reachable only by other apps in the environment — right for a private
  backend behind a gateway).
- **Revision** — an immutable snapshot of app-image-plus-config, created on every meaningful
  change. You can run two revisions at once and **split traffic** (90/10 canary), or flip 100% back
  to the old one — the same safety story as App Service slots, expressed as versions instead of a
  swap.
- **Scaling, KEDA-style** — declarative rules: "keep ~50 concurrent HTTP requests per replica,
  min 0, max 10", or CPU-based, or event-based ("scale on queue length" — KEDA ships scalers for
  dozens of event sources). Azure adds/removes replicas to satisfy the rule; at min 0, idle costs
  nothing, with the same cold-start tax as Functions — a `--min-replicas 1` floor buys latency back
  for money.

### In practice

Deploy the *same* ACR image a third way (`containerapp` commands may prompt once to install the CLI
extension — accept):

```bash
az containerapp env create --name todo-env --resource-group todo-rg \
    --location southeastasia

az containerapp create --name todo-api --resource-group todo-rg \
    --environment todo-env \
    --image todoregistry.azurecr.io/todo-api:v1 \
    --registry-server todoregistry.azurecr.io --registry-identity system \
    --target-port 8080 --ingress external \
    --min-replicas 0 --max-replicas 5 \
    --env-vars ConnectionStrings__Db="Host=...;Database=todo" Jwt__Key="dev-only-key"
```

`--target-port 8080` matches the `EXPOSE 8080` in the Dockerfile you hardened in *Containers*;
`--registry-identity system` is the same passwordless ACR pull as App Service's managed identity;
the `__` config mapping works identically. Expected tail:

```text
Container app created. Access your app at https://todo-api.<random>.southeastasia.azurecontainerapps.io/
```

```bash
curl https://todo-api.<random>.southeastasia.azurecontainerapps.io/todos
```

```text
[]
```

(If the app has scaled to zero, that curl hangs a few seconds first — you're watching a replica
being born.) Roll out `:v2` and inspect revisions:

```bash
az containerapp update --name todo-api --resource-group todo-rg \
    --image todoregistry.azurecr.io/todo-api:v2

az containerapp revision list --name todo-api --resource-group todo-rg \
    --query "[].{name:name, active:properties.active, traffic:properties.trafficWeight}" -o table
```

```text
Name                Active    Traffic
------------------  --------  ---------
todo-api--<rev1>    False     0
todo-api--<rev2>    True      100
```

By default the newest revision takes all traffic; switching the app to *multiple revision mode*
lets you weight traffic across the two (canary), or reactivate the old one as an instant rollback.

> **C corner:** a revision is a pointer swap, not a rebuild. Like flipping which shared library a
> symlink targets: both versions exist on disk immutably; "deploy" and "rollback" are retargeting,
> which is why both are instant and safe.

### Try it — Azure

*Prerequisites: `az login`, your ACR images from Containers. Cost note: the Consumption plan has a
monthly free grant (vCPU-seconds, GiB-seconds, and requests) — with `--min-replicas 0` and toy
traffic this exercise is effectively free; the environment itself costs nothing while idle. Delete
the resource group when done regardless.*

1. Run the walkthrough: environment, app from `:v1` with external ingress, min replicas 0. Curl it.
2. Leave it idle ~10 minutes, then curl again and *feel* the scale-from-zero delay. Set
   `--min-replicas 1` and confirm the delay disappears.
3. Update to `:v2`, list revisions, and roll back by reactivating the first revision. Compare the
   experience with the App Service slot swap from section 1 — same guarantee, different shape.
4. `az group delete --name todo-rg --yes`.

### Traps

- **Ingress port ≠ container port.** If `--target-port` doesn't match what Kestrel listens on
  inside the image (8080 for the .NET images from *Containers*), every request 502s while the app
  logs look perfectly healthy.
- **Scale-to-zero on a user-facing API, unexamined.** Min 0 is a *choice* trading first-request
  latency for idle cost — the same trade as Functions cold starts. Decide it consciously per app.
- **Treating ACA as "Kubernetes but easy" and expecting kubectl.** The cluster is deliberately
  sealed. If you genuinely need daemonsets, custom controllers, or node access, that's AKS — a
  different commitment.
- **Config drift across hosts.** You've now set the same connection string three ways. In real
  systems, secrets live in one place and hosts reference it — that's the next chapter, *Storage,
  Data & Config*.

**Verdict — when to pick Container Apps:** you're container-first (you are, since *Containers*),
want scale-to-zero economics or event-driven scaling, or expect to grow into multiple services and
background workers. For this book's project it's App Service's strongest rival — and the more
modern default for new containerized systems.

---

## Choosing — the whole point

Same API, three hosts, one honest decision rule:

- Always-on API, one app, least platform to learn → **App Service**.
- Runs only when something happens (event, timer, queue), idle most of the time → **Functions**.
- Containerized (possibly several services/workers), want consumption billing and room to grow →
  **Container Apps**.
- Need cluster-level control and staff to run it → AKS, out of scope here.

For the to-do API, App Service and Container Apps are both defensible; the purge job is a Function
either way. Deploying your container to Azure compute cold — and defending the choice of host — is
exactly the Cloud checkpoint.

## Check yourself

- Can you explain what an App Service *plan* is versus a web app, deploy your ACR image to one with
  config as app settings (`__` nesting), and describe what a slot swap gives you that a plain
  redeploy doesn't — plus the difference between scaling up and scaling out? If yes, tick
  *App Service* above.
- Can you define trigger and binding, explain what the isolated worker model means for your C#
  (your own `Program.cs`, host builder, and DI), write an HTTP-trigger and a timer-trigger
  function, and say when Functions beat an always-on API — and when they don't? If yes, tick
  *Azure Functions* above.
- Can you place Container Apps between App Service and AKS, deploy your ACR image with external
  ingress on the right target port, explain revisions as instant rollback, and state the
  scale-to-zero trade-off in one sentence? If yes, tick *Container Apps* above.

All three ticked? Tick the chapter — then go delete any resource groups you left running.
