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
    backgroundColor: '#328F7D',
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
});