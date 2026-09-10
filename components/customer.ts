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

  accountButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loginMessage: {
    fontSize: 13,
    lineHeight: 18,
    color: '#8F96A3',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 4,
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

  tripCard: {
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
    marginBottom: 20,
  },

  inputGroup: {
    marginBottom: 18,
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

  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#555C68',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#F5F5F5',
    backgroundColor: '#292F38',
  },

  infoRow: {
    borderTopWidth: 1,
    borderTopColor: '#454B55',
    paddingVertical: 14,
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

  infoValue: {
    fontSize: 16,
    color: '#F5F5F5',
    fontWeight: '500',
  },

  statusRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#454B55',
    paddingBottom: 14,
    marginBottom: 14,
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
    backgroundColor: '#1877E8',
  },

  abortButton: {
    marginTop: 10,
    minHeight: 50,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#555C68',
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
});