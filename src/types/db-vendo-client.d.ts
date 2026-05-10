declare module "db-vendo-client" {
  interface Location {
    type: string;
    id?: string;
    name?: string;
    location?: {
      type: string;
      latitude: number;
      longitude: number;
    };
  }

  interface Leg {
    origin: Location;
    destination: Location;
    departure: string;
    arrival: string;
    plannedDeparture: string;
    plannedArrival: string;
    departureDelay: number | null;
    arrivalDelay: number | null;
    departurePlatform: string | null;
    arrivalPlatform: string | null;
    direction: string | null;
    walking: boolean;
    transfer: boolean;
    line?: {
      name: string;
      product: string;
      productName: string;
      operator?: {
        name: string;
      };
    };
  }

  interface Journey {
    legs: Leg[];
    price?: {
      amount: number;
      currency: string;
    };
    refreshToken?: string;
  }

  interface JourneysResult {
    journeys: Journey[];
    earlierRef: string | null;
    laterRef: string | null;
    realtimeDataUpdatedAt: number | null;
  }

  interface Client {
    journeys(from: string, to: string, opt?: any): Promise<JourneysResult>;
    locations(query: string, opt?: any): Promise<Location[]>;
    departures(station: string, opt?: any): Promise<any>;
    arrivals(station: string, opt?: any): Promise<any>;
    stop(stop: string, opt?: any): Promise<any>;
    nearby(location: any, opt?: any): Promise<any>;
    trip?(id: string, opt?: any): Promise<any>;
    refreshJourney?(refreshToken: string, opt?: any): Promise<any>;
  }

  interface Profile {
    [key: string]: any;
  }

  function createClient(profile: Profile, userAgent: string, opt?: any): Client;
  function createBusinessClient(
    profile: Profile,
    userAgent: string,
    bmisNumber: string,
    opt?: any
  ): Client;
}

declare module "db-vendo-client/p/dbnav/index.js" {
  import { Profile } from "db-vendo-client";
  const profile: Profile;
  export { profile };
}

declare module "db-vendo-client/p/db/index.js" {
  import { Profile } from "db-vendo-client";
  const profile: Profile;
  export { profile };
}

declare module "db-vendo-client/p/dbweb/index.js" {
  import { Profile } from "db-vendo-client";
  const profile: Profile;
  export { profile };
}
