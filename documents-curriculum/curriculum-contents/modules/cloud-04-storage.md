# Cloud Module 04 — Storage & Config

**Days:** 5 · **Prereq:** Azure Compute

## Mission brief

Real apps persist state, keep secrets safe, and decouple work. Learn the Azure storage/data services you'll actually reach for from C#: **Blob Storage** (files/objects), **Cosmos DB** (globally-distributed NoSQL), **Key Vault** (secrets/keys), and **messaging** (Service Bus / Storage Queues) to decouple producers from consumers. You did relational + EF Core in backend Module 07; this is the cloud-native complement.

**Bridges:** Blob ≈ a filesystem in the cloud · Cosmos ≈ a document DB (model for access patterns, not normal forms) · Key Vault ≈ your app's password manager · queues ≈ async decoupling (the outbox/worker pattern).

---

## Day blocks

### Day 1 — Blob Storage from C#
- [ ] **Build:** upload/download/list blobs with the Azure SDK (`Azure.Storage.Blobs`), authenticated by **managed identity** (`DefaultAzureCredential`). Generate a time-limited SAS URL for a client download.
  - **Done-when:** your app stores and retrieves a file with no connection-string secret in code.

### Day 2 — Cosmos DB
- [ ] **Build:** a small Cosmos container; model one entity for its **access pattern** (partition key choice matters). CRUD from C#. Understand RU/s and why a bad partition key is expensive.
  - **Done-when:** you can query by partition key efficiently and explain your partition choice.

### Day 3 — Key Vault & configuration
- [ ] **Do:** store a secret in Key Vault; read it from your app via managed identity and the configuration provider. Rotate it and confirm the app picks up the change.
  - **Done-when:** zero secrets in source or app settings — all via Key Vault + identity.

### Day 4 — Messaging (Service Bus / Queues)
- [ ] **Build:** a producer that enqueues work and a consumer (a Function or worker) that processes it. Handle retries + dead-letter.
  - **Done-when:** a message flows producer → queue → consumer, with a failed message landing in the dead-letter queue.

### Day 5 — Integrate + cleanup
- [ ] **Do:** wire one of these into your p2/capstone API (e.g. Blob for uploads or a queue for a slow task). Tear down.

---

## Drills
1. **blob-crud**: upload/list/download via DefaultAzureCredential, cold.
2. **cosmos-partition**: justify a partition key for a given access pattern.
3. **keyvault-config**: app reads a secret via managed identity, no stored creds.
4. **queue-worker**: enqueue → dequeue → process with dead-letter on failure.
