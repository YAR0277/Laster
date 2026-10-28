import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#252A32',
  },

  title: {
    fontSize: 32,
    fontWeight: '500',
    color: '#F5F5F5',
  },

  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 30,
  },

  logo: {
    width: 50,
    height: 50,
    borderRadius: 12,
  },

  brandText: {
    fontSize: 32,
    fontWeight: '500',
    color: '#F5F5F5',
    marginLeft: 12,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 25,
  },

  headerSide: {
    width: 45,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  headerLogo: {
    width: 42,
    height: 42,
    borderRadius: 10,
  },

  headerTitle: {
    fontSize: 30,
    fontWeight: '400',
    color: '#F5F5F5',
    marginLeft: 10,
  },

  card: {
    padding: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#555',
  },

  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 12,
    marginBottom: 6,
  },

  input: {
    height: 45,
    borderWidth: 1,
    borderColor: '#777',
    borderRadius: 6,
    paddingHorizontal: 10,
    fontSize: 16,
    color: 'white',
  },

  readOnlyField: {
    height: 45,
    borderWidth: 1,
    borderColor: '#555',
    borderRadius: 6,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },

  readOnlyText: {
    fontSize: 16,
    color: 'white',
  },

  button: {
    marginTop: 25,
    padding: 14,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: '#007AFF',
  },

  abortButton: {
    marginTop: 25,
    padding: 14,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: '#CC0000',
  },

  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },

  tripCard: {
    padding: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#555',
    marginBottom: 20,
  },

  tripID: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 15,
  },

  tripText: {
    fontSize: 16,
    color: 'white',
    marginBottom: 8,
  },

  tripLabel: {
    fontWeight: 'bold',
  },

  status: {
    fontSize: 16,
    color: '#FFA500',
    fontWeight: 'bold',
    marginTop: 8,
  },

  acceptButton: {
    marginTop: 20,
    padding: 14,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: '#007AFF',
  },

  homeCard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#454B55',
    backgroundColor: '#303641'
  },

  stat: {
    fontSize: 12,
    color: '#B8BCC4',
    marginBottom: 3,
  },

  value: {
    fontSize: 26,
    color: '#F5F5F5',
    fontWeight: '400',
  },

  countdown: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 10,
  },

  confirmedButton: {
    marginTop: 20,
    padding: 14,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: '#555',
  },

  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 105,
  },

  statIconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 18,
  },

  customerIcon: {
    backgroundColor: '#4B5E77',
  },

  statContent: {
    flex: 1,
  },

  statIcon: {
    marginRight: 18,
  },

  statSeparator: {
    height: 1,
    backgroundColor: '#454B55',
    marginVertical: 3,
  },

  quickCard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#454B55',
    backgroundColor: '#303641',
    marginBottom: 18,
  },

  quickTitle: {
    fontSize: 23,
    fontWeight: '500',
    color: '#F5F5F5',
  },

  quickSubtitle: {
    fontSize: 15,
    color: '#8F96A3',
    marginTop: 3,
  },

  quickSeparator: {
    height: 1,
    backgroundColor: '#454B55',
    marginTop: 14,
    marginBottom: 18,
  },

  quickButtons: {
    flexDirection: 'row',
    gap: 14,
  },

  quickButton: {
    flex: 1,
    minHeight: 115,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },

  rentPickupButton: {
    backgroundColor: '#1877E8',
  },

  driveWithLasterButton: {
    backgroundColor: '#328F7D',
  },

  quickButtonContent: { alignItems: 'center', justifyContent: 'center', width: '100%', },

  quickButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    marginTop: 7,
    marginBottom: 3,
    textAlign: 'center',
  },

  quickButtonSubtitle: {
    fontSize: 12,
    fontWeight: '400',
    color: '#E8EDF5',
    textAlign: 'center',
    lineHeight: 16,
  },

  contentContainer: {
    paddingBottom: 30,
  },
});
