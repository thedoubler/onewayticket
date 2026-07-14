# Weekend Escape Finder — Design

**Date:** 2026-07-14
**Status:** Approved for planning

## Summary

A standalone Next.js app that scans a future timeline and surfaces only the
**cheapest weekend round-trip flights** from the user's home airport. Built as a
new project (sibling to `onewayticket`), reusing that project's Kiwi Tequila API
approach. The goal is spontaneous, low-cost **weekend escapes**: "where can I fly
away to for a weekend, cheaply, in the next few months?"

## Goals

- Show a single ranked list of the cheapest weekend round-trips, cheapest first.
- Restrict results to weekend-shaped trips (configurable strictness).
- Let the user set their home airport once and reuse it.
- Let the user choose how far ahead to scan.

## Non-goals (v1 — YAGNI)

- One-way flights (this is round-trip only).
- Hotels, trains, activities, events (the parent project has these; not here).
- User accounts / server-side persistence (home airport lives in `localStorage`).
- Multi-origin search.

## Architecture

Next.js 15 (App Router) + TypeScript + Tailwind CSS. Standalone project directory
`weekendescape`, sibling to `onewayticket`. Kiwi **Tequila API** (`/v2/search`) for
flight data via a server-side route (API key never reaches the client).

```
Browser (client components)
  ├─ HomeAirportInput  ──► /api/airports  (geo → nearest airport)
  ├─ WeekendControls   ──► /api/weekends  (the core search)
  └─ DealList / DealCard  ◄── ranked cheapest deals
```

### Environment

```
TEQUILA_API_KEY=...        # required
WEEKEND_CURRENCY=EUR       # optional, default EUR
```

## Core search strategy

**Chosen: single Tequila call.** One `/v2/search` request with `flight_type=round`
over the full selected window, using the Tequila params that natively express the
"weekend escape" shape. Rejected alternatives: one-call-per-weekend (~13 calls,
slow, rate-limit risk, dedupe work, no accuracy gain) and broad-search+JS-filter
(wasteful, hits result caps).

### Weekend-style → Tequila params

`fly_days` restricts departure day-of-week; `ret_fly_days` restricts return
day-of-week (0 = Sunday … 6 = Saturday). `nights_in_dst_from/to` bounds trip length.

| Style        | Depart (`fly_days`) | Return (`ret_fly_days`) | Nights (`nights_in_dst`) |
| ------------ | ------------------- | ----------------------- | ------------------------ |
| Strict Sat–Sun | Sat (6)           | Sun (0)                 | 1–1                      |
| Fri–Mon      | Fri, Sat (5,6)      | Sun, Mon (0,1)          | 1–3                      |
| Loose Thu–Sun| Thu, Fri, Sat (4,5,6) | Sun, Mon (0,1)        | 1–4                      |

Common params: `fly_days_type=departure`, `ret_fly_days_type=arrival`,
`one_for_city=1` (one cheapest deal per destination city — prevents a single city
dominating the list), `sort=price`, `curr=${WEEKEND_CURRENCY}`, `limit=200`,
`price_to=${maxPrice}` when the user sets one.

### Timeline window

`date_from` = today; `date_to` = today + N months, where N ∈ {1, 2, 3, 6},
default **3**. Dropdown-selectable per search.

## Components & routes

- **`HomeAirportInput`** (client): text field accepting IATA code or city name,
  plus a "📍 Use my location" button. On geolocation success, calls
  `/api/airports?lat&lon` to resolve the nearest airport. Selected home airport is
  persisted to `localStorage` (`weekendescape:home`) and pre-loaded on next visit.
- **`WeekendControls`** (client): weekend-style selector (Strict / Fri–Mon /
  Loose), timeline dropdown (1/2/3/6 months, default 3), optional max-price input,
  and a Search button.
- **`DealList` / `DealCard`** (client): flat ranked list, cheapest first. Each card
  shows destination city + country flag emoji, the concrete weekend dates (out →
  back), number of nights, price, and a booking link to Kiwi (`deep_link` from the
  API response).
- **`GET /api/weekends`** (server): validates params, maps weekend style → Tequila
  params, performs the single search, returns the normalized deal list.
  Params: `flyFrom`, `months`, `style` (`strict|frimon|loose`), `maxPrice?`.
- **`GET /api/airports`** (server): `lat`, `lon` → nearest airports via Tequila
  `locations/radius` (ported from `onewayticket`).

## Data flow

1. On load, read `weekendescape:home` from `localStorage`; if present, prefill the
   home airport.
2. User confirms/edits home airport (typing or geolocation), sets weekend style,
   timeline, optional max price, hits Search.
3. Client calls `/api/weekends?flyFrom&months&style&maxPrice`.
4. Route maps style → params, issues one Tequila `/v2/search`, normalizes each
   result to `{ cityTo, countryTo (flag), dateOut, dateBack, nights, price, currency, deepLink }`.
5. Client renders `DealList` sorted by price (API already sorts; client re-sorts
   defensively).

## Error handling

- Missing `TEQUILA_API_KEY` → 500 with a clear "API key not configured" message
  surfaced in the UI.
- Zero results → friendly empty state: "No cheap weekend deals found — try the
  Loose style or a longer timeline."
- Geolocation denied/unavailable → silently fall back to manual entry (no blocking
  error); show a hint that manual entry works.
- Tequila error/timeout → generic "Couldn't reach the flight service, try again"
  with the underlying status logged server-side.

## Testing

- **Unit:** weekend-style → Tequila param mapping (table above) — pure function,
  fully unit-tested for all three styles.
- **Unit:** timeline `months` → `date_from`/`date_to` computation.
- **Unit:** Tequila response → normalized deal object mapping (including flag emoji
  derivation and deep-link passthrough).
- **Route:** `/api/weekends` param validation (missing `flyFrom`, invalid `style`,
  invalid `months`) returns 400; API-key-missing returns 500.
- Mock the Tequila HTTP calls; no live API in tests.

## Open items / defaults chosen

- Currency default **EUR** (override via `WEEKEND_CURRENCY`).
- Timeline options fixed to {1,2,3,6} months, default 3.
- `one_for_city=1` chosen so the flat list shows variety (one deal per city) rather
  than many near-identical rows for the same destination.
