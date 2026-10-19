import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { styles as commonStyles } from '../../components/common';
import { styles as indexStyles } from '../../components/index';
import { supabase } from '../../lib/supabase';

export default function HomeScreen() {
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);
  const [averageFare, setAverageFare] = useState<number | null>(null);

  const [pickupsAvailable, setPickupsAvailable] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const loadPickupsAvailable = async () => {
        const { count, error } = await supabase
          .from('drivers')
          .select('*', { count: 'exact', head: true })
          .eq('is_available', true);

        if (cancelled) return;

        if (error) {
          console.error(
            'Load available pickups error:',
            error.message
          );
          return;
        }

        setPickupsAvailable(count ?? 0);
      };

      void loadPickupsAvailable();

      const interval = setInterval(() => {
        void loadPickupsAvailable();
      }, 15000);

      return () => {
        cancelled = true;
        clearInterval(interval);
      };
    }, [])
  );

  useEffect(() => {
    let cancelled = false;

    const loadAverageFare = async () => {
      const { data, error } = await supabase
        .from('trips')
        .select('fare')
        .not('fare', 'is', null);

      if (error) {
        console.error('Average fare load error:', error.message);
        return;
      }

      const fares = data
        .map((trip) => trip.fare)
        .filter(
          (fare): fare is number =>
            typeof fare === 'number' && Number.isFinite(fare)
        );

      if (!cancelled) {
        setAverageFare(
          fares.length > 0
            ? fares.reduce((sum, fare) => sum + fare, 0) / fares.length
            : null
        );
      }
    };

    void loadAverageFare();

    return () => {
      cancelled = true;
    };
  }, []);

  const [averageDistance, setAverageDistance] =
    useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadAverageDistance = async () => {
      const { data, error } = await supabase
        .from('trips')
        .select('distance')
        .not('distance', 'is', null);

      if (error) {
        console.error(
          'Average distance load error:',
          error.message
        );
        return;
      }

      const distances = data
        .map((trip) => trip.distance)
        .filter(
          (distance): distance is number =>
            typeof distance === 'number' &&
            Number.isFinite(distance)
        );

      if (!cancelled) {
        setAverageDistance(
          distances.length > 0
            ? distances.reduce((sum, distance) => sum + distance, 0) /
                distances.length
            : null
        );
      }
    };

    void loadAverageDistance();

    return () => {
      cancelled = true;
    };
  }, []);
  return (
  <ScrollView
    style={commonStyles.container}
    contentContainerStyle={commonStyles.contentContainer}
  >

      {/* Header */}
      <View style={indexStyles.header}>
        <Pressable 
          style={indexStyles.headerSide}
          onPress={() => setMenuVisible(true)}
          >
          <MaterialCommunityIcons
            name="menu"
            size={28}
            color="#B8BCC4"
          />
        </Pressable>

        <View style={indexStyles.headerBrand}>
          <Image
            source={require('../../assets/images/laster-icon-transparent.png')}
            style={indexStyles.headerLogo}
          />

          <Text style={indexStyles.headerTitle}>Laster</Text>
        </View>

        <Pressable
          style={indexStyles.headerSide}
          onPress={() => router.push('/settings')}
        >
          <MaterialCommunityIcons
            name="cog-outline"
            size={27}
            color="#B8BCC4"
          />
        </Pressable>
      </View>

      {/* Quick Actions */}
      <View style={indexStyles.quickCard}>
        <Text style={indexStyles.quickTitle}>Quick Actions</Text>
        <Text style={indexStyles.quickSubtitle}>Get started with Laster</Text>

        <View style={indexStyles.quickSeparator} />

        <View style={indexStyles.quickButtons}>

          {/* Rent a Pickup */}
            <Pressable
              style={[indexStyles.quickButton, indexStyles.rentPickupButton]}
              onPress={() => router.push('/customer')}
            >
            <MaterialCommunityIcons
              name="account-outline"
              size={28}
              color="#FFFFFF"
            />

            <Text style={indexStyles.quickButtonText}>Rent a Pickup</Text>
            <Text style={indexStyles.quickButtonSubtitle}>Need a pickup truck and driver?</Text>

            <MaterialCommunityIcons
              name="arrow-right"
              size={26}
              color="#FFFFFF"
            />
          </Pressable>

          {/* Drive with Laster */}
            <Pressable
              style={[indexStyles.quickButton, indexStyles.driveWithLasterButton]}
              onPress={() => router.push('/driver')}
            >
            <MaterialCommunityIcons
              name="car-pickup"
              size={28}
              color="#FFFFFF"
            />

            <Text style={indexStyles.quickButtonText}>Drive with Laster</Text>
            <Text style={indexStyles.quickButtonSubtitle}>Earn money driving your pickup.</Text>

            <MaterialCommunityIcons
              name="arrow-right"
              size={26}
              color="#FFFFFF"
            />
          </Pressable>

        </View>
      </View>

      {/* Statistics */}
      <View style={indexStyles.homeCard}>

        {/* Pickups available */}
        <View style={indexStyles.statRow}>
          <View style={[indexStyles.statIconCircle, indexStyles.customerIcon]}>
            <MaterialCommunityIcons
              name="car-pickup"
              size={22}
              color="#B8BCC4"
            />
          </View>
          <View style={indexStyles.statContent}>
            <Text style={indexStyles.statLabel}>PICKUPS AVAILABLE</Text>
            <Text style={indexStyles.statValue}>
              {pickupsAvailable !== null ? pickupsAvailable : '—'}
            </Text>
          </View>
        </View>

        <View style={indexStyles.statSeparator} />

        {/* Average Fare */}
        <View style={indexStyles.statRow}>
          <View style={[indexStyles.statIconCircle, indexStyles.fareIcon]}>
            <MaterialCommunityIcons
              name="database-outline"
              size={22}
              color="#FFD36A"
            />
          </View>
          <View style={indexStyles.statContent}>
            <Text style={indexStyles.statLabel}>MY AVERAGE FARE</Text>
            <Text style={indexStyles.statValue}>
              {averageFare !== null
                ? `$${averageFare.toFixed(2)}`
                : '—'}
            </Text>
          </View>
        </View>

        <View style={indexStyles.statSeparator} />

        {/* Average Trip Length */}
        <View style={indexStyles.statRow}>
          <View style={[indexStyles.statIconCircle, indexStyles.distanceIcon]}>
            <MaterialCommunityIcons
              name="road-variant"
              size={22}
              color="#E8EDF5"
            />
          </View>
          <View style={indexStyles.statContent}>
            <Text style={indexStyles.statLabel}>MY AVERAGE DISTANCE</Text>
            <Text style={indexStyles.statValue}>
              {averageDistance !== null
                ? `${averageDistance.toFixed(1)} mi`
                : '—'}
            </Text>
          </View>
        </View>

      </View>

      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable
          style={indexStyles.menuOverlay}
          onPress={() => setMenuVisible(false)}
        >
          <Pressable
            style={indexStyles.menu}
            onPress={(event) => event.stopPropagation()}
          >
            <Text style={indexStyles.menuTitle}>Menu</Text>

            <Pressable
              style={indexStyles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                router.push('/customer_account');
              }}
            >
              <Text style={indexStyles.menuItemText}>Customer Account</Text>
            </Pressable>

            <Pressable
              style={indexStyles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                router.push('/driver_account');
              }}
            >
              <Text style={indexStyles.menuItemText}>Driver Account</Text>
            </Pressable>

            <Pressable
              style={indexStyles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                router.push('/settings');
              }}
            >
              <Text style={indexStyles.menuItemText}>Settings</Text>
            </Pressable>

            <Pressable
              style={indexStyles.menuCancel}
              onPress={() => setMenuVisible(false)}
            >
              <Text style={indexStyles.menuCancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

    </ScrollView>
  );
}