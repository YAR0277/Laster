import { createContext, ReactNode, useContext, useState } from 'react';

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
  const [driver, setDriver] = useState<Driver | null>(null);

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