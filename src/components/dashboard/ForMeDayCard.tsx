import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Animated, Easing, StyleSheet, TouchableOpacity, View} from 'react-native';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ThemedText from '../common/ThemedText';
import {Colors} from '../../theme/colors';
import {Fonts} from '../../theme/fonts';
import {
  gospelStorage,
  type ForMeDaySettings,
} from '../../storage/gospelStorage';
import {
  getForMeDayYears,
  isForMeDay,
  scheduleForMeDayReminder,
} from '../../services/forMeDayService';
import {triggerLightHaptic} from '../../utils/haptics';

const ForMeDayCard = () => {
  const navigation = useNavigation<any>();
  const [settings, setSettings] = useState<ForMeDaySettings | null>(null);
  const entrance = useRef(new Animated.Value(0)).current;
  const sparkle = useRef(new Animated.Value(0)).current;
  useFocusEffect(
    useCallback(() => {
      let active = true;
      gospelStorage.getForMeDaySettings().then(value => {
        if (active) {
          setSettings(value);
        }
        if (value?.reminderEnabled) {
          scheduleForMeDayReminder(value).catch(() => {});
        }
      });
      return () => {
        active = false;
      };
    }, []),
  );
  const active = Boolean(settings && isForMeDay(settings.spiritualBirthday));
  useEffect(() => {
    if (!active) {return;}
    entrance.setValue(0);
    sparkle.setValue(0);
    const animation = Animated.parallel([
      Animated.spring(entrance, {toValue: 1, tension: 42, friction: 8, overshootClamping: true, useNativeDriver: true}),
      Animated.timing(sparkle, {toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true}),
    ]);
    animation.start();
    return () => animation.stop();
  }, [active, entrance, sparkle]);
  if (!settings || !active) {
    return null;
  }
  const years = getForMeDayYears(settings.spiritualBirthday);
  return (
    <Animated.View style={{
      opacity: entrance,
      transform: [
        {translateY: entrance.interpolate({inputRange: [0, 1], outputRange: [14, 0]})},
        {scale: entrance.interpolate({inputRange: [0, 1], outputRange: [0.97, 1]})},
      ],
    }}>
      <TouchableOpacity
      style={styles.card}
      activeOpacity={0.86}
      onPress={() => {
        triggerLightHaptic();
        navigation.navigate('ForMeDay', {mode: 'celebrate'});
      }}
      accessibilityRole="button"
      accessibilityLabel="Open your For Me Day">
      <View style={styles.top}>
        <ThemedText style={styles.eyebrow}>
          ✦ YOUR SPIRITUAL BIRTHDAY
        </ThemedText>
        <Animated.View style={{transform: [{rotate: sparkle.interpolate({inputRange: [0, 1], outputRange: ['-28deg', '0deg']})}, {scale: sparkle.interpolate({inputRange: [0, 1], outputRange: [0.45, 1]})}]}}>
          <Ionicons name="sparkles-outline" size={22} color={Colors.faithGold} />
        </Animated.View>
      </View>
      <ThemedText style={styles.title}>Happy For Me Day.</ThemedText>
      <ThemedText style={styles.body}>
        {years && settings.includeYearWhenSharing
          ? `Today marks ${years} ${
              years === 1 ? 'year' : 'years'
            } since the Gospel became personal.`
          : 'Today, remember when the Gospel became personal.'}{' '}
        Grace wasn’t only for the world—it was for you.
      </ThemedText>
      <View style={styles.action}>
        <ThemedText style={styles.actionText}>Remember this day</ThemedText>
        <Ionicons name="arrow-forward" size={16} color={Colors.hopeWhite} />
      </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.modalBlue,
    borderRadius: 22,
    padding: 20,
    marginBottom: 24,
    overflow: 'hidden',
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eyebrow: {
    color: Colors.faithGold,
    fontFamily: Fonts.semiBold,
    fontSize: 10,
    letterSpacing: 1.7,
  },
  title: {
    color: Colors.hopeWhite,
    fontFamily: Fonts.lora.semiBold,
    fontSize: 28,
    lineHeight: 35,
    marginTop: 14,
  },
  body: {
    color: Colors.hopeWhite,
    fontFamily: Fonts.regular,
    fontSize: 14,
    lineHeight: 22,
    opacity: 0.9,
    marginTop: 7,
  },
  action: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: Colors.sage,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    marginTop: 17,
  },
  actionText: {
    color: Colors.hopeWhite,
    fontFamily: Fonts.semiBold,
    fontSize: 12,
  },
});
export default ForMeDayCard;
