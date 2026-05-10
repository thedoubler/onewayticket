"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Sun,
  Moon,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Hourglass,
  Pencil,
  PartyPopper,
} from "lucide-react";
import FlightDetailView from "./components/FlightDetailView";
import TrainSearchView from "./components/TrainSearchView";
import { BorderRotate } from "@/components/ui/animated-gradient-border";
import {
  getContinent,
  getAvailableContinents,
  CONTINENT_EMOJI,
} from "@/utils/continents";

interface Flight {
  id: string;
  flyFrom: string;
  flyTo: string;
  cityFrom: string;
  cityTo: string;
  countryFrom: {
    code: string;
    name: string;
  };
  countryTo: {
    code: string;
    name: string;
  };
  price: number;
  duration: {
    departure: number;
    return: number;
    total: number;
  };
  nightsInDest?: number;
  technical_stops: number;
  route: Array<{
    flyFrom: string;
    flyTo: string;
    cityFrom: string;
    cityTo: string;
    airline: string;
    flight_no: number;
    local_departure: string;
    local_arrival: string;
    utc_departure: string;
    utc_arrival: string;
  }>;
  booking_token: string;
  deep_link: string;
  local_departure: string;
  local_arrival: string;
  utc_departure: string;
  utc_arrival: string;
}

interface PublicHoliday {
  date: string;
  localName: string;
  name: string;
  countryCode: string;
  fixed: boolean;
  global: boolean;
  types: string[];
}

interface LocationInfo {
  city: string;
  country: string;
  code: string;
}

export default function FlightSearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <FlightSearchPageContent />
    </Suspense>
  );
}

