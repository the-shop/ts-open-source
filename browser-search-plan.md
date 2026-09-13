# Plan — `web_search` replacement using a headless browser

**Status:** historical design record — the implementation shipped as the
[`pi-browser-search`](pi-browser-search/README.md) submodule. The body is kept as the
measurement trail (why the cookie imports and the pacing exist, and what was ruled
out); **current facts live in the submodule README**, and §9's "decisions needed"
are closed, not open.
**Target:** replace the `web_search` tool currently served by `npm:pi-web-access`
**Spec from owner:** ≥10 searches per `web_search` call, more when precision demands it;
engine mix **Google 70% / DuckDuckGo 20% / Bing 10%**; headless browser does the searching and scraping.

---

## 1. What exists today

| Piece | Fact |
| --- | --- |
| Incumbent | `npm:pi-web-access` v0.29.0, ~29,900 LOC across 74 root `.ts` files |
| Search backends | 30+ **HTTP API** providers (Brave, Exa, Tavily, Serper, BrightData, SerpApi, SearXNG, DuckDuckGo, Gemini…) |
| Browser usage | none for search. Chromium is only used for cookie *extraction* (Gemini Web) |
| `web_search` schema | `query`, `queries[]`, `numResults` (1–20), `provider`, `includeContent`, `workflow`, … |
| Default workflow | `summary-review` — opens an interactive curator HTTP server + browser window and **blocks** until approved. `workflow:"none"` gives raw results |
| Config | `~/.pi/agent/web-search.json` (absent); cache `~/.pi/agent/web-search-cache/` (empty) |
| Provider routing | sequential fallback only — README is explicit: *"Random, weighted, sticky, and cooldown routing are not enabled"* |

So the 70/20/10 weighted mix is a **new capability**, not a re-implementation of existing behaviour.

### Extension precedence — we can win the name

`pi` resolves duplicate tool names by **first registration wins**; later duplicates are ignored and only emit a startup diagnostic.
Load order is fixed (`dist/core/package-manager.js` → `resourcePrecedenceRank`):

```
rank 0  project .pi/settings.json "extensions"
rank 1  project .pi/extensions/            (auto-discovered)
rank 2  user ~/.pi/agent/settings.json "extensions"
rank 3  user ~/.pi/agent/extensions/       (auto-discovered)   ← we install here
rank 4  packages (npm:pi-web-access)                           ← incumbent loses
```

Verified empirically against the shipped resolver: our extension lands at rank 3, `npm:pi-web-access` at rank 4.
Registering `name: "web_search"` therefore **replaces** it, with no API override needed.
There is **no** `unregisterTool`; the only lever is load order or renaming the incumbent via its own `toolNames` config.

---

## 2. Empirical SERP reality (measured on this machine, not from blog posts)

Probes run against system Chrome 152 via raw CDP, plus plain HTTP. Public IP `93.141.143.12` — Hrvatski Telekom, **residential, not flagged** as proxy/hosting/datacenter.

| Engine | Fresh profile, headless | Fresh profile, headful | Real Chrome profile | Plain HTTP (no browser) |
| --- | --- | --- | --- | --- |
| **Google** `/search` | ❌ `/sorry` redirect | ❌ `/sorry` redirect | ✅ **10 results, 99 `data-ved` nodes** | ❌ 200 OK but **zero results** (soft block) |
| **Google** `/search`, anon-cookie profile | ✅ **10 results** (see §3) | — | — | — |
| **DuckDuckGo** lite | ⚠️ duck CAPTCHA | — | — | ✅ works |
| **DuckDuckGo** lite (clean UA override) | ✅ **10 results** | — | — | ✅ |
| **Bing** | ✅ **10 × `li.b_algo`** | — | — | ✅ 10 results |

Things that **did not** help Google: stripping the `HeadlessChrome` UA token, `--headless=old`, headful mode, `--disable-blink-features=AutomationControlled` (`navigator.webdriver` correctly `false`), SOCS/CONSENT cookie injection, visiting `google.com` first and clicking "Accept all", `udm=14`, `gbv=1`.

**Conclusion: Google's block here is profile-reputation, not IP-type and not headless detection.** A cold profile has no cookie history, so Google refuses. The same IP with the real warmed profile returns a full SERP.

