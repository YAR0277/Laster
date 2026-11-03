export function calculateFare(miles: number): number {
  if (!Number.isFinite(miles) || miles < 0) {
    throw new Error('Invalid trip distance.');
  }

  let fare: number;

  if (miles <= 5) fare = 35;
  else if (miles <= 20) fare = 35 + (miles - 5) * 2.5;
  else if (miles <= 40) fare = 72.5 + (miles - 20) * 1.25;
  else fare = 97.5 + (miles - 40);

  return Math.round(fare * 100) / 100;
}