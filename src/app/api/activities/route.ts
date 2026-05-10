import { NextRequest, NextResponse } from "next/server";
const Amadeus = require("amadeus");

// Amadeus API credentials
const AMADEUS_CLIENT_ID = "gB1igOIkAA55p6Y0axmBhJpKuktGY1bZ";
const AMADEUS_CLIENT_SECRET = "1qwT9zXFwWihASqr";

// Initialize Amadeus client
const amadeus = new Amadeus({
  clientId: AMADEUS_CLIENT_ID,
  clientSecret: AMADEUS_CLIENT_SECRET,
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const latitude = searchParams.get("latitude");
    const longitude = searchParams.get("longitude");
    const radius = searchParams.get("radius") || "1";

    if (!latitude || !longitude) {
      return NextResponse.json(
        { error: "Latitude and longitude are required" },
        { status: 400 }
      );
    }

    console.log("🎯 Activities search request:", {
      latitude,
      longitude,
      radius,
    });

    try {
      // Get activities using Amadeus SDK
      const activitiesResponse = await amadeus.shopping.activities.get({
        latitude: latitude,
        longitude: longitude,
        radius: radius,
      });

      console.log("📡 Amadeus activities response:", activitiesResponse.data);

      if (activitiesResponse.data && activitiesResponse.data.length > 0) {
        const activities = activitiesResponse.data.slice(0, 10); // Limit to 10 activities
        return NextResponse.json({ data: activities });
      } else {
        return NextResponse.json({ data: [] });
      }
    } catch (amadeusError: any) {
      console.error("❌ Amadeus activities API error:", amadeusError);
      return NextResponse.json(
        {
          error: "Failed to fetch activities from Amadeus",
          activities: [],
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Activities API error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch activities",
        activities: [],
      },
      { status: 500 }
    );
  }
}
