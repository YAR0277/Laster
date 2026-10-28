import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState
} from 'react';

import { mapTripRow } from '@laster/common';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

  const refreshTrips = useCallback(async () => {
    if (authLoading) {
      return;
    }

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
  }, [authLoading, customer, supabaseAuthUser]);

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