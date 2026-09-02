import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#000',
  },

  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 20,
  },

  subtitle: {
    fontSize: 20,
    color: 'white',
    marginBottom: 20,
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
});
