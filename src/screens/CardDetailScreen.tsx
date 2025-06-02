import React, { useState, useCallback } from 'react';
import { TouchableOpacity, Image, View, ScrollView, StyleSheet, StatusBar } from 'react-native';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackScreenProps } from '@react-navigation/stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import PlaybookHeader from '../components/PlaybookHeader';
import { Colors } from '../theme';
import TruthInLoveCard from '../components/TruthInLoveCard';
import ActionStepsCard from '../components/ActionStepsCard';
import AffirmationCard from '../components/AffirmationCard';
import BibleVerseCard from '../components/BibleVerseCard';
import DirectChallengeCard from '../components/DirectChallengeCard';
import { RootStackParamList } from '../navigation/types';
export default function CardDetailScreen({ route, navigation }: StackScreenProps<RootStackParamList, 'CardDetail'>) {
  const { 
    cardType, 
    cardData, 
    playbook, 
    progress, 
    totalTasks, 
    viewMode: initialViewMode = 'stack',
    onToggleView: parentToggleView
  } = route.params;
  
  const [showUserInput, setShowUserInput] = useState(false);
  const [viewMode, setViewMode] = useState<'stack' | 'document'>(initialViewMode);
  
  // Sync with parent's view mode when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (route.params?.viewMode) {
        setViewMode(route.params.viewMode);
      }
    }, [route.params?.viewMode])
  );
  
  // Handle view mode toggle
  const handleToggleView = useCallback((mode: 'stack' | 'document') => {
    setViewMode(mode);
    if (parentToggleView) {
      parentToggleView(mode);
    }
  }, [parentToggleView]);

  // Render the appropriate card component
  const renderCard = () => {
    switch (cardType) {
      case 'truth':
        return <TruthInLoveCard {...cardData} expandedMode />;
      case 'action':
        return <ActionStepsCard {...cardData} expandedMode />;
      case 'affirmation':
        return <AffirmationCard {...cardData} expandedMode />;
      case 'bible':
        return <BibleVerseCard {...cardData} expandedMode />;
      case 'challenge':
        return <DirectChallengeCard {...cardData} expandedMode />;
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor={Colors.anchorBlue} barStyle="light-content" />
      <PlaybookHeader
        title={playbook.title}
        subtitle={new Date(playbook.createdAt || new Date()).toLocaleDateString('en-US', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        })}
        progress={progress}
        totalTasks={totalTasks}
        showToggle={true}
        viewMode={viewMode}
        onToggleView={handleToggleView}
        onPlaybookLabelPress={() => setShowUserInput(prev => !prev)}
        showUserInput={showUserInput}
        userInput={playbook.userInput}
        profileImageUri={playbook.profileImage}
        backgroundColor={Colors.anchorBlue}
        textColor={Colors.hopeWhite}
      />
      <ScrollView contentContainerStyle={styles.cardContainer}>
        {renderCard()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.hopeWhite,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f2f5f7',
    paddingTop: 24,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f1f1',
  },
  headerLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  headerCenter: {
    flex: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  progressBarBg: {
    width: 120,
    height: 8,
    backgroundColor: 'rgba(26, 60, 109, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.growthGreen,
    borderRadius: 4,
  },
  cardContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
});
