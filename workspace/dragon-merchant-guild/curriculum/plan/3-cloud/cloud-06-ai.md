# Cloud Module 06 — AI-Integrated Cloud

**Days:** 5 · **Prereq:** CI/CD & IaC · **Cert:** AI-200 (Azure AI Cloud Developer) — the AZ-204 successor

## Why this exists

Microsoft's re-scoped Azure developer role (AI-200, replacing AZ-204 as of 2026-07-31) assumes AI integration is now *part of the job*, not a specialty. This module gives you the practical, employable version: call Azure's AI services from C#, and build one real feature — a **RAG** (retrieval-augmented generation) endpoint that grounds an LLM in your own data. You don't need to train models; you need to wire them in responsibly.

**Note on language:** the AI-200 study guide currently emphasizes Python. The *concepts and Azure services* here are identical from C# (the .NET SDKs are first-class); learn them in C# to stay in your stack, and cross-reference the official guide for exam specifics before booking.

**Bridges:** calling Azure OpenAI ≈ any HTTP/SDK service call you already do · embeddings ≈ turning text into vectors for similarity · RAG ≈ "search my data, then ask the model with that context" (grounding = fewer hallucinations).

---

## Day blocks

### Day 1 — Azure OpenAI / AI services from C#
- [ ] **Build:** call a chat model via the Azure OpenAI .NET SDK, authenticated by managed identity. Handle streaming, token limits, and errors. Add basic content-safety awareness.
  - **Done-when:** your API exposes an endpoint that proxies a prompt to the model and streams a response, no key in code.

### Day 2 — Prompts, structure & cost
- [ ] **Build:** system vs user prompts, structured output (ask for JSON, validate it), and cost/latency awareness (token counting, choosing model tiers).
  - **Done-when:** you get reliable structured output back and can estimate per-request cost.

### Day 3 — Embeddings & vector search
- [ ] **Build:** generate embeddings for a small document set, store vectors (Azure AI Search vector index or a pgvector Postgres), and do a similarity query.
  - **Done-when:** a text query returns the most relevant chunks by vector similarity.

### Day 4 — RAG feature
- [ ] **Build:** wire retrieval + generation: on a question, fetch top-k relevant chunks, inject them as context, and answer *grounded* in them (with citations). Compare answers with vs without grounding.
  - **Done-when:** grounded answers cite your data and refuse when the data doesn't cover the question.

### Day 5 — Ship it into the capstone + cleanup
- [ ] **Do:** fold the RAG endpoint into your capstone/p2 as a real feature (e.g. "ask about my docs"). Tear down.

---

## Cert track & Defense
- **AZ-204** (retires 2026-07-31) if you're already close; otherwise **AI-200** — verify current skills-measured + language coverage on Microsoft Learn before booking.
- **Cloud Cert Defense** (AI probe): hand your deployed, AI-integrated cloud project to Claude Code — justify every service choice (why Container Apps, why this partition key, why RAG over fine-tuning, where the cost goes) as if to a 5-year-old, then defend against the follow-ups.

## Drills
1. **chat-proxy**: stream a model response through your API via managed identity.
2. **structured-out**: reliable validated JSON from a prompt.
3. **rag-min**: top-k retrieval → grounded answer with citations, cold.