function FlightSearchPageContent() {
  // Main page tab: derived from URL search params (?tab=trains)
  const searchParams = useSearchParams();
  const mainTab = useMemo(() => {
    const tab = searchParams.get("tab");
    return tab === "trains" ? "trains" : "flights";
  }, [searchParams]);

  const [searchType, setSearchType] = useState<"oneway" | "roundtrip">(
    "oneway"
  );
  const [locationInfo, setLocationInfo] = useState<LocationInfo | null>(null);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [editableCity, setEditableCity] = useState<string>("");
  const [airportSuggestions, setAirportSuggestions] = useState<
    Array<{ code: string; name: string; city: string; country: string }>
  >([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Filter states
  const [timeFilter, setTimeFilter] = useState<
    "all" | "24h" | "1week" | "2weeks" | "1month" | "2months" | "3months"
  >("all");
  const [weekendOnly, setWeekendOnly] = useState(false);
  const [directFlightsOnly, setDirectFlightsOnly] = useState(false);
  const [oneForCity, setOneForCity] = useState(true);
  const [departureTimeFrom, setDepartureTimeFrom] = useState<string>("00:00");
  const [departureTimeTo, setDepartureTimeTo] = useState<string>("23:59");
  const [minNights, setMinNights] = useState(1);
  const [maxNights, setMaxNights] = useState(7);
  const [continentFilter, setContinentFilter] = useState<string>("Globe");

  // Optional specific dates
  const [departureDate, setDepartureDate] = useState<string>("");
  const [returnDate, setReturnDate] = useState<string>("");

  // Holidays per destination country: { "RO": PublicHoliday[], "GB": PublicHoliday[] }
  const [holidaysByCountry, setHolidaysByCountry] = useState<{
    [countryCode: string]: PublicHoliday[];
  }>({});

  // Selected flight for details
  const [selectedFlight, setSelectedFlight] = useState<Flight | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Get user's location
  useEffect(() => {
    const getLocation = async () => {
      try {
        setLocationLoading(true);

        // First, get browser geolocation
        if (!navigator.geolocation) {
          throw new Error("Geolocation is not supported by this browser");
        }

        const position = await new Promise<GeolocationPosition>(
          (resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 300000, // 5 minutes
            });
          }
        );

        const { latitude, longitude } = position.coords;
        console.log("📍 Browser geolocation:", { latitude, longitude });

        // Then call our geocode API with the coordinates
        const response = await fetch(
          `/api/geocode?lat=${latitude}&lon=${longitude}`
        );
        if (response.ok) {
          const data = await response.json();
          console.log("🌍 Geocode response:", data);

          // Find the nearest airport for this location
          const airportsResponse = await fetch(
            `/api/airports?term=${data.city}`
          );
          if (airportsResponse.ok) {
            const airportsData = await airportsResponse.json();
            const nearestAirport = airportsData.airports?.[0];

            if (nearestAirport) {
              setLocationInfo({
                city: data.city,
                country: data.country,
                code: nearestAirport.code,
              });
            } else {
              // Fallback to a default airport if no airports found
              setLocationInfo({
                city: data.city,
                country: data.country,
                code: "LHR", // Default to London Heathrow
              });
            }
          } else {
            // Fallback if airports API fails
            setLocationInfo({
              city: data.city,
              country: data.country,
              code: "LHR", // Default to London Heathrow
            });
          }
        } else {
          console.warn("Geocode API failed, using fallback location");
          setLocationInfo({
            city: "London",
            country: "United Kingdom",
            code: "LHR",
          });
        }
      } catch (error) {
        console.warn("Location detection failed, using fallback:", error);
        setLocationInfo({
          city: "London",
          country: "United Kingdom",
          code: "LHR",
        });
      } finally {
        setLocationLoading(false);
      }
    };

    getLocation();
  }, []);

  // Update editable city when location info changes (only on initial load)
  useEffect(() => {
    if (locationInfo?.city && !editableCity) {
      setEditableCity(locationInfo.city);
    }
  }, [locationInfo?.city]);

  // Debounced airport search with autocomplete
  useEffect(() => {
    if (editableCity.length >= 2) {
      const timeoutId = setTimeout(async () => {
        try {
          const airportsResponse = await fetch(
            `/api/airports?term=${encodeURIComponent(editableCity)}`
          );
          if (airportsResponse.ok) {
            const airportsData = await airportsResponse.json();
            const airports = airportsData.airports || [];

            setAirportSuggestions(airports);
            setShowSuggestions(airports.length > 0);

            // Auto-select first airport if no suggestions are showing
            const nearestAirport = airports[0];
            if (nearestAirport) {
              setLocationInfo({
                city: editableCity,
                country: nearestAirport.country || locationInfo?.country || "",
                code: nearestAirport.code,
              });
            }
          }
        } catch (error) {
          console.error("Error searching airports:", error);
        }
      }, 400);

      return () => clearTimeout(timeoutId);
    } else {
      setAirportSuggestions([]);
      setShowSuggestions(false);
    }
  }, [editableCity]);

  const selectAirport = (airport: {
    code: string;
    name: string;
    city: string;
    country: string;
  }) => {
    setEditableCity(airport.city || airport.name);
    setLocationInfo({
      city: airport.city || airport.name,
      country: airport.country,
      code: airport.code,
    });
    setShowSuggestions(false);
    setFlights([]);
  };

  // Fetch public holidays when flights change
  useEffect(() => {
    if (flights.length === 0) return;

    const fetchHolidays = async () => {
      // Gather unique destination country codes and years from flights
      const countryYears = new Map<string, Set<number>>();
      for (const flight of flights) {
        const cc = flight.countryTo.code;
        const year = new Date(flight.local_departure).getFullYear();
        if (!countryYears.has(cc)) countryYears.set(cc, new Set());
        countryYears.get(cc)!.add(year);
      }

      const newHolidays: { [countryCode: string]: PublicHoliday[] } = {};

      const fetches: Promise<void>[] = [];
      for (const [countryCode, years] of countryYears) {
        // Skip if already fetched
        if (holidaysByCountry[countryCode]) {
          newHolidays[countryCode] = holidaysByCountry[countryCode];
          continue;
        }
        for (const year of years) {
          fetches.push(
            fetch(`/api/holidays?countryCode=${countryCode}&year=${year}`)
              .then((res) => (res.ok ? res.json() : { holidays: [] }))
              .then((data) => {
                if (!newHolidays[countryCode]) newHolidays[countryCode] = [];
                newHolidays[countryCode].push(...(data.holidays || []));
              })
              .catch(() => {
                // Silently skip failed holiday fetches
              })
          );
        }
      }

      await Promise.all(fetches);
      setHolidaysByCountry((prev) => ({ ...prev, ...newHolidays }));
    };

    fetchHolidays();
  }, [flights]);

  // Get holidays that overlap with a flight's travel period at destination
  const getHolidaysForFlight = (flight: Flight): PublicHoliday[] => {
    const countryHolidays = holidaysByCountry[flight.countryTo.code];
    if (!countryHolidays || countryHolidays.length === 0) return [];

    const arrivalDate = new Date(flight.local_arrival);
    arrivalDate.setHours(0, 0, 0, 0);

    const windowStart = new Date(arrivalDate);
    const windowEnd = new Date(arrivalDate);

    if (flight.nightsInDest) {
      // Round-trip: check the full stay period
      windowEnd.setDate(windowEnd.getDate() + flight.nightsInDest);
    } else {
      // One-way: only show holidays on the arrival day itself
      // (no window extension — a holiday 5 days after arrival is irrelevant)
    }

    return countryHolidays.filter((h) => {
      const holidayDate = new Date(h.date + "T00:00:00");
      return holidayDate >= windowStart && holidayDate <= windowEnd;
    });
  };

  // Format time with day/night icon
  const formatTimeWithIcon = (dateString: string) => {
    const date = new Date(dateString);
    const hours = date.getHours();
    const timeStr = date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const isNight = hours >= 18 || hours < 6;
    const icon = isNight ? (
      <Moon className="w-3 h-3" />
    ) : (
      <Sun className="w-3 h-3" />
    );

    return { time: timeStr, icon, isNight };
  };

  // Calculate layover duration
  const calculateLayoverDuration = (route: Flight["route"]) => {
    if (!route || route.length <= 1) return null;

    const layovers = [];
    for (let i = 0; i < route.length - 1; i++) {
      try {
        const arrival = new Date(route[i].local_arrival);
        const departure = new Date(route[i + 1].local_departure);

        // Check if dates are valid
        if (isNaN(arrival.getTime()) || isNaN(departure.getTime())) {
          console.warn(
            "Invalid date in route segment:",
            route[i],
            route[i + 1]
          );
          continue;
        }

        const duration = departure.getTime() - arrival.getTime();

        // Only add layover if duration is positive (reasonable layover time)
        // AND if it's actually a layover (not a multi-day stay that should be filtered)
        if (duration > 0 && duration < 12 * 60 * 60 * 1000) {
          layovers.push({
            duration: Math.floor(duration / (1000 * 60)), // minutes
            airport: route[i].flyTo,
            cityTo: route[i].cityTo,
            nextAirport: route[i + 1].flyFrom,
            isSameAirport: route[i].flyTo === route[i + 1].flyFrom,
          });
        }
      } catch (error) {
        console.error(
          "Error calculating layover:",
          error,
          route[i],
          route[i + 1]
        );
      }
    }

    return layovers.length > 0 ? layovers : null;
  };

  // Format duration
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) {
      return `${mins}m`;
    }
    if (mins === 0) {
      return `${hours}h`;
    }
    return `${hours}h ${mins}m`;
  };

  // Format trip duration in days
  const formatTripDuration = (minutes: number) => {
    const totalHours = minutes / 60;
    const days = totalHours / 24;
    if (days >= 1) {
      return `${days.toFixed(1)} days`;
    }
    return `${totalHours.toFixed(1)} hours`;
  };

  // Format date for API (dd/mm/yyyy)
  const formatDateForAPI = (date: Date) => {
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Get country flag emoji using country-flag-emoji package
  const getCountryFlag = (countryCode: string) => {
    try {
      const countryFlagEmoji = require("country-flag-emoji");
      const country = countryFlagEmoji.get(countryCode);
      return country ? country.emoji : "🏳️";
    } catch {
      return "🏳️"; // Fallback flag
    }
  };

  // Format price
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "RON",
    }).format(price);
  };

  // Search flights
  const searchFlights = async () => {
    if (!locationInfo) return;

    setLoading(true);
    setError(null);

    try {
      let dateFromStr: string;
      let dateToStr: string;

      // Use specific departure date if set, otherwise calculate from time filter
      if (departureDate) {
        // Convert yyyy-mm-dd to dd/mm/yyyy for API
        const [y, m, d] = departureDate.split("-");
        dateFromStr = `${d}/${m}/${y}`;
        dateToStr = dateFromStr; // Exact date
      } else {
        // Calculate date range based on time filter
        const now = new Date();
        let dateFrom = new Date();
        let dateTo = new Date();

        switch (timeFilter) {
          case "24h":
            dateFrom = new Date(now);
            dateTo = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            break;
          case "1week": {
            const nextMonday = new Date(now);
            const daysUntilMonday = (1 - now.getDay() + 7) % 7;
            nextMonday.setDate(
              now.getDate() + (daysUntilMonday === 0 ? 7 : daysUntilMonday)
            );
            nextMonday.setHours(0, 0, 0, 0);
            const nextSunday = new Date(nextMonday);
            nextSunday.setDate(nextMonday.getDate() + 6);
            nextSunday.setHours(23, 59, 59, 999);
            dateFrom = nextMonday;
            dateTo = nextSunday;
            break;
          }
          case "2weeks": {
            const nextMonday2Weeks = new Date(now);
            const daysUntilMonday2Weeks = (1 - now.getDay() + 7) % 7;
            nextMonday2Weeks.setDate(
              now.getDate() +
                (daysUntilMonday2Weeks === 0 ? 7 : daysUntilMonday2Weeks)
            );
            nextMonday2Weeks.setHours(0, 0, 0, 0);
            const twoWeeksLater = new Date(nextMonday2Weeks);
            twoWeeksLater.setDate(nextMonday2Weeks.getDate() + 13);
            twoWeeksLater.setHours(23, 59, 59, 999);
            dateFrom = nextMonday2Weeks;
            dateTo = twoWeeksLater;
            break;
          }
          case "1month":
            dateTo.setMonth(now.getMonth() + 1);
            break;
          case "2months":
            dateTo.setMonth(now.getMonth() + 2);
            break;
          case "3months":
            dateTo.setMonth(now.getMonth() + 3);
            break;
          default: // "all"
            dateTo.setMonth(now.getMonth() + 6);
            break;
        }

        dateFromStr = formatDateForAPI(dateFrom);
        dateToStr = formatDateForAPI(dateTo);
      }

      const params = new URLSearchParams({
        flyFrom: locationInfo.code,
        dateFrom: dateFromStr,
        dateTo: dateToStr,
        maxStopovers: directFlightsOnly ? "0" : "2",
        oneForCity: oneForCity ? "1" : "0",
      });

      // Add round trip specific parameters
      if (searchType === "roundtrip") {
        params.set("stayNights", minNights.toString());
        params.set("maxNights", maxNights.toString());

        // Add return date if specified
        if (returnDate) {
          const [y, m, d] = returnDate.split("-");
          const returnDateFormatted = `${d}/${m}/${y}`;
          params.set("returnFrom", returnDateFormatted);
          params.set("returnTo", returnDateFormatted);
        }

        // Pass weekend departure to API for roundtrip
        if (weekendOnly) {
          params.set("weekendDeparture", "true");
        }

        // Pass direct flight to API for roundtrip
        if (directFlightsOnly) {
          params.set("directFlight", "true");
        }
      }

      console.log("🔍 Searching flights with params:", {
        flyFrom: locationInfo.code,
        dateFrom: dateFromStr,
        dateTo: dateToStr,
        maxStopovers: directFlightsOnly ? "0" : "2",
        weekendOnly,
        searchType,
        departureDate,
        returnDate,
      });

      // Use roundtrip API for round trips, search API for one-way
      const apiEndpoint =
        searchType === "roundtrip" ? "/api/roundtrip" : "/api/search";
      const response = await fetch(`${apiEndpoint}?${params.toString()}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to search flights");
      }

      const data = await response.json();
      console.log("✅ Flight search response:", data);

      // Only filter for weekend preference (API handles time filtering)
      let filteredFlights = data.data || [];

      if (weekendOnly) {
        filteredFlights = filteredFlights.filter((flight: Flight) => {
          const departureDate = new Date(flight.local_departure);
          const dayOfWeek = departureDate.getDay(); // 0 = Sunday, 5 = Friday, 6 = Saturday
          return dayOfWeek === 5 || dayOfWeek === 6; // Friday or Saturday
        });
      }

      // Filter by departure time when showing all flights
      if (!oneForCity && (departureTimeFrom !== "00:00" || departureTimeTo !== "23:59")) {
        const [fromH, fromM] = departureTimeFrom.split(":").map(Number);
        const [toH, toM] = departureTimeTo.split(":").map(Number);
        const fromMinutes = fromH * 60 + fromM;
        const toMinutes = toH * 60 + toM;

        filteredFlights = filteredFlights.filter((flight: Flight) => {
          const dep = new Date(flight.local_departure);
          const flightMinutes = dep.getHours() * 60 + dep.getMinutes();
          return flightMinutes >= fromMinutes && flightMinutes <= toMinutes;
        });
      }

      // Sort flights by departure date/time
      filteredFlights.sort((a: Flight, b: Flight) => {
        const dateA = new Date(a.local_departure);
        const dateB = new Date(b.local_departure);
        return dateA.getTime() - dateB.getTime(); // Sort earliest first
      });

      setFlights(filteredFlights);
    } catch (error) {
      console.error("Search error:", error);
      setError(
        error instanceof Error ? error.message : "Failed to search flights"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#101010]">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <header className="text-center py-12">
          {/* Tagline */}
          <p className="text-gray-400 text-xl mb-4 tracking-wide">
            Discover More. Travel Smarter.
          </p>

          {/* Main Title */}
          <h1 className="text-7xl font-bold text-white` mb-6 drop-shadow-2xl tracking-tight">
            Departing
          </h1>

          {/* Editable Location with Autocomplete */}
          <div className="flex items-center justify-center gap-2 text-2xl text-gray-400">
            <span>from</span>
            <div className="relative inline-block">
              <input
                type="text"
                value={editableCity}
                onChange={(e) => setEditableCity(e.target.value)}
                onFocus={() => {
                  if (airportSuggestions.length > 0) setShowSuggestions(true);
                }}
                onBlur={() => {
                  // Delay to allow click on suggestion
                  setTimeout(() => setShowSuggestions(false), 200);
                }}
                placeholder="your location"
                className="bg-transparent outline-none text-gray-300 caret-white text-center min-w-[150px] max-w-[300px] cursor-text border-0 border-b-2 border-dotted border-gray-500 pb-1"
                style={{
                  width: `${Math.max(editableCity.length * 0.6, 8)}ch`,
                }}
              />
              {/* Autocomplete Dropdown */}
              {showSuggestions && airportSuggestions.length > 0 && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-80 bg-[#1a1a1a] border border-white/20 rounded-xl shadow-2xl z-50 overflow-hidden">
                  {airportSuggestions.map((airport) => (
                    <button
                      key={airport.code}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectAirport(airport)}
                      className={`w-full px-4 py-3 text-left hover:bg-white/10 transition-colors flex items-center justify-between ${
                        locationInfo?.code === airport.code
                          ? "bg-white/5"
                          : ""
                      }`}
                    >
                      <div>
                        <div className="text-sm font-medium text-white">
                          {airport.city || airport.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {airport.name} &middot; {airport.country}
                        </div>
                      </div>
                      <span className="text-xs font-bold text-gray-400 bg-white/10 px-2 py-1 rounded">
                        {airport.code}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Pencil className="w-5 h-5 text-gray-500" />
          </div>

          {locationInfo && (
            <div className="text-sm text-gray-500 mt-3">
              {locationInfo.code} • {locationInfo.country}
            </div>
          )}
        </header>

        <style jsx>{`
          input::placeholder {
            color: rgb(209 213 219);
            opacity: 0.5;
          }
          input:focus::placeholder {
            opacity: 0.3;
          }
        `}</style>

        {/* Tab switcher hidden — use ?tab=trains in URL to access trains */}

        {/* Trains Tab Content */}
        {mainTab === "trains" && locationInfo && (
          <TrainSearchView
            cityFrom={editableCity || locationInfo.city}
            locationCode={locationInfo.code}
          />
        )}

        {mainTab === "trains" && !locationInfo && (
          <div className="max-w-4xl mx-auto text-center py-12">
            <p className="text-gray-400">Detecting your location...</p>
          </div>
        )}

        {/* Flights Tab Content */}
        {mainTab === "flights" && (
        <>
        {/* Search Type Toggle */}
        <div className="flex justify-center mb-4">
          <div className="bg-gray-800 rounded p-0.5 flex">
            <button
              onClick={() => { setSearchType("oneway"); setFlights([]); }}
              className={`px-3 py-1 rounded text-xs transition-all duration-200 ${
                searchType === "oneway"
                  ? "bg-white text-black"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              ONE-WAY
            </button>
            <button
              onClick={() => { setSearchType("roundtrip"); setFlights([]); }}
              className={`px-3 py-1 rounded text-xs transition-all duration-200 ${
                searchType === "roundtrip"
                  ? "bg-white text-black"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              ROUND-TRIP
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="max-w-4xl mx-auto mb-8">
          <div className="bg-[#0a0a0a] backdrop-blur-sm rounded-3xl p-8 border border-white/10">
            {/* Time Filter */}
            <div className="mb-6">
              <h3 className="text-white font-bold text-lg mb-4">
                When works for you?
              </h3>
              <div className="flex flex-wrap gap-1">
                {[
                  { value: "all", label: "Don't know, just browsing" },
                  { value: "24h", label: "In 24h" },
                  { value: "1week", label: "Next week" },
                  { value: "2weeks", label: "Two weeks" },
                  { value: "1month", label: "1 month" },
                  { value: "2months", label: "2 months" },
                  { value: "3months", label: "3 months" },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setTimeFilter(option.value as any)}
                    className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                      timeFilter === option.value
                        ? "bg-white text-black"
                        : "bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white border border-white/20"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Specific Dates (optional) */}
            <div className="mb-6">
              <h3 className="text-white font-bold text-lg mb-4">
                Or pick exact dates
                <span className="text-sm font-normal text-gray-500 ml-2">(optional)</span>
              </h3>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-gray-400 text-sm">Departure</label>
                  <input
                    type="date"
                    value={departureDate}
                    onChange={(e) => setDepartureDate(e.target.value)}
                    min={new Date(Date.now() + 86400000).toISOString().split("T")[0]}
                    className="px-3 py-1.5 rounded-lg bg-white/10 text-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm [color-scheme:dark]"
                  />
                </div>
                {searchType === "roundtrip" && (
                  <div className="flex items-center gap-2">
                    <label className="text-gray-400 text-sm">Return</label>
                    <input
                      type="date"
                      value={returnDate}
                      onChange={(e) => setReturnDate(e.target.value)}
                      min={departureDate || new Date(Date.now() + 86400000).toISOString().split("T")[0]}
                      className="px-3 py-1.5 rounded-lg bg-white/10 text-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm [color-scheme:dark]"
                    />
                  </div>
                )}
                {(departureDate || returnDate) && (
                  <button
                    onClick={() => { setDepartureDate(""); setReturnDate(""); }}
                    className="text-xs text-red-400 hover:text-red-300 underline"
                  >
                    Clear dates
                  </button>
                )}
              </div>
              {departureDate && (
                <p className="text-xs text-gray-500 mt-2">
                  Specific dates override the time range above
                </p>
              )}
            </div>

            {/* Round-trip specific filters */}
            {searchType === "roundtrip" && (
              <div className="mb-6">
                <h3 className="text-white font-bold text-lg mb-4">
                  How many nights?
                </h3>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-white font-medium">nights</label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={minNights}
                      onChange={(e) => setMinNights(parseInt(e.target.value))}
                      className="w-20 px-3 py-2 rounded-lg bg-white/10 text-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-white font-medium">nights</label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={maxNights}
                      onChange={(e) => setMaxNights(parseInt(e.target.value))}
                      className="w-20 px-3 py-2 rounded-lg bg-white/10 text-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Flight Preferences */}
            <div className="mb-6">
              <h3 className="text-white font-bold text-lg mb-4">
                Any preferences for your flight?
              </h3>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setWeekendOnly(!weekendOnly)}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                    weekendOnly
                      ? "bg-white text-black"
                      : "bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white border border-white/20"
                  }`}
                >
                  Weekend departure
                </button>
                <button
                  type="button"
                  onClick={() => setDirectFlightsOnly(!directFlightsOnly)}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                    directFlightsOnly
                      ? "bg-white text-black"
                      : "bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white border border-white/20"
                  }`}
                >
                  Direct flight only
                </button>
                <button
                  type="button"
                  onClick={() => setOneForCity(!oneForCity)}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                    oneForCity
                      ? "bg-white text-black"
                      : "bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white border border-white/20"
                  }`}
                >
                  {oneForCity ? "Cheapest per city" : "All flights"}
                </button>
              </div>

              {/* Departure time filter - visible when All flights is active */}
              {!oneForCity && (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <span className="text-gray-400 text-sm">Departure between</span>
                  <input
                    type="time"
                    value={departureTimeFrom}
                    onChange={(e) => setDepartureTimeFrom(e.target.value)}
                    className="px-3 py-1.5 rounded-lg bg-white/10 text-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm [color-scheme:dark]"
                  />
                  <span className="text-gray-400 text-sm">and</span>
                  <input
                    type="time"
                    value={departureTimeTo}
                    onChange={(e) => setDepartureTimeTo(e.target.value)}
                    className="px-3 py-1.5 rounded-lg bg-white/10 text-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm [color-scheme:dark]"
                  />
                  {(departureTimeFrom !== "00:00" || departureTimeTo !== "23:59") && (
                    <button
                      onClick={() => { setDepartureTimeFrom("00:00"); setDepartureTimeTo("23:59"); }}
                      className="text-xs text-red-400 hover:text-red-300 underline"
                    >
                      Reset
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Search Button */}
            <div className="mt-8 text-center flex justify-center">
              <BorderRotate
                borderRadius={50}
                borderWidth={3}
                animationSpeed={3}
                gradientColors={{
                  primary: "#9333ea",
                  secondary: "#ec4899",
                  accent: "#a855f7",
                }}
                backgroundColor="#1a1625"
                animationMode="auto-rotate"
                className="px-6"
              >
                <button
                  onClick={searchFlights}
                  disabled={loading || !locationInfo || locationLoading}
                  className="bg-transparent text-white px-12 py-4 rounded-[50px] font-bold text-xl hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-2xl"
                >
                  {loading ? (
                    <span className="flex items-center gap-3">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                      SEARCHING...
                    </span>
                  ) : locationLoading ? (
                    "LOADING LOCATION..."
                  ) : !locationInfo ? (
                    "LOCATION REQUIRED"
                  ) : (
                    "EXPLORE"
                  )}
                </button>
              </BorderRotate>
            </div>
          </div>
        </div>

        {/* Results */}
        {error && (
          <div className="max-w-4xl mx-auto mb-8">
            <div className="bg-red-500/20 border border-red-500/50 rounded-2xl p-6 text-center">
              <p className="text-red-300 font-medium">{error}</p>
            </div>
          </div>
        )}

        {flights.length > 0 && (
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-white mb-8 text-left">
              {flights.length} FLIGHTS FOUND
            </h2>

            {/* Continent Filter Chips */}
            <div className="mb-6 flex flex-wrap gap-2">
              <button
                onClick={() => setContinentFilter("Globe")}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  continentFilter === "Globe"
                    ? "bg-white text-black"
                    : "bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white border border-white/20"
                }`}
              >
                {CONTINENT_EMOJI["Globe"]} All Continents
              </button>
              {getAvailableContinents(flights).map((continent) => (
                <button
                  key={continent}
                  onClick={() => setContinentFilter(continent)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                    continentFilter === continent
                      ? "bg-white text-black"
                      : "bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white border border-white/20"
                  }`}
                >
                  {CONTINENT_EMOJI[continent]} {continent}
                </button>
              ))}
            </div>

            <div className="max-w-4xl mx-auto space-y-4">
              {flights
                .filter((flight) => {
                  // Apply continent filter
                  if (continentFilter === "Globe") return true;
                  const continent = getContinent(flight.countryTo.code);
                  return continent === continentFilter;
                })
                .map((flight) => {
                  // For roundtrip: find return segment first, so we can compute outbound correctly
                  let returnStartIndex = -1;
                  let outboundRoute = flight.route;
                  let returnRoute: Flight["route"] | null = null;
                  let returnDeparture = null;
                  let returnArrival = null;
                  let returnLayovers = null;
                  let returnIsDirect = false;

                  if (searchType === "roundtrip" && flight.route.length > 1) {
                    returnStartIndex = flight.route.findIndex(
                      (segment) => segment.flyFrom === flight.flyTo
                    );

                    if (returnStartIndex !== -1) {
                      outboundRoute = flight.route.slice(0, returnStartIndex);
                      returnRoute = flight.route.slice(returnStartIndex);
                      returnDeparture = formatTimeWithIcon(
                        returnRoute[0].local_departure
                      );
                      returnArrival = formatTimeWithIcon(
                        returnRoute[returnRoute.length - 1].local_arrival
                      );
                      returnLayovers = calculateLayoverDuration(returnRoute);
                      returnIsDirect = returnRoute.length <= 1;
                    }
                  }

                  // Use outbound-only times (for roundtrip, local_arrival is return arrival)
                  const outboundArrivalTime =
                    outboundRoute.length > 0
                      ? outboundRoute[outboundRoute.length - 1].local_arrival
                      : flight.local_arrival;
                  const outboundDepartureUtc =
                    outboundRoute.length > 0
                      ? outboundRoute[0].utc_departure
                      : flight.utc_departure;
                  const outboundArrivalUtc =
                    outboundRoute.length > 0
                      ? outboundRoute[outboundRoute.length - 1].utc_arrival
                      : flight.utc_arrival;

                  const departure = formatTimeWithIcon(flight.local_departure);
                  const arrival = formatTimeWithIcon(outboundArrivalTime);
                  const layovers = calculateLayoverDuration(outboundRoute);
                  const isDirect =
                    outboundRoute.length <= 1 && flight.technical_stops === 0;
                  const flightHolidays = getHolidaysForFlight(flight);

                  console.log("Flight layover debug:", {
                    flightId: flight.id,
                    technical_stops: flight.technical_stops,
                    routeLength: flight.route.length,
                    layovers: layovers,
                    isDirect: isDirect,
                    route: flight.route,
                    returnRoute,
                  });

                  return (
                    <div
                      key={flight.id}
                      onClick={() => {
                        setSelectedFlight(flight);
                        setShowDetails(true);
                      }}
                      className="bg-[#0a0a0a] backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:bg-[#121212] transition-all duration-300 cursor-pointer group w-full"
                    >
                      <div className="flex items-center justify-between">
                        {/* Route Info */}
                        <div className="flex-1">
                          <div className="flex items-center gap-6 mb-4">
                            <div className="text-left flex-1">
                              <div className="flex items-center justify-between gap-4">
                                <div className="text-2xl font-bold text-white flex-shrink min-w-0 flex items-center justify-between w-full">
                                  <div>
                                    {getCountryFlag(flight.countryTo.code)}{" "}
                                    {flight.cityTo}
                                    <sup className="text-sm text-gray-400 ml-1">
                                      {flight.flyTo} • {flight.countryTo.name}
                                    </sup>
                                  </div>
                                  {searchType === "roundtrip" && (
                                    <span className="text-2xl text-gray-400 font-bold">
                                      {flight.nightsInDest !== undefined
                                        ? `${flight.nightsInDest} ${
                                            flight.nightsInDest === 1
                                              ? "night"
                                              : "nights"
                                          }`
                                        : "N/A"}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {/* Price underneath location */}
                              <div className="text-xl font-semibold text-white mt-2 mb-4 text-left">
                                {formatPrice(flight.price)}
                              </div>
                              {/* Public holidays badge */}
                              {flightHolidays.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mb-3">
                                  {flightHolidays.map((holiday, hIdx) => (
                                    <span
                                      key={hIdx}
                                      title={holiday.localName !== holiday.name ? `${holiday.localName} — ${holiday.types?.join(", ") || "Public Holiday"}` : holiday.types?.join(", ") || "Public Holiday"}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-400/15 text-amber-300 border border-amber-400/30 cursor-help"
                                    >
                                      <PartyPopper className="w-3 h-3" />
                                      {holiday.name}
                                      <span className="text-amber-400/60 ml-0.5">
                                        {new Date(holiday.date + "T00:00:00").toLocaleDateString("en-GB", {
                                          day: "numeric",
                                          month: "short",
                                        })}
                                      </span>
                                    </span>
                                  ))}
                                </div>
                              )}
                              {/* Compact flight details grid */}
                              <div className="mt-2 space-y-2">
                                {/* Total duration - First row (outbound only) */}
                                <div className="flex items-center text-xs text-gray-500">
                                  <span className="w-3 h-3 flex items-center justify-center mr-1.5">
                                    <Clock className="w-3 h-3 text-gray-400" />
                                  </span>
                                  <span className="text-gray-400">
                                    Total:{" "}
                                    {formatDuration(
                                      Math.floor(
                                        (new Date(
                                          outboundArrivalUtc
                                        ).getTime() -
                                          new Date(
                                            outboundDepartureUtc
                                          ).getTime()) /
                                          (1000 * 60)
                                      )
                                    )}
                                  </span>
                                </div>

                                {/* Departure time with date */}
                                <div className="flex items-center text-xs text-gray-500">
                                  <span className="w-3 h-3 flex items-center justify-center mr-1.5">
                                    <ArrowUpRight className="w-3 h-3 text-gray-400" />
                                  </span>
                                  <span className="mr-1.5 w-[4.5rem]">
                                    {new Date(
                                      flight.local_departure
                                    ).toLocaleDateString("en-GB", {
                                      weekday: "short",
                                      day: "numeric",
                                      month: "short",
                                    })}
                                  </span>
                                  <span className="text-gray-400 font-medium mr-1.5 w-9">
                                    {departure.time}
                                  </span>
                                  <span className="w-3 h-3 flex items-center justify-center text-gray-400">
                                    {departure.icon}
                                  </span>
                                </div>

                                {/* Arrival time with date (outbound arrival) */}
                                <div className="flex items-center text-xs text-gray-500">
                                  <span className="w-3 h-3 flex items-center justify-center mr-1.5">
                                    <ArrowDownRight className="w-3 h-3 text-gray-400" />
                                  </span>
                                  <span className="mr-1.5 w-[4.5rem]">
                                    {new Date(
                                      outboundArrivalTime
                                    ).toLocaleDateString("en-GB", {
                                      weekday: "short",
                                      day: "numeric",
                                      month: "short",
                                    })}
                                  </span>
                                  <span className="text-gray-400 font-medium mr-1.5 w-9">
                                    {arrival.time}
                                  </span>
                                  <span className="w-3 h-3 flex items-center justify-center text-gray-400">
                                    {arrival.icon}
                                  </span>
                                </div>
                              </div>

                              {/* Layover details - only if layovers exist */}
                              {!isDirect && layovers && layovers.length > 0 && (
                                <div className="mt-2 text-xs text-gray-400">
                                  <div className="flex items-center flex-wrap">
                                    <span className="w-3 h-3 flex items-center justify-center mr-1.5">
                                      <Hourglass className="w-3 h-3" />
                                    </span>
                                    {layovers.map((layover, index) => (
                                      <span key={index}>
                                        {formatDuration(layover.duration)} in{" "}
                                        {layover.cityTo}
                                        {index < layovers.length - 1 && ", "}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Return Flight Display for Roundtrip */}
                          {searchType === "roundtrip" &&
                            returnRoute &&
                            returnDeparture &&
                            returnArrival && (
                              <div className="mt-6 pt-6 border-t border-white/10">
                                <div className="text-xl font-bold text-white mb-3">
                                  Return
                                </div>

                                {/* Compact return flight details grid */}
                                <div className="space-y-2">
                                  {/* Total duration - First row */}
                                  <div className="flex items-center text-xs text-gray-500">
                                    <span className="w-3 h-3 flex items-center justify-center mr-1.5">
                                      <Clock className="w-3 h-3 text-gray-400" />
                                    </span>
                                    <span className="text-gray-400">
                                      Total:{" "}
                                      {formatDuration(
                                        Math.floor(
                                          (new Date(
                                            returnRoute[
                                              returnRoute.length - 1
                                            ].local_arrival
                                          ).getTime() -
                                            new Date(
                                              returnRoute[0].local_departure
                                            ).getTime()) /
                                            (1000 * 60)
                                        )
                                      )}
                                    </span>
                                  </div>

                                  {/* Return departure time with date */}
                                  <div className="flex items-center text-xs text-gray-500">
                                    <span className="w-3 h-3 flex items-center justify-center mr-1.5">
                                      <ArrowUpRight className="w-3 h-3 text-gray-400" />
                                    </span>
                                    <span className="mr-1.5 w-[4.5rem]">
                                      {new Date(
                                        returnRoute[0].local_departure
                                      ).toLocaleDateString("en-GB", {
                                        weekday: "short",
                                        day: "numeric",
                                        month: "short",
                                      })}
                                    </span>
                                    <span className="text-gray-400 font-medium mr-1.5 w-9">
                                      {returnDeparture.time}
                                    </span>
                                    <span className="w-3 h-3 flex items-center justify-center text-gray-400">
                                      {returnDeparture.icon}
                                    </span>
                                  </div>

                                  {/* Return arrival time with date */}
                                  <div className="flex items-center text-xs text-gray-500">
                                    <span className="w-3 h-3 flex items-center justify-center mr-1.5">
                                      <ArrowDownRight className="w-3 h-3 text-gray-400" />
                                    </span>
                                    <span className="mr-1.5 w-[4.5rem]">
                                      {new Date(
                                        returnRoute[
                                          returnRoute.length - 1
                                        ].local_arrival
                                      ).toLocaleDateString("en-GB", {
                                        weekday: "short",
                                        day: "numeric",
                                        month: "short",
                                      })}
                                    </span>
                                    <span className="text-gray-400 font-medium mr-1.5 w-9">
                                      {returnArrival.time}
                                    </span>
                                    <span className="w-3 h-3 flex items-center justify-center text-gray-400">
                                      {returnArrival.icon}
                                    </span>
                                  </div>
                                </div>

                                {/* Return layover details - only if layovers exist */}
                                {!returnIsDirect &&
                                  returnLayovers &&
                                  returnLayovers.length > 0 && (
                                    <div className="mt-2 text-xs text-gray-400">
                                      <div className="flex items-center flex-wrap">
                                        <span className="w-3 h-3 flex items-center justify-center mr-1.5">
                                          <Hourglass className="w-3 h-3" />
                                        </span>
                                        {returnLayovers.map(
                                          (layover, index) => (
                                            <span key={index}>
                                              {formatDuration(layover.duration)}{" "}
                                              in {layover.cityTo}
                                              {index <
                                                returnLayovers.length - 1 &&
                                                ", "}
                                            </span>
                                          )
                                        )}
                                      </div>
                                    </div>
                                  )}
                              </div>
                            )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Flight Detail View */}
        {showDetails && selectedFlight && (
          <FlightDetailView
            flight={selectedFlight}
            selectedFlightIndex={0}
            totalFlights={1}
            eventsData={null}
            eventsLoading={false}
            holidays={getHolidaysForFlight(selectedFlight)}
            onPrevFlight={() => setShowDetails(false)}
            onNextFlight={() => setShowDetails(false)}
            onBackToList={() => setShowDetails(false)}
            formatTime={(dateString: string) => {
              const date = new Date(dateString);
              return date.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              });
            }}
            formatDateShort={(dateString: string) => {
              const date = new Date(dateString);
              return date.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              });
            }}
            formatPrice={formatPrice}
            formatDuration={formatDuration}
            calculateDuration={(departureTime: string, arrivalTime: string) => {
              return Math.floor(
                (new Date(arrivalTime).getTime() -
                  new Date(departureTime).getTime()) /
                  (1000 * 60)
              );
            }}
            getTimeUntilFlight={(departureTime: string) => {
              const now = new Date();
              const departure = new Date(departureTime);
              const diff = departure.getTime() - now.getTime();
              const days = Math.floor(diff / (1000 * 60 * 60 * 24));
              const hours = Math.floor(
                (diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
              );
              return `${days}d ${hours}h`;
            }}
            isDirectFlight={(flight: Flight) => flight.technical_stops === 0}
            getStopoverInfo={(flight: Flight) => {
              return flight.technical_stops === 0
                ? "Direct"
                : `${flight.technical_stops} stop${
                    flight.technical_stops > 1 ? "s" : ""
                  }`;
            }}
            formatLayoverTime={(route: Flight["route"]) => {
              if (route.length <= 1) return "";
              const layovers = calculateLayoverDuration(route);
              if (!layovers || layovers.length === 0) return "";
              return layovers
                .map((layover) => formatDuration(layover.duration))
                .join(", ");
            }}
            formatArrivalDate={(dateString: string) => {
              const date = new Date(dateString);
              return date.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              });
            }}
          />
        )}
        </>
        )}
      </div>
    </div>
  );
}
