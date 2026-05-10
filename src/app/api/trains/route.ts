import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const date = searchParams.get("date"); // ISO date string e.g. "2026-03-15"
  const results = parseInt(searchParams.get("results") || "5");

  if (!from || !to) {
    return NextResponse.json(
      { error: "Missing required parameters: from, to (station IDs or names)" },
      { status: 400 }
    );
  }

  try {
    const { createClient } = await import("db-vendo-client");
    const { profile } = await import("db-vendo-client/p/dbnav/index.js");

    const client = createClient(profile, "onewayticket-app", {
      enrichStations: false,
    });

    // Resolve station IDs if names are given
    let fromId = from;
    let toId = to;

    // If the input doesn't look like a station ID (pure digits), search for it
    if (!/^\d+$/.test(from)) {
      const fromLocations = await client.locations(from, {
        results: 1,
        fuzzy: true,
        stops: true,
        addresses: false,
        poi: false,
      });
      if (fromLocations.length > 0 && fromLocations[0].id) {
        fromId = fromLocations[0].id;
      } else {
        return NextResponse.json(
          { error: `Could not find station: ${from}` },
          { status: 404 }
        );
      }
    }

    if (!/^\d+$/.test(to)) {
      const toLocations = await client.locations(to, {
        results: 1,
        fuzzy: true,
        stops: true,
        addresses: false,
        poi: false,
      });
      if (toLocations.length > 0 && toLocations[0].id) {
        toId = toLocations[0].id;
      } else {
        return NextResponse.json(
          { error: `Could not find station: ${to}` },
          { status: 404 }
        );
      }
    }

    const journeyOpts: any = {
      results: Math.min(results, 5),
      tickets: true,
      stopovers: false,
      transfers: 3,
    };

    if (date) {
      journeyOpts.departure = new Date(date);
    }

    const journeysResult = await client.journeys(fromId, toId, journeyOpts);

    // Transform journeys into a clean format
    const trains = (journeysResult.journeys || []).map((journey: any) => {
      const legs = (journey.legs || []).map((leg: any) => ({
        origin: {
          name: leg.origin?.name || leg.origin?.id,
          id: leg.origin?.id,
        },
        destination: {
          name: leg.destination?.name || leg.destination?.id,
          id: leg.destination?.id,
        },
        departure: leg.departure || leg.plannedDeparture,
        arrival: leg.arrival || leg.plannedArrival,
        plannedDeparture: leg.plannedDeparture,
        plannedArrival: leg.plannedArrival,
        departureDelay: leg.departureDelay || null,
        arrivalDelay: leg.arrivalDelay || null,
        line: leg.line
          ? {
              name: leg.line.name,
              product: leg.line.product,
              productName: leg.line.productName,
              operator: leg.line.operator?.name || null,
            }
          : null,
        direction: leg.direction || null,
        walking: leg.walking || false,
        transfer: leg.transfer || false,
        departurePlatform: leg.departurePlatform || null,
        arrivalPlatform: leg.arrivalPlatform || null,
      }));

      // Calculate total duration
      const firstLeg = legs[0];
      const lastLeg = legs[legs.length - 1];
      const departureTime = new Date(firstLeg?.departure).getTime();
      const arrivalTime = new Date(lastLeg?.arrival).getTime();
      const durationMinutes = Math.round(
        (arrivalTime - departureTime) / (1000 * 60)
      );

      // Count transfers (legs - 1, minus walking legs)
      const trainLegs = legs.filter(
        (l: any) => !l.walking && !l.transfer
      );
      const transfers = Math.max(0, trainLegs.length - 1);

      return {
        departure: firstLeg?.departure,
        arrival: lastLeg?.arrival,
        duration: durationMinutes,
        transfers,
        legs,
        price: journey.price
          ? {
              amount: journey.price.amount,
              currency: journey.price.currency,
            }
          : null,
        refreshToken: journey.refreshToken || null,
      };
    });

    return NextResponse.json({
      trains,
      fromStation: fromId,
      toStation: toId,
    });
  } catch (error) {
    console.error("Error searching train journeys:", error);
    return NextResponse.json(
      {
        error: "Failed to search train journeys",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
