# Storage & Config

Chapters 11–13 got your containerized to-do API deployed and running on Azure compute. But an API alone
is not an application: real systems also need a place for **files**, sometimes a **NoSQL** store, a safe
home for **secrets**, and a way for services to hand work to each other without blocking. This chapter
is that supporting cast — the storage and configuration services that sit around the SQL database you
built in the SQL + EF Core chapter.

---

## 1. Blob & Cosmos DB

### The idea — object storage from zero

Suppose a user uploads a 2 MB profile picture. Where do the bytes go? Three wrong-ish answers first:

- **In the SQL database** (a binary column): works at toy scale, but databases are priced and tuned for
  small, queryable rows. Backups balloon, queries slow down, and you pay premium database storage for
  bytes you never query — you only ever fetch them whole.
- **On the server's disk**: dies the moment you scale to two containers (which one has the file?) or
  redeploy (containers are disposable — Containers chapter). There is no durable local disk in PaaS.
- **On a network file share**: fine for lift-and-shift legacy apps that expect a filesystem, but shares
  give you filesystem semantics (paths, locks, permissions) you don't need for "store bytes, get bytes".

The cloud answer is **object storage**: a service that stores named blobs of bytes — no filesystem, no
partial updates, just *put object, get object, delete object, list objects* over HTTPS. On Azure that's
**Blob Storage** ("blob" = binary large object). Cheap (fractions of a cent per GB-month), effectively
unlimited, triple-replicated, and every blob has a URL.

Azure's storage flavors, so you can name what you're *not* using:

| Service | Semantics | Use for |
|---|---|---|
| **Blob Storage** | objects by name over HTTP | uploads, images, exports, backups, logs |
| **Azure Files** | SMB/NFS file share (paths, locks) | legacy apps that expect a mounted drive |
| **Managed Disks** | virtual block device for a VM | IaaS virtual machines only |

Blob's object model is three levels: a **storage account** (globally-unique name, becomes the URL host:
`https://<account>.blob.core.windows.net`), which holds **containers** (flat top-level buckets like
`avatars` — not related to Docker containers), which hold **blobs** (named byte objects). Blob names may
contain `/`, so `2026/07/report.pdf` *looks* like a folder path, but it's just a name — the hierarchy is
cosmetic.

Each blob also has an **access tier** — a price/latency trade-off: **Hot** (frequent access, cheapest
reads), **Cool** (infrequent, cheaper storage but per-read fees and a 30-day minimum), and **Archive**
(offline; hours to rehydrate, for compliance backups). Default to Hot; tier down data you keep but
rarely touch.

The pattern that matters for your API: **bytes in Blob, path in SQL**. The `Todos` table gets a string
column like `AttachmentBlob`, and the actual file lives in a container. The database stays small and
queryable; the blobs scale independently.

One more concept you'll meet immediately: how does a *browser* download a blob if the container is
private (which it should be)? Your API could proxy every byte — wasteful. Instead you hand out a
**SAS URL** (shared access signature): the blob's URL plus a signed query string granting a specific
permission ("read this one blob") for a limited time ("next 15 minutes"). The client downloads straight
from Blob Storage; your API only minted a signature. Same trick for uploads: the browser PUTs directly
to Blob with a short-lived write SAS, and your API never touches the bytes.

> ⚠ **Fast-moving area.** Azure SDK package names, method shapes, and storage pricing tiers churn.
> `Azure.Storage.Blobs` is the current .NET package (the older `WindowsAzure.Storage` /
> `Microsoft.Azure.Storage.*` families are retired). The concepts below are stable; verify against
> current Azure docs before relying on them.

### In practice — Blob

Install the SDK into a console project (Study runs statements, but SDK exercises need a real project on
your machine — same as the Deployment chapter):

```bash
dotnet add package Azure.Storage.Blobs
```

