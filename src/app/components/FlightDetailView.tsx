"use client";

import React, { useState, useEffect } from "react";
import {
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Hourglass,
  Sun,
  Moon,
  X,
  ChevronLeft,
  ChevronRight,
  PartyPopper,
} from "lucide-react";

interface Airport {
  id: string;
  name: string;
  code: string;
  city: string;
  country: string;
  location: {
    lat: number;
    lon: number;
  };
}

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

interface HotelRate {
  rateKey: string;
  rateClass: string;
  rateType: string;
  net: string;
  boardCode: string;
  boardName: string;
  rooms: number;
  adults: number;
  children: number;
  cancellationPolicies?: Array<{
    amount: string;
    from: string;
  }>;
}

interface HotelRoom {
  code: string;
  name: string;
  rates: HotelRate[];
}

interface Hotel {
  code: number;
  name: string;
  categoryName: string;
  categoryCode: string;
  destinationName: string;
  latitude: string;
  longitude: string;
  minRate: string;
  maxRate: string;
  currency: string;
  images: string[];
  rooms: HotelRoom[];
}

interface HotelCheckRate {
  hotelCode: number;
  hotelName: string;
  categoryName: string;
  checkIn: string;
  checkOut: string;
  currency: string;
  room: {
    code: string;
    name: string;
    rate: {
      rateKey: string;
      net: string;
      boardCode: string;
      boardName: string;
      rooms: number;
      adults: number;
      children: number;
      cancellationPolicies?: Array<{
        amount: string;
        from: string;
      }>;
      rateComments?: string;
    } | null;
  } | null;
}

