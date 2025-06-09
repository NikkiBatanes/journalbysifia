import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { Colors } from '../theme/colors';

const { width, height } = Dimensions.get('window');

const GeneratingPlaybookScreen: React.FC = () => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.15,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [scaleAnim]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.circle,
          { transform: [{ scale: scaleAnim }] },
        ]}
      />
      <Text style={styles.text}>Take a breath, {'\n'}generating your playbook…</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    width: width * 0.25,
    height: width * 0.25,
    borderRadius: width * 0.125,
    backgroundColor: Colors.hopeWhite,
    opacity: 0.15,
    marginBottom: 40,
  },
  text: {
    color: Colors.hopeWhite,
    fontSize: 22,
    textAlign: 'center',
    fontWeight: '600',
    letterSpacing: 0.5,
    lineHeight: 32,
  },
});

export default GeneratingPlaybookScreen;
