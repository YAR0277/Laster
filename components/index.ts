import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({

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

  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 105,
  },

  statIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 18,
  },

  customerIcon: {
    backgroundColor: '#4B5E77',
  },

  distanceIcon: {
    backgroundColor: '#66529A',
  },

  fareIcon: {
    backgroundColor: '#80652F',
  },

  statContent: {
    flex: 1,
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
    backgroundColor: '#8B5CF6',
  },

  driveWithLasterButton: {
    backgroundColor: '#F59E0B',
  },

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

  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingTop: 65,
    paddingLeft: 20,
  },

  menu: {
    width: 250,
    backgroundColor: '#303641',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#454B55',
    padding: 10,
  },

  menuTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: '#F5F5F5',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  menuItem: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 10,
  },

  menuItemText: {
    fontSize: 16,
    color: '#F5F5F5',
  },

  menuCancel: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 14,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#454B55',
  },

  menuCancelText: {
    fontSize: 16,
    color: '#8F96A3',
  },  
});
