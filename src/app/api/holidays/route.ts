import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const countryCode = searchParams.get("countryCode");
  const year = searchParams.get("year");

  if (!countryCode || !year) {
    return NextResponse.json(
      { error: "Missing required parameters: countryCode, year" },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(
      `https://date.nager.at/api/v3/publicholidays/${year}/${countryCode.toUpperCase()}`,
      { next: { revalidate: 86400 } } // Cache for 24 hours
    );

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ holidays: [] });
      }
      throw new Error(`Nager.Date API returned ${response.status}`);
    }

    const holidays = await response.json();

    return NextResponse.json({ holidays });
  } catch (error) {
    console.error("Error fetching holidays:", error);
    return NextResponse.json(
      { error: "Failed to fetch holidays" },
      { status: 500 }
    );
  }
}
