import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  SafeAreaView,
  StatusBar 
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/Ionicons';
import { RootStackParamList } from '../navigation/types';
import { Colors, Fonts } from '../theme';
import { mockPlaybooks } from '../mocks/playbookMocks';

// Define the navigation param types
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

type Playbook = typeof mockPlaybooks[number];

// Update the navigation prop type to match the expected params
type PlaybookListScreenNavigationProp = StackNavigationProp<RootStackParamList, 'PlaybookDetail'> & {
  navigate: (screen: 'PlaybookDetail', params: { playbook: Playbook }) => void;
};

// Calculate progress based on completed action steps
function calculateProgress(playbook: Playbook): number {
  if (!playbook.actionSteps.length) return 0;
  const completed = playbook.actionSteps.filter(step => step.completed).length;
  return completed / playbook.actionSteps.length;
}

// Format progress text
function formatProgress(playbook: Playbook): string {
  const completed = playbook.actionSteps.filter(step => step.completed).length;
  return `${completed}/${playbook.actionSteps.length} Steps`;
}

// Format date to a readable format
const formatDate = () => {
  const date = new Date();
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function PlaybookListScreen() {
  const navigation = useNavigation<PlaybookListScreenNavigationProp>();
  
  const renderItem = ({ item }: { item: Playbook }) => {
    const progress = calculateProgress(item);
    const progressPercent = Math.round(progress * 100);
    
    return (
      <TouchableOpacity 
        style={styles.card}
        onPress={() => navigation.navigate('PlaybookDetail', { playbook: item })}
        activeOpacity={0.8}
      >
        <View style={styles.cardContent}>
          <View style={styles.textContainer}>
            <Text style={styles.title} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={styles.summary} numberOfLines={2}>
              {item.truthInLove.summary}
            </Text>
            <Text style={styles.userInput} numberOfLines={2}>
              "{item.userInput}"
            </Text>
          </View>
          
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill,
                  { width: `${progressPercent}%` }
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {progressPercent}% Complete • {formatProgress(item)}
            </Text>
          </View>
        </View>
        
        <View style={styles.arrowContainer}>
          <Icon name="chevron-forward" size={20} color={Colors.trustGrey} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.header}>My Playbooks</Text>
        <FlatList
          data={mockPlaybooks}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.hopeWhite,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.hopeWhite,
    padding: 16,
  },
  header: {
    fontSize: 24,
    fontFamily: Fonts.bold,
    color: Colors.anchorBlue,
    marginBottom: 20,
    marginTop: 10,
  },
  listContent: {
    paddingBottom: 20,
  },
  card: {
    backgroundColor: Colors.hopeWhite,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardContent: {
    flex: 1,
  },
  textContainer: {
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    color: Colors.anchorBlue,
    marginBottom: 4,
  },
  summary: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.trustGrey,
    marginBottom: 4,
  },
  userInput: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.anchorBlue,
    marginTop: 4,
    fontStyle: 'italic',
  },
  progressContainer: {
    marginTop: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: Colors.hopeWhite,
    borderRadius: 2,
    marginBottom: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.growthGreen,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: Colors.trustGrey,
  },
  arrowContainer: {
    marginLeft: 8,
  },
});
