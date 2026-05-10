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
    const maxStopovers = searchParams.get("maxStopovers") || "2";
    const oneForCity = searchParams.get("oneForCity");

    if (!flyFrom || !dateFrom || !dateTo) {
      return NextResponse.json(
        { error: "Missing required parameters: flyFrom, dateFrom, dateTo" },
        { status: 400 }
      );
    }

    if (!TEQUILA_API_KEY) {
      return NextResponse.json(
        { error: "Tequila API key not configured" },
        { status: 500 }
      );
    }

    console.log("🔍 Flight search request:", {
      flyFrom,
      dateFrom,
      dateTo,
      maxStopovers,
    });

    const response = await axios.get(`${TEQUILA_BASE_URL}/v2/search`, {
      headers: {
        apikey: TEQUILA_API_KEY,
      },
      params: {
        fly_from: flyFrom,
        date_from: dateFrom,
        date_to: dateTo,
        one_for_city: oneForCity === "0" ? 0 : 1,
        max_stopovers: parseInt(maxStopovers),
        return_from_diff_city: false,
        curr: "RON",
        locale: "en",
        sort: "date",
      },
    });

    console.log("✅ Flight search response:", {
      status: response.status,
      dataCount: response.data.data?.length || 0,
    });

    return NextResponse.json(response.data);
  } catch (error) {
    console.error("Flight search error:", error);
    return NextResponse.json(
      { error: "Failed to search flights" },
      { status: 500 }
    );
  }
}
