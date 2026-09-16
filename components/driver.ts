import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  pageHeader: {
    marginTop: 20,
    marginBottom: 25,
  },

  pageHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  pageSubtitle: {
    fontSize: 15,
    color: '#8F96A3',
    marginTop: 4,
  },

  tripCard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#454B55',
    backgroundColor: '#303641',
  },

  tripID: {
    fontSize: 21,
    fontWeight: '500',
    color: '#F5F5F5',
    marginBottom: 20,
  },

  tripText: {
    fontSize: 15,
    color: '#D8DCE3',
    marginBottom: 12,
  },

  tripLabel: {
    fontWeight: '500',
    color: '#8F96A3',
  },

  status: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#454B55',
    fontSize: 15,
    color: '#FFA500',
    fontWeight: '500',
  },

  acceptButton: {
    marginTop: 20,
    minHeight: 50,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B',
  },

  accountButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },  

  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },

  loginMessage: {
    fontSize: 13,
    lineHeight: 18,
    color: '#8F96A3',
    marginTop: 16,
  },

  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 16,
  },

  availabilityText: {
    fontSize: 14,
    color: '#D8DCE3',
  },
  accountLink: {
    color: '#F59E0B',
    textDecorationLine: 'underline',
  },

  availabilityMessage: {
    marginTop: 16,
    textAlign: 'center',
    color: '#B8BCC4',
    fontSize: 14,
  },

});