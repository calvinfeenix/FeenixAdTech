# Build prompt — FeenixAds (Roblox in-experience ad handler)

> Paste everything below into a fresh Claude Code chat **opened in a new, empty repo/folder** for the Roblox package. It is self-contained.

---

You are building a **production-grade, performant, secure Roblox (Luau) package** called **FeenixAds**. It runs inside Roblox experiences and is the in-game half of the **Feenix AdTech** platform. Its jobs:

1. **Auto-discover** ad surfaces in the game (no manual setup).
2. **Fetch** which creatives to show from the Feenix web API.
3. **Render** image/video creatives onto those surfaces.
4. **Measure impressions and clicks accurately** (this is the most important part).
5. **Report analytics** back to the API — safely, at scale, all the time.

Write clean, documented, **strict-Luau (`--!strict`)**, typed code. Optimize for running continuously across many servers without stalls or hitting Roblox limits.

## Reference implementation (STUDY — do not copy verbatim)
An older, working-but-overcomplex version exists at `C:\Users\ilegi\Documents\Disposable_REMOVE` (a Rojo project, `default.project.json`). Read these for **proven approaches and pitfalls**, then build fresh and simpler:
- `src/client/ImpressionAlgo.luau` — the **5-gate + dwell** impression validator (proximity → viewport → orientation → occlusion → dwell). The algorithm is solid; carry it forward.
- `src/client/BillboardDiscovery.luau` — CollectionService tag discovery.
- `src/server/Resolver.luau`, `EventQueue.luau`, `HttpDispatcher.luau` — serve-resolution with cache+backoff, batched event flushing, centralized HTTP with retries.
- `src/server/AntiCheat.luau`, `PlayerEligibilityGuard.luau`, `ImpressionReceiver.luau`, `ClickReceiver.luau`, `BillboardBinder.luau` — server validation, dedup, prompts, applying creatives.
- `src/Shared_Lua_Resources/{Constants,Config,Logger,Types}.luau`.
The **new contract is simpler**: a single tag, server-driven interactivity, and server-side location auto-registration. Don't replicate the old folder layout blindly — improve clarity and performance.

## The server you talk to (Feenix API)
Feenix AdTech is a Next.js app (on Railway) + Supabase. Base URL is **configurable** (e.g. `https://<app>.up.railway.app`). Every call sends header `x-api-key: <FEENIX_API_KEY>`. Endpoints:

1. `POST /api/locations/register` — report discovered ad units on startup so the web app auto-creates locations.
   Request: `{ "robloxPlaceId": <number>, "placements": [ { "externalRef": "<stable-id>", "name": "<label>", "surfaceType": "image"|"video"|"unknown", "path": "<instance path>" } ] }`
   Response 200: `{ "registered": <n> }`. Idempotent (upsert by game + externalRef).

2. `GET /api/serve?game=<robloxPlaceId>` — what to show right now. Returns only **active, in-flight** campaigns whose assets are **Roblox-approved**.
   Response 200:
   ```json
   { "game": {"id":"<uuid>","name":"...","robloxPlaceId":"..."},
     "servedAt":"...","cacheTtlSeconds":30,
     "placements":[
       {"externalRef":"<stable-id>","locationId":"<uuid>","name":"...",
        "creatives":[
          {"assetId":"<uuid>","robloxAssetId":123456789,"type":"image"|"audio",
           "title":"...","campaignId":"<uuid>","campaignName":"...",
           "action": {"type":"proximity","actionText":"Interact","objectText":"Advertisement",
                      "maxActivationDistance":20,"holdDuration":0,"requiresLineOfSight":false} } ] } ] }
   ```
   `action` is optional (present only when the web app ties the creative to an interaction). Returns **204** when there is nothing to serve.

3. `POST /api/ingest` — analytics. Request: `{ "events":[ {"campaign_id":"<uuid>","game_id":"<uuid>","location_id":"<uuid>","event_type":"impression"|"click"|"unique_user","count":1,"ts":"<iso?>"} ] }`.
   **Use the IDs from the `/serve` payload — never invent them.** Map `externalRef ↔ locationId` from serve.

> All three endpoints exist on the Feenix side today (serve, ingest, and locations/register), and `/api/serve` already returns the per-creative `action` object. Build directly against them; no mocking needed once you have a base URL + API key.

## Discovery & dynamic registration (no manual web setup)
- An ad unit is **any instance tagged `DisplayLocation_Feenix`** (CollectionService; PascalCase). The tag may sit on a `SurfaceGui` or on the `BasePart` it adorns — resolve both (the surface for rendering, the part for impression geometry).
- Inside a unit there may be an `ImageLabel` (image ad) and/or a `VideoFrame` (video ad). **Support both**; choose the right child for the creative type.
- **Stable external ref:** on first discovery, if the unit lacks a `FeenixId` attribute, generate one (`HttpService:GenerateGUID(false)`), set it as an attribute (persists with the place), and use it as `externalRef`. Use the instance `Name` as the human label.
- On server startup (and when new tagged units appear, debounced), batch-report all units via `POST /api/locations/register`. The web app registers unknown ones → they become serveable. Eventual, not instant.

