# Deployment

An API on your laptop helps no one. **Deployment** is the leap from "it runs on my machine" to "it's
live on the internet, survives restarts, and I can tell when it breaks." You already have everything
this chapter needs: a real ASP.NET Core API (from the *ASP.NET Core* chapter), backed by a database
(from the *SQL & EF Core* chapter), protected by JWT auth (from the *Auth* chapter). This chapter
takes that app and teaches, from zero, how to package it, ship it automatically, and run it in public.

---

## 1. Docker & images

> ⚠ **Fast-moving area.** Base image tags churn: `:10.0` currently means Ubuntu ("Noble"), variants
> like `noble-chiseled` come and go, and the SDK's container tooling gains options every release. The
> concepts below are stable; verify names/versions against current docs before relying on them.

### The idea

The oldest bug in deployment is *"works on my machine."* Your API runs fine on your laptop because
your laptop happens to have the right .NET runtime, the right environment variables, the right file
layout. The server has none of that, and installing it by hand — then keeping it in sync forever — is
how production servers become haunted houses nobody dares touch.

A **container** solves this by shipping the machine along with the app. It is a running process that
carries its own private filesystem: your app, the .NET runtime, every file and library it needs,
frozen together. The host operating system runs the process; everything the process *sees* comes from
the bundle. Same bundle → same behavior, on your laptop, in CI, on the server.

Three terms, and the mental model that holds them together:

- An **image** is the frozen bundle — a read-only snapshot of a filesystem plus a startup command.
  Like a compiled executable, but for a whole environment. You *build* an image once.
- A **container** is a running instance of an image. Like a process is to an executable: one image,
  as many containers as you want, each isolated from the others.
- A **registry** is a server that stores images so other machines can pull them — Docker Hub,
  GitHub Container Registry (`ghcr.io`), Microsoft's `mcr.microsoft.com`. `docker push` uploads,
  `docker pull` downloads. Like a package feed, but for machine-snapshots.

Images are built in **layers**. Each build instruction adds a layer on top of the previous ones, and
layers are cached and shared: if nothing an instruction depends on changed, its layer is reused
instead of rebuilt. Every .NET image you build starts from Microsoft's base layers (runtime + OS),
which every machine downloads exactly once. This is why a "rebuild" after a one-line code change
takes seconds, not minutes — only the layers after your code copy are redone.

Containers are *not* virtual machines. A VM emulates hardware and boots a whole OS kernel; a
container is just an ordinary process whose view of the filesystem, network and process table is
isolated by the host kernel. That's why containers start in milliseconds and an image is megabytes,
not gigabytes.

### In practice

A **Dockerfile** is the build script for an image: a text file of instructions, executed top to
bottom, one layer each. Here is a production-quality Dockerfile for the to-do API you built in the
ASP.NET Core chapter (project file `TodoApi.csproj`), followed by a line-by-line reading:

```dockerfile
# ---- build stage: full SDK, used only to compile ----
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# copy just the project file first, restore packages — this layer
# is cached until the .csproj changes, so code edits skip restore
COPY TodoApi.csproj .
RUN dotnet restore

# now copy the rest of the source and publish an optimized build
COPY . .
RUN dotnet publish -c Release -o /app --no-restore

# ---- runtime stage: small image, no compiler ----
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app .
EXPOSE 8080
ENTRYPOINT ["dotnet", "TodoApi.dll"]
```

Line by line:

- `FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build` — start from Microsoft's **SDK** image (compiler,
  NuGet, MSBuild — everything needed to *build*). `AS build` names this stage so a later stage can
  refer to it. The `:10.0` after the name is the **tag** — which version of the image you want.
- `WORKDIR /src` — set the current directory *inside the image*; created if missing.
- `COPY TodoApi.csproj .` then `RUN dotnet restore` — copy only the project file and restore NuGet
  packages. Deliberate layer-cache trick: package restore is slow, and this layer only invalidates
  when the `.csproj` changes — not on every code edit.
- `COPY . .` — copy the rest of your source tree from your machine into the image.
- `RUN dotnet publish -c Release -o /app --no-restore` — compile with optimizations (`-c Release` —
  never ship a Debug build) into `/app`. `dotnet publish` is `build` plus "lay out everything the app
  needs to run in one folder."
