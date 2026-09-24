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
  bankAccount: string;
  rating: number | null;
};

type DriverContextType = {
  driver: Driver | null;
  setDriver: React.Dispatch<React.SetStateAction<Driver | null>>;
};

const DriverContext = createContext<DriverContextType | undefined>(
  undefined
);

export function DriverProvider({ children }: { children: ReactNode }) {
  const { user: supabaseAuthUser, loading: authLoading } = useAuth();
  const [driver, setDriver] = useState<Driver | null>(null);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!supabaseAuthUser) {
      setDriver(null);
      return;
    }

    const loadDriver = async () => {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('driver_id', supabaseAuthUser.id)
        .single();

      if (error) {
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
        truckPhoto: data.truck_photo,
        licenseNumber: data.license_number,
        licenseState: data.license_state,
        dateOfBirth: data.date_of_birth,
        insurancePolicy: data.insurance_policy,
        insuranceCompany: data.insurance_company,
        bankAccount: data.bank_account,
        rating: data.rating,
      });
    };

    loadDriver();
  }, [supabaseAuthUser, authLoading]);

  return (
    <DriverContext.Provider value={{ driver, setDriver }}>
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