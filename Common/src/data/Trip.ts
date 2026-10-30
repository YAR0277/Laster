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
  displayTripID: number;
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

export type TripRow = {
  trip_id: string;
  display_trip_id: number;
  customer_id: string | null;
  driver_id: string | null;
  customer_first_name: string;
  driver_first_name: string;
  truck: string;
  truck_photo: string;
  from_location: string;
  to_location: string;
  cargo: string;
  cargo_photo: string;
  phone: string;
  payment: string;
  distance: number | null;
  distance_to_arrival: number | null;
  fare: number | null;
  payout: number | null;
  driver_rating: number | null;
  requested_at: string;
  completed_at: string | null;
  status: TripStatus;
  driver_arrival_lat: number | null;
  driver_arrival_lon: number | null;
};

export function formatDisplayTripID(displayTripID: number): string {
  return `LST-${String(displayTripID).padStart(6, '0')}`;
}