- `FROM mcr.microsoft.com/dotnet/aspnet:10.0` — a **second** `FROM` starts a fresh stage from the
  small **aspnet runtime** image: it can run .NET apps but contains no compiler. This is a
  **multi-stage build** — and the final image is only what this last stage contains.
- `COPY --from=build /app .` — reach back into the `build` stage and take just the published output.
  The SDK, your source code, and all intermediate junk are left behind.
- `EXPOSE 8080` — documentation that the app listens on port 8080 (the default for .NET containers;
  the images set `ASPNETCORE_HTTP_PORTS=8080` for you). It doesn't open anything by itself.
- `ENTRYPOINT ["dotnet", "TodoApi.dll"]` — the command a container runs at startup.

Why multi-stage? The SDK image is ~800 MB; the aspnet runtime image is a fraction of that. Shipping
the compiler to production means slower pulls, slower deploys, and a bigger attack surface. Build
big, ship small.

Build and run it (from the folder containing the Dockerfile):

```bash
docker build -t todo-api .
docker run -d -p 8080:8080 --name todo todo-api
```

- `docker build -t todo-api .` — run the Dockerfile in the current directory (`.`), name the result
  (`-t` = tag) `todo-api`.
- `docker run -d -p 8080:8080 --name todo todo-api` — start a container from the image. `-d` =
  detached (background). `-p 8080:8080` maps *your machine's* port 8080 to the *container's* 8080 —
  without `-p`, the app runs but nothing outside the container can reach it. `--name todo` names the
  container so later commands can refer to it.

Expected output shape:

```text
$ docker build -t todo-api .
[+] Building 42.3s (14/14) FINISHED
 => [build 4/6] RUN dotnet restore
 => [build 6/6] RUN dotnet publish -c Release -o /app --no-restore
 => [stage-1 3/3] COPY --from=build /app .
 => naming to docker.io/library/todo-api

$ docker run -d -p 8080:8080 --name todo todo-api
3f2a9c1b8d7e...        # the new container's ID

$ curl http://localhost:8080/todos
[]
```

The everyday commands:

```bash
docker ps            # list running containers (add -a to include stopped ones)
docker logs todo     # show the container's console output (your ASP.NET logs)
docker logs -f todo  # ...and keep following, like tail -f
docker stop todo     # graceful stop
docker rm todo       # delete the stopped container (the image stays)
docker images        # list images on this machine
```

`docker ps` output looks like:

```text
CONTAINER ID   IMAGE      COMMAND               STATUS         PORTS                    NAMES
3f2a9c1b8d7e   todo-api   "dotnet TodoApi.dll"  Up 2 minutes   0.0.0.0:8080->8080/tcp   todo
```

**The no-Dockerfile alternative.** The .NET SDK can build a container image *itself* — no Dockerfile,
no Docker during the build:

```bash
dotnet publish /t:PublishContainer
```

The SDK picks an appropriate base image, layers your published app on top, and hands the image to
your local Docker daemon (or pushes straight to a registry via `ContainerRegistry` MSBuild
properties). For a standard ASP.NET Core app this is genuinely enough. Learn the Dockerfile anyway:
it's the lingua franca of every CI system and host you'll meet, and you need it the moment your image
requires anything custom (extra native libraries, fonts, tools).

> **C corner:** an image is to a container what an executable file is to a process — `docker build`
> is the linker, `docker run` is `exec`. And a container is *not* an emulator: it's a normal process
> whose view of the system is narrowed by the kernel (Linux namespaces + cgroups), the same kernel
> feature family as `chroot`, taken to its conclusion.

### Try it — Project

