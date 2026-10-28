import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  pageHeader: {
    marginTop: 20,
    marginBottom: 25,
  },

  pageTitle: {
    fontSize: 30,
    fontWeight: '500',
    color: '#F5F5F5',
  },

  pageSubtitle: {
    fontSize: 15,
    color: '#8F96A3',
    marginTop: 4,
  },

  section: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#454B55',
    backgroundColor: '#303641',
  },

  sectionTitle: {
    fontSize: 21,
    fontWeight: '500',
    color: '#F5F5F5',
    marginBottom: 18,
  },

  infoRow: {
    minHeight: 60,
    justifyContent: 'center',
  },

  websiteRow: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
  },

  infoContent: {
    flex: 1,
  },

  infoLabel: {
    fontSize: 12,
    color: '#8F96A3',
    marginBottom: 4,
  },

  infoValue: {
    fontSize: 16,
    color: '#F5F5F5',
  },

  separator: {
    height: 1,
    backgroundColor: '#454B55',
    marginVertical: 8,
  },
});