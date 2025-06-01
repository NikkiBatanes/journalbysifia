import React from 'react';
import { View, Text, Button, StyleSheet, FlatList, TouchableOpacity } from 'react-native';

// Dummy data for now
const playbooks = [
  { id: '1', title: 'Morning Routine' },
  { id: '2', title: 'Workout Plan' },
  { id: '3', title: 'Study Schedule' },
];

export default function PlaybookListScreen({ navigation }: any) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Playbook List</Text>
      <FlatList
        data={playbooks}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => navigation.navigate('PlaybookDetail', { id: item.id })}>
            <Text style={styles.item}>{item.title}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  item: {
    fontSize: 20,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
});
