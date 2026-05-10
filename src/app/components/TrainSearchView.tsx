"use client";

import React, { useState, useEffect } from "react";
import {
  TrainFront,
  Leaf,
  ArrowRight,
  RefreshCw,
  MapPin,
  Clock,
  Calendar,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  ExternalLink,
} from "lucide-react";
import { BorderRotate } from "@/components/ui/animated-gradient-border";

interface DepartureEntry {
  departure: string;
  plannedDeparture: string;
  delay: number | null;
  line: {
    name: string;
    product: string;
    productName: string;
    operator: string | null;
  } | null;
  platform: string | null;
  tripId: string | null;
}

interface TrainDestination {
  destination: { name: string; id: string };
  departures: DepartureEntry[];
  stops: string[];
  trainTypes: string[];
  departureCount: number;
  nextDeparture: DepartureEntry;
  price?: { amount: number; currency: string } | null;
}

interface TrainLeg {
  origin: { name: string; id: string };
  destination: { name: string; id: string };
  departure: string;
  arrival: string;
  line: {
    name: string;
    product: string;
    productName: string;
    operator: string | null;
  } | null;
  direction: string | null;
  walking: boolean;
  transfer: boolean;
  departurePlatform: string | null;
  arrivalPlatform: string | null;
}

interface TrainJourney {
  departure: string;
  arrival: string;
  duration: number;
  transfers: number;
  legs: TrainLeg[];
  price: {
    amount: number;
    currency: string;
  } | null;
}

interface TrainSearchViewProps {
  cityFrom: string;
  locationCode: string;
}