Upload and download, end to end. `BlobServiceClient` is the entry point (one per storage account);
`GetBlobContainerClient` scopes it to a container; `GetBlobClient` to one blob:

```csharp
using Azure.Storage.Blobs;

// Connection string from the portal or `az storage account show-connection-string`.
// (Section 2 replaces this with identity-based auth — connection strings are the training wheels.)
string conn = Environment.GetEnvironmentVariable("STORAGE_CONN")!;

var service   = new BlobServiceClient(conn);
var container = service.GetBlobContainerClient("attachments");
await container.CreateIfNotExistsAsync();                       // idempotent — safe to re-run

// Upload: any Stream, or in-memory bytes via BinaryData
var blob = container.GetBlobClient("todo-7/receipt.txt");
await blob.UploadAsync(BinaryData.FromString("Lunch: $12.50"), overwrite: true);
Console.WriteLine($"Uploaded to {blob.Uri}");

// Download it back
var downloaded = await blob.DownloadContentAsync();
Console.WriteLine(downloaded.Value.Content.ToString());
```

```text
Uploaded to https://todostorage7.blob.core.windows.net/attachments/todo-7/receipt.txt
Lunch: $12.50
```

Minting a read-only SAS URL for that blob (this overload signs with the account key inside the
connection string):

```csharp
using Azure.Storage.Sas;

Uri sasUrl = blob.GenerateSasUri(BlobSasPermissions.Read, DateTimeOffset.UtcNow.AddMinutes(15));
Console.WriteLine(sasUrl);   // hand this to the browser; it expires in 15 minutes
```

```text
https://todostorage7.blob.core.windows.net/attachments/todo-7/receipt.txt?sv=2025-11-05&se=2026-07-22T13%3A45%3A00Z&sr=b&sp=r&sig=K7f...
```

Everything after `?` is the signature: permissions (`sp=r`, read), expiry (`se=...`), and a signed hash
(`sig=...`) that Blob Storage verifies. No signature, no access.

### The idea — NoSQL from zero

Your relational database (SQL + EF Core chapter) stores data as typed rows in tables, joined by keys,
with a schema enforced up front. A **document database** stores **JSON documents** instead: each item is
a self-contained blob of JSON, and items in the same container don't have to share a shape.

When documents beat rows:

- **The shape varies per item.** A product catalog where a laptop has `cpu`/`ram` and a t-shirt has
  `size`/`color` — in SQL that's a swamp of nullable columns or side tables; as JSON, each document just
  has its own fields.
- **You read whole aggregates by key.** A game save, a user profile, a device's telemetry — you fetch
  the entire document by its id, no joins needed, so the document model *is* your access pattern.
- **Scale-out is the requirement.** Document stores are built to spread data across many machines
  horizontally; relational databases scale up (bigger box) much more comfortably than out.

When rows still win — and this is most business apps: data that's **related and queried many ways**
(orders by customer, by date, by product), needs **cross-entity transactions**, or benefits from a
schema catching mistakes. NoSQL is not "SQL but newer"; it's a different trade — you give up joins,
ad-hoc queries across everything, and easy consistency, and you get schema flexibility and horizontal
scale. Default to SQL; reach for documents when the data genuinely is document-shaped.

**Azure Cosmos DB** is Azure's managed document database (it has several APIs; the native one is called
**NoSQL**, and that's what the .NET SDK below targets). Its model mirrors Blob's levels: an **account**
→ **databases** → **containers** → **items** (JSON documents). Every item must have an `id`, and every
container declares a **partition key** path at creation, e.g. `/userId`.

The partition key is *the* design decision, so here's why it exists. Cosmos scales by splitting a
container's data across many physical machines. The partition key decides which machine holds which
item: all items sharing a key value live together. Consequences:

- A read that supplies `id` + partition key value goes to exactly one machine — fast and cheap.
- A query that doesn't supply the partition key **fans out to every machine** — slow and expensive.
- If one key value gets most of the traffic (a "hot partition"), one machine does all the work while
  the rest idle — you paid for scale you can't use.

