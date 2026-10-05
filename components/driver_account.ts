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
    marginBottom: 16,
  },

  sectionTitle: {
    fontSize: 21,
    fontWeight: '500',
    color: '#F5F5F5',
    marginBottom: 18,
  },

  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#D8DCE3',
    marginBottom: 8,
  },

  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#555C68',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#F5F5F5',
    backgroundColor: '#292F38',
    marginBottom: 16,
  },

  actions: {
    marginBottom: 30,
  },

  primaryButton: {
    minHeight: 50,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B',
    marginBottom: 12,
  },

  secondaryButton: {
    minHeight: 50,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#555C68',
    marginBottom: 12,
  },

  deleteButton: {
    minHeight: 50,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8A3F3F',
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },

  toggleContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D0D5DD',
  },

  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  toggleButtonSelected: {
    backgroundColor: '#1F2937',
  },

  toggleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#667085',
  },

  toggleTextSelected: {
    color: '#FFFFFF',
  },  

  tripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  tripDate: {
    fontSize: 14,
    color: '#D8DCE3',
    marginBottom: 5,
  },

  tripRoute: {
    fontSize: 13,
    color: '#8F96A3',
  },

  tripFare: {
    fontSize: 16,
    fontWeight: '500',
    color: '#F5F5F5',
  },

  emptyText: {
    fontSize: 14,
    color: '#8F96A3',
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

  truckPhoto: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    marginTop: 10,
  },  
});