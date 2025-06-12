import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { Colors } from '../theme/colors';

const DevotionalsScreen = () => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Devotionals</Text>
        <Text style={styles.subtitle}>Your daily devotionals will appear here</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.hopeWhite,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.anchorBlue,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.trustGrey,
    textAlign: 'center',
  },
});

export default DevotionalsScreen;
