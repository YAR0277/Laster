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
  licenseExpirationDate: string;
  insurancePolicy: string;
  insuranceCompany: string;
  insuranceExpirationDate: string;
  insuranceCardPath: string | null;  
  rating: number | null;
  numberOfRatings: number;
  numberOfTrips: number;
  licenseStatus: boolean;
  insuranceStatus: boolean;
  payoutStatus: boolean;
  accountStatus: boolean;  
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

    let isActive = true;
    setLoading(true);

    // Load the complete driver profile on login.
    const loadDriver = async () => {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('driver_id', supabaseAuthUser.id)
        .single();

      if (!isActive) return;

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
        licenseExpirationDate: data.license_expiration_date,
        licenseNumber: data.license_number,
        licenseState: data.license_state,
        dateOfBirth: data.date_of_birth,
        insurancePolicy: data.insurance_policy,
        insuranceCompany: data.insurance_company,
        insuranceExpirationDate: data.insurance_expiration_date,
        insuranceCardPath: data.insurance_card_path,
        rating: data.rating,
        numberOfRatings: data.number_of_ratings,
        numberOfTrips: data.number_of_trips,
        licenseStatus: data.license_status,
        insuranceStatus: data.insurance_status,
        payoutStatus: data.payout_status,
        accountStatus: data.account_status,
      });

      setLoading(false);
    };

    // Listen for changes to this driver's row.
    const channel = supabase
      .channel(`driver-status-${supabaseAuthUser.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'drivers',
          filter: `driver_id=eq.${supabaseAuthUser.id}`,
        },
        (payload) => {
          if (!isActive) return;

          const updated = payload.new as {
            license_status: boolean;
            insurance_status: boolean;
            payout_status: boolean;
            account_status: boolean;
          };

          setDriver((current) => {
            if (!current) return current;

            const changed =
              current.licenseStatus !== updated.license_status ||
              current.insuranceStatus !== updated.insurance_status ||
              current.payoutStatus !== updated.payout_status ||
              current.accountStatus !== updated.account_status;

            if (!changed) return current;

            return {
              ...current,
              licenseStatus: updated.license_status,
              insuranceStatus: updated.insurance_status,
              payoutStatus: updated.payout_status,
              accountStatus: updated.account_status,
            };
          });
        }
      )
      .subscribe();

    void loadDriver();

    return () => {
      isActive = false;
      void supabase.removeChannel(channel);
    };
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