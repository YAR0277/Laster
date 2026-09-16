import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { styles as commonStyles } from '../../components/common';
import { styles as indexStyles } from '../../components/index';

export default function HomeScreen() {
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);
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
            <Text style={indexStyles.quickButtonSubtitle}>Need a pickup truck and a driver?</Text>

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

        {/* Customers Served */}
        <View style={indexStyles.statRow}>
          <View style={[indexStyles.statIconCircle, indexStyles.customerIcon]}>
            <MaterialCommunityIcons
              name="car-pickup"
              size={28}
              color="#B8BCC4"
            />
          </View>

          <View style={indexStyles.statContent}>
            <Text style={indexStyles.stat}>PICKUPS AVAILABLE</Text>
            <Text style={indexStyles.value}>12</Text>
          </View>

          <MaterialCommunityIcons
            name="chevron-right"
            size={24}
            color="#B8BCC4"
          />
        </View>

        <View style={indexStyles.statSeparator} />

        {/* Average Trip Length */}
        <View style={indexStyles.statRow}>
          <View style={[indexStyles.statIconCircle, indexStyles.distanceIcon]}>
            <MaterialCommunityIcons
              name="road-variant"
              size={26}
              color="#E8EDF5"
            />
          </View>

          <View style={indexStyles.statContent}>
            <Text style={indexStyles.stat}>AVERAGE TRIP LENGTH</Text>
            <Text style={indexStyles.value}>0 miles</Text>
          </View>

          <MaterialCommunityIcons
            name="chevron-right"
            size={26}
            color="#B8BCC4"
          />
        </View>

        <View style={indexStyles.statSeparator} />

        {/* Average Fare */}
        <View style={indexStyles.statRow}>
          <View style={[indexStyles.statIconCircle, indexStyles.fareIcon]}>
            <MaterialCommunityIcons
              name="database-outline"
              size={32}
              color="#FFD36A"
            />
          </View>

          <View style={indexStyles.statContent}>
            <Text style={indexStyles.stat}>AVERAGE FARE</Text>
            <Text style={indexStyles.value}>$0.00</Text>
          </View>

          <MaterialCommunityIcons
            name="chevron-right"
            size={30}
            color="#B8BCC4"
          />
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