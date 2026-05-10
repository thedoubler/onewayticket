declare module "amadeus" {
  interface AmadeusConfig {
    clientId: string;
    clientSecret: string;
  }

  interface AmadeusResponse<T> {
    data: T;
    result: T;
  }

  interface HotelAddress {
    cityName: string;
    countryCode: string;
    postalCode: string;
    lines?: string[];
  }

  interface Hotel {
    hotelId: string;
    name: string;
    rating: number;
    hotelCategory: string;
    address: HotelAddress;
  }

  interface HotelOffer {
    hotelId: string;
    offers: Array<{
      price: {
        total: string;
        currency: string;
      };
      boardType: string;
      room: {
        type: string;
        description: {
          text: string;
        };
        amenities: string[];
      };
    }>;
  }

  interface HotelOfferPricing {
    type: string;
    hotel: {
      type: string;
      hotelId: string;
      chainCode: string;
      name: string;
      cityCode: string;
      address: {
        countryCode: string;
      };
      amenities: string[];
    };
    available: boolean;
    offers: Array<{
      id: string;
      checkInDate: string;
      checkOutDate: string;
      rateCode: string;
      rateFamilyEstimated: {
        code: string;
        type: string;
      };
      description: {
        text: string;
        lang: string;
      };
      room: {
        type: string;
        typeEstimated: {
          beds: number;
          bedType: string;
        };
        description: {
          text: string;
          lang: string;
        };
      };
      guests: {
        adults: number;
      };
      price: {
        currency: string;
        base: string;
        total: string;
        variations: {
          changes: Array<{
            startDate: string;
            endDate: string;
            base: string;
          }>;
        };
      };
      policies: {
        paymentType: string;
        cancellation: {
          description: {
            text: string;
          };
          type: string;
        };
      };
    }>;
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

  class Amadeus {
    constructor(config: AmadeusConfig);

    referenceData: {
      locations: {
        get(params: {
          keyword: string;
          subType: string;
        }): Promise<AmadeusResponse<any[]>>;
        hotels: {
          byCity: {
            get(params: {
              cityCode: string;
            }): Promise<AmadeusResponse<Hotel[]>>;
          };
        };
      };
    };

    shopping: {
      hotelOffersSearch: {
        get(params: {
          hotelIds: string;
          checkInDate: string;
          checkOutDate: string;
          adults: string;
          roomQuantity: string;
          currency: string;
        }): Promise<AmadeusResponse<HotelOffer[]>>;
      };
      hotelOffers: {
        byOffer: {
          get(params: {
            offerId: string;
          }): Promise<AmadeusResponse<HotelOfferPricing>>;
        };
      };
      activities: {
        get(params: {
          latitude: string;
          longitude: string;
          radius: string;
        }): Promise<AmadeusResponse<Activity[]>>;
      };
    };
  }

  export = Amadeus;
}
