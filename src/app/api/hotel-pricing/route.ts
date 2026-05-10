import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const API_KEY = "1d5fc27ddf555a26b88e56a1b21d7311";
const API_SECRET = "bd4aebf907";
const HOTELBEDS_BASE = "https://api.test.hotelbeds.com/hotel-api/1.0";

function getAuthHeaders() {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto
    .createHash("sha256")
    .update(API_KEY + API_SECRET + timestamp)
    .digest("hex");

  return {
    "Api-key": API_KEY,
    "X-Signature": signature,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rateKey = searchParams.get("rateKey");

    if (!rateKey) {
      return NextResponse.json(
        { error: "rateKey parameter is required" },
        { status: 400 }
      );
    }

    console.log("💰 Hotelbeds checkrates request:", { rateKey });

    const body = {
      rooms: [
        {
          rateKey,
        },
      ],
    };

    const response = await fetch(`${HOTELBEDS_BASE}/checkrates`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Hotelbeds checkrates error:", data);
      return NextResponse.json(
        {
          error: "Failed to check hotel rates",
          details: data.error?.message || JSON.stringify(data),
        },
        { status: response.status }
      );
    }

    if (data.hotel) {
      const hotel = data.hotel;
      const room = hotel.rooms?.[0];
      const rate = room?.rates?.[0];

      const result = {
        hotelCode: hotel.code,
        hotelName: hotel.name,
        categoryName: hotel.categoryName,
        checkIn: hotel.checkIn,
        checkOut: hotel.checkOut,
        currency: hotel.currency,
        room: room
          ? {
              code: room.code,
              name: room.name,
              rate: rate
                ? {
                    rateKey: rate.rateKey,
                    net: rate.net,
                    boardCode: rate.boardCode,
                    boardName: rate.boardName,
                    rooms: rate.rooms,
                    adults: rate.adults,
                    children: rate.children,
                    cancellationPolicies: rate.cancellationPolicies,
                    rateComments: rate.rateComments,
                  }
                : null,
            }
          : null,
      };

      console.log("✅ Hotelbeds checkrates result:", result);
      return NextResponse.json({ data: result });
    } else {
      return NextResponse.json(
        { error: "No rate details found", data: null },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error("❌ Hotel pricing API error:", error);
    return NextResponse.json(
      {
        error: "Failed to check hotel rates",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
