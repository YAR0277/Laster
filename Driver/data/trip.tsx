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
import { useDriver } from './driver';

import type { Trip } from '@laster/common';
export type { DriverArrivalTrip, Trip, TripStatus } from '@laster/common';

type TripContextType = {
  trips: Trip[];
  setTrips: React.Dispatch<React.SetStateAction<Trip[]>>;
  refreshTrips: () => Promise<void>;
};

const TripContext = createContext<TripContextType | undefined>(undefined);

export function TripProvider({ children }: { children: ReactNode }) {
  const { loading: authLoading } = useAuth();
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

    if (!driver) {
      setTrips([]);
      return;
    }

    // Drivers see available Requested trips and their own trips.
    query = query.or(
      `status.eq.Requested,driver_id.eq.${driver.driverID}`
    );

    const { data, error } = await query;

    if (error) {
      console.error('Trip load error:', error.message);
      return;
    }

    setTrips(data.map(mapTripRow));
  }, [
    authLoading,
    driverLoading,
    driver,
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