interface Activity {
  id: string;
  name: string;
  shortDescription: string;
  description: string;
  pictures: string[];
  bookingLink: string;
  price: {
    amount: string;
    currencyCode: string;
  };
  minimumDuration: string;
  geoCode: {
    latitude: number;
    longitude: number;
  };
  rating: number;
  categories: Array<{
    name: string;
  }>;
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

interface FlightDetailViewProps {
  flight: Flight;
  selectedFlightIndex: number;
  totalFlights: number;
  eventsData: any;
  eventsLoading: boolean;
  holidays?: PublicHoliday[];
  onPrevFlight: () => void;
  onNextFlight: () => void;
  onBackToList: () => void;
  formatTime: (dateString: string) => string;
  formatDateShort: (dateString: string) => string;
  formatPrice: (price: number) => string;
  formatDuration: (minutes: number) => string;
  calculateDuration: (departureTime: string, arrivalTime: string) => number;
  getTimeUntilFlight: (departureTime: string) => string;
  isDirectFlight: (flight: Flight) => boolean;
  getStopoverInfo: (flight: Flight) => string;
  formatLayoverTime: (route: Flight["route"]) => string;
  formatArrivalDate: (dateString: string) => string;
}

export default function FlightDetailView({
  flight,
  selectedFlightIndex,
  totalFlights,
  eventsData,
  eventsLoading,
  holidays,
  onPrevFlight,
  onNextFlight,
  onBackToList,
  formatTime,
  formatDateShort,
  formatPrice,
  formatDuration,
  calculateDuration,
  getTimeUntilFlight,
  isDirectFlight,
  getStopoverInfo,
  formatLayoverTime,
  formatArrivalDate,
}: FlightDetailViewProps) {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [hotelsLoading, setHotelsLoading] = useState(false);
  const [hotelsError, setHotelsError] = useState<string | null>(null);

  const [activities, setActivities] = useState<Activity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [activitiesError, setActivitiesError] = useState<string | null>(null);

  const [hotelPricing, setHotelPricing] = useState<{
    [key: string]: HotelCheckRate;
  }>({});
  const [pricingLoading, setPricingLoading] = useState<{
    [key: string]: boolean;
  }>({});

  // Lock body scroll when detail view is open
  useEffect(() => {
    // Store original overflow style
    const originalOverflow = document.body.style.overflow;

    // Prevent body scroll
    document.body.style.overflow = "hidden";

    // Cleanup: restore original overflow when component unmounts
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Calculate check-in and check-out dates (4 days from arrival)
  const getHotelDates = () => {
    const arrivalDate = new Date(flight.local_arrival);
    const checkInDate = new Date(arrivalDate);
    const checkOutDate = new Date(arrivalDate);
    checkOutDate.setDate(checkOutDate.getDate() + 4);

    return {
      checkIn: checkInDate.toISOString().split("T")[0],
      checkOut: checkOutDate.toISOString().split("T")[0],
    };
  };

  const fetchHotels = async () => {
    try {
      setHotelsLoading(true);
      setHotelsError(null);

      // First, get airport coordinates for the destination
      const airportsResponse = await fetch(
        `/api/airports?term=${flight.cityTo}`
      );
      if (!airportsResponse.ok) {
        throw new Error("Failed to fetch airport coordinates");
      }

      const airportsData = await airportsResponse.json();
      const destinationAirport = airportsData.airports?.find(
        (airport: any) => airport.code === flight.flyTo
      );

      if (!destinationAirport) {
        throw new Error("Airport coordinates not found");
      }

      const { checkIn, checkOut } = getHotelDates();
      const hotelsResponse = await fetch(
        `/api/hotels?latitude=${destinationAirport.location.lat}&longitude=${destinationAirport.location.lon}&checkInDate=${checkIn}&checkOutDate=${checkOut}`
      );

      if (!hotelsResponse.ok) {
        const errorData = await hotelsResponse.json();
        throw new Error(errorData.error || "Failed to fetch hotels");
      }

      const hotelsData = await hotelsResponse.json();
      setHotels(hotelsData.hotels || []);
    } catch (error) {
      console.error("Error fetching hotels:", error);
      setHotelsError(
        error instanceof Error ? error.message : "Failed to fetch hotels"
      );
    } finally {
      setHotelsLoading(false);
    }
  };

  const fetchActivities = async () => {
    try {
      setActivitiesLoading(true);
      setActivitiesError(null);

      // First, get airport coordinates
      const airportsResponse = await fetch(
        `/api/airports?term=${flight.cityTo}`
      );
      if (!airportsResponse.ok) {
        throw new Error("Failed to fetch airport coordinates");
      }

      const airportsData = await airportsResponse.json();
      const destinationAirport = airportsData.airports?.find(
        (airport: any) => airport.code === flight.flyTo
      );

      if (!destinationAirport) {
        throw new Error("Airport coordinates not found");
      }

      // Fetch activities using airport coordinates
      const activitiesResponse = await fetch(
        `/api/activities?latitude=${destinationAirport.location.lat}&longitude=${destinationAirport.location.lon}&radius=5`
      );

      if (!activitiesResponse.ok) {
        throw new Error("Failed to fetch activities");
      }

      const activitiesData = await activitiesResponse.json();
      setActivities(activitiesData.data || []);
      console.log("🔍 Activities data:", activitiesData);
    } catch (error) {
      console.error("Error fetching activities:", error);
      setActivitiesError(
        error instanceof Error ? error.message : "Failed to fetch activities"
      );
    } finally {
      setActivitiesLoading(false);
    }
  };

  const fetchHotelPricing = async (rateKey: string) => {
    try {
      setPricingLoading((prev) => ({ ...prev, [rateKey]: true }));

      const pricingResponse = await fetch(
        `/api/hotel-pricing?rateKey=${encodeURIComponent(rateKey)}`
      );
      if (!pricingResponse.ok) {
        throw new Error("Failed to fetch hotel pricing");
      }

      const pricingData = await pricingResponse.json();
      setHotelPricing((prev) => ({ ...prev, [rateKey]: pricingData.data }));
    } catch (error) {
      console.error("Error fetching hotel pricing:", error);
    } finally {
      setPricingLoading((prev) => ({ ...prev, [rateKey]: false }));
    }
  };

  // Fetch hotels and activities when component mounts
  useEffect(() => {
    fetchHotels();
    fetchActivities();
  }, [flight.flyTo, flight.local_arrival]);

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

        if (isNaN(arrival.getTime()) || isNaN(departure.getTime())) {
          continue;
        }

        const duration = departure.getTime() - arrival.getTime();

        if (duration > 0 && duration < 12 * 60 * 60 * 1000) {
          layovers.push({
            duration: Math.floor(duration / (1000 * 60)),
            airport: route[i].flyTo,
            cityTo: route[i].cityTo,
          });
        }
      } catch (error) {
        console.error("Error calculating layover:", error);
      }
    }

    return layovers.length > 0 ? layovers : null;
  };

  const departure = formatTimeWithIcon(flight.local_departure);
  const arrival = formatTimeWithIcon(flight.local_arrival);
  const layovers = calculateLayoverDuration(flight.route);
  const isDirect = flight.technical_stops === 0 && flight.route.length <= 1;

