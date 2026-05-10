import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

const TEQUILA_API_KEY = process.env.TEQUILA_API_KEY;
const TEQUILA_BASE_URL = "https://tequila-api.kiwi.com";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const flyFrom = searchParams.get("flyFrom");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const stayNights = searchParams.get("stayNights");
    const maxNights = searchParams.get("maxNights");
    const returnFrom = searchParams.get("returnFrom");
    const returnTo = searchParams.get("returnTo");
    const weekendDeparture = searchParams.get("weekendDeparture");
    const directFlight = searchParams.get("directFlight");
    const oneForCity = searchParams.get("oneForCity");

    if (!flyFrom || !dateFrom) {
      return NextResponse.json(
        {
          error: "Missing required parameters: flyFrom, dateFrom",
        },
        { status: 400 }
      );
    }

    if (!TEQUILA_API_KEY) {
      return NextResponse.json(
        { error: "Tequila API key not configured" },
        { status: 500 }
      );
    }

    console.log("🔍 Round-trip flight search request:", {
      flyFrom,
      dateFrom,
    });

    const response = await axios.get(`${TEQUILA_BASE_URL}/v2/search`, {
      headers: {
        apikey: TEQUILA_API_KEY,
      },
      params: {
        // Required parameters
        fly_from: flyFrom,
        date_from: dateFrom,
        date_to: dateTo,
        curr: "RON",

        // Round trip specific parameters
        flight_type: "round",
        ret_from_diff_city: false,
        // Add stay nights if provided
        ...(stayNights &&
          maxNights && {
            nights_in_dst_from: parseInt(stayNights),
            nights_in_dst_to: parseInt(maxNights),
          }),

        // Return date range (optional, overrides nights_in_dst when set)
        ...(returnFrom && { return_from: returnFrom }),
        ...(returnTo && { return_to: returnTo }),

        // Weekend departure filter
        ...(weekendDeparture === "true" && { fly_days: "4,5", fly_days_type: "departure" }),

        // Direct flight filter
        ...(directFlight === "true" && { max_stopovers: 0 }),

        // Discovery parameters
        one_for_city: oneForCity === "0" ? 0 : 1,
        limit: 2000,

        // Optional filters
        sort: "date",
        price_from: 0,
        price_to: 2000,
      },
    });

    console.log("✅ Round-trip flight search response:", {
      status: response.status,
      dataCount: response.data.data?.length || 0,
    });

    // Log the full response for debugging
    // console.log("🔍 Full Kiwi API response data:", response.data);

    // // Log sample flights if available
    // if (response.data.data && response.data.data.length > 0) {
    //   console.log("📋 Sample flight from Kiwi:", response.data.data[0]);
    // }

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error("Round-trip flight search error:", error);

    // Log more details about the error
    if (error.response) {
      console.error("API Error Response:", {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers,
      });
    }

    return NextResponse.json(
      { error: "Failed to search round-trip flights" },
      { status: 500 }
    );
  }
}
