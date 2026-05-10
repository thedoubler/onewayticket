import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const API_KEY = "1d5fc27ddf555a26b88e56a1b21d7311";
const API_SECRET = "bd4aebf907";
const HOTELBEDS_BASE = "https://api.test.hotelbeds.com/hotel-api/1.0";
const HOTELBEDS_CONTENT_BASE =
  "https://api.test.hotelbeds.com/hotel-content-api/1.0";
const HOTELBEDS_IMAGE_BASE = "http://photos.hotelbeds.com/giata";

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
    const latitude = searchParams.get("latitude");
    const longitude = searchParams.get("longitude");
    const checkInDate = searchParams.get("checkInDate");
    const checkOutDate = searchParams.get("checkOutDate");

    if (!latitude || !longitude || !checkInDate || !checkOutDate) {
      return NextResponse.json(
        {
          error:
            "Missing required parameters: latitude, longitude, checkInDate, checkOutDate",
        },
        { status: 400 }
      );
    }

    console.log("🏨 Hotelbeds search request:", {
      latitude,
      longitude,
      checkInDate,
      checkOutDate,
    });

    const body = {
      stay: {
        checkIn: checkInDate,
        checkOut: checkOutDate,
      },
      occupancies: [
        {
          rooms: 1,
          adults: 2,
          children: 0,
        },
      ],
      geolocation: {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        radius: 20,
        unit: "km",
      },
      filter: {
        maxHotels: 15,
        minCategory: 3,
        maxCategory: 5,
      },
    };

    const response = await fetch(`${HOTELBEDS_BASE}/hotels`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Hotelbeds error:", data);
      return NextResponse.json(
        {
          error: "Failed to fetch hotels from Hotelbeds",
          details: data.error?.message || JSON.stringify(data),
        },
        { status: response.status }
      );
    }

    if (data.hotels?.hotels && data.hotels.hotels.length > 0) {
      // Fetch hotel images from Content API
      const hotelCodes = data.hotels.hotels
        .map((h: any) => h.code)
        .join(",");
      const imageMap: Record<number, string[]> = {};

      try {
        const contentResponse = await fetch(
          `${HOTELBEDS_CONTENT_BASE}/hotels?codes=${hotelCodes}&fields=images&language=ENG`,
          { headers: getAuthHeaders() }
        );
        if (contentResponse.ok) {
          const contentData = await contentResponse.json();
          for (const h of contentData.hotels || []) {
            if (h.images && h.images.length > 0) {
              imageMap[h.code] = h.images
                .filter((img: any) => img.imageTypeCode === "GEN" || img.imageTypeCode === "HAB")
                .slice(0, 5)
                .map((img: any) => `${HOTELBEDS_IMAGE_BASE}/${img.path}`);
            }
          }
        }
      } catch (imgError) {
        console.warn("⚠️ Could not fetch hotel images:", imgError);
      }

      const hotels = data.hotels.hotels.map((hotel: any) => {
        return {
          code: hotel.code,
          name: hotel.name,
          categoryName: hotel.categoryName,
          categoryCode: hotel.categoryCode,
          destinationName: hotel.destinationName,
          latitude: hotel.latitude,
          longitude: hotel.longitude,
          minRate: hotel.minRate,
          maxRate: hotel.maxRate,
          currency: hotel.currency,
          images: imageMap[hotel.code] || [],
          rooms: (hotel.rooms || []).map((room: any) => ({
            code: room.code,
            name: room.name,
            rates: (room.rates || []).map((rate: any) => ({
              rateKey: rate.rateKey,
              rateClass: rate.rateClass,
              rateType: rate.rateType,
              net: rate.net,
              boardCode: rate.boardCode,
              boardName: rate.boardName,
              rooms: rate.rooms,
              adults: rate.adults,
              children: rate.children,
              cancellationPolicies: rate.cancellationPolicies,
            })),
          })),
        };
      });

      // Sort by minRate ascending
      hotels.sort(
        (a: any, b: any) => parseFloat(a.minRate) - parseFloat(b.minRate)
      );

      console.log(`✅ Found ${hotels.length} hotels via Hotelbeds`);

      return NextResponse.json({
        hotels,
        total: hotels.length,
        checkInDate,
        checkOutDate,
      });
    } else {
      console.log("❌ No hotels found via Hotelbeds");
      return NextResponse.json(
        { error: "No hotels found for this location" },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error("❌ Hotel API error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch hotels",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
