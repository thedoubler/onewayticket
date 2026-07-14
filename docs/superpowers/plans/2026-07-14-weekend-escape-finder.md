# Weekend Escape Finder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone Next.js app that scans a future timeline and lists only the cheapest weekend round-trip flights from the user's home airport.

**Architecture:** Next.js 15 App Router + TypeScript + Tailwind. Pure helper functions (weekend-style → Tequila params, timeline → date range, Tequila response → normalized deals) are unit-tested in isolation; two server routes (`/api/weekends`, `/api/airports`) call Kiwi's Tequila API server-side; client components handle home-airport entry (with geolocation + localStorage), search controls, and a flat cheapest-first deal list.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS v4, Axios, Vitest + @testing-library/react (jsdom).

## Global Constraints

- New standalone project at `/Users/raul/Projects/samples/weekendescape` (sibling to `onewayticket`). All file paths below are relative to that project root.
- Source lives under `src/` (App Router at `src/app`).
- Tequila API base URL: `https://tequila-api.kiwi.com`. API key from env `TEQUILA_API_KEY`; never expose it to the client (server routes only).
- Currency from env `WEEKEND_CURRENCY`, default `EUR`.
- Tequila date format is `dd/mm/yyyy`.
- Tequila day-of-week codes: `0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat`.
- Weekend styles are exactly `strict | frimon | loose`.
- Timeline months are exactly one of `1 | 2 | 3 | 6`, default `3`.
- Test framework: Vitest. Run a single test file with `npx vitest run <path>`.
- Commit after every task with a `feat:`/`test:`/`chore:` message.

---

### Task 1: Scaffold project and test tooling

**Files:**
- Create: whole project via `create-next-app`, then add config files below.
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `.env.local`
- Create: `src/lib/__tests__/smoke.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a buildable Next.js app with Vitest wired up; `npx vitest run` executes tests.

- [ ] **Step 1: Scaffold the Next.js app**

Run from `/Users/raul/Projects/samples`:

```bash
npx create-next-app@latest weekendescape \
  --ts --tailwind --app --src-dir --eslint --import-alias "@/*" --use-npm --yes
```

Expected: a new `weekendescape/` directory with `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `next.config.ts`, `tsconfig.json`, `package.json`.

- [ ] **Step 2: Add runtime and test dependencies**

Run from `/Users/raul/Projects/samples/weekendescape`:

```bash
npm install axios
npm install -D vitest @vitest/coverage-v8 jsdom @testing-library/react @testing-library/jest-dom @vitejs/plugin-react
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

- [ ] **Step 4: Create `vitest.setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 5: Add test scripts to `package.json`**

In `package.json`, add to the `"scripts"` object:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Create `.env.local`**

```
TEQUILA_API_KEY=replace_with_real_key
WEEKEND_CURRENCY=EUR
```

- [ ] **Step 7: Write a smoke test at `src/lib/__tests__/smoke.test.ts`**

```ts
import { describe, it, expect } from "vitest";

describe("tooling smoke test", () => {
  it("runs vitest", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 8: Run the smoke test**

Run: `npx vitest run src/lib/__tests__/smoke.test.ts`
Expected: PASS (1 test passed).

- [ ] **Step 9: Verify the app builds**

Run: `npm run build`
Expected: build completes without errors.

- [ ] **Step 10: Commit**

```bash
git init
git add -A
git commit -m "chore: scaffold weekendescape app with vitest"
```

---

### Task 2: Weekend-style → Tequila params (pure function)

**Files:**
- Create: `src/lib/weekend.ts`
- Test: `src/lib/__tests__/weekend.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type WeekendStyle = "strict" | "frimon" | "loose"`
  - `interface WeekendParams { flyDays: number[]; retFlyDays: number[]; nightsFrom: number; nightsTo: number }`
  - `function weekendStyleToParams(style: WeekendStyle): WeekendParams`

- [ ] **Step 1: Write the failing test at `src/lib/__tests__/weekend.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { weekendStyleToParams } from "@/lib/weekend";

