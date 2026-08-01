# Cloud & Azure Foundations

You've built an API (*ASP.NET Core*), given it a database (*SQL + EF Core*), locked it down
(*Auth*), and pushed it onto a server (*Deployment*). The Cloud branch is about doing that last step
**professionally** — on rented, managed, pay-per-use infrastructure. This chapter teaches the cloud
from zero: what it physically is, how Azure organizes it, and the three grown-up concerns (identity,
access, money) that every later chapter leans on.

---

## 1. Cloud model & Azure map

### The idea

Strip the marketing away and "the cloud" is two things:

1. **Someone else's datacenter.** Microsoft owns warehouses full of servers, disks, and network
   gear, grouped into **regions** (a region ≈ a cluster of datacenters in one place: `eastus`,
   `westeurope`, `southeastasia`). When you "create a VM in East US", a real machine in Virginia
   starts running your workload.
2. **An API in front of it.** You never email a technician. Every action — "give me a Linux box",
   "create a database", "delete everything" — is an HTTPS call to Azure's management API. The web
   portal, the CLI, and the deployment scripts you'll write later are all just clients of that API.

That second point is the actual revolution. Servers existed before; *servers you can create and
destroy programmatically in seconds, paying only while they exist*, did not. Infrastructure becomes
something you write code against — which is why this branch belongs in a programming book.

**The responsibility ladder.** Cloud offerings differ in *how much Azure manages for you*:

| Model | You manage | Azure manages | Example |
|---|---|---|---|
| On-premises | everything, incl. the hardware | nothing | the server under your desk |
| **IaaS** (Infrastructure as a Service) | OS, patches, runtime, your app | hardware, network, power | a virtual machine |
| **PaaS** (Platform as a Service) | just your app + its config | OS, runtime, scaling, TLS | Azure App Service |
| **Serverless / FaaS** (Functions as a Service) | just a function's code | everything, incl. *when it runs at all* | Azure Functions |

Reading downward, you hand over more responsibility — and more 3 a.m. pages — to Azure, in exchange
for money and some lock-in. The professional default is to live **as low-effort as the workload
allows**: PaaS or serverless for most apps, IaaS only when you genuinely need to control the OS.
Renting a VM and hand-configuring it like the *Deployment* chapter's server is possible, but it
buys you almost nothing over that chapter — the cloud's payoff starts at PaaS.

**Regions and availability.** Two practical rules. First, resources that talk to each other
(API ↔ database) belong in the **same region** — cross-region traffic adds latency and, in some
directions, data-transfer charges (**egress**: data *leaving* Azure or a region is what's billed;
data coming in is free). Second, regions can fail; Azure's answer is **availability zones**
(independent datacenters within a region) and paired regions for the truly paranoid. For learning,
"pick one region near you and stay in it" is the whole strategy.

**The Azure map — the ~10 services this book actually uses.** Azure has hundreds of services; you
need about ten. This is the cast list for the rest of the branch:

| Service | What it is | Where it's taught |
|---|---|---|
| **App Service** | PaaS web hosting — hand it your API, it runs it | *Azure Compute* |
| **Azure Functions** | serverless — a function that runs per event/request | *Azure Compute* |
| **Container Apps** | managed containers that scale to zero | *Azure Compute* |
| **Container Registry (ACR)** | private storage for your Docker images | *Containers* |
| **Azure SQL Database** | managed SQL Server — your EF Core database, hosted | *Storage & Config* |
| **Blob Storage** | cheap object storage for files of any size | *Storage & Config* |
| **Cosmos DB** | managed NoSQL for non-relational shapes | *Storage & Config* |
| **Key Vault** | a safe for secrets, keys, and certificates | *Storage & Config* |
| **Application Insights** | telemetry — what your deployed app is actually doing | *CI/CD & IaC* |
| **Microsoft Entra ID** | the identity system behind everything | this chapter, §3 |

