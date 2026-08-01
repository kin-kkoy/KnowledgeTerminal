# Containers

You met Docker in the Deployment chapter: image vs container, a first multi-stage Dockerfile,
`docker build` and `docker run`. This chapter deepens that, because **the container image is the unit
the cloud deploys** — every Azure compute service in the next chapter takes an image and runs it.
Here you make that image production-grade (small, non-root, health-checked, cache-friendly) and then
put it somewhere the cloud can pull it from: **Azure Container Registry**.

---

## 1. Dockerize .NET

### The idea

The Deployment chapter's Dockerfile *worked*. A production Dockerfile has four extra jobs:

1. **Build fast on rebuild** — order the layers so Docker's cache does most of the work.
2. **Ship small** — the runtime image should contain the runtime and your app, nothing else. Small
   images pull faster (faster deploys and cold starts) and contain fewer packages that can have CVEs
   (published security vulnerabilities — less software, less to patch).
3. **Run as non-root** — if the app is compromised, the attacker should not be root inside the
   container.
4. **Report health** — the platform running the container needs a way to ask "is this app actually
   alive?", not just "is the process running?".

Quick recap of the model from Deployment, one paragraph: a **Dockerfile** is a script that builds an
**image** (an immutable, layered filesystem snapshot plus a start command). A **container** is a
running instance of an image. A **multi-stage** Dockerfile uses one image to *compile* (the big `sdk`
image, which has the compiler) and a different, smaller image to *run* (the `aspnet` image, which has
only the runtime). Only the final stage ships.

> ⚠ **Fast-moving area.** Image tag names churn with .NET and Ubuntu releases: as of this writing the
> current LTS tags are `sdk:10.0` and `aspnet:10.0` (Ubuntu 24.04 "noble" based), with `-alpine` and
> `-noble-chiseled` variants. The concepts below are stable; verify tag names against the
> `mcr.microsoft.com/dotnet` catalog before relying on them.

#### Layer caching — why line order matters

Docker builds an image as a stack of **layers**, one per Dockerfile instruction, and caches each
layer keyed on the instruction *and* the files it consumed. On rebuild, Docker reuses cached layers
from the top down — until the first layer whose inputs changed. From that point on, **everything
below is rebuilt**.

That's why a production Dockerfile copies the `.csproj` file *alone* and runs `dotnet restore`
*before* copying the rest of the source. `dotnet restore` downloads your NuGet packages
(dependencies), and your dependency list changes rarely while your source changes constantly. With
restore in its own layer, an ordinary code edit reuses the cached restore — rebuilds drop from
minutes to seconds. The rule generalizes: **order layers stalest → freshest**.

#### Image size — aspnet vs sdk, alpine, chiseled

Rough sizes for .NET 10 (amd64, compressed sizes vary — the *ratios* are the point):

| Base image | Contents | Approx. size |
|---|---|---|
| `sdk:10.0` | compiler, MSBuild, NuGet, full runtime | ~800 MB |
| `aspnet:10.0` | ASP.NET Core runtime on Ubuntu | ~220 MB |
| `aspnet:10.0-alpine` | runtime on Alpine Linux (musl libc) | ~120 MB |
| `aspnet:10.0-noble-chiseled` | runtime on "chiseled" Ubuntu: no shell, no package manager, non-root by default | ~110 MB |

Never ship the `sdk` image — that's the whole reason multi-stage builds exist. Between the runtime
variants: `aspnet:10.0` is the safe default; **alpine** is smaller but uses a different C library
(musl instead of glibc), which occasionally trips native dependencies; **chiseled** is the security
favorite — there is *no shell and no package manager inside*, so even a successful attacker has
almost nothing to work with. The cost: you can't `docker exec` a shell into it to poke around, and a
`HEALTHCHECK` can't run a curl command (more below).

#### Non-root — `USER $APP_UID`

By default a container's process runs as root *inside the container*. Container isolation is good but
not a security boundary you want to bet everything on — a kernel exploit or a misconfigured mount can
turn "root in the container" into real damage. The fix is one line. The .NET images (8.0+) create a
non-root user called `app` and export its numeric UID as the environment variable **`APP_UID`**
(value `1654`), so:

```dockerfile
USER $APP_UID
```

switches all following instructions and the running app to that user. Two consequences you must know:

- Non-root processes can't bind ports below 1024, so the .NET images default the app to **port
  8080** (via `ASPNETCORE_HTTP_PORTS=8080`), not 80.
- The app can no longer write anywhere it likes in the filesystem. If it writes files, give it a
  writable path deliberately (a mounted volume) — treat the image itself as read-only.

Chiseled images skip the ceremony: they *only* contain the non-root user, so they're non-root even
without the `USER` line.

#### Container health — HEALTHCHECK and health endpoints