So pick a key with **many distinct values**, **evenly spread traffic**, and that **appears in your
common queries**. For per-user data, `/userId` is the classic right answer. Cosmos bills in **Request
Units (RU/s)** — a currency of compute+IO per operation — which is why a fan-out query or hot partition
literally costs more money, not just time.

### In practice — Cosmos DB

The current .NET package is **`Microsoft.Azure.Cosmos`** (SDK v3). You may see a package named
`Azure.Cosmos` in old blog posts — that was an abandoned preview; don't use it.

```bash
dotnet add package Microsoft.Azure.Cosmos
```

CRUD against a container partitioned on `/userId`:

```csharp
using Microsoft.Azure.Cosmos;

string conn = Environment.GetEnvironmentVariable("COSMOS_CONN")!;
using var client = new CosmosClient(conn);

Database db         = await client.CreateDatabaseIfNotExistsAsync("todoapp");
Container container = await db.CreateContainerIfNotExistsAsync("todos", "/userId");

// A plain C# record serializes to a JSON document. "id" (lowercase) is required by Cosmos.
record TodoDoc(string id, string userId, string title, bool done);

var item = new TodoDoc("t-100", "user-42", "Buy milk", false);

// Create — you pass the partition key value explicitly so the SDK routes to the right partition
await container.CreateItemAsync(item, new PartitionKey(item.userId));

// Point read — id + partition key = the cheapest possible operation (~1 RU)
TodoDoc fetched = await container.ReadItemAsync<TodoDoc>("t-100", new PartitionKey("user-42"));
Console.WriteLine($"{fetched.title} (done: {fetched.done})");

// Update = replace the whole document (documents are the unit, not columns)
await container.ReplaceItemAsync(fetched with { done = true }, "t-100", new PartitionKey("user-42"));

// Query within one partition — note the SQL-ish query language over JSON
var query = new QueryDefinition("SELECT * FROM c WHERE c.userId = @u AND c.done = true")
    .WithParameter("@u", "user-42");
using var feed = container.GetItemQueryIterator<TodoDoc>(query);
while (feed.HasMoreResults)
    foreach (var t in await feed.ReadNextAsync())
        Console.WriteLine($"done: {t.title}");

// Delete
await container.DeleteItemAsync<TodoDoc>("t-100", new PartitionKey("user-42"));
```

```text
Buy milk (done: false)
done: Buy milk
```

`record ... with { done = true }` is the non-destructive copy from the OOP chapter; the
`HasMoreResults` loop is just the SDK's paging shape — each `ReadNextAsync` fetches one page of results.

> **C corner:** a partition key is a hash-table bucket selector at datacenter scale — `hash(key) %
> machines` deciding which box owns the data, exactly like `hash % nbuckets` picking a chain in a C
> hash table. A hot partition is every entry hashing to one bucket: the lookup still "works", but one
> chain does all the walking.

### Try it — Azure:

Prerequisites: an Azure subscription with the `todo-rg` resource group from the Azure Compute chapter,
`az` CLI logged in, and .NET 10 locally. **Cost:** Blob at this scale is effectively free (< $0.01);
for Cosmos use the **free tier** (first account per subscription: 1000 RU/s + 25 GB free) or the local
**emulator**. No Azure at all? The **Azurite** emulator (`npm install -g azurite`, then `azurite`)
fakes Blob/Queue/Table storage locally — the SDK connects to it with the well-known connection string
`UseDevelopmentStorage=true`. Cosmos has its own local emulator (Windows installer, or a Linux Docker
image) if you'd rather not create an account.

1. `az storage account create --name <unique> --resource-group todo-rg --sku Standard_LRS`, grab the
   connection string with `az storage account show-connection-string`, and run the Blob snippet above.
   Confirm the blob in the portal's Storage Browser.