Plus one that isn't a "service" so much as a language: **Bicep**, Azure's infrastructure-as-code
format (*CI/CD & IaC*), and **Microsoft Foundry** for hosted AI models (*AI in the Cloud*).

> ⚠ **Fast-moving area.** Service *names* churn: Azure AD became Microsoft Entra ID, Azure AI
> Foundry became Microsoft Foundry, and portal categories get reshuffled yearly. The
> concepts below are stable; verify against current Azure docs before relying on them.

### In practice

You can see the raw truth of "it's all an API" without an account. Azure publishes its region list
publicly; once you have the CLI (next section) this is one command:

```bash
az account list-locations --query "[?metadata.regionCategory=='Recommended'].name" -o tsv
```

```text
eastus
eastus2
westus2
westeurope
southeastasia
...
```

Every one of those names is a place where your code can physically run, addressable by string.

> **C corner:** IaaS vs PaaS maps to a familiar trade-off: `malloc`/`free` vs a garbage collector.
> IaaS is manual memory management for infrastructure — total control, and every leak (an unpatched
> OS, a forgotten VM) is yours. PaaS is the GC: you give up control over *how*, and a whole class
> of bugs stops being your problem.

> **Try it — Azure:** create the account you'll use for the whole branch. Go to
> `azure.microsoft.com`, choose the **free account**: it currently includes ~$200 of credit for the
> first 30 days, 12 months of free amounts of popular services, and a set of always-free services.
> It asks for a credit card for identity verification but **does not charge it** — a free account
> won't bill you unless you explicitly upgrade to pay-as-you-go. Then sign in to
> `portal.azure.com` and just look around: search for "App Service", open its Create screen, look
> at the region dropdown — and create nothing. Browsing costs nothing. (This exercise, like all
> **Try it — Azure** blocks in this branch, requires an Azure account; every step here is free.)

### Traps

- **Treating the cloud as "a big VM".** If your plan is "rent a VM and set it up by hand", you've
  rebuilt the *Deployment* chapter with extra billing. The value is in the managed layers above.
- **Scattering resources across regions.** An API in `westeurope` talking to a database in
  `eastus` is slow on every request and can pay egress on every byte. Co-locate by default.
- **Trying to learn Azure by breadth.** Hundreds of services exist so that *someone* needs each
  one. You need the table above; ignore the rest until a problem forces one on you.

---

## 2. Portal, CLI & resource model

### The idea

Everything you create in Azure — a web app, a database, a storage account — is a **resource**.
Resources live in a strict hierarchy:

```text
Account (you, in Entra ID)
└── Subscription        ← the billing boundary: every charge lands on exactly one
    └── Resource group  ← a folder: one app/environment's resources, managed as a unit
        └── Resources   ← the actual things: web app, database, storage account, ...
```

- A **subscription** is where the bill goes. Your free account gives you one; companies have many
  (per team, per environment) precisely to keep bills and permissions separated.
