import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';

import { supabase } from '../lib/supabase';
import { useAuth } from './auth';

export type Driver = {
  driverID: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  make: string;
  model: string;
  year: string;
  truckPhoto: string;
  licenseNumber: string;
  licenseState: string;
  dateOfBirth: string;
  insurancePolicy: string;
  insuranceCompany: string;
  rating: number | null;
  numberOfRatings: number;
  numberOfTrips: number;
};

type DriverContextType = {
  driver: Driver | null;
  setDriver: React.Dispatch<React.SetStateAction<Driver | null>>;
  loading: boolean;
};

const DriverContext = createContext<DriverContextType | undefined>(
  undefined
);

export function DriverProvider({ children }: { children: ReactNode }) {
  const { user: supabaseAuthUser, loading: authLoading } = useAuth();
  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) {
      console.info('[Laster diagnostics][driver-profile] Waiting for auth to finish loading.');
      return;
    }

    if (!supabaseAuthUser) {
      console.info('[Laster diagnostics][driver-profile] No authenticated user; clearing driver profile.');
      setDriver(null);
      setLoading(false);
      return;
    }

    console.info('[Laster diagnostics][driver-profile] Loading driver profile for authenticated user.', {
      userId: supabaseAuthUser.id,
    });

    const loadDriver = async () => {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('driver_id', supabaseAuthUser.id)
        .single();

      if (error) {
        console.error('[Laster diagnostics][driver-profile] Driver profile query FAILED.', {
          userId: supabaseAuthUser.id,
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        setDriver(null);
        setLoading(false);
        return;
      }

      console.info('[Laster diagnostics][driver-profile] Driver profile loaded.', {
        authenticatedUserId: supabaseAuthUser.id,
        driverId: data.driver_id,
        hasTruck: Boolean(data.make && data.model),
      });

      setDriver({
        driverID: data.driver_id,
        firstName: data.first_name,
        lastName: data.last_name,
        phone: data.phone,
        email: data.email,
        make: data.make,
        model: data.model,
        year: data.year,
        truckPhoto: data.truck_photo,
        licenseNumber: data.license_number,
        licenseState: data.license_state,
        dateOfBirth: data.date_of_birth,
        insurancePolicy: data.insurance_policy,
        insuranceCompany: data.insurance_company,
        rating: data.rating,
        numberOfRatings: data.number_of_ratings,
        numberOfTrips: data.number_of_trips,
      });
      setLoading(false);
    };

    loadDriver();
  }, [supabaseAuthUser, authLoading]);

  return (
    <DriverContext.Provider value={{ driver, setDriver, loading }}>
      {children}
    </DriverContext.Provider>
  );
}

export function useDriver() {
  const context = useContext(DriverContext);

  if (!context) {
    throw new Error('useDriver must be used inside a DriverProvider');
  }

  return context;
}