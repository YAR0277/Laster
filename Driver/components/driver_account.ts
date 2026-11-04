import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({

  accountActionsSection: {
    marginTop: 6,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#303641',
    borderWidth: 1,
    borderColor: '#454B55',
  },
  accountActionsTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#F5F5F5',
    marginBottom: 12,
  },

  actionRow: {
    minHeight: 56,
    borderRadius: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#303641',
    borderWidth: 1,
    borderColor: '#454B55',
    marginBottom: 10,
  },
  actionRowLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  
  actionRowText: {
    color: '#F5F5F5',
    fontSize: 16,
    fontWeight: '500',
  },

  deleteActionRow: {
    backgroundColor: '#8A3F3F',
    borderColor: '#8A3F3F',
    marginBottom: 0,
  },

  payoutDescription: {
    color: '#B8BEC8',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 16,
  },

  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B',
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
  },

  photoButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },

  primaryButton: {
    minHeight: 50,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B',
    marginBottom: 12,
  },

  truckPhoto: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    marginTop: 10,
  },
});
