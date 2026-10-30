import type { Trip, TripRow } from './Trip';

export function mapTripRow(row: TripRow): Trip {
  return {
    tripID: row.trip_id,
    displayTripID: row.display_trip_id,
    customerID: row.customer_id,
    driverID: row.driver_id,
    customerFirstName: row.customer_first_name,
    driverFirstName: row.driver_first_name,
    truck: row.truck,
    truckPhoto: row.truck_photo,
    from: row.from_location,
    to: row.to_location,
    cargo: row.cargo,
    cargoPhoto: row.cargo_photo,
    phone: row.phone,
    payment: row.payment,
    distance: row.distance,
    distanceToArrival: row.distance_to_arrival,
    fare: row.fare,
    payout: row.payout,
    driverRating: row.driver_rating,
    requestedAt: row.requested_at,
    completedAt: row.completed_at,
    status: row.status,
    driverArrivalTrip:
      row.driver_arrival_lat != null &&
      row.driver_arrival_lon != null
        ? {
            lat: row.driver_arrival_lat,
            lon: row.driver_arrival_lon,
          }
        : null,
  };
}