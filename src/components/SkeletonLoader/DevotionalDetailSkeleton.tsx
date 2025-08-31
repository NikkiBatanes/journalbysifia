import React from 'react';
import { View, StyleSheet, Animated, SafeAreaView, ScrollView } from 'react-native';
import { Colors } from '../../theme';

const DevotionalDetailSkeleton: React.FC = () => {
  const animatedValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: false,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: false,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.8],
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with back button and title */}
      <View style={styles.header}>
        <Animated.View style={[styles.backButton, { opacity }]} />
        <Animated.View style={[styles.headerTitle, { opacity }]} />
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Day navigation dots */}
        <View style={styles.dayDotsContainer}>
          {[1, 2, 3].map((dot) => (
            <Animated.View key={dot} style={[styles.dayDot, { opacity }]} />
          ))}
        </View>

        {/* Day title */}
        <View style={styles.dayTitleContainer}>
          <Animated.View style={[styles.dayNumber, { opacity }]} />
          <Animated.View style={[styles.dayTitle, { opacity }]} />
        </View>

        {/* Scripture section */}
        <View style={styles.sectionContainer}>
          <Animated.View style={[styles.sectionHeader, { opacity }]} />
          <View style={styles.scriptureCard}>
            <Animated.View style={[styles.scriptureText, { opacity }]} />
            <Animated.View style={[styles.scriptureTextLine2, { opacity }]} />
            <Animated.View style={[styles.scriptureReference, { opacity }]} />
          </View>
        </View>

        {/* Reflection section */}
        <View style={styles.sectionContainer}>
          <Animated.View style={[styles.sectionHeader, { opacity }]} />
          <View style={styles.reflectionCard}>
            {[1, 2, 3, 4, 5].map((line) => (
              <Animated.View 
                key={line} 
                style={[
                  styles.reflectionLine, 
                  { opacity, width: line === 5 ? '60%' : '100%' }
                ]} 
              />
            ))}
          </View>
        </View>

        {/* Reflection Questions section */}
        <View style={styles.sectionContainer}>
          <Animated.View style={[styles.sectionHeader, { opacity }]} />
          {[1, 2, 3].map((question) => (
            <View key={question} style={styles.questionCard}>
              <Animated.View style={[styles.questionText, { opacity }]} />
              <Animated.View style={[styles.questionButton, { opacity }]} />
            </View>
          ))}
        </View>

        {/* Prayer section */}
        <View style={styles.sectionContainer}>
          <Animated.View style={[styles.sectionHeader, { opacity }]} />
          <View style={styles.prayerCard}>
            {[1, 2, 3, 4].map((line) => (
              <Animated.View 
                key={line} 
                style={[
                  styles.prayerLine, 
                  { opacity, width: line === 4 ? '40%' : '100%' }
                ]} 
              />
            ))}
            <Animated.View style={[styles.prayButton, { opacity }]} />
          </View>
        </View>

        {/* Day completion button */}
        <View style={styles.completionContainer}>
          <Animated.View style={[styles.completionButton, { opacity }]} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  backButton: {
    width: 24,
    height: 24,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 12,
  },
  headerTitle: {
    flex: 1,
    height: 20,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 4,
    marginLeft: 16,
    width: '60%',
  },
  headerSpacer: {
    width: 24,
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  dayDotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  dayDot: {
    width: 12,
    height: 12,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 6,
  },
  dayTitleContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  dayNumber: {
    width: 60,
    height: 16,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 4,
    marginBottom: 8,
  },
  dayTitle: {
    width: 200,
    height: 24,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 4,
  },
  sectionContainer: {
    marginBottom: 30,
  },
  sectionHeader: {
    width: 120,
    height: 20,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 4,
    marginBottom: 16,
  },
  scriptureCard: {
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  scriptureText: {
    width: '90%',
    height: 18,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 4,
    marginBottom: 8,
  },
  scriptureTextLine2: {
    width: '70%',
    height: 18,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 4,
    marginBottom: 16,
  },
  scriptureReference: {
    width: 120,
    height: 14,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 4,
  },
  reflectionCard: {
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 16,
    padding: 20,
  },
  reflectionLine: {
    height: 16,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 4,
    marginBottom: 8,
  },
  questionCard: {
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  questionText: {
    flex: 1,
    height: 16,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 4,
    marginRight: 12,
  },
  questionButton: {
    width: 80,
    height: 32,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 16,
  },
  prayerCard: {
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 16,
    padding: 20,
  },
  prayerLine: {
    height: 16,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 4,
    marginBottom: 8,
  },
  prayButton: {
    width: 100,
    height: 40,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 20,
    marginTop: 16,
    alignSelf: 'center',
  },
  completionContainer: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  completionButton: {
    width: 200,
    height: 48,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 24,
  },
});

export default DevotionalDetailSkeleton;
