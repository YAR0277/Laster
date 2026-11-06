import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({

  abortButton: {
    backgroundColor: '#B42318',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  abortButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },

  abortMessage: {
    marginTop: 12,
    textAlign: 'center',
    color: '#B8BCC4',
    fontSize: 14,
  },

  accountOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
  },

  accountOptionText: {
    marginLeft: 8,
    color: '#F5F5F5',
    fontSize: 16,
  },

  button: {
    marginTop: 10,
    minHeight: 50,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#8B5CF6',
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },

  cargoPhoto: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    marginTop: 10,
  },  

  driverInfo: {
    borderTopWidth: 1,
    borderTopColor: '#454B55',
    paddingTop: 16,
    marginTop: 4,
    marginBottom: 6,
  },

  driverInfoLabel: {
    fontWeight: '500',
    color: '#B8BCC4',
  },

  driverInfoText: {
    fontSize: 15,
    color: '#D8DCE3',
    marginBottom: 8,
  },

  driverMessage: {
    fontSize: 18,
    fontWeight: '500',
    color: '#F5F5F5',
    marginBottom: 14,
  },

  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },

  fieldLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#D8DCE3',
    marginLeft: 8,
  },

  infoContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  infoLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#8F96A3',
    letterSpacing: 0.8,
  },

  infoRow: {
    borderTopWidth: 1,
    borderTopColor: '#454B55',
    paddingVertical: 14,
  },

  infoValue: {
    fontSize: 16,
    color: '#F5F5F5',
    fontWeight: '500',
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
    textAlign: 'left',
    writingDirection: 'ltr',
  },

  inputGroup: {
    marginBottom: 18,
  },

  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8B5CF6',
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
  },

  photoButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },

  ratingButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },

  ratingButtonDisabled: {
    opacity: 0.4,
  },

  ratingButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  ratingCard: {
    backgroundColor: '#2D323B',
    borderRadius: 12,
    padding: 18,
    marginTop: 16,
  },

  ratingMessage: {
    color: '#F5F5F5',
    fontSize: 15,
    marginBottom: 4,
  },

  ratingSubmitted: {
    alignItems: 'center',
    paddingVertical: 8,
  },

  ratingSubtitle: {
    color: '#B8BCC4',
    fontSize: 15,
    marginTop: 4,
    marginBottom: 8,
  },

  sectionTitle: {
    fontSize: 21,
    fontWeight: '500',
    color: '#F5F5F5',
    marginBottom: 20,
  },

  starButton: {
    paddingHorizontal: 4,
  },

  stars: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
  },

  statusRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#454B55',
    paddingBottom: 14,
    marginBottom: 14,
  },

  tripCard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#454B55',
    backgroundColor: '#303641',
  },

  truckPhoto: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    marginTop: 12,
    marginBottom: 12,
  },
});