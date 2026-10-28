import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { styles as commonStyles } from '../../components/common';
import { styles as indexStyles } from '../../components/index';
import { useDriver } from '../../data/driver';
import { useTrip } from '../../data/trip';

export default function HomeScreen() {
  const router = useRouter();
  const { driver } = useDriver();
  const { trips, refreshTrips } = useTrip();
  const [menuVisible, setMenuVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const refresh = async () => {
        if (active) setRefreshing(true);
        await refreshTrips();
        if (active) setRefreshing(false);
      };

      void refresh();

      return () => {
        active = false;
      };
    }, [refreshTrips])
  );

  const completedTrips = trips.filter(
    (trip) =>
      driver !== null &&
      trip.driverID === driver.driverID &&
      trip.status === 'Completed'
  );

  const payouts = completedTrips
    .map((trip) => trip.payout)
    .filter(
      (payout): payout is number =>
        typeof payout === 'number' && Number.isFinite(payout)
    );

  const distances = completedTrips
    .map((trip) => trip.distance)
    .filter(
      (distance): distance is number =>
        typeof distance === 'number' &&
        Number.isFinite(distance)
    );

  const averagePayout =
    payouts.length > 0
      ? payouts.reduce((sum, payout) => sum + payout, 0) /
        payouts.length
      : null;

  const averageDistance =
    distances.length > 0
      ? distances.reduce((sum, distance) => sum + distance, 0) /
        distances.length
      : null;

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
          <Text style={indexStyles.headerTitle}>Laster Driver</Text>
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

    <Modal
    visible={menuVisible}
    transparent
    animationType="fade"
    onRequestClose={() => setMenuVisible(false)}
    >
    <Pressable
        style={{
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.55)',
        flexDirection: 'row',
        }}
        onPress={() => setMenuVisible(false)}
    >
        <Pressable
          style={{
            width: 270,
            alignSelf: 'flex-start',
            backgroundColor: '#303641',
            paddingHorizontal: 16,
            paddingTop: 20,
            paddingBottom: 12,
          }}
          onPress={(event) => event.stopPropagation()}
        >
        <Text
            style={{
            color: '#F5F5F5',
            fontSize: 20,
            fontWeight: '500',
            marginBottom: 24,
            }}
        >
            Laster Driver
        </Text>

        <Pressable
        onPress={() => {
            setMenuVisible(false);
            router.push('/(tabs)/driver');
        }}
        style={{
            paddingVertical: 16,
            flexDirection: 'row',
            alignItems: 'center',
        }}
        >
        <MaterialCommunityIcons
            name="car-pickup"
            size={24}
            color="#B8BCC4"
        />
        <Text
            style={{
            color: '#F5F5F5',
            fontSize: 16,
            marginLeft: 14,
            }}
        >
            Drive
        </Text>
        </Pressable>

        <Pressable
            onPress={() => {
            setMenuVisible(false);
            router.push('/driver_account');
            }}
            style={{ paddingVertical: 16, flexDirection: 'row', alignItems: 'center' }}
        >
            <MaterialCommunityIcons
            name="account-outline"
            size={24}
            color="#B8BCC4"
            />
            <Text style={{ color: '#F5F5F5', fontSize: 16, marginLeft: 14 }}>
            Account
            </Text>
        </Pressable>

        <Pressable
            onPress={() => {
            setMenuVisible(false);
            router.push('/settings');
            }}
            style={{ paddingVertical: 16, flexDirection: 'row', alignItems: 'center' }}
        >
            <MaterialCommunityIcons
            name="cog-outline"
            size={24}
            color="#B8BCC4"
            />
            <Text style={{ color: '#F5F5F5', fontSize: 16, marginLeft: 14 }}>
            Settings
            </Text>
        </Pressable>
        </Pressable>
        <View style={{ flex: 1 }} />
    </Pressable>
    </Modal>

      {/* Home actions */}
      <View style={indexStyles.quickCard}>
        <Text style={indexStyles.quickSubtitle}>
          Want to earn money with your pickup?
        </Text>

        <View style={indexStyles.quickSeparator} />

        <View style={indexStyles.quickButtons}>
          <Pressable
            style={[
              indexStyles.quickButton,
              indexStyles.rentPickupButton,
            ]}
            onPress={() => router.push('/(tabs)/driver')}
          >
            <MaterialCommunityIcons
              name="car-pickup"
              size={28}
              color="#FFFFFF"
            />
            <Text style={indexStyles.quickButtonText}>Go Online</Text>
            <Text style={indexStyles.quickButtonSubtitle}>
              Find available trips
            </Text>
            <MaterialCommunityIcons
              name="arrow-right"
              size={26}
              color="#FFFFFF"
            />
          </Pressable>

          <Pressable
            style={[
              indexStyles.quickButton,
              indexStyles.driveWithLasterButton,
            ]}
            onPress={() => router.push('/driver_account')}
          >
            <MaterialCommunityIcons
              name="account-outline"
              size={28}
              color="#FFFFFF"
            />
            <Text style={indexStyles.quickButtonText}>
              Become a Driver
            </Text>
            <Text style={indexStyles.quickButtonSubtitle}>
              Log in or manage your account
            </Text>
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
        <View style={indexStyles.statRow}>
          <View
            style={[
              indexStyles.statIconCircle,
              indexStyles.customerIcon,
            ]}
          >
            <MaterialCommunityIcons
              name="account-check-outline"
              size={22}
              color="#B8BCC4"
            />
          </View>
          <View style={indexStyles.statContent}>
            <Text style={indexStyles.statLabel}>ACCOUNT STATUS</Text>
            <Text style={indexStyles.statValue}>
              {driver ? 'Active' : '—'}
            </Text>
          </View>
        </View>

        <View style={indexStyles.statSeparator} />

        <View style={indexStyles.statRow}>
          <View
            style={[
              indexStyles.statIconCircle,
              indexStyles.customerIcon,
            ]}
          >
            <MaterialCommunityIcons
              name="cash-multiple"
              size={22}
              color="#B8BCC4"
            />
          </View>
          <View style={indexStyles.statContent}>
            <Text style={indexStyles.statLabel}>MY AVERAGE PAYOUT</Text>
            <Text style={indexStyles.statValue}>
              {averagePayout !== null
                ? `$${averagePayout.toFixed(2)}`
                : '—'}
            </Text>
          </View>
        </View>

        <View style={indexStyles.statSeparator} />

        <View style={indexStyles.statRow}>
          <View
            style={[
              indexStyles.statIconCircle,
              indexStyles.customerIcon,
            ]}
          >
            <MaterialCommunityIcons
              name="road-variant"
              size={22}
              color="#B8BCC4"
            />
          </View>
          <View style={indexStyles.statContent}>
            <Text style={indexStyles.statLabel}>
              MY AVERAGE DISTANCE
            </Text>
            <Text style={indexStyles.statValue}>
              {averageDistance !== null
                ? `${averageDistance.toFixed(1)} mi`
                : '—'}
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}