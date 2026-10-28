# LasterDriver

The LasterDriver Expo app lets registered drivers manage their accounts and
pickup trucks, set availability, accept trips, and complete trips.

## Monorepo layout

- `Customer/` — customer-facing Expo app
- `Driver/` — driver-facing Expo app
- `Common/` — shared TypeScript types and interfaces
- `supabase/` — database migrations and Edge Functions

## Setup

From the repository root:

npm install

# LasterDriver

The LasterDriver Expo app allows registered drivers to manage their accounts and pickup trucks, set availability, accept trips, and complete trips.

## Monorepo Structure

- `Customer/` — customer-facing Expo app
- `Driver/` — driver-facing Expo app
- `Common/` — shared TypeScript types and interfaces
- `supabase/` — database migrations and Edge Functions

## Setup

Run commands from the repository root:

npm install

## Start the Driver App

cd Driver
npx expo start --tunnel

Scan the QR code with Expo Go on your Android phone.

## Type Checking

Run from the repository root:

npx tsc --project Common/tsconfig.json
npx tsc --project Driver/tsconfig.json --noEmit

## Android Export Check

cd Driver
npx expo export --platform android

## Environment Configuration

Configure the required `EXPO_PUBLIC_` environment variables in a local `Driver/.env` file.

Never commit `.env` files, Supabase service-role keys, Stripe secret keys, or other credentials.

## Supabase

The Customer and Driver apps share the same Supabase project.

- **Customer** creates and manages trip requests.
- **Driver** reads available trips and updates trip status through the appropriate Edge Functions.
- **Common** contains shared types and interfaces used by both apps.

Review database migrations and Edge Function changes before applying or deploying them. Testing the apps does not automatically deploy changes to Supabase.