"The process is running" and "the app works" are different facts. A deadlocked app or one that lost
its database connection still has a live process. Health has two halves:

- **The app exposes a health endpoint** — ASP.NET Core has this built in:

  ```csharp
  builder.Services.AddHealthChecks();   // before builder.Build()
  // ...
  app.MapHealthChecks("/healthz");      // after builder.Build()
  ```

  `GET /healthz` now returns `200 OK` with body `Healthy` while the app can serve requests.

- **Something calls that endpoint.** Locally and in Docker Compose that's the Dockerfile
  `HEALTHCHECK` instruction (shown below): Docker calls it on an interval and marks the container
  `healthy`/`unhealthy` in `docker ps`. In the cloud it's usually *not* Docker doing the probing —
  Azure's compute services and Kubernetes **ignore the Dockerfile `HEALTHCHECK`** and instead let
  you configure their own probes, which you'll point at this same `/healthz` endpoint in the next
  chapter. The endpoint is the durable part; who probes it varies by platform.

#### .dockerignore

`docker build` first uploads the **build context** (the directory you point it at) to the Docker
daemon. Without a `.dockerignore`, that includes `bin/`, `obj/`, and `.git/` — megabytes of junk
that slows the upload *and* breaks caching: `COPY . .` sees those files, so a local build changing
`bin/` invalidates the layer even though no source changed. Worse, host-built `obj/` files can
poison the in-container restore. Always ship a `.dockerignore`.

#### Environment config into containers

An image should be **environment-agnostic**: the *same* image runs in dev, staging, and production,
and only its configuration differs. You already know the mechanism from the backend chapters —
ASP.NET Core configuration reads environment variables, and `__` (double underscore) in a variable
name maps to `:` in a config key. So the connection string `ConnectionStrings:Default` is set from
outside at run time:

```bash
docker run -e ConnectionStrings__Default="Host=db;Database=todo" -e ASPNETCORE_ENVIRONMENT=Production todo-api
```

Never bake secrets into the image (`ENV` lines with passwords, copied `appsettings.Production.json`
with credentials): images get pushed to registries and pulled by many people, and every layer is
inspectable with `docker history`. Config goes in at `docker run` time — in Azure, the compute
service injects it (and pulls secrets from Key Vault, as set up in the Cloud Foundations chapter).

### In practice

The production Dockerfile for the to-do API, line by line. Assume the project file is
`TodoApi.csproj` in the directory you build from.

```dockerfile
# --- build stage: big SDK image, used only to compile; never shipped ---
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# 1) Copy ONLY the project file, restore in its own cached layer.
COPY TodoApi.csproj .
RUN dotnet restore

# 2) Now copy the source. Editing a .cs file invalidates from HERE down,
#    but the restore layer above stays cached.
COPY . .
RUN dotnet publish -c Release -o /app --no-restore

# --- runtime stage: small aspnet image, no compiler ---
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app .

# Run as the built-in non-root user (UID 1654, exported as APP_UID).
USER $APP_UID

# Non-root can't bind <1024; the image already defaults the app to 8080.
EXPOSE 8080

# Docker-level health probe: hits the app's /healthz every 30s.
# (Cloud platforms ignore this and use their own probes on the same endpoint.)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8080/healthz || exit 1

ENTRYPOINT ["dotnet", "TodoApi.dll"]
```

Notes on the unfamiliar pieces: `--no-restore` on publish skips a redundant second restore;
`COPY --from=build` reaches into the *build* stage's filesystem; `wget -qO-` fetches a URL quietly
to stdout (the Ubuntu-based image has `wget`; a chiseled image has no shell at all, so there you'd
drop `HEALTHCHECK` and rely on platform probes).

`.dockerignore`, next to the Dockerfile:

```text
bin/
obj/
.git/
*.md
Dockerfile
.dockerignore
```

Build it twice to see the cache work:

```bash
docker build -t todo-api .
# ...first build: every step runs, restore downloads packages...
#  => [build 4/6] RUN dotnet restore                    18.3s

# Touch a source file, rebuild:
docker build -t todo-api .
#  => CACHED [build 3/6] COPY TodoApi.csproj .
#  => CACHED [build 4/6] RUN dotnet restore
#  => [build 5/6] COPY . .                               0.1s
```

Run it and verify non-root and health:

```bash
docker run -d -p 8080:8080 --name todo todo-api

docker exec todo whoami
# app

curl -s http://localhost:8080/healthz
# Healthy

docker ps --format '{{.Names}}: {{.Status}}'
# todo: Up 45 seconds (healthy)

docker images todo-api --format '{{.Repository}}: {{.Size}}'
# todo-api: 254MB      # vs ~850MB if you'd shipped the sdk image
```