export default function TrainSearchView({
  cityFrom,
  locationCode,
}: TrainSearchViewProps) {
  const [travelDate, setTravelDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [periodDays, setPeriodDays] = useState(3);
  const [tripType, setTripType] = useState<"oneway" | "roundtrip">("oneway");

  // Explore mode: destinations from station
  const [destinations, setDestinations] = useState<TrainDestination[]>([]);
  const [departuresLoading, setDeparturesLoading] = useState(false);
  const [departuresError, setDeparturesError] = useState<string | null>(null);
  const [stationName, setStationName] = useState("");
  const [expandedDest, setExpandedDest] = useState<string | null>(null);

  // Detail mode: journeys to a specific destination
  const [selectedDestination, setSelectedDestination] = useState<string | null>(
    null
  );
  const [trainJourneys, setTrainJourneys] = useState<TrainJourney[]>([]);
  const [returnJourneys, setReturnJourneys] = useState<TrainJourney[]>([]);
  const [trainsLoading, setTrainsLoading] = useState(false);
  const [trainsError, setTrainsError] = useState<string | null>(null);

  // Set default date to tomorrow
  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setTravelDate(tomorrow.toISOString().split("T")[0]);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 2);
    setReturnDate(dayAfter.toISOString().split("T")[0]);
  }, []);

  // Explore: fetch all destinations from station over a period
  const fetchDepartures = async () => {
    try {
      setDeparturesLoading(true);
      setDeparturesError(null);
      setSelectedDestination(null);
      setTrainJourneys([]);
      setReturnJourneys([]);
      setExpandedDest(null);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);

      const response = await fetch(
        `/api/train-departures?from=${encodeURIComponent(cityFrom)}&date=${travelDate}&days=${periodDays}`,
        { signal: controller.signal }
      );

      clearTimeout(timeoutId);

      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error("Failed to get departures");
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch departures");
      }

      const dests: TrainDestination[] = data.destinations || [];
      setDestinations(dests);
      setStationName(data.station?.name || cityFrom);

      // Fetch prices for each destination in the background
      fetchPricesForDestinations(dests);
    } catch (error) {
      console.error("Error fetching departures:", error);
      if (error instanceof DOMException && error.name === "AbortError") {
        setDeparturesError("Search timed out. Try again.");
      } else {
        setDeparturesError(
          error instanceof Error ? error.message : "Failed to fetch departures"
        );
      }
    } finally {
      setDeparturesLoading(false);
    }
  };

  // Fetch price preview for each destination
  const fetchPricesForDestinations = async (dests: TrainDestination[]) => {
    const priceUpdates = new Map<string, { amount: number; currency: string }>();

    // Fetch prices in parallel (max 5 concurrent)
    const batchSize = 5;
    for (let i = 0; i < dests.length; i += batchSize) {
      const batch = dests.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (dest) => {
          try {
            const res = await fetch(
              `/api/trains?from=${encodeURIComponent(cityFrom)}&to=${encodeURIComponent(dest.destination.name)}&date=${travelDate}&results=1`
            );
            if (res.ok) {
              const data = await res.json();
              const firstTrain = data.trains?.[0];
              if (firstTrain?.price) {
                priceUpdates.set(dest.destination.name, firstTrain.price);
              }
            }
          } catch {
            // Price fetch failed for this destination, skip
          }
        })
      );

      // Update state after each batch
      if (priceUpdates.size > 0) {
        setDestinations((prev) =>
          prev.map((d) => ({
            ...d,
            price: priceUpdates.get(d.destination.name) || d.price,
          }))
        );
      }
    }
  };

  // Fetch full journeys to a specific destination
  const fetchJourneys = async (destinationName: string) => {
    try {
      setSelectedDestination(destinationName);
      setTrainsLoading(true);
      setTrainsError(null);
      setReturnJourneys([]);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      // Fetch outbound journeys
      const response = await fetch(
        `/api/trains?from=${encodeURIComponent(cityFrom)}&to=${encodeURIComponent(destinationName)}&date=${travelDate}&results=5`,
        { signal: controller.signal }
      );

      clearTimeout(timeoutId);

      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error("No train routes available for this connection");
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch trains");
      }

      setTrainJourneys(data.trains || []);

      // If round-trip, also fetch return journeys
      if (tripType === "roundtrip" && returnDate) {
        try {
          const returnResponse = await fetch(
            `/api/trains?from=${encodeURIComponent(destinationName)}&to=${encodeURIComponent(cityFrom)}&date=${returnDate}&results=5`
          );
          if (returnResponse.ok) {
            const returnData = await returnResponse.json();
            setReturnJourneys(returnData.trains || []);
          }
        } catch {
          // Return fetch failed, just show outbound
        }
      }
    } catch (error) {
      console.error("Error fetching trains:", error);
      if (error instanceof DOMException && error.name === "AbortError") {
        setTrainsError("Train search timed out.");
      } else {
        setTrainsError(
          error instanceof Error ? error.message : "Failed to fetch trains"
        );
      }
    } finally {
      setTrainsLoading(false);
    }
  };

  const getProductColor = (product: string) => {
    switch (product) {
      case "nationalExpress":
      case "national":
        return "bg-emerald-400/15 text-emerald-300 border-emerald-400/30";
      case "regionalExpress":
        return "bg-blue-400/15 text-blue-300 border-blue-400/30";
      case "regional":
        return "bg-cyan-400/15 text-cyan-300 border-cyan-400/30";
      default:
        return "bg-white/10 text-gray-300 border-white/20";
    }
  };

  const getProductLabel = (product: string) => {
    switch (product) {
      case "nationalExpress":
        return "High-Speed";
      case "national":
        return "Long Distance";
      case "regionalExpress":
        return "Regional Express";
      case "regional":
        return "Regional";
      default:
        return product;
    }
  };

  const formatPrice = (price: { amount: number; currency: string }) => {
    const symbol =
      price.currency === "EUR"
        ? "\u20AC"
        : price.currency === "RON"
          ? "RON "
          : price.currency + " ";
    return `${symbol}${price.amount.toFixed(2)}`;
  };

  // Group departures by date for the schedule view
  const groupByDate = (departures: DepartureEntry[]) => {
    const groups = new Map<string, DepartureEntry[]>();
    for (const dep of departures) {
      const dateKey = new Date(dep.departure).toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
      if (!groups.has(dateKey)) groups.set(dateKey, []);
      groups.get(dateKey)!.push(dep);
    }
    return groups;
  };

  // Build booking links for a train journey (multiple providers)
  const slugify = (name: string) =>
    name
      .toLowerCase()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .replace(/ș/g, "s")
      .replace(/ț/g, "t")
      .replace(/ă/g, "a")
      .replace(/î/g, "i")
      .replace(/â/g, "a")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  const getBookingLinks = (train: TrainJourney) => {
    const origin = train.legs[0]?.origin?.name || "";
    const destination =
      train.legs[train.legs.length - 1]?.destination?.name || "";
    const depTime = new Date(train.departure);

    const dd = String(depTime.getDate()).padStart(2, "0");
    const mm = String(depTime.getMonth() + 1).padStart(2, "0");
    const yyyy = depTime.getFullYear();
    const hh = String(depTime.getHours()).padStart(2, "0");
    const min = String(depTime.getMinutes()).padStart(2, "0");

    const originSlug = slugify(origin);
    const destSlug = slugify(destination);
    const dateStr = `${yyyy}-${mm}-${dd}`;

    return [
      {
        label: "Omio",
        url: `https://www.omio.com/trains/${originSlug}/${destSlug}`,
        color: "bg-blue-600 hover:bg-blue-500",
      },
      {
        label: "Trainline",
        url: `https://www.thetrainline.com/book/results?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&outwardDate=${dateStr}T${hh}:${min}:00&journeySearchType=single`,
        color: "bg-teal-600 hover:bg-teal-500",
      },
      {
        label: "DB",
        url: `https://int.bahn.de/en/buchung/suche#sts=true&so=${encodeURIComponent(origin)}&zo=${encodeURIComponent(destination)}&kl=2&r=13:16:KLASSENLOS:1&soid=&zoid=&hd=${yyyy}-${mm}-${dd}T${hh}:${min}:00&hza=D&ar=false&s=true&d=false&hz=%5B%5D&fm=false&bp=false`,
        color: "bg-red-700 hover:bg-red-600",
      },
    ];
  };

  // Render a journey card (used for both outbound and return)
  const renderJourneyCard = (
    train: TrainJourney,
    index: number,
    label?: string
  ) => {
    const depTime = new Date(train.departure);
    const arrTime = new Date(train.arrival);
    const hours = Math.floor(train.duration / 60);
    const mins = train.duration % 60;

    return (
      <div
        key={index}
        className="bg-[#0a0a0a] rounded-2xl p-6 border border-emerald-500/15 hover:border-emerald-500/30 transition-all duration-300"
      >
        {/* Label if provided */}
        {label && (
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-3 font-medium">
            {label}
          </div>
        )}

        {/* Main time row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-6">
            {/* Departure */}
            <div className="text-left">
              <div className="text-white font-bold text-xl">
                {depTime.toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })}
              </div>
              <div className="text-gray-500 text-xs mt-0.5">
                {depTime.toLocaleDateString("en-GB", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}
              </div>
              <div className="text-gray-400 text-xs mt-1">
                {train.legs[0]?.origin?.name}
              </div>
            </div>

            {/* Duration arrow */}
            <div className="flex flex-col items-center gap-1">
              <div className="text-gray-400 text-xs font-medium">
                {hours}h{mins > 0 ? ` ${mins}m` : ""}
              </div>
              <div className="flex items-center gap-1">
                <div className="w-12 h-px bg-emerald-400/30"></div>
                <ArrowRight className="w-3.5 h-3.5 text-emerald-400/60" />
                <div className="w-12 h-px bg-emerald-400/30"></div>
              </div>
              <div className="text-gray-500 text-xs">
                {train.transfers === 0
                  ? "Direct"
                  : `${train.transfers} transfer${train.transfers > 1 ? "s" : ""}`}
              </div>
            </div>

            {/* Arrival */}
            <div className="text-left">
              <div className="text-white font-bold text-xl">
                {arrTime.toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })}
              </div>
              <div className="text-gray-500 text-xs mt-0.5">
                {arrTime.toLocaleDateString("en-GB", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}
              </div>
              <div className="text-gray-400 text-xs mt-1">
                {train.legs[train.legs.length - 1]?.destination?.name}
              </div>
            </div>
          </div>

          {/* Price */}
          {train.price && (
            <div className="text-right">
              <div className="text-emerald-300 font-bold text-2xl">
                {formatPrice(train.price)}
              </div>
              <div className="text-gray-500 text-xs mt-0.5">per person</div>
            </div>
          )}
        </div>

        {/* Legs detail */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {train.legs
            .filter((leg) => !leg.walking && !leg.transfer)
            .map((leg, legIdx) => (
              <span
                key={legIdx}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border ${
                  leg.line
                    ? getProductColor(leg.line.product)
                    : "bg-white/5 text-gray-300 border-white/5"
                }`}
              >
                <TrainFront className="w-3 h-3" />
                {leg.line?.name || "Train"}
                {leg.line?.operator && (
                  <span className="opacity-60">{leg.line.operator}</span>
                )}
              </span>
            ))}
        </div>

        {/* Platform info */}
        {train.legs[0]?.departurePlatform && (
          <div className="text-xs text-gray-500">
            Platform {train.legs[0].departurePlatform}
          </div>
        )}

        {/* Expanded legs for transfers */}
        {train.transfers > 0 && (
          <div className="mt-4 pt-4 border-t border-white/5">
            <div className="space-y-2">
              {train.legs
                .filter((leg) => !leg.walking && !leg.transfer)
                .map((leg, legIdx) => {
                  const legDep = new Date(leg.departure);
                  const legArr = new Date(leg.arrival);
                  return (
                    <div
                      key={legIdx}
                      className="flex items-center justify-between text-xs text-gray-400 bg-white/3 rounded-lg p-3"
                    >
                      <div className="flex items-center gap-2">
                        <TrainFront className="w-3 h-3 text-emerald-400/50" />
                        <span className="text-white font-medium">
                          {leg.line?.name || "Train"}
                        </span>
                        <span className="text-gray-500">
                          {leg.origin.name} → {leg.destination.name}
                        </span>
                      </div>
                      <div className="text-gray-400 flex items-center gap-2">
                        <span>
                          {legDep.toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          })}
                        </span>
                        <ArrowRight className="w-3 h-3" />
                        <span>
                          {legArr.toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          })}
                        </span>
                        {leg.departurePlatform && (
                          <span className="text-gray-500 ml-1">
                            Pl. {leg.departurePlatform}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Booking links */}
        <div className="mt-4 pt-4 border-t border-white/5">
          <p className="text-gray-500 text-xs mb-2">Book on:</p>
          <div className="flex flex-wrap gap-2">
            {getBookingLinks(train).map((link) => (
              <a
                key={link.label}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1.5 ${link.color} text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors`}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Trip Type Toggle */}
      <div className="flex justify-center mb-4">
        <div className="bg-gray-800 rounded p-0.5 flex">
          <button
            onClick={() => setTripType("oneway")}
            className={`px-3 py-1 rounded text-xs transition-all duration-200 ${
              tripType === "oneway"
                ? "bg-emerald-500 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            ONE-WAY
          </button>
          <button
            onClick={() => setTripType("roundtrip")}
            className={`px-3 py-1 rounded text-xs transition-all duration-200 ${
              tripType === "roundtrip"
                ? "bg-emerald-500 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            ROUND-TRIP
          </button>
        </div>
      </div>

      {/* Search Controls */}
      <div className="max-w-4xl mx-auto mb-8">
        <div className="bg-[#0a0a0a] backdrop-blur-sm rounded-3xl p-8 border border-white/10">
          {/* Eco banner inline */}
          <div className="flex items-center gap-3 mb-6">
            <Leaf className="w-5 h-5 text-emerald-400" />
            <p className="text-gray-400 text-sm">
              Trains produce{" "}
              <span className="text-emerald-300 font-medium">
                ~90% less CO&#x2082;
              </span>{" "}
              than flights. Explore where you can go by rail.
            </p>
          </div>

          {/* Date picker + period */}
          <div className="mb-6">
            <h3 className="text-white font-bold text-lg mb-4">
              When do you want to travel?
            </h3>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <label className="text-gray-400 text-sm">
                  {tripType === "roundtrip" ? "Departure" : "Date"}
                </label>
                <input
                  type="date"
                  value={travelDate}
                  onChange={(e) => setTravelDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="px-4 py-3 rounded-xl bg-white/5 text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm [color-scheme:dark]"
                />
              </div>

              {/* Return date for round-trip */}
              {tripType === "roundtrip" && (
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-gray-400" />
                  <label className="text-gray-400 text-sm">Return</label>
                  <input
                    type="date"
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    min={
                      travelDate ||
                      new Date().toISOString().split("T")[0]
                    }
                    className="px-4 py-3 rounded-xl bg-white/5 text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm [color-scheme:dark]"
                  />
                </div>
              )}

              {/* Period selector for explore */}
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-sm">explore</span>
                <div className="flex gap-1">
                  {[1, 3, 5, 7].map((d) => (
                    <button
                      key={d}
                      onClick={() => setPeriodDays(d)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        periodDays === d
                          ? "bg-emerald-500 text-white"
                          : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10"
                      }`}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Explore Button */}
          <div className="text-center flex justify-center">
            <BorderRotate
              borderRadius={50}
              borderWidth={3}
              animationSpeed={3}
              gradientColors={{
                primary: "#10b981",
                secondary: "#34d399",
                accent: "#6ee7b7",
              }}
              backgroundColor="#0a1a14"
              animationMode="auto-rotate"
              className="px-6"
            >
              <button
                onClick={fetchDepartures}
                disabled={departuresLoading}
                className="bg-transparent text-white px-12 py-4 rounded-[50px] font-bold text-xl hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-2xl"
              >
                {departuresLoading ? (
                  <span className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                    EXPLORING...
                  </span>
                ) : (
                  "EXPLORE"
                )}
              </button>
            </BorderRotate>
          </div>
        </div>
      </div>

      {/* Error State */}
      {departuresError && (
        <div className="max-w-4xl mx-auto mb-8">
          <div className="bg-red-500/20 border border-red-500/50 rounded-2xl p-6 text-center">
            <p className="text-red-300 font-medium mb-3">{departuresError}</p>
            <button
              onClick={fetchDepartures}
              className="inline-flex items-center gap-1.5 bg-white/10 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-white/20 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Destinations Results - Overview */}
      {destinations.length > 0 && !selectedDestination && (
        <div>
          <h2 className="text-3xl font-bold text-white mb-2 text-left">
            {destinations.length} DESTINATIONS
          </h2>
          <p className="text-gray-400 text-sm mb-6">
            Reachable by train from {stationName} &middot; {periodDays}-day
            overview &middot; Click to see routes
          </p>

          <div className="max-w-4xl mx-auto space-y-3">
            {destinations.map((dest, index) => {
              const isExpanded = expandedDest === dest.destination.name;
              const dateGroups = groupByDate(dest.departures);
              const nextDep = dest.nextDeparture;
              const nextDepTime = new Date(nextDep.departure);

              return (
                <div
                  key={index}
                  className="bg-[#0a0a0a] backdrop-blur-sm rounded-2xl border border-white/10 hover:border-emerald-500/30 transition-all duration-300 overflow-hidden"
                >
                  {/* Main card - clickable for route details */}
                  <div
                    onClick={() => fetchJourneys(dest.destination.name)}
                    className="p-5 cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        {/* Destination name */}
                        <div className="text-xl font-bold text-white mb-2 group-hover:text-emerald-300 transition-colors">
                          <TrainFront className="w-5 h-5 inline-block mr-2 text-emerald-400" />
                          {dest.destination.name}
                        </div>

                        {/* Summary row */}
                        <div className="flex items-center gap-4 text-xs text-gray-400 mb-2">
                          {/* Departure count */}
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3 h-3" />
                            <span className="text-gray-300 font-medium">
                              {dest.departureCount} departure
                              {dest.departureCount !== 1 ? "s" : ""}
                            </span>
                            <span className="text-gray-500">
                              in {periodDays} day{periodDays !== 1 ? "s" : ""}
                            </span>
                          </div>

                          {/* Next departure */}
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3" />
                            <span className="text-gray-300">
                              Next:{" "}
                              {nextDepTime.toLocaleTimeString("en-US", {
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: false,
                              })}
                            </span>
                            <span className="text-gray-500">
                              {nextDepTime.toLocaleDateString("en-GB", {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                              })}
                            </span>
                          </div>
                        </div>

                        {/* Stops preview */}
                        {dest.stops.length > 0 && (
                          <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                            <MapPin className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">
                              via{" "}
                              {dest.stops.length <= 4
                                ? dest.stops.join(" \u2192 ")
                                : `${dest.stops.slice(0, 3).join(" \u2192 ")} \u2192 ... \u2192 ${dest.stops[dest.stops.length - 1]}`}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Right side: price, train types + arrow */}
                      <div className="flex items-center gap-4 ml-4">
                        {/* Price */}
                        {dest.price && (
                          <div className="text-right">
                            <div className="text-emerald-300 font-bold text-lg">
                              {formatPrice(dest.price)}
                            </div>
                            <div className="text-gray-500 text-xs">from</div>
                          </div>
                        )}

                        <div className="flex flex-col items-end gap-1">
                          {dest.trainTypes.map((type, tIdx) => (
                            <span
                              key={tIdx}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${getProductColor(
                                dest.departures.find(
                                  (d) => d.line?.productName === type
                                )?.line?.product || ""
                              )}`}
                            >
                              {type}
                            </span>
                          ))}
                        </div>
                        <ArrowRight className="w-5 h-5 text-gray-600 group-hover:text-emerald-400 transition-colors" />
                      </div>
                    </div>
                  </div>

                  {/* Expand/collapse schedule button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedDest(isExpanded ? null : dest.destination.name);
                    }}
                    className="w-full px-5 py-2 border-t border-white/5 flex items-center justify-center gap-2 text-xs text-gray-500 hover:text-gray-300 hover:bg-white/3 transition-colors"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="w-3.5 h-3.5" />
                        Hide schedule
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3.5 h-3.5" />
                        Show all {dest.departureCount} departures
                      </>
                    )}
                  </button>

                  {/* Expanded schedule */}
                  {isExpanded && (
                    <div className="px-5 pb-4 border-t border-white/5">
                      {Array.from(dateGroups.entries()).map(
                        ([dateLabel, deps]) => (
                          <div key={dateLabel} className="mt-3">
                            <div className="text-xs font-medium text-emerald-400/70 mb-2">
                              {dateLabel}
                            </div>
                            <div className="space-y-1.5">
                              {deps.map((dep, depIdx) => {
                                const depTime = new Date(dep.departure);
                                return (
                                  <div
                                    key={depIdx}
                                    className="flex items-center justify-between text-xs bg-white/3 rounded-lg px-3 py-2"
                                  >
                                    <div className="flex items-center gap-3">
                                      <span className="text-white font-medium w-12">
                                        {depTime.toLocaleTimeString("en-US", {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                          hour12: false,
                                        })}
                                      </span>
                                      {dep.line && (
                                        <span
                                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getProductColor(dep.line.product)}`}
                                        >
                                          {dep.line.name}
                                        </span>
                                      )}
                                      {dep.line?.operator && (
                                        <span className="text-gray-500">
                                          {dep.line.operator}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {dep.platform && (
                                        <span className="text-gray-500">
                                          Pl. {dep.platform}
                                        </span>
                                      )}
                                      {dep.delay && dep.delay > 0 && (
                                        <span className="text-red-400 font-medium">
                                          +{Math.round(dep.delay / 60)}min
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Journey Detail View - when a destination is selected */}
      {selectedDestination && (
        <div className="max-w-4xl mx-auto">
          {/* Back button */}
          <button
            onClick={() => {
              setSelectedDestination(null);
              setTrainJourneys([]);
              setReturnJourneys([]);
              setTrainsError(null);
            }}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6 text-sm"
          >
            <ArrowRight className="w-4 h-4 rotate-180" />
            Back to all destinations
          </button>

          <h2 className="text-3xl font-bold text-white mb-2">
            {cityFrom} → {selectedDestination}
            {tripType === "roundtrip" && (
              <span className="text-gray-500 text-lg font-normal ml-3">
                round-trip
              </span>
            )}
          </h2>
          <p className="text-gray-400 text-sm mb-6">
            {travelDate &&
              new Date(travelDate + "T00:00:00").toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            {tripType === "roundtrip" && returnDate && (
              <>
                {" → "}
                {new Date(returnDate + "T00:00:00").toLocaleDateString("en-GB", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </>
            )}
          </p>

          {trainsLoading && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400 mx-auto mb-4"></div>
              <p className="text-gray-400 text-sm">
                Finding routes to {selectedDestination}...
              </p>
            </div>
          )}

          {trainsError && (
            <div className="bg-[#0a0a0a] rounded-2xl p-6 border border-white/10 mb-6 text-center">
              <p className="text-gray-400 text-sm mb-4">{trainsError}</p>
              <button
                onClick={() => fetchJourneys(selectedDestination)}
                className="inline-flex items-center gap-1.5 bg-white/10 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-white/20 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Try Again
              </button>
            </div>
          )}

          {!trainsLoading && !trainsError && trainJourneys.length > 0 && (
            <div className="space-y-4">
              {/* Total price summary for round-trip */}
              {tripType === "roundtrip" &&
                trainJourneys[0]?.price &&
                returnJourneys[0]?.price && (
                  <div className="bg-emerald-400/5 p-4 rounded-2xl border border-emerald-400/20 mb-2">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-sm">
                        Round-trip from
                      </span>
                      <span className="text-emerald-300 font-bold text-xl">
                        {formatPrice({
                          amount:
                            trainJourneys[0].price.amount +
                            returnJourneys[0].price.amount,
                          currency: trainJourneys[0].price.currency,
                        })}
                      </span>
                    </div>
                  </div>
                )}

              {/* Outbound section header for round-trip */}
              {tripType === "roundtrip" && (
                <h3 className="text-lg font-bold text-white mt-2">
                  Outbound
                </h3>
              )}

              {trainJourneys.map((train, index) =>
                renderJourneyCard(train, index)
              )}

              {/* Return journeys for round-trip */}
              {tripType === "roundtrip" && returnJourneys.length > 0 && (
                <>
                  <h3 className="text-lg font-bold text-white mt-6 pt-6 border-t border-white/10">
                    Return
                  </h3>
                  {returnJourneys.map((train, index) =>
                    renderJourneyCard(train, index)
                  )}
                </>
              )}

              {tripType === "roundtrip" && returnJourneys.length === 0 && !trainsLoading && (
                <div className="bg-[#0a0a0a] rounded-2xl p-6 border border-white/10 text-center mt-4">
                  <p className="text-gray-400 text-sm">
                    No return trains found for{" "}
                    {returnDate &&
                      new Date(returnDate + "T00:00:00").toLocaleDateString(
                        "en-GB",
                        { day: "numeric", month: "long" }
                      )}
                  </p>
                </div>
              )}

              {/* Eco message */}
              <div className="bg-emerald-400/5 p-4 rounded-2xl border border-emerald-400/10">
                <div className="flex items-start gap-3">
                  <Leaf className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <p className="text-gray-400 text-xs">
                    Trains produce on average{" "}
                    <span className="text-emerald-300 font-medium">
                      ~6g CO&#x2082;/km
                    </span>{" "}
                    vs{" "}
                    <span className="text-red-300 font-medium">
                      ~255g CO&#x2082;/km
                    </span>{" "}
                    for flights. Taking the train saves up to 90% in carbon
                    emissions.
                  </p>
                </div>
              </div>
            </div>
          )}

          {!trainsLoading &&
            !trainsError &&
            trainJourneys.length === 0 &&
            selectedDestination && (
              <div className="bg-[#0a0a0a] rounded-2xl p-8 border border-white/10 text-center">
                <TrainFront className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-sm">
                  No detailed routes found for {cityFrom} →{" "}
                  {selectedDestination}
                </p>
                <p className="text-gray-500 text-xs mt-2">
                  The destination may require intermediate connections
                </p>
              </div>
            )}
        </div>
      )}

      {/* Empty state before exploring */}
      {destinations.length === 0 &&
        !departuresLoading &&
        !departuresError &&
        !selectedDestination && (
          <div className="max-w-4xl mx-auto text-center py-8">
            <TrainFront className="w-16 h-16 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-500 text-sm">
              Hit Explore to discover train destinations from {cityFrom}
            </p>
          </div>
        )}
    </div>
  );
}