Two traps confirmed and designed around:
1. Google's block page returns **HTTP 200** with a valid-looking document — success must be detected structurally (count result containers), never by status code.
2. The `HeadlessChrome` token in the default UA is itself a tell that breaks DuckDuckGo. UA override is mandatory.

Google extraction quality with the real profile — 3/3 queries, **~4.1 s each, 8–9 organic results** with clean title/URL/snippet (`h3` → nearest anchor → `div[data-hveid]` block for the snippet). Verified durable against Google's obfuscated class names, and it correctly skipped ad/AI-Overview blocks.

---

## 3. Google at 70% — RESOLVED, self-contained bootstrap

Google works through a **warmed profile**, so the question was what "warmed" actually means. Isolated by experiment (each row = 2 queries; profile rebuilt from scratch each time):

| Profile variant | Auth cookies | History | Local State | Outcome |
| --- | --- | --- | --- | --- |
| Fresh empty | — | — | — | ❌ `/sorry` |
| Real profile, anonymous cookies only | stripped (0 kept) | removed | kept | ✅ 9–10 results |
| Real profile, full session | 52 kept | removed | kept | ✅ 9–10 results |
| **Fresh profile + 4 injected anonymous cookie rows** | **none** | **none** | **none** | ✅ **9–10 results** |

The last row is the one that matters: a **blank profile** plus the four anonymous Google cookie rows (`SOCS`, `NID`×2, `AEC`) — copied verbatim as encrypted blobs, no login, no history, no machine state — produces a full SERP, and it **persists across restarts**.

**Consequences:**
- **No use of your logged-in Google account.** No account-flagging risk. Option A is not needed.
- No dependency on your personal profile, its history, or its Local State.
- The bootstrap is one-time and durable — `NID` lives ~6 months, and it can be re-anchored automatically when it expires.

**Rate tolerance** (the pacing question, exercised against the bootstrapped profile):

```
12/12 queries succeeded, 0 blocked, 71.2s   (2.0–3.2 s jittered gaps, 9–11 results each)
```

So ~5.9 s per Google query including pacing, sustained without a soft block. 7 Google probes per `web_search` call is comfortably within budget.

**Residual risk:** the block is partly *velocity*-sensitive, not purely profile-sensitive — an earlier headless warm-up attempt was refused during a window when I had just probed Google heavily. The pacing governor and spillover logic (§6) are therefore mandatory, not optional — and cookie staleness must degrade gracefully rather than fail silently.

Fallback if Google ever hard-fails at scale: **Option C**, a SERP API (Serper/SerpApi/BrightData — all already supported by the incumbent; no key is configured today).

---

## 4. Architecture

Self-contained — **no gstack, no bun, no Playwright.** Node 26 ships `WebSocket`, `fetch`, and `node:sqlite`; I already drove Chrome end-to-end in ~40 lines of raw CDP. Reusing the gstack browse daemon was evaluated and rejected: it is project-scoped, dies after 30 min idle, wraps page content in an untrusted-content envelope, rate-limits to 10 req/s, needs `bun`, and has no SERP logic anyway.

```
~/.pi/agent/extensions/pi-browser-search/
  index.ts                  extension factory; registers web_search + get_search_content
  browser/
    chrome.ts               spawn / attach / reuse; dedicated profile; single-flight; idle reap
    cdp.ts                  minimal CDP client (WebSocket, no deps, no Runtime.enable leak)
    stealth.ts              UA override, webdriver mask, plugin/chrome-object spoof, init scripts
  engines/
    types.ts                SearchHit, Probe, EngineAdapter
    google.ts               URL builder, SERP parser, /sorry + consent detection, page 2
    duckduckgo.ts           lite + html endpoints, uddg= unwrap, browser + HTTP paths
    bing.ts                 li.b_algo parser, mkt/setlang, first= pagination, ck/a unwrap
  pipeline/
    expand.ts               query fan-out → probes
    schedule.ts             smooth weighted round-robin (70/20/10)
    normalize.ts            redirect unwrap, URL canonicalization, junk filtering
    rank.ts                 multi-signal scoring, dedupe, diversity
    enrich.ts               top-K page text extraction (readability-style)
  util/
    profile.ts              profile snapshot / warm / health
    pace.ts                 per-engine pacing, budget governor, backoff
    cache.ts, render.ts     result cache; LLM-facing formatting
```

