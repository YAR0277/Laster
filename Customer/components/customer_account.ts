import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({

  infoLabel: {
    fontSize: 13,
    color: '#8F96A3',
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  infoValue: {
    fontSize: 15,
    color: '#F5F5F5',
    fontWeight: '500',
  },

  pageHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  paymentButton: {
    marginTop: 16,
  },

  primaryButton: {
    minHeight: 50,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8B5CF6',
    marginBottom: 12,
  },
});