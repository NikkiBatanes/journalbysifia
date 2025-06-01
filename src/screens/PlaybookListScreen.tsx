import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import { Playbook } from '../interfaces/playbook';

// Dummy data for now
const dummyPlaybooks: Playbook[] = [
  {
    id: '1',
    title: 'Morning Devotion',
    truthInLove: 'God loves you and has a plan for your day',
    truthSummary: 'God is with you every morning',
    actionSteps: [
      { id: '1', text: 'Pray for guidance', completed: true },
      { id: '2', text: 'Read scripture', completed: true },
      { id: '3', text: 'Reflect on God\'s word', completed: false },
    ],
    affirmation: 'I am loved and guided by God',
    bibleVerse: {
      text: 'The steadfast love of the LORD never ceases; his mercies never come to an end; they are new every morning; great is your faithfulness.',
      reference: 'Lamentations 3:22-23'
    },
    directChallenge: 'Take a moment to thank God for this new day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userInput: 'I want to start my day with God'
  },
  {
    id: '2',
    title: 'Prayer Guide',
    truthInLove: 'God hears your prayers',
    truthSummary: 'Prayer connects us with God',
    actionSteps: [
      { id: '1', text: 'Praise God', completed: true },
      { id: '2', text: 'Confess sins', completed: true },
      { id: '3', text: 'Give thanks', completed: true },
      { id: '4', text: 'Make requests', completed: false },
    ],
    affirmation: 'I can come boldly to God in prayer',
    bibleVerse: {
      text: 'Do not be anxious about anything, but in everything by prayer and supplication with thanksgiving let your requests be made known to God.',
      reference: 'Philippians 4:6'
    },
    directChallenge: 'Spend 5 minutes in prayer right now',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userInput: 'I want to improve my prayer life'
  },
  {
    id: '3',
    title: 'Study Schedule',
    truthInLove: 'God\'s word is living and active',
    truthSummary: 'The Bible transforms our minds',
    actionSteps: [
      { id: '1', text: 'Read the passage', completed: true },
      { id: '2', text: 'Reflect on meaning', completed: false },
      { id: '3', text: 'Apply to life', completed: false },
    ],
    affirmation: 'God speaks to me through His word',
    bibleVerse: {
      text: 'All Scripture is breathed out by God and profitable for teaching, for reproof, for correction, and for training in righteousness.',
      reference: '2 Timothy 3:16'
    },
    directChallenge: 'Read a chapter of the Bible today',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userInput: 'I want to study the Bible more'
  },
];

type PlaybookListScreenNavigationProp = StackNavigationProp<RootStackParamList, 'MainTabs'>;

// Calculate progress based on completed action steps
function calculateProgress(playbook: Playbook): number {
  if (!playbook.actionSteps.length) return 0;
  const completed = playbook.actionSteps.filter(step => step.completed).length;
  return completed / playbook.actionSteps.length;
}

export default function PlaybookListScreen() {
  const navigation = useNavigation<PlaybookListScreenNavigationProp>();
  const [playbooks] = useState(dummyPlaybooks);

  const renderItem = ({ item }: { item: Playbook }) => (
    <TouchableOpacity 
      style={styles.item} 
      onPress={() => navigation.navigate('PlaybookDetail', { playbook: item })}
    >
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.description} numberOfLines={2}>
        {item.truthSummary || item.truthInLove}
      </Text>
      <View style={styles.progressContainer}>
        <View style={[
          styles.progressBar, 
          { width: `${calculateProgress(item) * 100}%` }
        ]} />
      </View>
      <Text style={styles.progressText}>
        {Math.round(calculateProgress(item) * 100)}% Complete
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Playbook List</Text>
      <FlatList
        data={playbooks}
        keyExtractor={item => item.id}
        renderItem={renderItem}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  listContent: {
    paddingBottom: 20,
  },
  item: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  progressContainer: {
    height: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4a90e2',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'right',
  },
});