- A **resource group** is a named folder for everything belonging to one application in one
  environment — `todo-dev-rg` holds the dev API, its database, its storage. Groups exist so you
  can see, tag, secure, and — crucially — **delete** an entire application as one unit. A resource
  group itself is free and must name a region (where its *metadata* lives; its resources may
  technically live elsewhere, but shouldn't — see §1).
- A **resource** is the billable thing itself. Every resource belongs to exactly one group.

**Two clients, one API.** You'll touch this hierarchy through:

- the **Azure Portal** (`portal.azure.com`) — the web UI. Good for exploring, checking state, and
  one-off reads; bad for anything you'll do twice, because clicks aren't repeatable or reviewable.
- the **Azure CLI** (`az`) — a command-line client. Everything the portal does, as commands you can
  script, diff, and put in CI. This book prefers the CLI: it's precise on the page and it's what
  the *CI/CD & IaC* chapter automates.

Both talk to the same thing: **Azure Resource Manager (ARM)**, the management API from §1. ARM is
the single front door — it authenticates you (via Entra ID, §3), checks your permissions (RBAC,
§3), and then creates/reads/updates/deletes resources. Portal, CLI, Bicep, and the SDKs are all
just different ways of composing ARM requests. That's why anything done in one tool is instantly
visible in the others.

Two habits complete the model. **Tagging**: every resource and group can carry free-form
`key=value` tags (`app=todo`, `env=dev`); cost reports and cleanup scripts filter by them, and
messy tag discipline is how big Azure bills become unexplainable. **Cleanup**: because a group
deletes as a unit, `az group delete` is the cloud's great safety habit — when an experiment is
done, one command guarantees nothing from it is silently billing you.

> ⚠ **Fast-moving area.** The portal's navigation and the CLI's login flow are the churniest UI in
> Azure — menu layouts move, and `az login` behavior has changed more than once (it currently opens
> a browser and then asks you to pick a subscription). The concepts below are stable; verify
> against current Azure docs before relying on them.

### In practice

Install the CLI (on Debian/Ubuntu-family Linux; other OS installers are on the same docs page the
command's output points to):

```bash
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
az version
```

```text
{
  "azure-cli": "2.75.0",
  "azure-cli-core": "2.75.0",
  ...
}
```

Log in — this opens a browser, you authenticate there, and the CLI stores a token (on a machine
with no browser, `az login --use-device-code` prints a code to enter on another device):

```bash
az login
```

```text
Select a subscription and tenant (Type a number or Enter for no changes):
[1] * Azure subscription 1 (a1b2c3d4-...)

Tenant: Default Directory
Subscription: Azure subscription 1 (a1b2c3d4-...)
```

Now the core loop — create a group, put nothing in it yet, inspect it, destroy it:

```bash
az group create --name todo-dev-rg --location eastus --tags app=todo env=dev
```

```text
{
  "id": "/subscriptions/a1b2c3d4-.../resourceGroups/todo-dev-rg",
  "location": "eastus",
  "name": "todo-dev-rg",
  "properties": { "provisioningState": "Succeeded" },
  "tags": { "app": "todo", "env": "dev" }
}
```

Note the `id`: every resource has one of these full paths — subscription, then group, then
resource. RBAC scopes (§3) are exactly these paths. Inspect and tear down:

```bash
az group list --query "[].{name:name, location:location}" -o table
az resource list --resource-group todo-dev-rg -o table   # empty for now
az group delete --name todo-dev-rg --yes                 # deletes the group AND everything in it
```

```text
Name         Location
-----------  ----------
todo-dev-rg  eastus
```

That create → inspect → delete loop, with real services in the middle, is 80% of day-to-day Azure.
(The `--query` flag is JMESPath, a JSON query language built into `az`; `-o table` picks the output
format. You'll only ever need the simple forms shown in this book.)

> **C corner:** ARM's model is declarative where the CLI looks imperative. `az group create` on an
> existing, identical group isn't an error — ARM sees the desired state already holds and does
> nothing, like `mkdir -p` rather than `mkdir`. Bicep (*CI/CD & IaC*) takes this to its
> conclusion: you declare the end state and ARM computes the diff.

> **Try it — Azure:** (needs your account from §1; every step is free — resource groups cost
> nothing.) Install `az`, log in, and run the exact loop above with your own group name. Between
> `create` and `delete`, open `portal.azure.com`, search for your group, and confirm the portal
> shows the tags you set from the CLI — that's ARM being the single source of truth. Finish with
> `az group list -o table` and confirm the output is empty (or only contains groups you recognize).

### Traps

- **Learning portal-only.** Clicks don't survive into scripts, code review, or CI. Explore in the
  portal, but make the CLI your muscle memory — later chapters assume it.
- **One giant resource group.** Dumping every experiment into `my-stuff-rg` makes "what is this
  and can I delete it?" unanswerable. One group per app per environment, tagged.
- **Assuming delete is instant or reversible.** `az group delete` returns after minutes, not
  seconds, and there is no undo — it takes the group's databases with it. That's exactly why prod
  and dev belong in different groups (and ideally different subscriptions).
- **Forgetting which subscription you're in.** With more than one subscription, `az` commands hit
  whichever is active (`az account show`). Creating resources in the wrong one is a classic
  someone-else-gets-the-bill mistake; `az account set --subscription <name>` switches.

---

## 3. Identity, RBAC & cost

### The idea

Three questions decide whether ARM executes a request: *who are you?* (identity), *are you allowed?*
(RBAC), and — asked later, monthly, by you — *what did it cost?*

**Identity: Microsoft Entra ID.** Entra ID (renamed from "Azure Active Directory" in 2023 — older
docs and blog posts say Azure AD; same thing) is the directory behind every Azure login. Its core
concepts:

- A **tenant** is one organization's directory — its users, groups, and app identities. Your free
  account created a tenant with one user: you. A company has one tenant; its Azure subscriptions
  *trust* that tenant for sign-in.
- A **user** is a human identity. This is what `az login` authenticated.
- A **service principal** is a *non-human* identity — an account for a program, with its own
  credentials. Your CI pipeline deploying to Azure logs in as a service principal, not as you.
- A **managed identity** is a service principal that Azure itself creates *for a resource* and
  whose credentials Azure manages invisibly — your App Service gets an identity with no password
  or key for you to store, leak, or rotate. Conceptual for now; the *Storage & Config* chapter
  uses one so your API can read Key Vault with **zero secrets in config**. Remember the JWT
  signing key and connection string you had to protect in *Auth* and *Deployment*? Managed
  identity is the cloud's answer to "where do I put that".

**Authorization: RBAC.** Role-based access control answers "allowed?" with a triple — a **role
assignment** is:

```text
principal  +  role  +  scope
(who)         (may do what)  (on which slice of the hierarchy)
```

- **Principal**: a user, group, service principal, or managed identity.
- **Role**: a named bundle of permissions. The big three built-ins: **Reader** (look, don't
  touch), **Contributor** (create/change/delete resources, but not grant access), **Owner**
  (Contributor + manage access).
- **Scope**: a node in the §2 hierarchy — a whole subscription, one resource group, or a single
  resource. Assignments **inherit downward**: Contributor on a subscription means Contributor on
  every group and resource inside it.

The professional rule is **least privilege**: grant the smallest role at the narrowest scope that
works. A deploy pipeline gets Contributor on *one resource group* — never Owner on the
subscription. Your free account made you Owner of your subscription, which is fine alone, but the
habit of asking "what's the narrowest grant?" starts now.

**Cost.** Azure bills continuously, per resource, and the meter is on from the moment a resource
exists. What actually costs money:

- **Compute time** — the big one. A VM or an always-on App Service plan bills *per second of
  existing*, used or not. Serverless (Functions, Container Apps at zero) bills per execution, so
  idle ≈ free — which is why this book's learning path favors it.
- **Storage** — per GB per month, plus per-operation micro-charges. Cheap, but never zero, and it
  bills even when nothing reads it.
- **Egress** — data leaving Azure (or crossing regions), per GB. Inbound is free.

Defenses, in order of importance: **budgets and cost alerts** (a budget on a subscription or group
with email alerts at, say, 50/90/100% — alerts *warn*, they don't stop spending); the **cost
analysis** view, checked weekly like a bank statement; and the §2 delete habit. The classic
beginner failure has a shape worth memorizing: you follow a tutorial, it creates a non-free tier
without you noticing, you finish, close the tab, and *forget it exists* — and it bills quietly for
months, because a resource never deletes itself. Every "surprise Azure bill" story is this story.
The cure is mechanical, not moral: everything lives in a resource group, and finishing means
`az group delete`.

> ⚠ **Fast-moving area.** Identity naming (Azure AD → Entra ID) and free-tier terms ($200/30-day
> credit, the 12-month free amounts, which SKUs have free tiers) are exactly the details Microsoft
> revises. The concepts below are stable; verify against current Azure docs before relying on them.

### In practice

Look at your own identity and standing grants:

```bash
az account show --query "{subscription:name, tenant:tenantId, user:user.name}" -o json
az role assignment list --assignee steven@example.com --query "[].{role:roleDefinitionName, scope:scope}" -o table
```

```text
{
  "subscription": "Azure subscription 1",
  "tenant": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "user": "steven@example.com"
}

Role    Scope
------  ---------------------------------
Owner   /subscriptions/a1b2c3d4-...
```

One user, one tenant, Owner at subscription scope — the whole §3 model in two commands. Note the
scope is the same `id` path shape from §2. A grant at narrower scope looks like this (shown for
reading; you've no second user to grant to yet):

```bash
az role assignment create --assignee a-pipeline-principal-id \
  --role Contributor \
  --scope /subscriptions/a1b2c3d4-.../resourceGroups/todo-dev-rg
```

And a budget with an alert, straight from the CLI (`--amount` is in your billing currency; the
notification fires at 80%):

```bash
az consumption budget create --budget-name learn-budget --amount 10 \
  --category cost --time-grain monthly \
  --start-date 2026-08-01 --end-date 2027-08-01
```

> **C corner:** RBAC scopes work like file-permission inheritance in a directory tree, with one C
> instinct to override: there's no "execute my code = my permissions". Your API running in App
> Service has *its own* principal (the managed identity), not yours — the process's identity, not
> the author's, is what RBAC checks. Closer to setuid than to ordinary process inheritance.

> **Try it — Azure:** (needs your account; every step is free.) In the portal, search **Cost
> Management**, open **Budgets**, and create a monthly budget of $5–10 on your subscription with an
> email alert at 80% — budgets and alerts cost nothing and this is the single highest-value click
> in the chapter. Then search **Microsoft Entra ID** and find yourself under **Users** — that's
> your tenant. Back in the terminal, run the two `az` commands above and match what you see: same
> tenant ID, same Owner assignment. You now know exactly who you are to Azure and what you'd be
> told if spending starts.

### Traps

- **Secrets in config, cloud edition.** If your deployed app holds a connection string in a config
  file, you've ported the *Deployment* chapter's weakest point into the cloud. The managed-identity
  + Key Vault pattern (*Storage & Config*) removes the secret entirely; prefer it whenever both
  ends are Azure.
- **Owner everywhere.** Granting Owner "so it just works" means any compromised credential — or
  wrong-window command — can do anything, including deleting prod and granting itself more access.
  Contributor at group scope covers nearly every real need.
- **Believing a budget stops spending.** Budgets *notify*. Nothing auto-stops. The only real caps
  are the free account's credit exhaustion (which suspends, until you upgrade) and your own delete
  habit.
- **The forgotten resource.** Tutorial → non-free tier → closed tab → months of quiet billing. If
  you take one habit from this chapter: end every session with `az group list -o table` and delete
  what you don't recognize.

---

## Check yourself

- Can you place IaaS, PaaS, and serverless on the responsibility ladder, say which this book's
  path favors and why, and name what Blob Storage, Key Vault, and App Service are each for —
  without the table? If yes, tick *Cloud model & Azure map* above.
- Can you draw subscription → resource group → resource from memory, explain what ARM is and why
  the portal and CLI always agree, and write the create → inspect → delete loop in `az` commands
  without looking? If yes, tick *Portal, CLI & resource model* above.
- Can you name the three parts of a role assignment, explain what a managed identity removes the
  need for, and list the three things that bill (compute time, storage, egress) plus the one habit
  that prevents the forgotten-resource bill? If yes, tick *Identity, RBAC & cost* above.

All three ticked? Tick the chapter — next stop, *Containers*: putting your API in a box Azure can
run anywhere.
