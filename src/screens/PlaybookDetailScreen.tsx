import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function PlaybookDetailScreen({ route }: any) {
  const { id } = route.params;
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Playbook Detail</Text>
      <Text style={styles.subtitle}>ID: {id}</Text>
      {/* Add playbook details here */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 18,
    color: '#555',
  },
});
