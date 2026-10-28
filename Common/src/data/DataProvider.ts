import type { Trip } from './Trip';

export type TripAudience = 'customer' | 'driver';

export type TripQuery = {
  audience: TripAudience;
  accountId: string;
};

export type DataResult<T> = {
  data: T | null;
  error: {
    code: string;
    message: string;
  } | null;
};

export interface DataProvider {
  getTrips(query: TripQuery): Promise<DataResult<Trip[]>>;
}
