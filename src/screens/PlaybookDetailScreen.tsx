import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

type Playbook = {
  id: string;
  title: string;
  description?: string;
};

type PlaybookDetailScreenProps = {
  route: {
    params: {
      playbook: Playbook;
    };
  };
};

export default function PlaybookDetailScreen({ route }: PlaybookDetailScreenProps) {
  const { playbook } = route.params;
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{playbook.title}</Text>
      {playbook.description ? (
        <Text style={styles.subtitle}>{playbook.description}</Text>
      ) : null}
      <Text style={styles.idText}>ID: {playbook.id}</Text>
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
    marginBottom: 10,
    textAlign: 'center',
  },
  idText: {
    fontSize: 12,
    color: '#aaa',
    marginTop: 20,
  },
});
