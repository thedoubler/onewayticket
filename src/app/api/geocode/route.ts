import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(request: NextRequest) {
  try {
    // This API endpoint will be called from the frontend after getting browser geolocation
    // The frontend will pass the lat/long as query parameters
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');

    if (!lat || !lon) {
      return NextResponse.json(
        { error: 'Missing lat/lon parameters from browser geolocation' },
        { status: 400 }
      );
    }

    console.log('📍 Browser geolocation received:', { lat, lon });

    // Reverse geocode to get city name using OpenStreetMap Nominatim
    console.log('🌍 Reverse geocoding coordinates to get city name...');
    const nominatimResponse = await axios.get(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'OneWayTicket/1.0 (flight search app)',
        },
        timeout: 5000,
      }
    );

    console.log('🌍 Nominatim response:', nominatimResponse.data);

    const address = nominatimResponse.data.address;
    const city = address.city || address.town || address.village || address.county || 'Unknown City';
    const country = address.country || 'Unknown Country';
    const state = address.state || '';

    console.log('🏙️ Extracted location info:', { city, country, state });

    return NextResponse.json({
      lat: parseFloat(lat),
      lon: parseFloat(lon),
      city,
      country,
      state,
      source: 'browser_geolocation'
    });
  } catch (error) {
    console.error('❌ Geocoding error:', error);
    return NextResponse.json(
      { error: 'Failed to process geolocation data' },
      { status: 500 }
    );
  }
} 