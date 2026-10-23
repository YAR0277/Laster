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
  | 'Started'
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
      console.info('[Laster diagnostics][trips] Refresh skipped while loading.', {
        authLoading,
        driverLoading,
      });
      return;
    }

    console.info('[Laster diagnostics][trips] Refresh started.', {
      authenticated: Boolean(supabaseAuthUser),
      userId: supabaseAuthUser?.id ?? null,
      hasDriverProfile: Boolean(driver),
      driverId: driver?.driverID ?? null,
      hasCustomerProfile: Boolean(customer),
      customerId: customer?.customerID ?? null,
    });

    let query = supabase
      .from('trips')
      .select('*')
      .order('trip_id', { ascending: true });

    if (driver) {
      // Drivers see available Requested trips and their own trips.
      console.info('[Laster diagnostics][trips] Using DRIVER query.', {
        driverId: driver.driverID,
        filter: 'status=Requested OR driver_id=current driver',
      });
      query = query.or(
        `status.eq.Requested,driver_id.eq.${driver.driverID}`
      );
    } else {
      console.warn('[Laster diagnostics][trips] No driver profile loaded; using CUSTOMER/GUEST query instead.', {
        authenticated: Boolean(supabaseAuthUser),
        userId: supabaseAuthUser?.id ?? null,
        hasCustomerProfile: Boolean(customer),
        customerId: customer?.customerID ?? null,
      });
      let customerID = customer?.customerID ?? null;

      // Guest customer
      if (!customerID && !supabaseAuthUser) {
        customerID = await AsyncStorage.getItem(
          'laster_guest_customer_id'
        );
      }

      if (!customerID) {
        console.warn('[Laster diagnostics][trips] No customer/guest ID; clearing local trip list.');
        setTrips([]);
        return;
      }

      console.info('[Laster diagnostics][trips] Using CUSTOMER/GUEST query.', { customerId: customerID });
      query = query.eq('customer_id', customerID);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Laster diagnostics][trips] Supabase trip query FAILED.', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        queryRole: driver ? 'driver' : 'customer/guest',
        driverId: driver?.driverID ?? null,
        customerId: customer?.customerID ?? null,
      });
      return;
    }

    console.info('[Laster diagnostics][trips] Supabase trip query succeeded.', {
      rowCount: data?.length ?? 0,
      rows: (data ?? []).map((trip) => ({
        tripId: trip.trip_id,
        status: trip.status,
        paymentStatus: trip.payment_status,
        driverId: trip.driver_id,
      })),
    });

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

    // A driver may already be viewing this screen when a customer requests a
    // trip. Refresh periodically so newly requested trips appear without
    // requiring the driver to leave and reopen the page.
    if (!driver || authLoading || driverLoading) {
      return;
    }

    const refreshInterval = setInterval(() => {
      void refreshTrips();
    }, 10_000);

    return () => {
      clearInterval(refreshInterval);
    };
  }, [refreshTrips, driver, authLoading, driverLoading]);

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