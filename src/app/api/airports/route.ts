import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const TEQUILA_API_KEY = process.env.TEQUILA_API_KEY;
const TEQUILA_BASE_URL = 'https://tequila-api.kiwi.com';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const term = searchParams.get('term');

    if (!term) {
      return NextResponse.json(
        { error: 'Missing required parameter: term (city name)' },
        { status: 400 }
      );
    }

    if (!TEQUILA_API_KEY) {
      return NextResponse.json(
        { error: 'Tequila API key not configured' },
        { status: 500 }
      );
    }

    console.log('🔍 Airports API Request:', { term, hasApiKey: !!TEQUILA_API_KEY });

    console.log('🚀 Making Tequila API request to:', `${TEQUILA_BASE_URL}/locations/query`);
    console.log('📋 Request params:', {
      term: term,
      locale: 'en-US',
      location_types: 'airport',
      limit: 10,
      active_only: true,
    });

    const response = await axios.get(`${TEQUILA_BASE_URL}/locations/query`, {
      headers: {
        'apikey': TEQUILA_API_KEY,
      },
      params: {
        term: term,
        locale: 'en-US',
        location_types: 'airport',
        limit: 10,
        active_only: true,
      },
    });

    console.log('✅ Tequila API response status:', response.status);
    console.log('📊 Raw response data:', response.data);

    // Format airports response
    const airports = response.data.locations
      .filter((airport: any) => {
        return airport.location && airport.location.lat && airport.location.lon;
      })
      .map((airport: any) => ({
        id: airport.id,
        name: airport.name,
        code: airport.code,
        city: airport.city?.name || airport.city_name || '',
        country: airport.country?.name || airport.country_name || '',
        location: {
          lat: airport.location.lat,
          lon: airport.location.lon,
        },
      }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name))
      .slice(0, 10); // Return top 10 airports

    console.log('✈️ Final airports result:', {
      totalFound: response.data.locations?.length || 0,
      filteredCount: airports.length,
      airports: airports.map((a: any) => ({ code: a.code, name: a.name, city: a.city }))
    });

    return NextResponse.json({ airports });
  } catch (error) {
    console.error('❌ Airport search error:', error);
    if (axios.isAxiosError(error)) {
      console.error('🔍 Axios error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url,
        params: error.config?.params
      });
    }
    return NextResponse.json(
      { error: 'Failed to search airports' },
      { status: 500 }
    );
  }
} 