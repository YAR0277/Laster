import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState
} from 'react';

import { mapTripRow } from '@laster/common';
import { supabase } from '../lib/supabase';
import { useAuth } from './auth';
import { useCustomer } from './customer';

import type { Trip } from '@laster/common';
export type { DriverArrivalTrip, Trip, TripStatus } from '@laster/common';

type TripContextType = {
  trips: Trip[];
  setTrips: React.Dispatch<React.SetStateAction<Trip[]>>;
  refreshTrips: () => Promise<void>;
};

const TripContext = createContext<TripContextType | undefined>(undefined);

export function TripProvider({ children }: { children: ReactNode }) {
  const { user: supabaseAuthUser, loading: authLoading } = useAuth();
  const { customer } = useCustomer();
  const [trips, setTrips] = useState<Trip[]>([]);
  const customerID = customer?.customerID ?? null;
  const authUserID = supabaseAuthUser?.id ?? null;

  const refreshTrips = useCallback(async () => {
    if (authLoading) return;

    if (!customerID || !authUserID) {
      setTrips([]);
      return;
    }

    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .eq('customer_id', customerID)
      .order('trip_id', { ascending: true });

    if (error) {
      console.error('Trip load error:', error.message);
      return;
    }

    setTrips(data.map(mapTripRow));
  }, [authLoading, customerID, authUserID]);

  useEffect(() => {
    if (authLoading || !customerID || !authUserID) return;

    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setupTripUpdates = async () => {
      // Load the customer's trips initially.
      await refreshTrips();

      if (cancelled) return;

      channel = supabase
        .channel(`customer-trips-${customerID}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'trips',
            filter: `customer_id=eq.${customerID}`,
          },
          (payload) => {
            const updatedTrip = mapTripRow(
              payload.new as Parameters<typeof mapTripRow>[0]
            );

            console.log(
              'Customer received trip update:',
              updatedTrip.tripID,
              updatedTrip.status
            );

            setTrips((currentTrips) => {
              const index = currentTrips.findIndex(
                (trip) => trip.tripID === updatedTrip.tripID
              );

              if (index === -1) {
                return [...currentTrips, updatedTrip];
              }

              return currentTrips.map((trip) =>
                trip.tripID === updatedTrip.tripID
                  ? updatedTrip
                  : trip
              );
            });
          }
        )
        .subscribe((status, error) => {
          console.log('Customer trip Realtime status:', status);

          if (error) {
            console.error('Customer trip Realtime error:', error);
          }
        });
    };

    void setupTripUpdates();

    return () => {
      cancelled = true;

      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [authLoading, refreshTrips, customerID, authUserID]);
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