2. Generate a SAS URL for your blob, open it in a browser (it downloads), wait past the expiry, reload —
   `AuthenticationFailed`. That's the whole SAS lifecycle.
3. Create a free-tier Cosmos account (`az cosmosdb create --name <unique> --resource-group todo-rg
   --enable-free-tier true`), run the CRUD snippet, and watch each operation's RU charge in the portal's
   Data Explorer. A point read costs ~1 RU; try the query without the `userId` filter and compare.
4. Clean up anything you created just to poke at: `az group delete` removes the whole resource group.

### Traps

- **Storing files in SQL "just for now".** The path-in-DB, bytes-in-Blob split costs ten minutes today
  and saves a painful migration later. Binary columns are the storage decision people regret most.
- **Public containers.** Container access level "Blob (anonymous read)" means anyone with the URL reads
  everything, forever. Keep containers private and mint short-lived SAS URLs instead.
- **Choosing the partition key by what's convenient** (e.g. a constant, or a date — today's date is one
  hot partition taking all writes). Choose by *access pattern*, and know it's immutable — changing it
  means creating a new container and migrating.
- **Treating Cosmos as a relational database** — cross-partition queries everywhere, joins simulated in
  app code. If you keep fighting for joins and transactions, the data was relational; use the database
  you already have from SQL + EF Core.

---

## 2. Key Vault & config

### The idea — the secrets problem

Count your to-do API's secrets: the SQL connection string, the JWT signing key from the Auth chapter,
maybe the Blob and Cosmos connection strings from section 1. Where do they live? Every conventional
answer leaks:

