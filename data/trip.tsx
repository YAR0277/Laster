import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState
} from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useAuth } from './auth';
import { useCustomer } from './customer';
import { useDriver } from './driver';

export type TripStatus =
  | 'Not submitted'
  | 'Requested'
  | 'Accepted'
  | 'Completed'
  | 'Aborted';

export type DriverArrivalTrip = {
  lat: number;
  lon: number;
};

export type Trip = {
  tripID: string;
  customerID: string | null;
  driverID: string | null;
  customerFirstName: string;
  driverFirstName: string;
  truck: string;
  truckPhoto: string;
  from: string;
  to: string;
  cargo: string;
  cargoPhoto: string;
  phone: string;
  payment: string;
  distance: number | null;
  distanceToArrival: number | null;
  fare: number | null;
  payout: number | null;
  driverRating: number | null;
  requestedAt: string;
  completedAt: string | null;
  status: TripStatus;
  driverArrivalTrip: DriverArrivalTrip | null;
};

type TripContextType = {
  trips: Trip[];
  setTrips: React.Dispatch<React.SetStateAction<Trip[]>>;
  refreshTrips: () => Promise<void>;
};

const TripContext = createContext<TripContextType | undefined>(undefined);

export function TripProvider({ children }: { children: ReactNode }) {
  const { user: supabaseAuthUser, loading: authLoading } = useAuth();
  const { customer } = useCustomer();
  const { driver, loading: driverLoading } = useDriver();
  const [trips, setTrips] = useState<Trip[]>([]);

  const refreshTrips = useCallback(async () => {
    if (authLoading || driverLoading) {
      return;
    }

    let query = supabase
      .from('trips')
      .select('*')
      .order('trip_id', { ascending: true });

    if (driver) {
      // Drivers see available Requested trips and their own trips.
      query = query.or(
        `status.eq.Requested,driver_id.eq.${driver.driverID}`
      );
    } else {
      let customerID = customer?.customerID ?? null;

      // Guest customer
      if (!customerID && !supabaseAuthUser) {
        customerID = await AsyncStorage.getItem(
          'laster_guest_customer_id'
        );
      }

      if (!customerID) {
        setTrips([]);
        return;
      }

      query = query.eq('customer_id', customerID);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Trip load error:', error.message);
      return;
    }

    setTrips(
      data.map((trip) => ({
        tripID: trip.trip_id,
        customerID: trip.customer_id,
        driverID: trip.driver_id,
        customerFirstName: trip.customer_first_name,
        driverFirstName: trip.driver_first_name,
        truck: trip.truck,
        truckPhoto: trip.truck_photo,
        from: trip.from_location,
        to: trip.to_location,
        cargo: trip.cargo,
        cargoPhoto: trip.cargo_photo,
        phone: trip.phone,
        payment: trip.payment,
        distance: trip.distance,
        distanceToArrival: trip.distance_to_arrival,
        fare: trip.fare,
        payout: trip.payout,
        driverRating: trip.driver_rating,
        requestedAt: trip.requested_at,
        completedAt: trip.completed_at,
        status: trip.status as TripStatus,
        driverArrivalTrip:
          trip.driver_arrival_lat != null &&
          trip.driver_arrival_lon != null
            ? {
                lat: trip.driver_arrival_lat,
                lon: trip.driver_arrival_lon,
              }
            : null,
      }))
    );
  }, [
    authLoading,
    driverLoading,
    driver,
    customer,
    supabaseAuthUser,
  ]);

  useEffect(() => {
    void refreshTrips();
  }, [refreshTrips]);

  return (
    <TripContext.Provider value={{ trips, setTrips, refreshTrips }}>
      {children}
    </TripContext.Provider>
  );
}

export function useTrip() {
  const context = useContext(TripContext);

  if (!context) {
    throw new Error('useTrip must be used inside a TripProvider');
  }

  return context;
}