import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const term = searchParams.get("term");

  if (!term) {
    return NextResponse.json(
      { error: "Missing required parameter: term" },
      { status: 400 }
    );
  }

  try {
    const { createClient } = await import("db-vendo-client");
    const { profile } = await import("db-vendo-client/p/dbnav/index.js");

    const client = createClient(profile, "onewayticket-app", {
      enrichStations: false,
    });

    const locations = await client.locations(term, {
      results: 10,
      fuzzy: true,
      stops: true,
      addresses: false,
      poi: false,
    });

    // Filter to only stations/stops with IDs
    const stations = locations
      .filter((loc: any) => loc.type === "stop" || loc.type === "station")
      .map((loc: any) => ({
        id: loc.id,
        name: loc.name,
        location: loc.location || null,
      }));

    return NextResponse.json({ stations });
  } catch (error) {
    console.error("Error searching train stations:", error);
    return NextResponse.json(
      {
        error: "Failed to search train stations",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
