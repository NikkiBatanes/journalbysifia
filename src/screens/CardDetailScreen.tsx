import React, { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, StatusBar, Text, TouchableOpacity, Image } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { StackScreenProps } from '@react-navigation/stack';
import { CommonActions } from '@react-navigation/native';
import PlaybookHeader from '../components/PlaybookHeader';
import { Colors } from '../theme';
import TruthInLoveCard from '../components/TruthInLoveCard';
import ActionStepsCard from '../components/ActionStepsCard';
import { useActionSteps } from '../context/ActionStepsContext';
import { useAuth } from '../context/IndustryStandardAuthContext';
import AffirmationCard from '../components/AffirmationCard';
import BibleVerseCard from '../components/BibleVerseCard';
import DirectChallengeCard from '../components/DirectChallengeCard';
import { RootStackParamList } from '../navigation/types';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';

export default function CardDetailScreen({ route, navigation }: StackScreenProps<RootStackParamList, 'CardDetail'>) {
  const [headerHeight, setHeaderHeight] = useState(150); // Default header height
  const {
    cardType,
    cardData,
    playbook,
  } = route.params;

  // Get the latest progress and task counts from context
  const { getCompletedStepsCount, actionSteps } = useActionSteps();
  const { user } = useAuth();
  const { completed: completedTasks, total: totalTasks } = getCompletedStepsCount();
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  const [showUserInput, setShowUserInput] = useState(false);

  // Chevron animation logic
  const chevronAnim = useSharedValue(0);
  React.useEffect(() => {
    chevronAnim.value = withTiming(showUserInput ? 1 : 0, { duration: 200 });
  }, [showUserInput, chevronAnim]);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronAnim.value * 180}deg` }],
    marginLeft: 4,
  }));

  const [userInput] = useState(playbook?.userInput || '');

  // Header left component
  const headerLeft = React.useCallback(() => (
    <View style={styles.headerLeftContainer}>
      <TouchableOpacity
        onPress={() => {
          try {
            navigation.goBack();
          } catch (error) {
            console.log('Navigation error:', error);
          }
        }}
        style={styles.backButtonContainer}
      >
        <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.playbookLabelContainer}
        onPress={() => setShowUserInput(!showUserInput)}
        activeOpacity={0.7}
      >
        <Text style={styles.playbookLabelText}>PLAYBOOK</Text>
        <Animated.View style={chevronStyle}>
          <Ionicons
            name="chevron-down"
            size={15}
            color="#FFFFFF"
          />
        </Animated.View>
      </TouchableOpacity>

    </View>
  ), [navigation, showUserInput, chevronStyle]);

  // Set navigation options
  React.useLayoutEffect(() => {
    console.log('[DEBUG] CardDetailScreen: Setting navigation options with headerLeft');
    navigation.setOptions({
      headerTitle: '',
      headerLeft,
      headerRight: () => (
        <TouchableOpacity
          onPress={() => {
            console.log('Profile image pressed from CardDetail');
            try {
              navigation.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [
                    {
                      name: 'MainTabs',
                      state: {
                        routes: [
                          { name: 'Home' },
                          { name: 'Playbooks' },
                          { name: 'Devotionals' },
                          { name: 'Profile' },
                        ],
                        index: 3,
                      },
                    },
                  ],
                })
              );
            } catch (error) {
              console.log('Navigation error:', error);
            }
          }}
          style={{ marginRight: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 16, overflow: 'hidden' }}
          activeOpacity={0.7}
        >
          {(user as any)?.user_metadata?.avatar_url ? (
            <Image
              source={{ uri: (user as any).user_metadata.avatar_url }}
              style={{ width: 32, height: 32, borderRadius: 16 }}
              resizeMode="cover"
            />
          ) : (
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#666', justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name="person" size={16} color="#fff" />
            </View>
          )}
        </TouchableOpacity>
      ),
      headerShown: true,
      headerTransparent: false,
      headerStyle: {
        backgroundColor: Colors.anchorBlue,
      },
    });
  }, [navigation, headerLeft, user]);

  // Force re-render to get updated progress
  useFocusEffect(
    useCallback(() => {
      // Force re-render to get updated progress
    }, [])
  );

  // Render the appropriate card component
  const renderCard = (cardSteps: any) => {
    switch (cardType) {
      case 'truth':
        return <TruthInLoveCard
          {...cardData}
          expanded={true}
          textColor={Colors.anchorBlue}
          currentUser={user ? {
            displayName: (user as any).displayName || (user.user_metadata?.full_name) || '',
            firstName: (user as any).firstName || (user.user_metadata?.first_name) || '',
            lastName: (user as any).lastName || (user.user_metadata?.last_name) || '',
          } : undefined}
        />;
      case 'action':
        return <ActionStepsCard
          steps={cardSteps}
          textColor={Colors.anchorBlue}
          solidCardBackground={true}
          checkboxColor={Colors.anchorBlue}
          stepCircleBackground="rgba(26,60,109,0.12)"
        />;
      case 'affirmation':
        if (Array.isArray(cardData.affirmations)) {
          return (
            <View style={[styles.affirmationsCard, styles.fullWidthContainer]}>
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
                    containerStyle={styles.cardBackground}
                  />
                ))}
              </View>
            </View>
          );
        }
        return (
          <View style={[styles.affirmationsCard, styles.fullWidthContainer]}>
            <View style={styles.affirmationsHeader}>
              <MaterialCommunityIcons name="format-quote-close" size={24} color={Colors.faithGold} style={[styles.icon, { transform: [{ scaleX: -1 }] }]} />
              <Text style={styles.affirmationsTitle}>Affirmations</Text>
            </View>
            <AffirmationCard
              id={cardData.id}
              text={cardData.text}
              completed={cardData.completed}
              color={Colors.anchorBlue}
              containerStyle={styles.cardBackground}
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
      <View
        style={styles.headerContainer}
        onLayout={e => setHeaderHeight(e.nativeEvent.layout.height)}
      >
        <PlaybookHeader
          title={playbook.title}
          subtitle={new Date(playbook.createdAt || new Date()).toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          })}
          progress={progress || 0}
          completedTasks={completedTasks}
          totalTasks={totalTasks}
          onBack={() => navigation.goBack()}
          showToggle={false}
          backgroundColor={Colors.anchorBlue}
          textColor={Colors.hopeWhite}
          alignTasksLeft={true}
          showUserInput={showUserInput}
          userInput={userInput}
          userInputBackgroundColor={'#264776'}
          userInputBorderColor={'#385886'}
          userInputTextColor={Colors.hopeWhite}

        />
      </View>

      {/* Scrollable Content */}
      <ScrollView
        style={[styles.scrollView, { paddingTop: headerHeight }]}
        contentContainerStyle={styles.scrollViewContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentContainer}>
          <View style={styles.cardContainer}>
            {renderCard(actionSteps)}
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
    marginTop: 0,
    paddingTop: 16, // Add a small, uniform gap below the header for all cards

  },
  mainContainer: {
    flex: 1,
    paddingHorizontal: 16,
    backgroundColor: Colors.hopeWhite, // Restore background to hope white in CardDetailScreen
  },
  cardContainer: {
    flex: 1,
    marginTop: 0,
    padding: 24,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
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
  fullWidthContainer: {
    flex: 1,
    width: '100%',
  },
  cardBackground: {
    backgroundColor: 'rgba(80,80,80,0.15)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
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
  headerLeftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButtonContainer: {
    padding: 8,
    paddingLeft: 0,
  },
  playbookLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 32,
  },
  playbookLabelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  chevronIcon: {
    marginLeft: 4,
  },

});
