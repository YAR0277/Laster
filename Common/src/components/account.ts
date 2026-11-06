import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({

  accountButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  accountLink: {
    color: '#F59E0B',
    textDecorationLine: 'underline',
  },

  accountName: {
    color: '#B8BCC4',
    fontSize: 11,
    marginTop: 2,
  },

  actions: {
    marginBottom: 30,
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },

  deleteButton: {
    minHeight: 50,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8A3F3F',
  },

  emptyText: {
    fontSize: 14,
    color: '#8F96A3',
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

  pageHeader: {
    marginTop: 20,
    marginBottom: 25,
  },

  pageHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  
  pageHeaderText: {
    flex: 1,
    minWidth: 0,
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

  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 18,
  },

  sectionTitle: {
    fontSize: 21,
    fontWeight: '500',
    color: '#F5F5F5',
    marginBottom: 0,
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

  toggleContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D0D5DD',
  },

  toggleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#667085',
  },

  toggleTextSelected: {
    color: '#FFFFFF',
  },

  tripDate: {
    fontSize: 14,
    color: '#D8DCE3',
    marginBottom: 5,
  },

  tripFare: {
    fontSize: 16,
    fontWeight: '500',
    color: '#F5F5F5',
  },

  tripRoute: {
    fontSize: 13,
    color: '#8F96A3',
  },

  tripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
});