- **In `appsettings.json`** → committed to git → in every clone, every fork, forever (git history
  doesn't forget). This is the classic breach.
- **In environment variables** (as in the Azure Compute chapter) → better, nothing in git — but the
  secrets sit in plain text in App Service settings, visible to anyone with portal access, unversioned,
  and duplicated per environment.

**Azure Key Vault** is a dedicated secrets service: a vault holds **secrets** (strings — connection
strings, API keys), **keys** (cryptographic keys that never leave the vault; you send data in to be
signed/decrypted), and **certificates** (TLS certs with managed renewal). For app work you'll mostly use
secrets. Every read is access-controlled through Azure's identity system and audit-logged — you can
answer "who read the DB password, and when".

But wait — if the app needs a credential *to reach the vault*, haven't we just moved the problem? A
connection string to the secret store is still a secret. The escape is **managed identity**: Azure can
give your compute (App Service, Container Apps, Functions — chapter 13's services all support it) an
identity in **Microsoft Entra ID** (Azure's identity directory) that exists *only inside Azure*. There
is no password. Your code asks the platform "give me a token proving I'm this app", the platform
answers (only real Azure infrastructure can), and Key Vault accepts the token because you granted that
identity read access. **No secret is stored anywhere, at any layer.** This is the same trust move as
JWT in the Auth chapter — prove identity with a signed token instead of presenting a password — except
the platform issues the token to your *app* automatically.

In code, the piece that makes this practical is **`DefaultAzureCredential`** (package `Azure.Identity`).
It's a chain of authentication strategies tried in order: environment credentials, **managed identity**
(in Azure), your **`az login`** session (on your dev machine), and a few more. Result: the *same line
of code* authenticates as the managed identity in production and as *you* locally — no branching, no
local secrets. Current guidance worth knowing: `DefaultAzureCredential` is a *development* convenience;
in production, either use `ManagedIdentityCredential` directly or pin the chain by setting the
environment variable `AZURE_TOKEN_CREDENTIALS=ManagedIdentityCredential`, so a misconfigured app fails
loudly instead of silently authenticating as the wrong thing.

> ⚠ **Fast-moving area.** Identity guidance and SDK auth chains evolve (the `AZURE_TOKEN_CREDENTIALS`
> pinning above is recent), and package names churn. The concepts below are stable; verify against
> current Azure docs before relying on them.

### In practice

Reading one secret directly:

```bash
dotnet add package Azure.Identity
dotnet add package Azure.Security.KeyVault.Secrets
```

```csharp
using Azure.Identity;
using Azure.Security.KeyVault.Secrets;

var vault = new SecretClient(
    new Uri("https://todo-kv.vault.azure.net/"),   // the vault's URL — not secret, just an address
    new DefaultAzureCredential());                  // managed identity in Azure, az login locally

KeyVaultSecret secret = await vault.GetSecretAsync("Jwt-SigningKey");
Console.WriteLine($"{secret.Name} = {secret.Value[..8]}...");   // never print full secrets
```

```text
Jwt-SigningKey = 9f2c41ab...
```

But you rarely fetch secrets one by one. ASP.NET Core's configuration system (the
`builder.Configuration` you've used since the ASP.NET Core chapter) layers providers —
`appsettings.json`, environment variables — and Key Vault plugs in as *just another layer*:

```bash
dotnet add package Azure.Extensions.AspNetCore.Configuration.Secrets
```

```csharp
// Program.cs — two added lines, before builder.Build()
using Azure.Identity;

var builder = WebApplication.CreateBuilder(args);

builder.Configuration.AddAzureKeyVault(
    new Uri("https://todo-kv.vault.azure.net/"),
    new DefaultAzureCredential());

var app = builder.Build();

// Everywhere else is unchanged — config reads don't know or care where values come from:
string jwtKey = builder.Configuration["Jwt:Key"]!;
```

One naming rule: vault secret names can't contain `:`, so `--` in a secret name maps to `:` in config —
a secret named `Jwt--Key` appears as `Jwt:Key`, `ConnectionStrings--Db` as `ConnectionStrings:Db`.
Because Key Vault is added *last*, it wins over `appsettings.json` — your JSON keeps harmless defaults,
the vault supplies the real values, and nothing sensitive is in the repo.

Provisioning it all with the CLI:

```bash
az keyvault create --name todo-kv --resource-group todo-rg
az keyvault secret set --vault-name todo-kv --name Jwt--Key --value "prod-signing-key-..."

# Give your App Service (ch. 13) a system-assigned managed identity, then let it read secrets:
az webapp identity assign --name todo-api --resource-group todo-rg
az role assignment create --assignee <that-identity's-principalId> \
    --role "Key Vault Secrets User" \
    --scope $(az keyvault show --name todo-kv --query id -o tsv)
```

Locally, `az login` makes `DefaultAzureCredential` authenticate as you — grant your own user the same
`Key Vault Secrets User` role and the app runs unmodified on your machine.

Two related services, briefly, so the names aren't noise:

- **Azure App Configuration** is Key Vault's non-secret sibling: a central store for ordinary settings
  and **feature flags** (toggle a feature on for 10% of users, or just for you, without redeploying).
  It plugs into `builder.Configuration` the same way (`AddAzureAppConfiguration`, package
  `Microsoft.Azure.AppConfiguration.AspNetCore`) and holds *references* to Key Vault secrets rather
  than secrets themselves. Rule of thumb: secrets → Key Vault; shared settings and flags → App
  Configuration; per-app trivia → `appsettings.json`.
- Managed identity isn't just for Key Vault: Blob, Cosmos, and Service Bus all accept
  `DefaultAzureCredential` too (e.g. `new BlobServiceClient(new Uri("https://acct.blob.core.windows.net"),
  new DefaultAzureCredential())`), which retires the connection strings from section 1 the same way.

### Try it — Azure:

Prerequisites: the deployed API from the Azure Compute chapter, `az` CLI. **Cost:** Key Vault bills per
10k operations (~$0.03) — pocket change at this scale. There is no local Key Vault emulator; for
offline work, ASP.NET Core's **user-secrets** tool (`dotnet user-secrets set "Jwt:Key" "dev-key"`)
plays the same "secrets outside the repo" role on a dev machine.

1. Create `todo-kv`, store your JWT key and DB connection string as `Jwt--Key` and
   `ConnectionStrings--Db`.
2. Add the two `AddAzureKeyVault` lines, delete the real values from `appsettings.json` (leave dummy
   placeholders), grant yourself the `Key Vault Secrets User` role, `az login`, run locally — the API
   works with zero secrets on disk.
3. Assign your App Service a managed identity, grant it the role, redeploy, and delete the secret
   app settings you set with `az webapp config appsettings set` in chapter 13. The deployed API now
   holds no secrets anywhere.
4. Audit: portal → your vault → Monitoring shows who read what, when.

### Traps

- **Secrets already committed to git are burned.** Adding Key Vault later doesn't un-leak them — git
  history keeps every version. Rotate (change) any secret that has ever been committed.
- **Vault throttling at startup.** The config provider loads all secrets once at boot — fine. Fetching
  secrets with `SecretClient` inside request handlers hits vault rate limits under load; read at
  startup, or cache.
- **`DefaultAzureCredential` picking the wrong identity** — it silently authenticates as whatever in
  the chain succeeds first (your `az login`? a leftover environment variable?). In production, pin it:
  `ManagedIdentityCredential` or `AZURE_TOKEN_CREDENTIALS=ManagedIdentityCredential`.
- **Forgetting the `--` ↔ `:` mapping** — the secret loads fine but `Configuration["Jwt:Key"]` is null
  because the secret was named `Jwt-Key` or `Jwt:Key` (invalid) instead of `Jwt--Key`.

---

## 3. Messaging

### The idea — async decoupling from zero

Your API creates a todo and should also email a confirmation. The obvious code — call the email service
inside the POST handler — couples two services in three bad ways:

- **Latency:** the user waits for the email hop; the response time is the *sum* of every downstream call.
- **Availability:** if the email service is down, creating todos fails — an outage in a side-effect
  takes out the core feature.
- **Load:** a spike of requests hits every downstream service at full force, simultaneously.

The decoupling move is a **queue**: the API writes a small **message** ("todo 7 created for user 42")
to a durable buffer and returns immediately. A separate **consumer** (a worker service, or an Azure
Function with a queue trigger — chapter 13) reads messages at *its own* pace and does the slow work.
What this buys, precisely:

- **Spike smoothing:** 10,000 requests in a minute become 10,000 queued messages; the worker drains
  them steadily. The queue absorbs the burst; nothing downstream is overwhelmed.
- **Retries and outage-riding:** if the worker crashes mid-message, the message isn't lost — it
  reappears on the queue and is retried. If the email service is down for an hour, messages simply wait.
- **Independent scaling:** the API and the worker are separate deployables — scale the worker on queue
  length, the API on HTTP traffic.

This is the same "don't block on slow work" instinct as `async`/`await` from the Async chapter — but
across *processes*, surviving crashes, with the queue as durable memory between them.

Azure has two queue services, and the choice is honest:

| | **Storage Queues** | **Service Bus** |
|---|---|---|
| Part of | a storage account (section 1) | dedicated messaging service |
| Model | simple queues only | queues **and** topics/subscriptions |
| Ordering / duplicate detection / sessions | no | yes |
| Max message size / TTL | 64 KB / 7 days | larger / unlimited |
| Cost & setup | cheaper, trivial | pricier, richer |

Rule of thumb: a simple background-work buffer → Storage Queues; anything with multiple consumers,
ordering, or enterprise patterns → Service Bus.

Service Bus adds one big idea: **topics and subscriptions** — publish/subscribe. A queue is
point-to-point (each message consumed once, by one consumer). A **topic** is a queue with fan-out:
publishers send to the topic, and *each* **subscription** gets its own copy of every message. Publish
`todo-created` once; the email service, the statistics service, and the audit log each consume it
independently — and the publisher doesn't know any of them exist. Adding a fourth consumer is a new
subscription, zero publisher changes.

Two consequences of durability that every queue system shares:

- **At-least-once delivery.** The consumer receives a message, processes it, then acknowledges
  ("complete") it. If it crashes *after* processing but *before* completing, the message is
  redelivered — so the same message can be processed **twice**. The fix is not on the queue side; it's
  making your handler **idempotent** (safe to run twice): "set `emailSent = true`" is idempotent,
  "increment `emailCount`" is not; or track processed message IDs and skip repeats.
- **Dead-letter queues.** A message that fails repeatedly (poison message — bad data, a bug) must not
  block the queue or retry forever. After N failed deliveries, the broker shunts it to a side queue —
  the **dead-letter queue (DLQ)** — for a human to inspect. An unmonitored DLQ is where failures hide;
  alert on its length.

> ⚠ **Fast-moving area.** SDK package names (`Azure.Messaging.ServiceBus` replaced the older
> `Microsoft.Azure.ServiceBus`) and Service Bus tiers/quotas churn. The concepts below are stable;
> verify against current Azure docs before relying on them.

### In practice

```bash
dotnet add package Azure.Messaging.ServiceBus
```

Sending (this is the only messaging code your *API* needs — one line in the POST handler's place of the
email call):

```csharp
using Azure.Messaging.ServiceBus;

string conn = Environment.GetEnvironmentVariable("SERVICEBUS_CONN")!;
await using var client = new ServiceBusClient(conn);        // or (namespaceUri, DefaultAzureCredential)
await using ServiceBusSender sender = client.CreateSender("todo-created");

var msg = new ServiceBusMessage("""{ "todoId": 7, "userId": "user-42" }""")
{
    ContentType = "application/json",
    MessageId   = "todo-7-created"    // stable ID — lets consumers deduplicate
};
await sender.SendMessageAsync(msg);
Console.WriteLine("Enqueued. API can return 201 now — the email is someone else's problem.");
```

```text
Enqueued. API can return 201 now — the email is someone else's problem.
```

Receiving, in a separate worker process. `ServiceBusProcessor` runs a callback per message and manages
the receive loop:

```csharp
using Azure.Messaging.ServiceBus;

await using var client = new ServiceBusClient(Environment.GetEnvironmentVariable("SERVICEBUS_CONN")!);
await using ServiceBusProcessor processor = client.CreateProcessor("todo-created");

processor.ProcessMessageAsync += async args =>
{
    Console.WriteLine($"Processing {args.Message.MessageId}: {args.Message.Body}");
    // ... send the email (idempotently!) ...
    await args.CompleteMessageAsync(args.Message);   // ack — only now is the message gone
};
processor.ProcessErrorAsync += args =>
{
    Console.WriteLine($"Error: {args.Exception.Message}");   // after max retries → dead-letter queue
    return Task.CompletedTask;
};

await processor.StartProcessingAsync();
Console.WriteLine("Worker listening. Press Enter to stop.");
Console.ReadLine();
await processor.StopProcessingAsync();
```

```text
Worker listening. Press Enter to stop.
Processing todo-7-created: { "todoId": 7, "userId": "user-42" }
```

If the handler throws, `CompleteMessageAsync` never runs, the lock on the message expires, and the
broker redelivers it — that's at-least-once delivery happening. After the queue's max delivery count
(default 10), the message lands in the DLQ, addressable as `todo-created/$deadletterqueue`.

Storage Queues, for contrast, in full (package `Azure.Storage.Queues` — note it takes the *storage
account* connection string from section 1, and works against Azurite):

```csharp
using Azure.Storage.Queues;

var queue = new QueueClient(Environment.GetEnvironmentVariable("STORAGE_CONN")!, "todo-created");
await queue.CreateIfNotExistsAsync();
await queue.SendMessageAsync("""{ "todoId": 7 }""");

var received = await queue.ReceiveMessagesAsync(maxMessages: 1);
foreach (var m in received.Value)
{
    Console.WriteLine($"Got: {m.MessageText}");
    await queue.DeleteMessageAsync(m.MessageId, m.PopReceipt);   // the "complete" equivalent
}
```

```text
Got: { "todoId": 7 }
```

Same shape — send, receive, explicit delete-after-processing — with less machinery and fewer features.

> **C corner:** a queue between services is a producer/consumer ring buffer between threads, scaled
> out: the enqueue is the producer writing a slot, the ack is the consumer advancing the read index,
> and at-least-once is what you get when the consumer can crash between reading the slot and advancing
> the index. The broker is the mutex, the condition variable, and the persistence, so nobody has to
> write that code correctly at 2 a.m.

### Try it — Azure:

Prerequisites: `az` CLI, .NET 10, two terminal windows. **Cost:** Service Bus Basic tier is ~$0.05 per
million operations — create it, play, `az group delete` when done. There's no faithful local Service
Bus (an official emulator exists as a Docker container with limitations), but **Azurite** fully
emulates Storage Queues locally and free — do step 1 against it if you're offline.

1. Warm-up with Storage Queues (Azurite or your section-1 storage account): run the Storage Queue
   snippet, then comment out `DeleteMessageAsync` and rerun the receive — the message comes back after
   its visibility timeout. You've just watched at-least-once delivery.
2. `az servicebus namespace create --name todo-bus-<unique> --resource-group todo-rg --sku Basic`,
   then `az servicebus queue create --namespace-name todo-bus-<unique> --resource-group todo-rg
   --name todo-created`. Get the connection string from
   `az servicebus namespace authorization-rule keys list ... --name RootManageSharedAccessKey`.
3. Run the receiver in one terminal, the sender in the other. Then kill the receiver mid-processing
   (before `CompleteMessageAsync`) and restart it — the message is redelivered.
4. Make it fail: `throw` in the handler, send once, and watch the delivery count climb until the
   message dead-letters. Peek the DLQ in the portal (Service Bus Explorer → the queue → Dead-letter).
5. Stretch: wire the sender into your deployed to-do API's POST handler and let a chapter-13 Azure
   Function with a Service Bus trigger be the consumer.

### Traps

- **Assuming exactly-once delivery.** Every mainstream broker is at-least-once. Write handlers
  idempotent from day one — duplicates *will* arrive, precisely when things are already going wrong
  (crashes, timeouts).
- **Big payloads in messages.** Don't enqueue the 5 MB PDF; upload it to Blob (section 1) and enqueue
  its path — the *claim check* pattern. Messages are notifications, not cargo.
- **Nobody watching the dead-letter queue.** DLQs fill silently; users report "I never got my email"
  weeks later. Alert on DLQ length from the start.
- **Queueing what needs an immediate answer.** Queues are for fire-and-forget side effects. If the
  caller needs the result to respond (e.g. validating a card before confirming an order), that's a
  synchronous call — a queue just adds latency and complexity there.

---

## Check yourself

- Can you explain where the bytes of a user upload should live and why, what a SAS URL grants and for
  how long, and what makes a good Cosmos partition key (and what a bad one costs you)? If yes, tick
  *Blob & Cosmos DB* above.
- Can you explain how a deployed app reads its DB password with **no secret stored anywhere** — the
  roles managed identity, `DefaultAzureCredential`, and `AddAzureKeyVault` each play? If yes, tick
  *Key Vault & config* above.
- Can you say what a queue buys over a direct call (three things), when you'd pick Service Bus over
  Storage Queues, and why handlers must be idempotent? If yes, tick *Messaging* above.

All three ticked? Tick the chapter. Your API now has files, secrets, and async work handled the way
production systems do — next stop is making the deployments themselves automatic.
