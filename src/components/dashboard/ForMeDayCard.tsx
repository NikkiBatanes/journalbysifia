import React, {useEffect, useRef} from 'react';
import {Animated, Easing, StyleSheet, TouchableOpacity, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {format} from 'date-fns';
import ThemedText from '../common/ThemedText';
import {Colors} from '../../theme/colors';
import {Fonts} from '../../theme/fonts';
import {type ForMeDaySettings} from '../../storage/gospelStorage';
import {getForMeDayYears} from '../../services/forMeDayService';
import {triggerLightHaptic} from '../../utils/haptics';

const ForMeDayCard = ({settings}: {settings: ForMeDaySettings}) => {
  const navigation = useNavigation<any>();
  const sparkle = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    sparkle.setValue(0);
    const animation = Animated.timing(sparkle, {toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true});
    animation.start();
    return () => animation.stop();
  }, [sparkle]);
  const years = getForMeDayYears(settings.spiritualBirthday);
  const isFirstDay = settings.spiritualBirthday === format(new Date(), 'yyyy-MM-dd');
  return (
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
        {isFirstDay
          ? 'Today, you accepted Jesus as your Lord and Savior and began following Him.'
          : years && settings.includeYearWhenSharing
          ? `Today marks ${years} ${
              years === 1 ? 'year' : 'years'
            } since you accepted Jesus as your Lord and Savior and began following Him.`
          : 'Today, remember when you accepted Jesus as your Lord and Savior.'}{' '}
        {isFirstDay
          ? 'Celebrate His good news and this new beginning.'
          : 'Celebrate His good news and thank Him for how He has carried you.'}
      </ThemedText>
      <View style={styles.action}>
        <ThemedText style={styles.actionText}>{isFirstDay ? 'Celebrate this beginning' : 'Remember this day'}</ThemedText>
        <Ionicons name="arrow-forward" size={16} color={Colors.hopeWhite} />
      </View>
    </TouchableOpacity>
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
