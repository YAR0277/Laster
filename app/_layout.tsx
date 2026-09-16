import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { CustomerProvider } from '../data/customer';
import { DriverProvider } from '../data/driver';
import { TripProvider } from '../data/trip';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <CustomerProvider>
        <DriverProvider>
      <TripProvider>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="modal"
            options={{ presentation: 'modal', title: 'Modal' }}
          />
          <Stack.Screen
            name="customer_account"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="driver_account"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="settings"
            options={{ headerShown: false }}
          />
        </Stack>
      </TripProvider>
      </DriverProvider>
      </CustomerProvider>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}