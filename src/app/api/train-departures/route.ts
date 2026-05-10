import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const from = searchParams.get("from"); // city name or station ID
  const date = searchParams.get("date"); // ISO date string e.g. "2026-03-15"
  const days = parseInt(searchParams.get("days") || "3"); // number of days to scan

  if (!from) {
    return NextResponse.json(
      { error: "Missing required parameter: from (station name or ID)" },
      { status: 400 }
    );
  }

  try {
    const { createClient } = await import("db-vendo-client");
    const { profile } = await import("db-vendo-client/p/dbnav/index.js");

    const client: any = createClient(profile, "onewayticket-app", {
      enrichStations: false,
    });

    // Resolve station ID if a name is given
    let stationId = from;
    let stationName = from;

    if (!/^\d+$/.test(from)) {
      const locations = await client.locations(from, {
        results: 1,
        fuzzy: true,
        stops: true,
        addresses: false,
        poi: false,
      });
      if (locations.length > 0 && locations[0].id) {
        stationId = locations[0].id;
        stationName = locations[0].name || from;
      } else {
        return NextResponse.json(
          { error: `Could not find station: ${from}` },
          { status: 404 }
        );
      }
    }

    const numDays = Math.min(Math.max(days, 1), 7); // Cap at 7 days

    // Collect departures across multiple days
    // Some APIs return only a few results per query, so we query
    // at multiple time slots throughout each day to capture all departures
    const allRawDepartures: any[] = [];
    const seenTripIds = new Set<string>();

    const timeSlots = ["06:00", "08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00"];

    for (let d = 0; d < numDays; d++) {
      // Build the date parts
      let dateY: number, dateM: number, dateD: number;
      if (date) {
        const baseDate = new Date(date + "T00:00:00");
        baseDate.setDate(baseDate.getDate() + d);
        dateY = baseDate.getFullYear();
        dateM = baseDate.getMonth() + 1;
        dateD = baseDate.getDate();
      } else {
        const now = new Date();
        now.setDate(now.getDate() + d);
        dateY = now.getFullYear();
        dateM = now.getMonth() + 1;
        dateD = now.getDate();
      }

      const dateStr = `${dateY}-${String(dateM).padStart(2, "0")}-${String(dateD).padStart(2, "0")}`;

      // Query each time slot
      for (const slot of timeSlots) {
        const queryTime = new Date(`${dateStr}T${slot}:00`);

        try {
          const departuresResult = await client.departures(stationId, {
            when: queryTime,
            duration: 180, // 3 hours per slot
            results: 50,
          });

          for (const dep of departuresResult.departures || []) {
            // Deduplicate by tripId
            const tripKey = dep.tripId || `${dep.line?.name}-${dep.when}`;
            if (!seenTripIds.has(tripKey)) {
              seenTripIds.add(tripKey);
              allRawDepartures.push(dep);
            }
          }
        } catch (slotError) {
          // Individual slot failures are ok, continue
        }
      }
    }

    // Filter out non-train transport
    const trainDepartures = allRawDepartures.filter((dep) => {
      const product = dep.line?.product || "";
      const productName = dep.line?.productName || "";
      const mode = dep.line?.mode || "";
      // Keep if product is train-related OR if mode is "train"
      if (mode === "train") return true;
      if (
        product === "suburban" ||
        product === "bus" ||
        product === "tram" ||
        product === "ferry"
      ) {
        return false;
      }
      // Keep regional, regionalExpress, national, nationalExpress, and anything else that's a train
      if (productName === "Bus") return false;
      return true;
    });

    // For departures with null destination, resolve via trip lookup
    // We do this in parallel with a concurrency limit
    const resolvedDepartures: Array<{
      destination: { name: string; id: string };
      departure: string;
      plannedDeparture: string;
      delay: number | null;
      line: {
        name: string;
        product: string;
        productName: string;
        operator: string | null;
      } | null;
      direction: string | null;
      platform: string | null;
      tripId: string | null;
      stops: string[];
    }> = [];

    // Process departures - resolve missing destinations via trip API
    const tripPromises = trainDepartures.map(async (dep) => {
      let destName = dep.destination?.name || dep.direction || null;
      let destId = dep.destination?.id || "";
      let stops: string[] = [];

      // If destination is missing, try to resolve from trip
      if (!destName && dep.tripId) {
        try {
          const trip = await client.trip(dep.tripId, { stopovers: true });
          const stopovers = trip.trip?.stopovers || [];
          if (stopovers.length > 0) {
            const lastStop = stopovers[stopovers.length - 1];
            destName = lastStop?.stop?.name || null;
            destId = lastStop?.stop?.id || "";
            // Collect intermediate stop names (skip origin)
            stops = stopovers
              .slice(1)
              .map((s: any) => s.stop?.name)
              .filter(Boolean);
          }
        } catch {
          // Trip lookup failed, skip this departure
        }
      }

      if (!destName) return null;

      return {
        destination: { name: destName, id: destId },
        departure: dep.when || dep.plannedWhen,
        plannedDeparture: dep.plannedWhen,
        delay: dep.delay || null,
        line: dep.line
          ? {
              name: dep.line.name,
              product: dep.line.product,
              productName: dep.line.productName,
              operator: dep.line.operator?.name || null,
            }
          : null,
        direction: dep.direction || null,
        platform: dep.platform || dep.plannedPlatform || null,
        tripId: dep.tripId || null,
        stops,
      };
    });

    const results = await Promise.all(tripPromises);
    for (const r of results) {
      if (r) resolvedDepartures.push(r);
    }

    // Group by destination, collecting all departures per destination
    const destinationMap = new Map<
      string,
      {
        destination: { name: string; id: string };
        departures: Array<{
          departure: string;
          plannedDeparture: string;
          delay: number | null;
          line: {
            name: string;
            product: string;
            productName: string;
            operator: string | null;
          } | null;
          platform: string | null;
          tripId: string | null;
        }>;
        stops: string[];
        trainTypes: string[];
      }
    >();

    for (const dep of resolvedDepartures) {
      const destKey = dep.destination.name;

      if (!destinationMap.has(destKey)) {
        destinationMap.set(destKey, {
          destination: dep.destination,
          departures: [],
          stops: dep.stops,
          trainTypes: [],
        });
      }

      const entry = destinationMap.get(destKey)!;
      entry.departures.push({
        departure: dep.departure,
        plannedDeparture: dep.plannedDeparture,
        delay: dep.delay,
        line: dep.line,
        platform: dep.platform,
        tripId: dep.tripId,
      });

      // Track unique train types
      if (dep.line?.productName) {
        const typeName = dep.line.productName;
        if (!entry.trainTypes.includes(typeName)) {
          entry.trainTypes.push(typeName);
        }
      }
    }

    // Convert to array and sort by destination name
    const destinations = Array.from(destinationMap.values())
      .map((entry) => ({
        ...entry,
        departures: entry.departures.sort(
          (a, b) =>
            new Date(a.departure).getTime() - new Date(b.departure).getTime()
        ),
        departureCount: entry.departures.length,
        nextDeparture: entry.departures.sort(
          (a, b) =>
            new Date(a.departure).getTime() - new Date(b.departure).getTime()
        )[0],
      }))
      .sort((a, b) => b.departureCount - a.departureCount); // Sort by most connected first

    return NextResponse.json({
      station: { id: stationId, name: stationName },
      destinations,
      totalDestinations: destinations.length,
      periodDays: numDays,
      periodStart: date || new Date().toISOString().split("T")[0],
    });
  } catch (error) {
    console.error("Error fetching train departures:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch departures",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