  return (
    <div className="fixed inset-0 z-50 bg-[#101010] overflow-hidden">
      <div
        className="h-full w-full overflow-y-auto overflow-x-hidden"
        style={{
          WebkitOverflowScrolling: "touch",
          overscrollBehavior: "contain",
        }}
      >
        {/* Top Navigation Bar - Full Width Sticky */}
        <div className="sticky top-0 bg-[#101010] z-20 py-4 px-4 md:px-8 flex items-center justify-between border-b border-white/10">
          <button
            onClick={onBackToList}
            className="flex items-center gap-2 text-white hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
            <span className="text-sm font-medium">Close</span>
          </button>

          <div className="flex items-center gap-4">
            <button
              onClick={onPrevFlight}
              className="text-white hover:text-gray-300 transition-colors p-2"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <span className="text-white text-sm font-medium">
              {selectedFlightIndex + 1} / {totalFlights}
            </span>
            <button
              onClick={onNextFlight}
              className="text-white hover:text-gray-300 transition-colors p-2"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Flight Content */}
        <div className="p-4 md:p-8">
          <div className="max-w-4xl mx-auto">
            {/* Flight Card */}
            <div className="bg-[#0a0a0a] rounded-2xl p-6 border border-white/10 mb-6">
              {/* Header */}
              <div className="mb-6">
                <div className="text-2xl font-bold text-white mb-2">
                  {flight.cityTo}
                  <sup className="text-sm text-gray-400 ml-1">
                    {flight.flyTo} • {flight.countryTo.name}
                  </sup>
                </div>
                <div className="text-xl font-semibold text-white">
                  {formatPrice(flight.price)}
                </div>
              </div>

              {/* Flight Details */}
              <div className="space-y-2 mb-6">
                {/* Total duration */}
                <div className="flex items-center text-xs text-gray-500">
                  <span className="w-3 h-3 flex items-center justify-center mr-1.5">
                    <Clock className="w-3 h-3 text-gray-400" />
                  </span>
                  <span className="text-gray-400">
                    Total:{" "}
                    {formatDuration(
                      calculateDuration(
                        flight.local_departure,
                        flight.local_arrival
                      )
                    )}
                  </span>
                </div>

                {/* Departure */}
                <div className="flex items-center text-xs text-gray-500">
                  <span className="w-3 h-3 flex items-center justify-center mr-1.5">
                    <ArrowUpRight className="w-3 h-3 text-gray-400" />
                  </span>
                  <span className="mr-1.5 w-[4.5rem]">
                    {new Date(flight.local_departure).toLocaleDateString(
                      "en-GB",
                      {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      }
                    )}
                  </span>
                  <span className="text-gray-400 font-medium mr-1.5 w-9">
                    {departure.time}
                  </span>
                  <span className="w-3 h-3 flex items-center justify-center text-gray-400">
                    {departure.icon}
                  </span>
                  <span className="ml-3 text-gray-500">
                    {flight.cityFrom} ({flight.flyFrom})
                  </span>
                </div>

                {/* Arrival */}
                <div className="flex items-center text-xs text-gray-500">
                  <span className="w-3 h-3 flex items-center justify-center mr-1.5">
                    <ArrowDownRight className="w-3 h-3 text-gray-400" />
                  </span>
                  <span className="mr-1.5 w-[4.5rem]">
                    {new Date(flight.local_arrival).toLocaleDateString(
                      "en-GB",
                      {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      }
                    )}
                  </span>
                  <span className="text-gray-400 font-medium mr-1.5 w-9">
                    {arrival.time}
                  </span>
                  <span className="w-3 h-3 flex items-center justify-center text-gray-400">
                    {arrival.icon}
                  </span>
                  <span className="ml-3 text-gray-500">
                    {flight.cityTo} ({flight.flyTo})
                  </span>
                </div>