**Lifecycle:** Chrome is launched lazily on first `web_search`, reused across calls, reaped after idle. Chrome is never started in the extension factory (pi requires background resources to start in `session_start` and be cleaned up idempotently in `session_shutdown`).

---

## 5. Search design — the core

### 5.1 Query fan-out (probe generation)

One `web_search` call becomes **≥10 probes**. Expansion is intent-classified first, then facet-derived — not blind synonym shuffling:

1. `verbatim` — the query exactly as asked (always probe #1)
2. `quoted` — key phrase quoted, to force precision
3. `reformulated:explanatory` — "what is / how does"
4. `reformulated:practical` — "how to / best practice / example"
5. `signals:issues` — "problem / error / not working" (surfaces real-world reports)
6. `site:stackoverflow.com`, `site:github.com`, `site:docs.*` — high-value source mining
7. `site:<top-domain-from-wave-1>` — **adaptive**, mines the best domain found
8. `recency` — last 12 months, only when the query is time-sensitive
9. `terminology` — acronym expansion / domain vocabulary swap
10. `longtail` — full natural-language question

### 5.2 Weighted engine scheduler

**Smooth weighted round-robin** (nginx algorithm), not random — exactly proportional and reproducible:

```
weights  google=7  ddg=2  bing=1        (sum 10)
each round:  current[i] += weight[i];  pick argmax(current);  current[pick] -= sum
```

For 10 probes → exactly **7 Google / 2 DDG / 1 Bing**, evenly interleaved (no Google bursts).
For 20 probes → 14 / 4 / 2. Arbitrary M uses largest-remainder rounding so totals always match M exactly.

Probes may constrain eligibility (`filetype:` is Google/Bing only, `site:` is universal). The scheduler renormalizes weights over each probe's *eligible* set, then runs a final rebalance pass so the **global** mix still lands on 70/20/10.

### 5.3 Two-wave execution with adaptive deepening

**Wave 1** — the 10+ probes above, bounded concurrency (Google 3, DDG 4, Bing 4) with 800–2500 ms jittered spacing on Google.

**Wave 2 triggers** (any one): distinct domains < 15 · top-3 corroborated by <2 engines · <10 unique results · query is comparative/multi-entity.
**Wave 2 actions:** page 2 of the best probes · `site:` probes on the top-3 discovered domains · terminology drift using terms found in wave-1 snippets. Adds 6–10 probes.

**Engine-failure spillover:** if Google returns `/sorry`, that probe's quota **spills to DDG/Bing** so the probe count is preserved — and the achieved mix is reported truthfully (§8).

### 5.4 Normalization

- Unwrap redirects: Google `/url?q=`, DDG `uddg=`, Bing `ck/a?…u=`
- Canonicalize: strip `utm_*`/`gclid`/`fbclid`/`ref`/`source`, lowercase host, drop fragment, normalize `www`, resolve AMP → canonical
- Drop non-organic blocks: ads, AI Overview / "AI Mode reply", People-Also-Ask, shopping, knowledge panels, sitelinks
- Keep provenance: `{engine, probe, position}` per occurrence

### 5.5 Ranking

```
score = 3.0·corroborating_engines      # strongest signal: 1–3 engines agree
      + 1.5·supporting_probes          # distinct probes that found it
      + 1.0·Σ 1/log2(rank+1)           # position, summed over occurrences
      + 0.8·authority(domain, intent)  # curated prior; .gov/.edu/docs/arxiv/github
      + 0.5·term_match(title,snippet)  # query-term coverage
      + 0.4·freshness                  # only for time-sensitive intent
      − 1.2·spam_penalty(domain)       # content farms, SEO ring signatures
```

Then **diversity selection**: max 2 results per domain, so no single site dominates page one. Near-duplicate URLs (same domain+path, differing query strings) collapse.

### 5.6 Enrichment

Top-K (default 5) results are fetched through the same browser and reduced to readable text, so the model gets substance rather than 160-character snippets. Full payloads are cached and addressable via `get_search_content` (pi truncates tool output at 50 KB / 2000 lines; we write the full result set to a file and return its path, per the documented pattern).

### 5.7 Performance budget

| Phase | Wall clock |
| --- | --- |
| Chrome attach (warm) | ~50 ms |
| Wave 1 (Google 7 @ 3-wide + jitter) | ~12–15 s (measured 5.9 s/query incl. pacing) |
| Wave 2 (when triggered) | +8–12 s |
| Enrichment (top 5) | ~4–6 s |
| **Typical total** | **~18–25 s** |

This is **10–20× slower** than the current API-backed `web_search` (~1–2 s). That is the unavoidable price of browser-driven SERP scraping and ≥10 probes. Mitigations: results stream via `onUpdate` as they land, the cache serves repeats instantly, and `depth` is tunable per call.

---

## 6. Failure modes and how they are handled

| Failure | Detection | Response |
| --- | --- | --- |
| Google `/sorry` | structural: no `div[data-ved][data-hveid]`, or `/sorry` in href | mark Google degraded, spill to DDG/Bing, surface in output |
| Google consent interstitial | `consent.google` in href | auto-accept via SOCS cookie; if still stuck, spill |
| **Google 200-clean-but-empty** | result-container count == 0 | treat as failure — never as success |
| DDG duck CAPTCHA | "Select all squares containing" text | rotate UA + retry once, then spill |
| Profile lock (Chrome running) | `SingletonLock` present | fall back to snapshot-copy profile |
| Cookie staleness | auth cookies aged | refresh snapshot; degrade to DDG/Bing if still blocked |
| Chrome crash | CDP socket closed | relaunch once, replay the wave |
| Abort (Esc) | `signal.aborted` | kill in-flight probes, return partials already found |

---

## 7. Output contract

Drop-in compatible shape: `{content:[{type:"text",text}], details:{…}}`. Text is a ranked, cited list with per-result provenance, so the model can weigh corroboration:

```
1. Kubernetes Operator Best Practices — sdk.operatorframework.io/docs/best-practices/
   (google p1/p3, ddg p2 · 3 engines · 5 probes)
   Like all containers on Kubernetes, Operators need not run as root…

——— 11 probes · 10 sources · engines: google 7/7, ddg 2/2, bing 1/1 · 21.4s
```

The engine line is **always the achieved mix**, never the requested one.

---

## 8. Honesty guarantee

The spec asks for Google 70%. If Google is unavailable, the tool must not silently return a DDG/Bing-only result set as if it satisfied the request.
Every response therefore carries the achieved engine mix, and a degraded Google lane is reported explicitly at the top of the result when its failure rate exceeds a threshold.

---

## 9. Decisions needed

**D1 — Google lane. ✅ RESOLVED, no decision needed.** Self-contained bootstrap (§3): no login, no history, no personal-profile dependency, no API cost. Option A (your real logged-in profile) and Option C (paid SERP API) are both unnecessary.

One thing to confirm: the bootstrap needs a **one-time read of the four anonymous Google cookies** from your Chrome profile (or it can acquire them organically from a clean IP). Anonymous cookies only — `SOCS`, `NID`, `AEC`. Say if you'd rather it never touch your Chrome profile at all, in which case it acquires them itself on first run.

**D2 — Incumbent during transition.** Recommended: set `{"tools":{"webSearch":{"enabled":false}}}` in `~/.pi/agent/web-search.json` so the legacy registration never loads (removes the conflict diagnostic and stops its curator window opening). `fetch_content` and `source_check` stay with the incumbent. Alternative: keep both, ours wins by load order.

**D3 — Delivery.** New repo `the-shop/pi-browser-search` added as a submodule here, matching the `pi-the-shop` pattern — or develop in-place under this repo first?

---

## 10. Phases

| Phase | Deliverable | Gate |
| --- | --- | --- |
| **0** | ✅ **Done.** Google trust isolated to 4 anonymous cookies; bootstrap proven on a blank profile; 12/12 rate tolerance | passed |
| **1** | `browser/` — CDP client, Chrome lifecycle, stealth, profile mgmt | Bing + DDG + (Google if D1 resolved) return parsed hits |
| **2** | `engines/` — three adapters with structural success detection | 100 golden queries, ≥95% extraction accuracy |
| **3** | `pipeline/` — expansion, SWRR scheduler, normalize, rank | achieved mix within ±5% of 70/20/10 |
| **4** | `index.ts` — tool registration, streaming, cache, `get_search_content` | drop-in parity on the existing schema |
| **5** | Hardening: pacing, backoff, spillover, abort, honesty reporting | 200-query soak with no silent quality loss |

Phase 0 is the only blocking unknown; everything else is engineering with the risk already retired by the probes in §2.