describe("weekendStyleToParams", () => {
  it("maps strict to Sat out / Sun back, 1 night", () => {
    expect(weekendStyleToParams("strict")).toEqual({
      flyDays: [6],
      retFlyDays: [0],
      nightsFrom: 1,
      nightsTo: 1,
    });
  });

  it("maps frimon to Fri/Sat out, Sun/Mon back, 1-3 nights", () => {
    expect(weekendStyleToParams("frimon")).toEqual({
      flyDays: [5, 6],
      retFlyDays: [0, 1],
      nightsFrom: 1,
      nightsTo: 3,
    });
  });

  it("maps loose to Thu/Fri/Sat out, Sun/Mon back, 1-4 nights", () => {
    expect(weekendStyleToParams("loose")).toEqual({
      flyDays: [4, 5, 6],
      retFlyDays: [0, 1],
      nightsFrom: 1,
      nightsTo: 4,
    });
  });

  it("throws on unknown style", () => {
    // @ts-expect-error testing invalid input
    expect(() => weekendStyleToParams("bogus")).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/weekend.test.ts`
Expected: FAIL (cannot find module `@/lib/weekend`).

- [ ] **Step 3: Write minimal implementation at `src/lib/weekend.ts`**

```ts
export type WeekendStyle = "strict" | "frimon" | "loose";

export interface WeekendParams {
  flyDays: number[];
  retFlyDays: number[];
  nightsFrom: number;
  nightsTo: number;
}

export function weekendStyleToParams(style: WeekendStyle): WeekendParams {
  switch (style) {
    case "strict":
      return { flyDays: [6], retFlyDays: [0], nightsFrom: 1, nightsTo: 1 };
    case "frimon":
      return { flyDays: [5, 6], retFlyDays: [0, 1], nightsFrom: 1, nightsTo: 3 };
    case "loose":
      return { flyDays: [4, 5, 6], retFlyDays: [0, 1], nightsFrom: 1, nightsTo: 4 };
    default:
      throw new Error(`Unknown weekend style: ${style}`);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/weekend.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/weekend.ts src/lib/__tests__/weekend.test.ts
git commit -m "feat: add weekend-style to Tequila params mapping"
```

---

### Task 3: Timeline months → Tequila date range (pure function)

**Files:**
- Create: `src/lib/timeline.ts`
- Test: `src/lib/__tests__/timeline.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type TimelineMonths = 1 | 2 | 3 | 6`
  - `function timelineRange(months: number, today: Date): { dateFrom: string; dateTo: string }` — returns Tequila `dd/mm/yyyy` strings; `dateFrom` = today, `dateTo` = today + months.

- [ ] **Step 1: Write the failing test at `src/lib/__tests__/timeline.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { timelineRange } from "@/lib/timeline";

describe("timelineRange", () => {
  it("formats today and today+months as dd/mm/yyyy", () => {
    const today = new Date(2026, 6, 14); // 14 Jul 2026 (month is 0-based)
    expect(timelineRange(3, today)).toEqual({
      dateFrom: "14/07/2026",
      dateTo: "14/10/2026",
    });
  });

  it("rolls over the year", () => {
    const today = new Date(2026, 10, 20); // 20 Nov 2026
    expect(timelineRange(3, today)).toEqual({
      dateFrom: "20/11/2026",
      dateTo: "20/02/2027",
    });
  });

  it("pads single-digit day and month", () => {
    const today = new Date(2026, 0, 5); // 5 Jan 2026
    expect(timelineRange(1, today)).toEqual({
      dateFrom: "05/01/2026",
      dateTo: "05/02/2026",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/timeline.test.ts`
Expected: FAIL (cannot find module `@/lib/timeline`).

- [ ] **Step 3: Write minimal implementation at `src/lib/timeline.ts`**

```ts
export type TimelineMonths = 1 | 2 | 3 | 6;

function formatTequilaDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function timelineRange(
  months: number,
  today: Date
): { dateFrom: string; dateTo: string } {
  const to = new Date(today);
  to.setMonth(to.getMonth() + months);
  return { dateFrom: formatTequilaDate(today), dateTo: formatTequilaDate(to) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/timeline.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/timeline.ts src/lib/__tests__/timeline.test.ts
git commit -m "feat: add timeline months to date-range mapping"
```

---

### Task 4: Tequila response → normalized deals (pure functions)

**Files:**
- Create: `src/lib/deals.ts`
- Test: `src/lib/__tests__/deals.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface Deal { cityTo: string; countryTo: string; flag: string; dateOut: string; dateBack: string; nights: number; price: number; currency: string; deepLink: string }`
  - `function flagEmoji(countryCode: string): string`
  - `function normalizeDeals(raw: unknown, currency: string): Deal[]` — reads `raw.data[]`; for each item uses `cityTo`, `countryTo.name`, `countryTo.code` (→ flag), `price`, `deep_link`, `nightsInDest`, and the `route[]` legs to derive `dateOut` (first leg `local_departure`, date part `YYYY-MM-DD`) and `dateBack` (the leg with `return === 1`, its `local_departure` date part). Sorted ascending by `price`. Items missing required fields are skipped.

- [ ] **Step 1: Write the failing test at `src/lib/__tests__/deals.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { flagEmoji, normalizeDeals } from "@/lib/deals";

describe("flagEmoji", () => {
  it("converts an ISO country code to a flag emoji", () => {
    expect(flagEmoji("ES")).toBe("🇪🇸");
    expect(flagEmoji("gb")).toBe("🇬🇧");
  });
  it("falls back to a white flag on bad input", () => {
    expect(flagEmoji("")).toBe("🏳️");
    expect(flagEmoji("X")).toBe("🏳️");
  });
});

describe("normalizeDeals", () => {
  const raw = {
    data: [
      {
        cityTo: "Lisbon",
        countryTo: { code: "PT", name: "Portugal" },
        price: 89,
        deep_link: "https://kiwi.com/deep/lisbon",
        nightsInDest: 2,
        route: [
          { local_departure: "2026-08-21T18:00:00.000Z", return: 0 },
          { local_departure: "2026-08-23T20:00:00.000Z", return: 1 },
        ],
      },
      {
        cityTo: "Rome",
        countryTo: { code: "IT", name: "Italy" },
        price: 55,
        deep_link: "https://kiwi.com/deep/rome",
        nightsInDest: 1,
        route: [
          { local_departure: "2026-09-05T07:30:00.000Z", return: 0 },
          { local_departure: "2026-09-06T21:00:00.000Z", return: 1 },
        ],
      },
    ],
  };

  it("normalizes and sorts ascending by price", () => {
    const deals = normalizeDeals(raw, "EUR");
    expect(deals).toHaveLength(2);
    expect(deals[0]).toEqual({
      cityTo: "Rome",
      countryTo: "Italy",
      flag: "🇮🇹",
      dateOut: "2026-09-05",
      dateBack: "2026-09-06",
      nights: 1,
      price: 55,
      currency: "EUR",
      deepLink: "https://kiwi.com/deep/rome",
    });
    expect(deals[1].cityTo).toBe("Lisbon");
    expect(deals[1].dateOut).toBe("2026-08-21");
    expect(deals[1].dateBack).toBe("2026-08-23");
  });

  it("returns an empty array when data is missing", () => {
    expect(normalizeDeals({}, "EUR")).toEqual([]);
    expect(normalizeDeals(null, "EUR")).toEqual([]);
  });

  it("skips items missing required fields", () => {
    const bad = { data: [{ cityTo: "Nowhere" }] };
    expect(normalizeDeals(bad, "EUR")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/deals.test.ts`
Expected: FAIL (cannot find module `@/lib/deals`).

- [ ] **Step 3: Write minimal implementation at `src/lib/deals.ts`**

```ts
export interface Deal {
  cityTo: string;
  countryTo: string;
  flag: string;
  dateOut: string;
  dateBack: string;
  nights: number;
  price: number;
  currency: string;
  deepLink: string;
}

export function flagEmoji(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return "🏳️";
  const A = 0x1f1e6;
  const base = "A".charCodeAt(0);
  const upper = countryCode.toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return "🏳️";
  return Array.from(upper)
    .map((c) => String.fromCodePoint(A + c.charCodeAt(0) - base))
    .join("");
}

interface RouteLeg {
  local_departure?: string;
  return?: number;
}

function datepart(iso: string | undefined): string | null {
  if (!iso || typeof iso !== "string") return null;
  const part = iso.split("T")[0];
  return /^\d{4}-\d{2}-\d{2}$/.test(part) ? part : null;
}

export function normalizeDeals(raw: unknown, currency: string): Deal[] {
  const data =
    raw && typeof raw === "object" && Array.isArray((raw as any).data)
      ? ((raw as any).data as any[])
      : [];

  const deals: Deal[] = [];
  for (const item of data) {
    const route: RouteLeg[] = Array.isArray(item?.route) ? item.route : [];
    const outLeg = route[0];
    const backLeg = route.find((l) => l?.return === 1);
    const dateOut = datepart(outLeg?.local_departure);
    const dateBack = datepart(backLeg?.local_departure);
    const cityTo = item?.cityTo;
    const price = item?.price;
    const deepLink = item?.deep_link;

    if (
      !cityTo ||
      typeof price !== "number" ||
      !deepLink ||
      !dateOut ||
      !dateBack
    ) {
      continue;
    }

    deals.push({
      cityTo,
      countryTo: item?.countryTo?.name ?? "",
      flag: flagEmoji(item?.countryTo?.code ?? ""),
      dateOut,
      dateBack,
      nights:
        typeof item?.nightsInDest === "number" ? item.nightsInDest : 0,
      price,
      currency,
      deepLink,
    });
  }

  return deals.sort((a, b) => a.price - b.price);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/deals.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/deals.ts src/lib/__tests__/deals.test.ts
git commit -m "feat: add Tequila response to normalized deals mapping"
```

---

### Task 5: `/api/weekends` route

**Files:**
- Create: `src/app/api/weekends/route.ts`
- Test: `src/app/api/weekends/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `weekendStyleToParams` (Task 2), `timelineRange` (Task 3), `normalizeDeals` (Task 4).
- Produces: `GET(request: NextRequest): Promise<NextResponse>` at `/api/weekends`. Query params: `flyFrom` (required IATA), `style` (`strict|frimon|loose`, default `frimon`), `months` (`1|2|3|6`, default `3`), `maxPrice` (optional number). Returns `{ deals: Deal[] }` on success; `{ error }` with 400 on invalid params, 500 on missing key / upstream failure.

- [ ] **Step 1: Write the failing test at `src/app/api/weekends/__tests__/route.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import axios from "axios";
import { GET } from "@/app/api/weekends/route";

vi.mock("axios");

function req(qs: string) {
  return new NextRequest(`http://localhost/api/weekends?${qs}`);
}

describe("GET /api/weekends", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.TEQUILA_API_KEY = "test-key";
    process.env.WEEKEND_CURRENCY = "EUR";
  });

  it("returns 400 when flyFrom is missing", async () => {
    const res = await GET(req("style=frimon"));
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid style", async () => {
    const res = await GET(req("flyFrom=BCN&style=nope"));
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid months", async () => {
    const res = await GET(req("flyFrom=BCN&months=5"));
    expect(res.status).toBe(400);
  });

  it("returns 500 when API key is missing", async () => {
    delete process.env.TEQUILA_API_KEY;
    const res = await GET(req("flyFrom=BCN"));
    expect(res.status).toBe(500);
  });

  it("calls Tequila with mapped params and returns normalized deals", async () => {
    (axios.get as any).mockResolvedValue({
      status: 200,
      data: {
        data: [
          {
            cityTo: "Rome",
            countryTo: { code: "IT", name: "Italy" },
            price: 55,
            deep_link: "https://kiwi.com/deep/rome",
            nightsInDest: 1,
            route: [
              { local_departure: "2026-09-05T07:30:00.000Z", return: 0 },
              { local_departure: "2026-09-06T21:00:00.000Z", return: 1 },
            ],
          },
        ],
      },
    });

    const res = await GET(req("flyFrom=BCN&style=strict&months=3&maxPrice=200"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deals).toHaveLength(1);
    expect(body.deals[0].cityTo).toBe("Rome");

    const params = (axios.get as any).mock.calls[0][1].params;
    expect(params.fly_from).toBe("BCN");
    expect(params.flight_type).toBe("round");
    expect(params.fly_days).toBe("6");
    expect(params.ret_fly_days).toBe("0");
    expect(params.nights_in_dst_from).toBe(1);
    expect(params.nights_in_dst_to).toBe(1);
    expect(params.one_for_city).toBe(1);
    expect(params.sort).toBe("price");
    expect(params.curr).toBe("EUR");
    expect(params.price_to).toBe(200);
  });

  it("returns 500 when Tequila call fails", async () => {
    (axios.get as any).mockRejectedValue(new Error("upstream down"));
    const res = await GET(req("flyFrom=BCN"));
    expect(res.status).toBe(500);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/weekends/__tests__/route.test.ts`
Expected: FAIL (cannot find module `@/app/api/weekends/route`).

- [ ] **Step 3: Write minimal implementation at `src/app/api/weekends/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { weekendStyleToParams, WeekendStyle } from "@/lib/weekend";
import { timelineRange } from "@/lib/timeline";
import { normalizeDeals } from "@/lib/deals";

const TEQUILA_BASE_URL = "https://tequila-api.kiwi.com";
const VALID_STYLES: WeekendStyle[] = ["strict", "frimon", "loose"];
const VALID_MONTHS = [1, 2, 3, 6];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const flyFrom = searchParams.get("flyFrom");
    const style = (searchParams.get("style") || "frimon") as WeekendStyle;
    const months = parseInt(searchParams.get("months") || "3", 10);
    const maxPriceRaw = searchParams.get("maxPrice");

    if (!flyFrom) {
      return NextResponse.json(
        { error: "Missing required parameter: flyFrom" },
        { status: 400 }
      );
    }
    if (!VALID_STYLES.includes(style)) {
      return NextResponse.json(
        { error: `Invalid style. Use one of: ${VALID_STYLES.join(", ")}` },
        { status: 400 }
      );
    }
    if (!VALID_MONTHS.includes(months)) {
      return NextResponse.json(
        { error: `Invalid months. Use one of: ${VALID_MONTHS.join(", ")}` },
        { status: 400 }
      );
    }

    const apiKey = process.env.TEQUILA_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Tequila API key not configured" },
        { status: 500 }
      );
    }

    const currency = process.env.WEEKEND_CURRENCY || "EUR";
    const wp = weekendStyleToParams(style);
    const { dateFrom, dateTo } = timelineRange(months, new Date());
    const maxPrice = maxPriceRaw ? parseInt(maxPriceRaw, 10) : undefined;

    const response = await axios.get(`${TEQUILA_BASE_URL}/v2/search`, {
      headers: { apikey: apiKey },
      params: {
        fly_from: flyFrom,
        date_from: dateFrom,
        date_to: dateTo,
        flight_type: "round",
        fly_days: wp.flyDays.join(","),
        fly_days_type: "departure",
        ret_fly_days: wp.retFlyDays.join(","),
        ret_fly_days_type: "arrival",
        nights_in_dst_from: wp.nightsFrom,
        nights_in_dst_to: wp.nightsTo,
        one_for_city: 1,
        sort: "price",
        curr: currency,
        limit: 200,
        ...(maxPrice ? { price_to: maxPrice } : {}),
      },
    });

    const deals = normalizeDeals(response.data, currency);
    return NextResponse.json({ deals });
  } catch (error) {
    console.error("Weekend search error:", error);
    return NextResponse.json(
      { error: "Failed to search weekend flights" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/weekends/__tests__/route.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/weekends
git commit -m "feat: add /api/weekends search route"
```

---

### Task 6: `/api/airports` geolocation route

**Files:**
- Create: `src/app/api/airports/route.ts`
- Test: `src/app/api/airports/__tests__/route.test.ts`

**Interfaces:**
- Consumes: nothing (calls Tequila directly).
- Produces: `GET(request: NextRequest): Promise<NextResponse>` at `/api/airports`. Query params: `lat`, `lon` (both required numbers). Returns `{ airports: { code: string; name: string; city: string; country: string }[] }` (nearest first, max 5). 400 on missing coords, 500 on missing key / failure. Uses Tequila `locations/radius`.

- [ ] **Step 1: Write the failing test at `src/app/api/airports/__tests__/route.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import axios from "axios";
import { GET } from "@/app/api/airports/route";

vi.mock("axios");

function req(qs: string) {
  return new NextRequest(`http://localhost/api/airports?${qs}`);
}

describe("GET /api/airports", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.TEQUILA_API_KEY = "test-key";
  });

  it("returns 400 when lat/lon are missing", async () => {
    const res = await GET(req("lat=41.4"));
    expect(res.status).toBe(400);
  });

  it("returns 500 when API key is missing", async () => {
    delete process.env.TEQUILA_API_KEY;
    const res = await GET(req("lat=41.4&lon=2.1"));
    expect(res.status).toBe(500);
  });

  it("maps Tequila radius results to airports (max 5)", async () => {
    (axios.get as any).mockResolvedValue({
      status: 200,
      data: {
        locations: [
          {
            code: "BCN",
            name: "Barcelona El Prat",
            city: { name: "Barcelona" },
            country: { name: "Spain" },
          },
          {
            code: "GRO",
            name: "Girona",
            city: { name: "Girona" },
            country: { name: "Spain" },
          },
        ],
      },
    });

    const res = await GET(req("lat=41.4&lon=2.1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.airports).toHaveLength(2);
    expect(body.airports[0]).toEqual({
      code: "BCN",
      name: "Barcelona El Prat",
      city: "Barcelona",
      country: "Spain",
    });

    const params = (axios.get as any).mock.calls[0][1].params;
    expect(params.lat).toBe("41.4");
    expect(params.lon).toBe("2.1");
    expect(params.location_types).toBe("airport");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/airports/__tests__/route.test.ts`
Expected: FAIL (cannot find module `@/app/api/airports/route`).

- [ ] **Step 3: Write minimal implementation at `src/app/api/airports/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

const TEQUILA_BASE_URL = "https://tequila-api.kiwi.com";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get("lat");
    const lon = searchParams.get("lon");

    if (!lat || !lon) {
      return NextResponse.json(
        { error: "Missing required parameters: lat, lon" },
        { status: 400 }
      );
    }

    const apiKey = process.env.TEQUILA_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Tequila API key not configured" },
        { status: 500 }
      );
    }

    const response = await axios.get(`${TEQUILA_BASE_URL}/locations/radius`, {
      headers: { apikey: apiKey },
      params: {
        lat,
        lon,
        radius: 250,
        locale: "en-US",
        location_types: "airport",
        limit: 5,
        active_only: true,
        sort: "distance",
      },
    });

    const locations = Array.isArray(response.data?.locations)
      ? response.data.locations
      : [];
    const airports = locations.slice(0, 5).map((a: any) => ({
      code: a.code,
      name: a.name,
      city: a.city?.name ?? a.city_name ?? "",
      country: a.country?.name ?? a.country_name ?? "",
    }));

    return NextResponse.json({ airports });
  } catch (error) {
    console.error("Airport search error:", error);
    return NextResponse.json(
      { error: "Failed to search airports" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/airports/__tests__/route.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/airports
git commit -m "feat: add /api/airports geolocation route"
```

---

### Task 7: Home-airport storage helpers

**Files:**
- Create: `src/lib/home-storage.ts`
- Test: `src/lib/__tests__/home-storage.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `const HOME_KEY = "weekendescape:home"`
  - `function loadHome(): string | null` — reads the saved IATA code from `localStorage`, or `null`.
  - `function saveHome(code: string): void` — persists an uppercased IATA code.

- [ ] **Step 1: Write the failing test at `src/lib/__tests__/home-storage.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { loadHome, saveHome } from "@/lib/home-storage";

describe("home-storage", () => {
  beforeEach(() => localStorage.clear());

  it("returns null when nothing saved", () => {
    expect(loadHome()).toBeNull();
  });

  it("saves an uppercased code and loads it back", () => {
    saveHome("bcn");
    expect(loadHome()).toBe("BCN");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/home-storage.test.ts`
Expected: FAIL (cannot find module `@/lib/home-storage`).

- [ ] **Step 3: Write minimal implementation at `src/lib/home-storage.ts`**

```ts
export const HOME_KEY = "weekendescape:home";

export function loadHome(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(HOME_KEY);
}

export function saveHome(code: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(HOME_KEY, code.toUpperCase());
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/home-storage.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/home-storage.ts src/lib/__tests__/home-storage.test.ts
git commit -m "feat: add home-airport localStorage helpers"
```

---

### Task 8: DealCard and DealList components

**Files:**
- Create: `src/components/DealCard.tsx`
- Create: `src/components/DealList.tsx`
- Test: `src/components/__tests__/DealCard.test.tsx`
- Test: `src/components/__tests__/DealList.test.tsx`

**Interfaces:**
- Consumes: `Deal` type from `@/lib/deals` (Task 4).
- Produces:
  - `function DealCard({ deal }: { deal: Deal }): JSX.Element` — renders flag, city, country, dates, nights, price, and a booking link (`<a href={deal.deepLink}>`).
  - `function DealList({ deals, loading, error }: { deals: Deal[]; loading: boolean; error: string | null }): JSX.Element` — shows loading, error, empty-state ("No cheap weekend deals found — try the Loose style or a longer timeline."), or the list of `DealCard`s.

- [ ] **Step 1: Write the failing tests**

`src/components/__tests__/DealCard.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DealCard } from "@/components/DealCard";
import type { Deal } from "@/lib/deals";

const deal: Deal = {
  cityTo: "Rome",
  countryTo: "Italy",
  flag: "🇮🇹",
  dateOut: "2026-09-05",
  dateBack: "2026-09-06",
  nights: 1,
  price: 55,
  currency: "EUR",
  deepLink: "https://kiwi.com/deep/rome",
};

describe("DealCard", () => {
  it("renders city, price and a booking link", () => {
    render(<DealCard deal={deal} />);
    expect(screen.getByText("Rome")).toBeInTheDocument();
    expect(screen.getByText(/55/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /book/i });
    expect(link).toHaveAttribute("href", "https://kiwi.com/deep/rome");
  });
});
```

`src/components/__tests__/DealList.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DealList } from "@/components/DealList";

describe("DealList", () => {
  it("shows a loading state", () => {
    render(<DealList deals={[]} loading={true} error={null} />);
    expect(screen.getByText(/searching/i)).toBeInTheDocument();
  });

  it("shows an error", () => {
    render(<DealList deals={[]} loading={false} error="boom" />);
    expect(screen.getByText("boom")).toBeInTheDocument();
  });

  it("shows the empty state", () => {
    render(<DealList deals={[]} loading={false} error={null} />);
    expect(screen.getByText(/no cheap weekend deals/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/__tests__`
Expected: FAIL (cannot find modules).

- [ ] **Step 3: Write `src/components/DealCard.tsx`**

```tsx
import type { Deal } from "@/lib/deals";

export function DealCard({ deal }: { deal: Deal }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-black/10 dark:border-white/10 p-4">
      <div className="flex items-center gap-3">
        <span className="text-2xl" aria-hidden>
          {deal.flag}
        </span>
        <div>
          <div className="font-medium">{deal.cityTo}</div>
          <div className="text-sm opacity-70">{deal.countryTo}</div>
          <div className="text-sm opacity-70">
            {deal.dateOut} → {deal.dateBack} · {deal.nights}{" "}
            {deal.nights === 1 ? "night" : "nights"}
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-lg font-semibold">
          {deal.price} {deal.currency}
        </div>
        <a
          href={deal.deepLink}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm underline"
        >
          Book
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write `src/components/DealList.tsx`**

```tsx
import type { Deal } from "@/lib/deals";
import { DealCard } from "@/components/DealCard";

export function DealList({
  deals,
  loading,
  error,
}: {
  deals: Deal[];
  loading: boolean;
  error: string | null;
}) {
  if (loading) return <p className="opacity-70">Searching for escapes…</p>;
  if (error) return <p className="text-red-500">{error}</p>;
  if (deals.length === 0)
    return (
      <p className="opacity-70">
        No cheap weekend deals found — try the Loose style or a longer timeline.
      </p>
    );

  return (
    <div className="flex flex-col gap-3">
      {deals.map((deal, i) => (
        <DealCard key={`${deal.cityTo}-${deal.dateOut}-${i}`} deal={deal} />
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/__tests__`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components
git commit -m "feat: add DealCard and DealList components"
```

---

### Task 9: Home page — controls, search wiring, geolocation

**Files:**
- Modify: `src/app/page.tsx` (replace scaffold content)
- Modify: `src/app/layout.tsx` (title/metadata)
- Test: `src/app/__tests__/page.test.tsx`

**Interfaces:**
- Consumes: `loadHome`/`saveHome` (Task 7), `DealList` (Task 8), `Deal` (Task 4), `WeekendStyle` (Task 2).
- Produces: the default-exported `Home` client component wiring the full UX: home-airport input + "Use my location" button, weekend-style selector, timeline dropdown, optional max-price, Search button calling `/api/weekends`, results via `DealList`.

- [ ] **Step 1: Write the failing test at `src/app/__tests__/page.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Home from "@/app/page";

describe("Home page", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("renders the controls", () => {
    render(<Home />);
    expect(
      screen.getByPlaceholderText(/home airport/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /search/i })).toBeInTheDocument();
  });

  it("searches and renders deals from the API", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        deals: [
          {
            cityTo: "Rome",
            countryTo: "Italy",
            flag: "🇮🇹",
            dateOut: "2026-09-05",
            dateBack: "2026-09-06",
            nights: 1,
            price: 55,
            currency: "EUR",
            deepLink: "https://kiwi.com/deep/rome",
          },
        ],
      }),
    } as Response);

    render(<Home />);
    fireEvent.change(screen.getByPlaceholderText(/home airport/i), {
      target: { value: "BCN" },
    });
    fireEvent.click(screen.getByRole("button", { name: /search/i }));

    await waitFor(() =>
      expect(screen.getByText("Rome")).toBeInTheDocument()
    );
    expect((global.fetch as any).mock.calls[0][0]).toContain("flyFrom=BCN");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/__tests__/page.test.tsx`
Expected: FAIL (page still the scaffold; no home-airport input).

- [ ] **Step 3: Replace `src/app/page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import type { Deal } from "@/lib/deals";
import type { WeekendStyle } from "@/lib/weekend";
import { loadHome, saveHome } from "@/lib/home-storage";
import { DealList } from "@/components/DealList";

const STYLES: { value: WeekendStyle; label: string }[] = [
  { value: "strict", label: "Strict (Sat–Sun)" },
  { value: "frimon", label: "Fri–Mon" },
  { value: "loose", label: "Loose (Thu–Sun)" },
];
const MONTHS = [1, 2, 3, 6];

export default function Home() {
  const [home, setHome] = useState("");
  const [style, setStyle] = useState<WeekendStyle>("frimon");
  const [months, setMonths] = useState(3);
  const [maxPrice, setMaxPrice] = useState("");
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const saved = loadHome();
    if (saved) setHome(saved);
  }, []);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("Geolocation unavailable — enter your airport manually.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `/api/airports?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`
          );
          const body = await res.json();
          if (body.airports?.[0]?.code) setHome(body.airports[0].code);
        } catch {
          setError("Couldn't resolve nearby airports — enter one manually.");
        }
      },
      () => setError("Location denied — enter your airport manually.")
    );
  }

  async function search() {
    const code = home.trim().toUpperCase();
    if (!code) {
      setError("Enter your home airport first.");
      return;
    }
    saveHome(code);
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const qs = new URLSearchParams({
        flyFrom: code,
        style,
        months: String(months),
      });
      if (maxPrice.trim()) qs.set("maxPrice", maxPrice.trim());
      const res = await fetch(`/api/weekends?${qs.toString()}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Search failed");
      setDeals(body.deals ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
      setDeals([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-2xl mx-auto p-6 flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">Weekend Escape</h1>
        <p className="opacity-70">The cheapest weekend getaways from home.</p>
      </header>

      <section className="flex flex-col gap-3">
        <div className="flex gap-2">
          <input
            value={home}
            onChange={(e) => setHome(e.target.value)}
            placeholder="Home airport (e.g. BCN)"
            className="flex-1 rounded-lg border border-black/15 dark:border-white/15 px-3 py-2 bg-transparent"
          />
          <button
            onClick={useMyLocation}
            className="rounded-lg border border-black/15 dark:border-white/15 px-3 py-2"
          >
            📍 Use my location
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Weekend style"
            value={style}
            onChange={(e) => setStyle(e.target.value as WeekendStyle)}
            className="rounded-lg border border-black/15 dark:border-white/15 px-3 py-2 bg-transparent"
          >
            {STYLES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          <select
            aria-label="Timeline"
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="rounded-lg border border-black/15 dark:border-white/15 px-3 py-2 bg-transparent"
          >
            {MONTHS.map((m) => (
              <option key={m} value={m}>
                Next {m} {m === 1 ? "month" : "months"}
              </option>
            ))}
          </select>

          <input
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="Max €"
            inputMode="numeric"
            className="w-24 rounded-lg border border-black/15 dark:border-white/15 px-3 py-2 bg-transparent"
          />

          <button
            onClick={search}
            className="rounded-lg bg-black text-white dark:bg-white dark:text-black px-4 py-2 font-medium"
          >
            Search
          </button>
        </div>
      </section>

      {searched && <DealList deals={deals} loading={loading} error={error} />}
      {!searched && error && <p className="text-red-500">{error}</p>}
    </main>
  );
}
```

- [ ] **Step 4: Update `src/app/layout.tsx` metadata**

Change the exported `metadata` object to:

```tsx
export const metadata: Metadata = {
  title: "Weekend Escape — cheapest weekend flights",
  description: "Find the cheapest weekend round-trips from your home airport.",
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/app/__tests__/page.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Run the full suite and build**

Run: `npm run test && npm run build`
Expected: all tests pass; build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/app/page.tsx src/app/layout.tsx src/app/__tests__/page.test.tsx
git commit -m "feat: wire home page controls, search, and geolocation"
```

---

### Task 10: README and manual verification

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: everything above.
- Produces: setup docs and a manual smoke check.

- [ ] **Step 1: Write `README.md`**

```markdown
# Weekend Escape

Finds the cheapest weekend round-trip flights from your home airport across a
future timeline. Built with Next.js + the Kiwi Tequila API.

## Setup

1. `npm install`
2. Create `.env.local`:
   ```
   TEQUILA_API_KEY=your_key
   WEEKEND_CURRENCY=EUR
   ```
   Get a key at https://partners.kiwi.com/
3. `npm run dev` and open http://localhost:3000

## How it works

- Set your home airport (type an IATA code or use geolocation).
- Pick a weekend style (Strict / Fri–Mon / Loose) and timeline (1–6 months).
- One Tequila `/v2/search` call returns the cheapest weekend round-trip per
  destination; results are shown cheapest-first.

## Testing

`npm test` runs the Vitest suite.
```

- [ ] **Step 2: Manual verification with a real key**

Set a real `TEQUILA_API_KEY` in `.env.local`, then:

Run: `npm run dev`

Check in the browser at http://localhost:3000:
- Enter `BCN`, click Search → a cheapest-first list of weekend deals appears.
- Reload the page → `BCN` is prefilled (localStorage).
- Switch style to Loose → results update after another Search.
- Enter a `Max €` value → cheaper-only results.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add README and setup instructions"
```

---

## Notes for the implementer

- Tasks 2–4 and 7 are pure functions — no network, fully deterministic tests.
- Tasks 5–6 mock `axios`; never call the live API in tests.
- Tasks 8–9 use `@testing-library/react` under jsdom.
- The only step requiring a real API key is Task 10's manual verification.