*(These exercises assume Docker is installed and running on your machine — `docker --version` should
print a version. If not, install Docker first; it's outside the app.)*

1. In your to-do API's folder, create the Dockerfile above (adjust `TodoApi` to your project name).
2. `docker build -t todo-api .` — watch the layer output; find the restore and publish layers.
3. `docker run -d -p 8080:8080 --name todo todo-api`, then hit `http://localhost:8080` with the same
   requests you used in the ASP.NET chapter. Same app, now in a box.
4. `docker logs todo` — confirm you see the ASP.NET startup lines and your request logs.
5. Change one line of a handler, rebuild, and time it: the restore layer should say `CACHED`.
6. `docker stop todo && docker rm todo` to clean up.

### Traps

- **Wrong `-p` order.** It's `-p host:container`. `-p 5000:8080` means "my localhost:5000 reaches the
  container's 8080." Flip it and the app is unreachable while `docker ps` looks perfectly healthy.
- **Container works, database doesn't.** Inside a container, `localhost` is *the container itself* —
  a connection string pointing at `localhost` no longer reaches the database on your machine. This is
  exactly why config lives in environment variables (ASP.NET chapter): pass the real address with
  `docker run -e "ConnectionStrings__Todo=..."` (note `__` replaces `:` in env-var names).
- **Data vanishes on `docker rm`.** A container's filesystem dies with it. SQLite file inside the
  container? Gone. Databases belong *outside* the app container — a separate container with a
  mounted volume, or a managed service (section 3).
- **Single-stage bloat.** `FROM sdk` all the way down works, and quietly ships an image several times
  larger than needed. If `docker images` shows your API near a gigabyte, you forgot the second stage.

---

## 2. CI/CD

> ⚠ **Fast-moving area.** Action version numbers churn constantly — `actions/checkout`,
> `actions/setup-dotnet` and `actions/upload-artifact` bump majors regularly (the `@vN` pins below
> were current at writing). The concepts below are stable; verify names/versions against current docs
> before relying on them.

### The idea

**CI — continuous integration** — means: every time anyone pushes code, a server automatically checks
out the repo, builds it, and runs the tests. Not "when someone remembers." Every push. The value is
the feedback loop: a broken build or failing test is flagged in minutes, pinned to the exact commit
that caused it, before it hides under a week of other changes. It also kills "works on my machine" at
the source level: CI builds on a clean machine every time, so a missing file or an accidentally
absolute path fails *there* even when it works locally.

**CD — continuous delivery/deployment** — is the next step: if the build is green, automatically
package the result (for us: build the Docker image and push it to a registry) and, in full continuous
*deployment*, release it. Deploys stop being a scary manual ritual and become a boring side effect of
merging.

The tool you'll actually meet first is **GitHub Actions**: CI/CD built into GitHub. You commit a YAML
file describing what to run; GitHub runs it on their machines ("runners") on every push, and shows a
green check or red X on each commit and pull request. The vocabulary:

- A **workflow** is one YAML file in `.github/workflows/` — one automated process.
- `on:` declares **triggers** — which events start it (push, pull request, a schedule, a button).
- A workflow contains **jobs**; each job gets a fresh virtual machine (`runs-on: ubuntu-latest`).
  Jobs run in parallel unless you chain them with `needs:`.
- A job is a list of **steps**, run in order on that machine. A step either `run`s a shell command or
  `uses` an **action** — a reusable step someone published, pinned by version (`@v6`).
- **Artifacts** are files a job uploads so you can download them after the run — test results,
  published binaries — since the runner VM is thrown away when the job ends.

### In practice

The complete workflow for a .NET solution — build, test, and (on `main` only) build the Docker image
and push it to GitHub's registry. Save as `.github/workflows/ci.yml`:

```yaml
name: ci

on:
  push:
    branches: [main]
  pull_request:            # also run on PRs, so reviewers see red/green

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6            # clone the repo onto the runner

      - uses: actions/setup-dotnet@v6        # install the .NET SDK
        with:
          dotnet-version: '10.0.x'           # any 10.0 SDK

      - run: dotnet restore

      - run: dotnet build --no-restore -c Release

      - run: dotnet test --no-build -c Release --logger trx --results-directory TestResults

      - uses: actions/upload-artifact@v7     # keep test results downloadable
        if: always()                         # even when tests fail — especially then
        with:
          name: test-results
          path: TestResults

  publish-image:
    needs: build-and-test                    # only runs if tests passed
    if: github.ref == 'refs/heads/main'      # only for main, not PRs
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write                        # allow pushing to ghcr.io
    steps:
      - uses: actions/checkout@v6

      - name: Log in to GitHub Container Registry
        run: echo "${{ secrets.GITHUB_TOKEN }}" | docker login ghcr.io -u ${{ github.actor }} --password-stdin

      - name: Build and push image
        run: |
          docker build -t ghcr.io/${{ github.repository }}:latest .
          docker push ghcr.io/${{ github.repository }}:latest
```

Reading the new pieces:

- `on:` — this workflow triggers on pushes to `main` and on every pull request. PR runs are the
  quality gate: GitHub shows the result right on the PR.
- `dotnet restore` / `build --no-restore` / `test --no-build` — split into three steps so the log
  tells you *which phase* broke; the `--no-*` flags stop later steps from silently redoing earlier
  work.
- `--logger trx` writes test results to files, and `upload-artifact` with `if: always()` saves them
  even on failure — a red run where the evidence evaporated with the VM helps no one.
- `${{ ... }}` is the Actions expression syntax. `secrets.GITHUB_TOKEN` is a credential GitHub mints
  automatically for each run; `github.actor` and `github.repository` are metadata (your username,
  `you/your-repo`). You never paste real passwords into the YAML — other secrets go in the repo's
  *Settings → Secrets* and appear the same way.
- The `publish-image` job `needs:` the test job (CI gates CD) and its `if:` skips it for PRs — you
  don't publish images of unmerged code. It reuses your section-1 Dockerfile unchanged, then pushes
  to `ghcr.io` so any machine — including the host in section 3 — can `docker pull` it.

What you see in the GitHub UI after a push: an **Actions** tab entry per run, each job with expandable
per-step logs. A failing test looks like:

```text
  Failed TodoApiTests.AddTodo_ReturnsCreated [23 ms]
  Error Message:
   Assert.Equal() Failure: Expected 201, Actual 500
Error: Process completed with exit code 1.
```

...the job goes red, `publish-image` is skipped, and the commit gets a red X. Broken code never
becomes an image. That sentence is the whole point of CI/CD.

### Try it — Project

*(Needs a GitHub repo; the Docker job additionally needs the section-1 Dockerfile committed.)*

1. Push your to-do API (with its test project from the ASP.NET chapter) to a GitHub repo.
2. Add `.github/workflows/ci.yml` with just the `build-and-test` job first. Commit, push, and watch
   the run in the Actions tab.
3. Break a test on purpose — flip one expected value — and push. Watch the red X arrive, open the
   step log, and find the failure message. Fix it, push, watch it go green. *That loop is CI.*
4. Add the `publish-image` job and push to `main`. Confirm the image appears under your GitHub
   profile → Packages, then prove the loop closes:
   `docker pull ghcr.io/<you>/<repo>:latest && docker run -d -p 8080:8080 ghcr.io/<you>/<repo>:latest`.

### Traps

- **YAML indentation.** Structure *is* indentation (spaces, never tabs). A step indented one level
  too far produces a baffling "unexpected value" error at a line number near, not at, the mistake.
- **Tests pass locally, fail in CI.** Usually an honest bug the clean machine exposed: a hardcoded
  path, a file not committed, dependence on a locally installed tool, or a casing mismatch
  (`Data.db` vs `data.db` — Linux runners are case-sensitive, your machine's filesystem may not be).
  CI is right; fix the code.
- **Secrets in the YAML.** The workflow file is in the repo, so anything typed into it is public
  history forever. Connection strings and tokens go in *Settings → Secrets* and are referenced as
  `${{ secrets.NAME }}` — never inline.
- **Unpinned actions.** `uses: actions/checkout` with no `@vN` (or `@main`) means someone else's
  future change can alter or break your pipeline. Always pin a version.

---

## 3. Hosting, HTTPS & monitoring

> ⚠ **Fast-moving area.** Hosting offerings churn fastest of all — PaaS products rename, change free
> tiers, appear and die within a couple of years. The concepts below are stable; verify names/versions
> against current docs before relying on them.

### The idea

You have an image in a registry. It still needs a machine to run on, a public HTTPS address, and a
way to tell you when it's sick. Where apps actually run, in increasing order of "how much is done for
you":

- **A VPS (virtual private server)** — you rent a Linux virtual machine with a public IP. You SSH in,
  install Docker, `docker pull` and `docker run` your image yourself. Total control, fixed low price;
  in exchange *you* are the operations team: OS updates, restarts, TLS, backups.
- **A PaaS (platform as a service)** — you hand over code or a repo; the platform builds, runs,
  scales, and gives you an HTTPS URL. Fastest path, least control, and pricing that grows with usage.
- **Containers-as-a-service** — the middle path, and the one your work so far points at: you hand
  over an *image* ("run `ghcr.io/you/todo-api:latest`, 512 MB, port 8080") and the platform runs it
  with a managed URL and TLS. Your container runs identically to how it ran locally — that's the
  payoff of section 1. (At real scale this becomes an orchestrator — Kubernetes — which is a career
  topic of its own; know the name, don't start there.)

The trade-off axis is the same everywhere: **control and fixed cost** versus **operations done for
you**. For a first deployment, anything that takes a container image and gives back an HTTPS URL is
the right choice.

Three concepts appear on every one of those roads:

**Reverse proxies.** Your Kestrel server (ASP.NET Core chapter) listens on plain HTTP on port 8080.
In front of it sits a **reverse proxy** — a server like Nginx or Caddy that accepts the public
traffic on ports 80/443 and forwards it to your app. "Reverse" because it fronts *servers* (a normal
proxy fronts clients). It's where TLS terminates, and it can serve several apps from one machine,
load-balance, and shield the app from raw internet weirdness. On a PaaS, the platform's edge *is* the
reverse proxy; on a VPS, you run one yourself.

**TLS certificates.** HTTPS is HTTP inside an encrypted TLS tunnel. To prove your server really is
`api.example.com` (and not an impostor), it presents a **certificate**: a statement "this public key
belongs to this domain," digitally signed by a **certificate authority (CA)** that browsers already
trust. **Let's Encrypt** is a free CA that automated the whole thing: an agent on your server answers
a challenge proving it controls the domain (e.g. serving a token at a URL the CA specifies), receives
a certificate valid ~90 days, and renews it automatically forever. Practically: on a PaaS this is a
checkbox; on a VPS, the proxy handles it (Caddy provisions Let's Encrypt certificates by default —
you literally write the domain name in its config and HTTPS happens). Your app code never touches
certificates; auth (Auth chapter) *depends* on this — a JWT sent over plain HTTP is a stolen JWT.

**Health checks and observability.** A deployed app must be *operable*: the host needs to know if
it's alive (and restart it if not), and you need to be able to answer "what happened?" and "is it
slow?" — a health endpoint, searchable logs, and metrics. In-practice below; the rule is: **if you
can't see production, you're flying blind.**

### In practice

**Health checks.** ASP.NET Core has them built in. In `Program.cs` of your to-do API:

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<TodoContext>(/* ...as in the SQL & EF chapter... */);

builder.Services.AddHealthChecks()
    .AddDbContextCheck<TodoContext>();   // healthy only if the DB answers
                                         // (package: Microsoft.Extensions.Diagnostics.HealthChecks.EntityFrameworkCore)

var app = builder.Build();

app.MapHealthChecks("/health");          // GET /health → 200 "Healthy" or 503 "Unhealthy"

app.Run();
```

```text
$ curl -i http://localhost:8080/health
HTTP/1.1 200 OK
Content-Type: text/plain

Healthy
```

Stop the database and the same request returns `503` / `Unhealthy`. Every host and orchestrator can
be pointed at this URL ("probe `/health` every 10 s; restart after 3 failures") — this is how a wedged
instance gets recycled at 3 a.m. instead of rotting until a user complains.

**Logs.** You already log via `ILogger<T>` (ASP.NET Core chapter). In a container, logs go to the
console, and the platform captures the console — that's the whole contract. `docker logs` locally;
every host has its equivalent screen. One habit upgrade: use the message-template form —

```csharp
app.Logger.LogInformation("Todo {TodoId} completed by {UserId}", todo.Id, userId);
```

— not string interpolation. The platform stores `TodoId` and `UserId` as named fields (**structured
logging**), so you can *search* "all events for user 42" instead of grepping prose.

**Metrics** answer "how is it doing *overall*": requests per second, error rate, latency
percentiles. ASP.NET Core emits these automatically as standard .NET metrics; hosts and tools (e.g.
Prometheus + Grafana, or a platform's built-in graphs) collect and chart them. Day one you need
exactly one habit: know where your host's request-rate/error-rate graph is, and look at it after each
deploy.

**A concrete VPS picture**, so hosting isn't abstract — this is genuinely the whole thing:

```bash
ssh you@your-server            # a rented Ubuntu VM with a public IP
sudo apt install docker.io caddy
docker run -d --restart=always -p 8080:8080 \
  -e "ConnectionStrings__Todo=Host=db.example.com;..." \
  -e "Jwt__Key=$JWT_KEY" \
  --name todo ghcr.io/you/todo-api:latest
```

Caddy config (`/etc/caddy/Caddyfile`) — reverse proxy + automatic Let's Encrypt HTTPS in three lines:

```text
api.example.com {
    reverse_proxy localhost:8080
}
```

Point your domain's DNS at the server's IP, `sudo systemctl reload caddy`, and
`https://api.example.com/health` returns `Healthy` over TLS. Note the pieces you built earlier
clicking in: config through environment variables (ASP.NET Core chapter), the JWT key as a secret
(Auth chapter), the database *elsewhere* — managed or on its own volume — so the app container stays
disposable (`--restart=always` makes Docker resurrect it after crashes and reboots).

### Try it — Project

*(Steps 1–3 are local and assume Docker installed; step 4 needs a real host and is the capstone.)*

1. Add `MapHealthChecks("/health")` with the `DbContext` check to your to-do API. Run it and `curl -i
   http://localhost:8080/health`. Then break the connection string on purpose, restart, and confirm
   `503 Unhealthy`.
2. Rebuild the image (`docker build -t todo-api .`) and run it with config injected from outside:
   `docker run -d -p 8080:8080 -e "ConnectionStrings__Todo=<real value>" --name todo todo-api`.
   Verify `/health`, then `docker logs todo` and find your structured log lines.
3. Kill it rudely — `docker kill todo` — then rerun with `--restart=always` and `docker kill` it
   again: `docker ps` shows it back up within seconds. That's self-healing, one flag's worth.
4. **Ship it (⚠ area — pick any current container host):** deploy the image your CI pushed in
   section 2, set the connection string and JWT key as the host's secret/env settings, point its
   health probe at `/health`, and open your HTTPS URL from your phone. Success test: a stranger can
   hit the URL, data survives a container restart, and a failing test blocks the pipeline that
   deploys it. That URL is the most convincing line on a junior résumé.

### Traps

- **Serving plain HTTP in public.** Everything between client and server — including every JWT from
  the Auth chapter — is readable on the wire. HTTPS is not optional; with managed certs and Let's
  Encrypt it's also no longer hard, so there's no excuse left.
- **Config baked into the image.** A connection string in `appsettings.json` inside the image means
  the image only works in one environment — and your secrets are in every copy of the image, forever.
  The image is the *app*; the environment supplies the *config*. (And add `appsettings.Development.json`
  to `.dockerignore`.)
- **State inside the disposable container.** Hosts restart and replace containers freely — that's a
  feature. Any file written inside one (SQLite db, uploads) silently vanishes. Data lives in a managed
  database or mounted volume; the container must be safe to delete at any moment.
- **A too-honest health check.** If `/health` checks a flaky third-party API, that dependency's bad
  day makes the host kill *your* healthy instances in a restart loop. Health-check only what a restart
  could actually fix.

---

## Check yourself

- Can you explain image vs container vs registry, why the Dockerfile has two `FROM` lines, and get
  your API answering on `localhost:8080` with `docker build` + `docker run`? If yes, tick *Docker &
  images* above.
- Can you read a workflow YAML — triggers, jobs, steps — and set up a pipeline where a failing
  `dotnet test` blocks the image from being published? If yes, tick *CI/CD* above.
- Can you weigh VPS vs PaaS vs containers-as-a-service, say what a reverse proxy and a Let's Encrypt
  certificate each do, and wire up `MapHealthChecks` plus structured logs so you'd *know* when
  production breaks? If yes, tick *Hosting, HTTPS & monitoring* above.

All three ticked? Tick the chapter. Then head to checkpoint **cp9** on the Map — an exam-style gate,
no book open — see *Checkpoints & Defenses* for how those work.
