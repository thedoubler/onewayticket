import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

// Fixed API keys - removed non-ASCII characters
const UNSPLASH_ACCESS_KEY = 'GsWjA4VHEVaWU-hukf52v-8yVsK2lAqThWSetG7jows';
const UNSPLASH_SECRET = 'LLcGEtK9ta8nGKZqK3RTl4Jpr06wuH4EqCjyHR8o8oY';
const CACHE_DIR = path.join(process.cwd(), 'public', 'cache');
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');

    if (!query) {
      return NextResponse.json(
        { error: 'Missing query parameter' },
        { status: 400 }
      );
    }

    console.log('🖼️ Unsplash request for query:', query);

    // Check cache first
    const cacheKey = query.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const cacheFile = path.join(CACHE_DIR, `${cacheKey}.json`);
    
    if (fs.existsSync(cacheFile)) {
      const cacheData = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      const now = Date.now();
      
      // Check if cache is still valid
      if (now - cacheData.timestamp < CACHE_DURATION) {
        console.log('✅ Serving cached image for:', query);
        return NextResponse.json({
          imageUrl: cacheData.imageUrl,
          cached: true,
          timestamp: cacheData.timestamp
        });
      }
    }

    // Fetch from Unsplash API
    console.log('🌐 Fetching from Unsplash API for:', query);
    console.log('🔑 Using access key:', UNSPLASH_ACCESS_KEY.substring(0, 10) + '...');
    
    const response = await axios.get('https://api.unsplash.com/search/photos', {
      headers: {
        'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}`
      },
      params: {
        query: `${query} city landscape`,
        orientation: 'landscape',
        per_page: 1,
        order_by: 'relevant'
      },
      timeout: 10000 // 10 second timeout
    });

    console.log('📡 Unsplash API response status:', response.status);
    console.log('📡 Unsplash API response data:', JSON.stringify(response.data, null, 2));

    if (response.data.results && response.data.results.length > 0) {
      const imageUrl = response.data.results[0].urls.regular;
      console.log('🖼️ Selected image URL:', imageUrl);
      
      // Cache the result
      const cacheData = {
        imageUrl,
        timestamp: Date.now(),
        query
      };
      
      fs.writeFileSync(cacheFile, JSON.stringify(cacheData));
      console.log('💾 Cached image for:', query);

      return NextResponse.json({
        imageUrl,
        cached: false,
        timestamp: Date.now()
      });
    } else {
      console.log('❌ No images found in response');
      return NextResponse.json(
        { error: 'No images found for this query' },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('❌ Unsplash API error:', error);
    if (axios.isAxiosError(error)) {
      console.error('❌ Axios error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
    }
    return NextResponse.json(
      { error: 'Failed to fetch image', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 