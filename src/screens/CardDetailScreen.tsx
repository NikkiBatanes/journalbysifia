import React, { useState, useCallback } from 'react';
import { TouchableOpacity, Image, View, ScrollView, StyleSheet, StatusBar, Text } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackScreenProps } from '@react-navigation/stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import PlaybookHeader from '../components/PlaybookHeader';
import { Colors } from '../theme';
import TruthInLoveCard from '../components/TruthInLoveCard';
import ActionStepsCard from '../components/ActionStepsCard';
import { useActionSteps } from '../context/ActionStepsContext';
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
  const [userInput, setUserInput] = useState(playbook?.userInput || '');
  
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
        return <TruthInLoveCard {...cardData} expanded={true} textColor={Colors.anchorBlue} />;
      case 'action':
        const { actionSteps } = useActionSteps();
        return <ActionStepsCard
          steps={actionSteps}
          textColor={Colors.anchorBlue}
          solidCardBackground={true}
          checkboxColor={Colors.anchorBlue}
          stepCircleBackground="rgba(26,60,109,0.12)"
        />;
      case 'affirmation':
        if (Array.isArray(cardData.affirmations)) {
          return (
            <View style={[styles.affirmationsCard, { flex: 1, width: '100%' }]}>
              <View style={styles.affirmationsHeader}>
                <MaterialCommunityIcons name="format-quote-close" size={24} color={Colors.faithGold} style={[styles.icon, { transform: [{ scaleX: -1 }] }]} />
                <Text style={styles.affirmationsTitle}>Affirmations</Text>
              </View>
              <View style={styles.affirmationsList}>
                {cardData.affirmations.map((affirmation: any) => (
                  <AffirmationCard
                    key={affirmation.id}
                    id={affirmation.id}
                    text={affirmation.text}
                    completed={affirmation.completed}
                    color={Colors.anchorBlue}
                    containerStyle={{ backgroundColor: 'rgba(80,80,80,0.15)', borderRadius: 16, padding: 16, marginBottom: 12 }}
                  />
                ))}
              </View>
            </View>
          );
        }
        return (
          <View style={[styles.affirmationsCard, { flex: 1, width: '100%' }]}>
            <View style={styles.affirmationsHeader}>
              <MaterialCommunityIcons name="format-quote-close" size={24} color={Colors.faithGold} style={[styles.icon, { transform: [{ scaleX: -1 }] }]} />
              <Text style={styles.affirmationsTitle}>Affirmations</Text>
            </View>
            <AffirmationCard 
              id={cardData.id}
              text={cardData.text}
              completed={cardData.completed}
              color={Colors.anchorBlue}
              containerStyle={{ backgroundColor: 'rgba(80,80,80,0.15)', borderRadius: 16, padding: 16, marginBottom: 12 }}
            />
          </View>
        );
      case 'bible':
        return (
          <View style={styles.cardContainer}>
            <BibleVerseCard 
              {...cardData} 
              expandedMode 
              textColor={Colors.anchorBlue} 
              backgroundColor={Colors.hopeWhite}
              style={styles.bibleCard}
            />
          </View>
        );
      case 'challenge':
        return <DirectChallengeCard {...cardData} expandedMode textColor={Colors.anchorBlue} />;
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} />
      
      {/* Fixed Header */}
      <View style={styles.headerContainer}>
        <PlaybookHeader
          title={playbook.title}
          subtitle={new Date(playbook.createdAt || new Date()).toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
          })}
          progress={progress || 0}
          totalTasks={totalTasks || 0}
          onBack={() => navigation.goBack()}
          showToggle={false}
          backgroundColor={Colors.anchorBlue}
          textColor={Colors.hopeWhite}
          alignTasksLeft={true}
          showUserInput={showUserInput}
          userInput={userInput}
          onPlaybookLabelPress={() => setShowUserInput(!showUserInput)}
        />
      </View>

      {/* User Input Card */}
      {showUserInput && userInput && (
        <View style={[styles.userInputContainer, { backgroundColor: Colors.hopeWhite }]}>
          <View style={styles.userInputCard}>
            <Text style={styles.userInputText}>{userInput}</Text>
          </View>
        </View>
      )}

      {/* Scrollable Content */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentContainer}>
          <View style={styles.cardContainer}>
            {renderCard()}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Base container styles
  container: {
    flex: 1,
    backgroundColor: Colors.hopeWhite,
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  scrollView: {
    flex: 1,
    paddingTop: 150, // Increased to 150 as requested
  },
  scrollViewContent: {
    flexGrow: 1,
    paddingBottom: 40, // Add some bottom padding
  },
  // Main content container with max width
  contentContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 600, // Set a max-width for larger screens
    alignSelf: 'center',
  },
  mainContainer: {
    flex: 1,
    paddingHorizontal: 16,
    backgroundColor: Colors.hopeWhite, // Restore background to hope white in CardDetailScreen
  },
  cardContainer: {
    flex: 1,
    marginTop: 0, // Remove general marginTop; we'll apply it only to ActionStepsCard
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  userInputContainer: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
    backgroundColor: Colors.hopeWhite,
  },
  userInputCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  userInputText: {
    fontFamily: 'System',
    fontWeight: '400',
    fontSize: 15,
    lineHeight: 22,
    color: Colors.anchorBlue,
  },
  bibleCard: {
    width: '100%',
    maxWidth: 500,
    borderRadius: 16,
    padding: 24,
    elevation: 3,
  },
  affirmationsCard: {
    backgroundColor: 'transparent',
    width: '100%',
  },
  affirmationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  icon: {
    marginRight: 8,
  },
  affirmationsTitle: {
    fontFamily: 'Inter-Black',
    fontSize: 20,
    color: Colors.anchorBlue,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  affirmationsList: {
    width: '100%',
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

});
