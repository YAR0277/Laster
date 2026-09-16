import { createContext, ReactNode, useContext, useState } from 'react';

export type TripStatus =
  | 'Not submitted'
  | 'Requested'
  | 'Accepted'
  | 'Completed'
  | 'Aborted';

export type Trip = {
  tripID: string;

  customerID: string | null;
  driverID: string | null;

  from: string;
  to: string;
  cargo: string;

  phone: string;
  payment: string;

  distance: number | null;
  fare: number | null;
  payout: number | null;

  status: TripStatus;
};

type TripContextType = {
  trips: Trip[];
  setTrips: React.Dispatch<React.SetStateAction<Trip[]>>;
};

const TripContext = createContext<TripContextType | undefined>(undefined);

export function TripProvider({ children }: { children: ReactNode }) {
  const [trips, setTrips] = useState<Trip[]>([]);

  return (
    <TripContext.Provider value={{ trips, setTrips }}>
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