## Serving creatives
- A server-side **Resolver** fetches `/api/serve` with a **30s cache TTL** and retry/backoff (see old Resolver). One fetch per server per interval, **jittered** so many servers don't fire in sync.
- Match `placement.externalRef` → discovered unit; render the first creative: image → `ImageLabel.Image = "rbxassetid://"..robloxAssetId`; video → `VideoFrame.Video = "rbxassetid://"..robloxAssetId`. (Multiple creatives: show first; leave a rotation hook.)
- **Eventual updates:** when ads change on the web app, servers reflect it on the next resolver refresh (~≤30–60s). Cache the served `{campaignId, assetId, locationId}` per unit for attribution.
- Render a small **"Ad"** label per Roblox Advertising Standards (see old `Constants.AD_LABEL_*`).

## Impressions (must be correct)
- **Per-client** detection (camera is per-player) on a throttled Heartbeat/RenderStepped loop, using the **5-gate + dwell** algo from `ImpressionAlgo.luau`:
  1. Proximity (≤ max track distance) 2. Viewport (`Camera:WorldToViewportPoint` OnScreen) 3. Orientation (facing it; dot-product threshold) 4. Occlusion (multi-point raycast, ≥ ratio hits the ad) 5. **Dwell** — all gates continuously true for `IMPRESSION_DWELL_SECONDS` (**default 1.0**, configurable). **Hard reset on any gate failure.**
- Client fires a RemoteEvent → server with `{externalRef/locationId, servedCampaignId, servedAssetId}`.
- **Server is authoritative + anti-cheat:** validate (player & unit exist, the server actually served that asset there, distance plausibility), then **dedup so the same player cannot keep logging impressions**: one impression per `(userId, locationId, assetId)` with a re-arm cooldown (**default 60s**); a player who keeps staring does not spam. Server table keyed by that tuple → `lastFiredAt`; clean up on `PlayerRemoving`. (See old AntiCheat / PlayerEligibilityGuard / ImpressionReceiver.)
- Validated impressions go into the **EventQueue** (batched) — never one HTTP call per impression.
- **Unique users:** emit a single `unique_user` event per distinct player per server-day (track userIds seen; one beacon each). Server-side, deduped.

## Clicks / interactions (CTR)
- When a served creative includes an `action` (proximity), create a **ProximityPrompt** on the unit's part with `RequiresLineOfSight=false` and `MaxActivationDistance`/`HoldDuration`/`ActionText`/`ObjectText` from the action config (defaults: 20 / 0 / "Interact" / "Advertisement").
- `ProximityPromptService.PromptTriggered` (server-side = secure) with a per-player debounce (default 1s) = a **click** → enqueue a `click` event attributed to that campaign/asset/location. Add/update/remove the prompt as the creative or action changes.

## Debug mode (`Config.debug = true`)
- When an impression is counted, make it **visually obvious**: clone/overlay the ad surface with a **bright green flash/tint**, play a short beep (`Sound`), show a tiny "✓ Impression" label, then **destroy it after ~1s**. Same idea (different color) for clicks. Verbose `Logger` output.
- **Gate every debug visual/sound behind `Config.debug`** so production is completely silent.

## Networking / performance / security (hard requirements)
- **HTTP only from the server.** Never expose `FEENIX_API_KEY` to clients. Read it from **Roblox Secrets** (HttpService secret store) when available, else a **server-only** Config in `ServerStorage`/`ServerScriptService`. Never in a LocalScript or anything replicated.
- **EventQueue:** batch (≤~50/batch), flush every ~30s **+ random jitter (~10s)**, soft cap (~500) with drop + diagnostic logging, and **flush on `game:BindToClose()`** (server shutdown) — yield until flush completes or the ~30s budget elapses, so trailing events aren't lost.
- **HttpDispatcher:** centralized; retry/backoff on 429/5xx; timeouts; respect Roblox's ~500 req/min budget — coalesce, never per-event; one failing location must not break others.
- Never block the main thread; budget raycasts; guard missing/garbage instances; handle **StreamingEnabled** (parts stream in/out); handle units added/removed at runtime.

## Deliverable & structure
- A **Rojo project** (`default.project.json`) producing a self-contained **FeenixAds** package the developer drops in. It should bootstrap itself: server code → `ServerScriptService`, client code → `StarterPlayer`/`ReplicatedStorage`, RemoteEvents under a `ReplicatedStorage/FeenixAds` folder.
- A short **install README** and a **Config** module the dev edits: `baseUrl`, `apiKey` source, `debug` (default false), `tagName` (default `DisplayLocation_Feenix`), `dwellSeconds` (default 1), `impressionCooldownSeconds` (default 60), `pollIntervalSeconds` (default 30) + jitter.
- Suggested modules (improve freely): **Shared** (Config, Constants, Types, Logger); **Server** (Bootstrap/init, Resolver, Renderer/BillboardBinder, LocationRegistrar, ImpressionReceiver, AntiCheat, ClickReceiver, EventQueue, HttpDispatcher); **Client** (init, Discovery, ImpressionAlgo, DebugVisuals).

## Acceptance test (in Studio, HttpService enabled)
1. Tag a Part+SurfaceGui (with an `ImageLabel`) `DisplayLocation_Feenix` → on Play it registers, calls `/serve`, and shows the creative.
2. Look at it for 1s → impression counted **once**; keep looking → **not** re-counted until 60s; debug shows the green flash/beep.
3. A creative with an `action` → ProximityPrompt appears; triggering it logs a **click**.
4. Stop the server → EventQueue flushes remaining events.
5. A client cannot forge impressions (server validates/dedups); HTTP budget respected; no main-thread stalls.