                {/* Layovers */}
                {!isDirect && layovers && layovers.length > 0 && (
                  <div className="flex items-center text-xs text-gray-400">
                    <span className="w-3 h-3 flex items-center justify-center mr-1.5">
                      <Hourglass className="w-3 h-3" />
                    </span>
                    {layovers.map((layover, index) => (
                      <span key={index}>
                        {formatDuration(layover.duration)} in {layover.cityTo}
                        {index < layovers.length - 1 && ", "}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Route Details */}
              {!isDirect && flight.route.length > 1 && (
                <div className="border-t border-white/10 pt-4 mb-6">
                  <h3 className="text-sm font-bold text-white mb-3">
                    Flight Segments
                  </h3>
                  <div className="space-y-2">
                    {flight.route.map((route, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-center text-xs text-gray-400 bg-white/5 rounded-lg p-3"
                      >
                        <div>
                          <span className="font-medium text-white">
                            {route.airline} {route.flight_no}
                          </span>
                          <span className="ml-2 text-gray-500">
                            {route.flyFrom} → {route.flyTo}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="text-gray-400">
                            {formatTime(route.local_departure)} →{" "}
                            {formatTime(route.local_arrival)}
                          </div>
                          <div className="text-gray-500 text-xs">
                            {formatDuration(
                              calculateDuration(
                                route.local_departure,
                                route.local_arrival
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Book Button */}
              <a
                href={flight.deep_link}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full bg-white text-black text-center py-3 px-6 rounded-xl font-bold hover:bg-gray-200 transition-colors"
              >
                Book Flight
              </a>
            </div>

            {/* Public Holidays Section */}
            {holidays && holidays.length > 0 && (
              <div className="bg-[#0a0a0a] rounded-2xl p-6 border border-amber-400/20 mb-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <PartyPopper className="w-5 h-5 text-amber-400" />
                  Public Holidays in {flight.countryTo.name}
                </h3>
                <div className="space-y-3">
                  {holidays.map((holiday, index) => (
                    <div
                      key={index}
                      className="bg-amber-400/5 p-4 rounded-xl border border-amber-400/10 flex items-start gap-3"
                    >
                      <div className="bg-amber-400/15 rounded-lg px-3 py-2 text-center flex-shrink-0">
                        <div className="text-amber-300 text-xs font-medium">
                          {new Date(holiday.date + "T00:00:00").toLocaleDateString("en-GB", {
                            month: "short",
                          })}
                        </div>
                        <div className="text-amber-200 text-lg font-bold">
                          {new Date(holiday.date + "T00:00:00").getDate()}
                        </div>
                        <div className="text-amber-400/60 text-xs">
                          {new Date(holiday.date + "T00:00:00").toLocaleDateString("en-GB", {
                            weekday: "short",
                          })}
                        </div>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-white font-semibold text-sm">{holiday.name}</h4>
                        {holiday.localName !== holiday.name && (
                          <p className="text-gray-400 text-xs mt-0.5">{holiday.localName}</p>
                        )}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {holiday.types.map((type, tIdx) => (
                            <span
                              key={tIdx}
                              className="px-2 py-0.5 rounded text-xs bg-amber-400/10 text-amber-300/80"
                            >
                              {type}
                            </span>
                          ))}
                          {holiday.global && (
                            <span className="px-2 py-0.5 rounded text-xs bg-green-400/10 text-green-300/80">
                              National
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Events Section */}
            <div className="bg-[#0a0a0a] rounded-2xl p-6 border border-white/10 mb-6">
              <h3 className="text-lg font-bold text-white mb-4">
                Events in {flight.cityTo}
              </h3>

              {eventsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
                  <p className="text-gray-400 text-sm">
                    Searching for events...
                  </p>
                </div>
              ) : eventsData &&
                eventsData.events &&
                eventsData.events.length > 0 ? (
                <div className="space-y-3">
                  {eventsData.events
                    .slice(0, 3)
                    .map((event: any, index: number) => (
                      <div
                        key={index}
                        className="bg-white/5 p-4 rounded-xl border border-white/5"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-3">
                              <span
                                className={`px-2 py-1 rounded-lg text-xs font-bold ${
                                  event.type === "festival"
                                    ? "bg-purple-400 bg-opacity-30 text-purple-200 border border-purple-400 border-opacity-50"
                                    : event.type === "concert"
                                    ? "bg-pink-400 bg-opacity-30 text-pink-200 border border-pink-400 border-opacity-50"
                                    : event.type === "sports"
                                    ? "bg-blue-400 bg-opacity-30 text-blue-200 border border-blue-400 border-opacity-50"
                                    : event.type === "cultural"
                                    ? "bg-yellow-400 bg-opacity-30 text-yellow-200 border border-yellow-400 border-opacity-50"
                                    : "bg-gray-400 bg-opacity-30 text-gray-200 border border-gray-400 border-opacity-50"
                                }`}
                              >
                                {event.type}
                              </span>
                              {event.relevance === "high" && (
                                <span className="px-2 py-1 rounded-lg text-xs font-bold bg-green-400 bg-opacity-30 text-green-200 border border-green-400 border-opacity-50">
                                  Popular
                                </span>
                              )}
                            </div>
                            <h4 className="text-lg font-bold text-white mb-3">
                              {event.title}
                            </h4>
                            <p className="text-gray-300 text-sm mb-4">
                              {event.description}
                            </p>

                            {/* Event Details Grid */}
                            <div className="grid grid-cols-2 gap-3 mb-3">
                              {event.time && (
                                <div className="flex items-center space-x-2">
                                  <span className="text-orange-300">🕐</span>
                                  <span className="text-white text-sm">
                                    {event.time}
                                  </span>
                                </div>
                              )}
                              {event.duration && (
                                <div className="flex items-center space-x-2">
                                  <span className="text-blue-300">⏱️</span>
                                  <span className="text-white text-sm">
                                    {event.duration}
                                  </span>
                                </div>
                              )}
                              {event.location && (
                                <div className="flex items-center space-x-2">
                                  <span className="text-green-300">📍</span>
                                  <span className="text-white text-sm">
                                    {event.location}
                                  </span>
                                </div>
                              )}
                              {event.cost && (
                                <div className="flex items-center space-x-2">
                                  <span className="text-purple-300">💰</span>
                                  <span className="text-white text-sm">
                                    {event.cost}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Highlights */}
                            {event.highlights && (
                              <div className="mt-3 p-3 bg-white bg-opacity-10 rounded-lg border border-white border-opacity-20">
                                <div className="flex items-center space-x-2 mb-2">
                                  <span className="text-yellow-300">⭐</span>
                                  <span className="text-white text-sm font-semibold">
                                    Highlights
                                  </span>
                                </div>
                                <p className="text-gray-300 text-sm">
                                  {event.highlights}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                  {eventsData.weather && (
                    <div className="bg-white/5 p-4 rounded-xl border border-white/5 mt-4">
                      <h4 className="text-sm font-bold text-white mb-2">
                        🌤️ Weather
                      </h4>
                      <p className="text-gray-300 text-sm">
                        {eventsData.weather}
                      </p>
                    </div>
                  )}

                  {eventsData.tips && (
                    <div className="bg-white/5 p-4 rounded-xl border border-white/5 mt-4">
                      <h4 className="text-sm font-bold text-white mb-2">
                        💡 Travel Tips
                      </h4>
                      <p className="text-gray-300 text-sm">{eventsData.tips}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-400 text-sm">
                    No events found for this date
                  </p>
                </div>
              )}
            </div>

            {/* Hotels Section */}
            <div className="bg-[#0a0a0a] rounded-2xl p-6 border border-white/10 mb-6">
              <h3 className="text-lg font-bold text-white mb-4">
                🏨 Hotels in {flight.cityTo}
              </h3>

              {hotelsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
                  <p className="text-gray-400 text-sm">
                    Searching for hotels...
                  </p>
                </div>
              ) : hotelsError ? (
                <div className="text-center py-8">
                  <p className="text-red-300 text-sm">{hotelsError}</p>
                  <button
                    onClick={fetchHotels}
                    className="mt-4 bg-white/10 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-white/20"
                  >
                    Try Again
                  </button>
                </div>
              ) : hotels.length > 0 ? (
                <div className="space-y-3">
                  {hotels.slice(0, 5).map((hotel) => {
                    const cheapestRoom = hotel.rooms?.[0];
                    const cheapestRate = cheapestRoom?.rates?.[0];
                    const rateKey = cheapestRate?.rateKey;

                    return (
                      <div
                        key={hotel.code}
                        className="bg-white/5 p-4 rounded-xl border border-white/5"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-3">
                              <span className="px-2 py-1 rounded-lg text-xs font-bold bg-blue-400 bg-opacity-30 text-blue-200 border border-blue-400 border-opacity-50">
                                {hotel.categoryName}
                              </span>
                              <span className="px-2 py-1 rounded-lg text-xs font-bold bg-green-400 bg-opacity-30 text-green-200 border border-green-400 border-opacity-50">
                                {hotel.currency} {hotel.minRate}
                              </span>
                            </div>
                            <h4 className="text-lg font-bold text-white mb-3">
                              {hotel.name}
                            </h4>

                            {/* Hotel Images */}
                            {hotel.images && hotel.images.length > 0 && (
                              <div className="mb-4">
                                <div className="flex space-x-2 overflow-x-auto pb-2">
                                  {hotel.images.slice(0, 4).map((imgUrl, imgIdx) => (
                                    <img
                                      key={imgIdx}
                                      src={imgUrl}
                                      alt={`${hotel.name} - ${imgIdx + 1}`}
                                      className="w-28 h-20 object-cover rounded-lg border border-white/10 flex-shrink-0"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = "none";
                                      }}
                                    />
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Hotel Details Grid */}
                            <div className="grid grid-cols-2 gap-3 mb-3">
                              {hotel.destinationName && (
                                <div className="flex items-center space-x-2">
                                  <span className="text-green-300">📍</span>
                                  <span className="text-white text-sm">
                                    {hotel.destinationName}
                                  </span>
                                </div>
                              )}
                              {cheapestRate?.boardName && (
                                <div className="flex items-center space-x-2">
                                  <span className="text-orange-300">🍽️</span>
                                  <span className="text-white text-sm">
                                    {cheapestRate.boardName}
                                  </span>
                                </div>
                              )}
                              {cheapestRoom?.name && (
                                <div className="flex items-center space-x-2">
                                  <span className="text-blue-300">🛏️</span>
                                  <span className="text-white text-sm">
                                    {cheapestRoom.name}
                                  </span>
                                </div>
                              )}
                              {cheapestRate?.cancellationPolicies &&
                                cheapestRate.cancellationPolicies.length > 0 && (
                                  <div className="flex items-center space-x-2">
                                    <span className="text-red-300">❌</span>
                                    <span className="text-white text-sm">
                                      Cancel before{" "}
                                      {new Date(
                                        cheapestRate.cancellationPolicies[0].from
                                      ).toLocaleDateString()}
                                    </span>
                                  </div>
                                )}
                            </div>

                            {/* Hotel Link */}
                            <a
                              href={`https://www.google.com/travel/hotels/s/${encodeURIComponent(
                                hotel.name + " " + hotel.destinationName
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block mt-3 bg-white/10 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-white/20 transition-colors"
                            >
                              Search Hotel
                            </a>

                            {/* Check Rate Button */}
                            {rateKey && !hotelPricing[rateKey] && (
                              <button
                                onClick={() => fetchHotelPricing(rateKey)}
                                disabled={pricingLoading[rateKey]}
                                className="mt-2 bg-white/10 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-white/20 disabled:opacity-50"
                              >
                                {pricingLoading[rateKey]
                                  ? "Checking rate..."
                                  : "Check Rate Details"}
                              </button>
                            )}

                            {/* Display Checked Rate Details */}
                            {rateKey && hotelPricing[rateKey] && (
                              <div className="mt-4">
                                <div className="p-4 bg-white/5 rounded-lg border border-white/5">
                                  <h5 className="text-white font-bold mb-3">
                                    💳 Confirmed Rate
                                  </h5>
                                  {hotelPricing[rateKey].room?.rate && (
                                    <div className="text-gray-400 text-xs space-y-1">
                                      <div className="flex justify-between items-center mb-2">
                                        <span className="text-white text-sm font-semibold">
                                          {hotelPricing[rateKey].room!.name}
                                        </span>
                                        <span className="text-green-300 font-bold">
                                          {hotelPricing[rateKey].currency}{" "}
                                          {hotelPricing[rateKey].room!.rate!.net}
                                        </span>
                                      </div>
                                      <div>
                                        📅 {hotelPricing[rateKey].checkIn} -{" "}
                                        {hotelPricing[rateKey].checkOut}
                                      </div>
                                      <div>
                                        🍽️{" "}
                                        {hotelPricing[rateKey].room!.rate!
                                          .boardName}
                                      </div>
                                      <div>
                                        👥{" "}
                                        {
                                          hotelPricing[rateKey].room!.rate!
                                            .adults
                                        }{" "}
                                        adult
                                        {hotelPricing[rateKey].room!.rate!
                                          .adults > 1
                                          ? "s"
                                          : ""}
                                      </div>
                                      {hotelPricing[rateKey].room!.rate!
                                        .cancellationPolicies?.[0] && (
                                        <div>
                                          ❌ Cancel before{" "}
                                          {new Date(
                                            hotelPricing[
                                              rateKey
                                            ].room!.rate!.cancellationPolicies![0].from
                                          ).toLocaleDateString()}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-400 text-sm">
                    No hotels found for this location
                  </p>
                </div>
              )}
            </div>

            {/* Activities Section */}
            <div className="bg-[#0a0a0a] rounded-2xl p-6 border border-white/10 mb-6">
              <h3 className="text-lg font-bold text-white mb-4">
                🎯 Activities Near {flight.cityTo}
              </h3>

              {activitiesLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
                  <p className="text-gray-400 text-sm">
                    Searching for activities...
                  </p>
                </div>
              ) : activitiesError ? (
                <div className="text-center py-8">
                  <p className="text-red-300 text-sm">{activitiesError}</p>
                  <button
                    onClick={fetchActivities}
                    className="mt-4 bg-white/10 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-white/20"
                  >
                    Try Again
                  </button>
                </div>
              ) : activities.length > 0 ? (
                <div className="space-y-3">
                  {activities.slice(0, 5).map((activity, index) => (
                    <div
                      key={index}
                      className="bg-white/5 p-4 rounded-xl border border-white/5"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-3">
                            {activity.categories &&
                              activity.categories.length > 0 && (
                                <span className="px-2 py-1 rounded-lg text-xs font-bold bg-purple-400 bg-opacity-30 text-purple-200 border border-purple-400 border-opacity-50">
                                  {activity.categories[0].name}
                                </span>
                              )}
                            {activity.rating && (
                              <span className="px-2 py-1 rounded-lg text-xs font-bold bg-yellow-400 bg-opacity-30 text-yellow-200 border border-yellow-400 border-opacity-50">
                                ⭐ {activity.rating}/5
                              </span>
                            )}
                            {activity.price && (
                              <span className="px-2 py-1 rounded-lg text-xs font-bold bg-green-400 bg-opacity-30 text-green-200 border border-green-400 border-opacity-50">
                                {activity.price.currencyCode}{" "}
                                {activity.price.amount}
                              </span>
                            )}
                          </div>
                          <h4 className="text-lg font-bold text-white mb-3">
                            {activity.name}
                          </h4>
                          <p className="text-gray-300 text-sm mb-4">
                            {activity.shortDescription}
                          </p>

                          {/* Activity Pictures */}
                          {activity.pictures &&
                            activity.pictures.length > 0 && (
                              <div className="mb-4">
                                <div className="flex space-x-2 overflow-x-auto pb-2">
                                  {activity.pictures
                                    .slice(0, 3)
                                    .map((pictureUrl, picIndex) => (
                                      <img
                                        key={picIndex}
                                        src={pictureUrl}
                                        alt={`${activity.name} - Image ${
                                          picIndex + 1
                                        }`}
                                        className="w-24 h-24 object-cover rounded-lg border border-white border-opacity-20 flex-shrink-0"
                                        onError={(e) => {
                                          const target =
                                            e.target as HTMLImageElement;
                                          target.style.display = "none";
                                        }}
                                      />
                                    ))}
                                </div>
                              </div>
                            )}

                          {/* Activity Details Grid */}
                          <div className="grid grid-cols-2 gap-3 mb-3">
                            {activity.minimumDuration && (
                              <div className="flex items-center space-x-2">
                                <span className="text-blue-300">⏱️</span>
                                <span className="text-white text-sm">
                                  {activity.minimumDuration}
                                </span>
                              </div>
                            )}
                            {activity.pictures &&
                              activity.pictures.length > 0 && (
                                <div className="flex items-center space-x-2">
                                  <span className="text-green-300">📸</span>
                                  <span className="text-white text-sm">
                                    {activity.pictures.length} photo
                                    {activity.pictures.length > 1 ? "s" : ""}
                                  </span>
                                </div>
                              )}
                          </div>

                          {/* Description */}
                          {activity.description && (
                            <div className="mt-3 p-3 bg-white/5 rounded-lg border border-white/5">
                              <p className="text-gray-300 text-sm">
                                {activity.description}
                              </p>
                            </div>
                          )}

                          {/* Booking Link */}
                          {activity.bookingLink && (
                            <div className="mt-4 text-center">
                              <a
                                href={activity.bookingLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block bg-white/10 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-white/20 transition-colors"
                              >
                                Book Activity
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-400 text-sm">
                    No activities found for this location
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
