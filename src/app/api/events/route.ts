import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const date = searchParams.get("date");
  const location = searchParams.get("location");

  if (!date || !location) {
    return NextResponse.json(
      { error: "Date and location are required" },
      { status: 400 }
    );
  }

  // Check if the date is in the past
  const searchDate = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset time to start of day for comparison

  if (searchDate < today) {
    return NextResponse.json(
      {
        error: "Cannot search for events in the past",
        events: [],
        weather: "Check local weather forecast",
        tips: "Plan your trip according to local events and weather conditions",
      },
      { status: 400 }
    );
  }

  try {
    const openaiResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content: `You are a helpful assistant that searches the internet for current, real-time information about events, festivals, and activities happening on specific dates and locations. Use your knowledge cutoff and web search capabilities to find the most up-to-date information. Provide relevant, accurate, and engaging information based on current data. Format your response as a JSON object with the following structure:
                        {
                            "events": [
                                {
                                    "title": "Event name",
                                    "description": "Brief description",
                                    "type": "festival|concert|sports|cultural|other",
                                    "relevance": "high|medium|low",
                                    "date": "The specific date(s) when the event occurs (e.g., '2024-03-15', 'March 15-17, 2024', 'Every Saturday in March')",
                                    "time": "When the event takes place (e.g., 'All day', '7:00 PM', 'Morning', 'Weekend')",
                                    "location": "Where the event takes place (venue, area, or district)",
                                    "duration": "How long the event lasts (e.g., '2 hours', '3 days', 'All weekend')",
                                    "cost": "Cost information if available (e.g., 'Free', '$25', 'From $15')",
                                    "highlights": "Key highlights or what makes this event special"
                                }
                            ],
                            "weather": "Brief weather info if available",
                            "tips": "Travel tips for this date/location"
                        }`,
            },
            {
              role: "user",
              content: `Search the internet for current events, festivals, and activities happening on or starting on ${date} in ${location}. Use web search to find real-time, up-to-date information from official sources, event websites, tourism boards, and local news.

Search criteria:
1. Events that occur specifically on ${date}
2. Events that start on ${date} (even if they continue beyond this date)
3. Ongoing events that include ${date} in their duration
4. Recurring events that happen on this date (weekly/monthly events)

Event types to search for: cultural festivals, concerts, sports events, exhibitions, markets, performances, conferences, seasonal celebrations, local traditions, community gatherings, food festivals, art shows, music events, theater performances, and outdoor activities.

Search strategy:
- Look for official event websites and tourism board listings
- Check local news sources and event calendars
- Search for venue-specific events (museums, theaters, stadiums, parks)
- Find seasonal and cultural celebrations
- Look for recurring weekly/monthly events

For each event found, provide accurate timing information and specify if it's a single-day event or part of a multi-day festival/event. IMPORTANT: Include the specific date(s) for each event in the "date" field, showing exactly when the event occurs.

Also search for and provide relevant travel tips for visiting ${location} on ${date}, including seasonal considerations, local customs, weather conditions, and practical advice for tourists.`,
            },
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      }
    );

    if (!openaiResponse.ok) {
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }

    const data = await openaiResponse.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error("No content received from OpenAI");
    }

    // Try to parse the JSON response
    let parsedContent;
    try {
      parsedContent = JSON.parse(content);
    } catch (parseError) {
      // If parsing fails, create a fallback response
      parsedContent = {
        events: [
          {
            title: "Local Events",
            description: content,
            type: "other",
            relevance: "medium",
          },
        ],
        weather: "Check local weather forecast",
        tips: "Plan your trip according to local events and weather conditions",
      };
    }

    return NextResponse.json(parsedContent);
  } catch (error) {
    console.error("Events API error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch events",
        events: [],
        weather: "Check local weather forecast",
        tips: "Plan your trip according to local events and weather conditions",
      },
      { status: 500 }
    );
  }
}
