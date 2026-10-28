import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Linking from 'expo-linking';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { styles as commonStyles } from '../components/common';
import { styles as settingsStyles } from '../components/settings';

const LASTER_WEBSITE = 'https://laster.example.com';

export default function SettingsScreen() {
  const openWebsite = () => {
    Linking.openURL(LASTER_WEBSITE);
  };

  return (
    <ScrollView
      style={commonStyles.container}
      contentContainerStyle={commonStyles.contentContainer}
    >
      {/* Page Header */}
      <View style={settingsStyles.pageHeader}>
        <Text style={settingsStyles.pageTitle}>Settings</Text>
        <Text style={settingsStyles.pageSubtitle}>
          Laster app settings
        </Text>
      </View>

      {/* About */}
      <View style={settingsStyles.section}>
        <Text style={settingsStyles.sectionTitle}>About</Text>

        {/* App Version */}
        <View style={settingsStyles.infoRow}>
          <View style={settingsStyles.infoContent}>
            <Text style={settingsStyles.infoLabel}>APP VERSION</Text>
            <Text style={settingsStyles.infoValue}>1.0.0</Text>
          </View>
        </View>

        <View style={settingsStyles.separator} />

        {/* Website */}
        <Pressable
          style={settingsStyles.websiteRow}
          onPress={openWebsite}
        >
          <View style={settingsStyles.infoContent}>
            <Text style={settingsStyles.infoLabel}>LASTER WEBSITE</Text>
            <Text style={settingsStyles.infoValue}>
              Visit the Laster website
            </Text>
          </View>

          <MaterialCommunityIcons
            name="open-in-new"
            size={24}
            color="#B8BCC4"
          />
        </Pressable>
      </View>
    </ScrollView>
  );
}