> **C corner:** a Docker image layer is close in spirit to incremental compilation with `make`:
> each instruction is a target, its "prerequisites" are the files it copies, and an unchanged
> prerequisite means the cached artifact is reused. Ordering `COPY *.csproj` + `restore` before
> `COPY . .` is the same instinct as keeping headers stable so you don't recompile the world.

**Try it — Project:** *(prerequisite: Docker installed and running — this happens in your own
terminal, not the Study tab)*. Take your to-do API from the backend chapters and:

1. Add the health endpoint (`AddHealthChecks` / `MapHealthChecks("/healthz")`) and the
   `.dockerignore` and Dockerfile above (adjust the `.csproj` name).
2. `docker build -t todo-api .` — then change one line of C# and build again. Confirm
   `CACHED ... RUN dotnet restore` appears in the second build's output.
3. `docker run -d -p 8080:8080 --name todo todo-api`, then confirm `docker exec todo whoami`
   prints `app` and `docker ps` shows `(healthy)` after ~30 seconds.
4. Optional: change the runtime base to `aspnet:10.0-alpine`, rebuild, and compare
   `docker images todo-api`.

**Traps**

- **`COPY . .` before restore.** The build still succeeds, so nothing warns you — but every code
  edit now re-downloads all packages. If your rebuilds feel slow, check layer order first.
- **Assuming port 80.** With the non-root user the app listens on 8080; `docker run -p 80:80`
  silently maps a port nobody is listening on and every request fails to connect.
- **Baking config into the image.** An image with a production connection string inside it is a
  leaked credential waiting to happen (`docker history` shows all) and forces a rebuild per
  environment. Same image everywhere; config via environment variables at run time.
- **A green HEALTHCHECK that lies.** If `/healthz` only proves "the web server responds", a dead
  database goes unnoticed. ASP.NET Core health checks accept custom checks (e.g. a database ping)
  — add them for anything the app cannot live without.

---

## 2. Registries (ACR)

### The idea

Recap from Deployment, one sentence: a **container registry** is a versioned store of images that
`docker push` uploads to and any machine — your laptop, a teammate's, an Azure service — can
`docker pull` from; Docker Hub is the public one. In the cloud you want a **private** registry that
lives next to your compute and speaks Azure's identity system: **Azure Container Registry (ACR)**.

An ACR has a globally unique name, which becomes its login server: registry `facetodo` is reached at
`facetodo.azurecr.io`. Image names are how Docker routes pushes: `todo-api:v1` is a local name, but
`facetodo.azurecr.io/todo-api:v1` says "repository `todo-api`, tag `v1`, in *that* registry" —
which is why pushing always starts with `docker tag` to give your image its registry-qualified name.

> ⚠ **Fast-moving area.** `az acr` command shapes, SKU names (Basic/Standard/Premium), and ACR's
> RBAC roles (the classic `AcrPull` role vs the newer repository-level roles on ABAC-enabled
> registries) all churn. The concepts below are stable; verify against current docs before relying
> on them.

#### Tags vs digests

A **tag** (`:v1`, `:latest`, a git commit SHA) is a mutable, human-friendly pointer — like a git
branch. Anyone with push rights can re-point `v1` at a different image tomorrow. A **digest**
(`@sha256:9f2b...`) is the content hash of the image itself — like a git commit: immutable, and it
identifies *exactly one* build forever. Practical policy:

- **Tag every push with a real version** (`:v1`, `:2026.07.1`, or the commit SHA). Never deploy
  `:latest` to production — it's a moving target; you can't answer "which build is live?" or roll
  back to "the previous latest".
- When you need a guarantee (audits, "pin exactly what we tested"), reference by digest.

#### Authentication — three options, and which to use when

| Method | What it is | Use when |
|---|---|---|
| **Admin user** | A single built-in username/password for the whole registry, disabled by default | Personal experiments only. One shared credential, full push+pull, no audit trail of *who* — turn it off otherwise. |
| **Tokens (with scope maps)** | Registry-issued credentials scoped to specific repositories/actions (e.g. "pull-only, repo `todo-api`") | Giving a narrow credential to something *outside* your Microsoft Entra tenant — an external CI system, a partner. |
| **Microsoft Entra identity** (your `az login`, or a **managed identity**) | Normal Azure RBAC: assign the `AcrPull` or `AcrPush` role to an identity | Everything else. Humans use `az acr login`; Azure services use their managed identity. No password exists to leak or rotate. |

The default answer is the third one. You met **managed identity** in the Cloud Foundations chapter
— an identity Azure creates *for a resource*, with credentials Azure itself manages. **Letting an
Azure service pull from ACR** is exactly that pattern: give the compute service's managed identity
the `AcrPull` role on the registry, and it pulls with no stored secret anywhere. You'll wire this up
for real in the next chapter; the `az role assignment` command below is the whole trick.

