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
  vinNumber: string;
  truckPhoto: string;
  licenseNumber: string;
  licenseState: string;
  dateOfBirth: string;
  insurancePolicy: string;
  insuranceCompany: string;
  insuranceExpirationDate: string;
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
      return;
    }

    if (!supabaseAuthUser) {
      setDriver(null);
      setLoading(false);
      return;
    }

    const loadDriver = async () => {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('driver_id', supabaseAuthUser.id)
        .single();

      if (error) {
        setDriver(null);
        setLoading(false);
        return;
      }

      setDriver({
        driverID: data.driver_id,
        firstName: data.first_name,
        lastName: data.last_name,
        phone: data.phone,
        email: data.email,
        make: data.make,
        model: data.model,
        year: data.year,
        vinNumber: data.vin_number,
        truckPhoto: data.truck_photo,
        licenseNumber: data.license_number,
        licenseState: data.license_state,
        dateOfBirth: data.date_of_birth,
        insurancePolicy: data.insurance_policy,
        insuranceCompany: data.insurance_company,
        insuranceExpirationDate: data.insurance_expiration_date,
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