For *you* at the terminal, `az acr login` bridges Azure identity to Docker: it uses your `az login`
session to fetch a short-lived token and hands it to the local Docker client. No registry password
involved.

### In practice

*(Prerequisites: an Azure account with the `az` CLI logged in — set up in the Cloud Foundations
chapter — plus Docker and the image from section 1. ACR names must be globally unique, lowercase
alphanumeric: pick your own instead of `facetodo`.)*

Create the registry (Basic SKU is the cheap dev tier, ~a few USD/month while it exists):

```bash
az acr create --resource-group todo-rg --name facetodo --sku Basic
# {
#   "loginServer": "facetodo.azurecr.io",
#   "name": "facetodo",
#   "provisioningState": "Succeeded",
#   "sku": { "name": "Basic", ... },
#   ...
# }
```

Log in, tag, push:

```bash
az acr login --name facetodo
# Login Succeeded

docker tag todo-api facetodo.azurecr.io/todo-api:v1
docker push facetodo.azurecr.io/todo-api:v1
# The push refers to repository [facetodo.azurecr.io/todo-api]
# 5f70bf18a086: Pushed
# 9c1b6dd6c1e6: Pushed
# ...
# v1: digest: sha256:9f2b60cde3b1a4c8... size: 1786
```

That last line is the image's **digest** — record it if you ever need to pin this exact build.
Verify from the registry side, then round-trip a pull:

```bash
az acr repository show-tags --name facetodo --repository todo-api --output table
# Result
# --------
# v1

docker pull facetodo.azurecr.io/todo-api:v1
# v1: Pulling from todo-api
# Digest: sha256:9f2b60cde3b1a4c8...
# Status: Image is up to date for facetodo.azurecr.io/todo-api:v1
```

And the managed-identity grant you'll reuse next chapter — assigning `AcrPull` to a service's
identity (here `$PRINCIPAL_ID` is the managed identity's ID, which the compute service hands you
when you enable it):

```bash
az role assignment create \
  --assignee "$PRINCIPAL_ID" \
  --role AcrPull \
  --scope "$(az acr show --name facetodo --query id --output tsv)"
```

**Try it — Azure:** *(prerequisites: Docker + Azure account; a Basic ACR costs money while it
exists, so delete it — or the whole resource group — when done)*

1. Create an ACR in your `todo-rg` resource group, `az acr login`, tag your image
   `<yourname>.azurecr.io/todo-api:v1`, push it.
2. Change something visible in the API (a response string), rebuild, tag `:v2`, push. Note how the
   second push is fast: unchanged layers are `Layer already exists`.
3. `az acr repository show-tags ...` — both tags listed. That's your rollback history: redeploying
   `v1` is always possible because `v1` still exists.
4. `docker rmi` your local registry-tagged copies, then `docker pull ...:v1` — the round trip that
   every Azure compute service will do on your behalf.
5. Not continuing straight to the next chapter? `az group delete --name todo-rg` to stop the meter.

**Traps**

- **Pushing without the registry-qualified name.** `docker push todo-api:v1` tries Docker Hub and
  fails with `denied: requested access to the resource is denied`. The image name *is* the routing:
  tag as `<registry>.azurecr.io/<repo>:<tag>` first.
- **`unauthorized: authentication required` mid-workday.** `az acr login` tokens expire (hours);
  just run `az acr login` again. It's not a role problem if pushing worked earlier.
- **Enabling the admin user because a tutorial said so.** It works, which is the problem — one
  shared full-access password, and every consumer looks identical in the logs. Prefer `az acr login`
  for humans and managed identity + `AcrPull` for services.
- **Treating tags as immutable.** Nothing stops a second `docker push ...:v1` from silently
  replacing the first. Discipline (or a locked/immutable-tag policy on the registry) keeps `v1`
  meaning one build; digests are the only *guaranteed* immutable reference.

---

## Check yourself

- Can you write a multi-stage Dockerfile from memory that keeps `dotnet restore` in a cached layer,
  runs as non-root on port 8080, and explain what `HEALTHCHECK` proves that "the process is up"
  doesn't? If yes, tick *Dockerize .NET* above.
- Can you push a versioned image to an ACR and say when you'd authenticate with the admin user, a
  token, or a managed identity — and why `:latest` and digests sit at opposite ends of the
  trust scale? If yes, tick *Registries (ACR)* above.

Both ticked — tick the chapter. Your image is now small, non-root, health-checked, and sitting in a
registry under a real version tag: a deployable unit. Next stop before the compute chapter points
services at it: the cloud checkpoint **cpc1** (see *Checkpoints & Defenses*), which gates on exactly
these skills.
