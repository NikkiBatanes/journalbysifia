import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

type PrayerHandsIconProps = {
  size: number;
  color: string;
  style?: StyleProp<ViewStyle>;
};

const PrayerHandsIcon: React.FC<PrayerHandsIconProps> = ({size, color, style}) => (
  <View style={[{width: size, height: size, alignItems: 'center', justifyContent: 'center'}, style]}>
    <View style={{transform: [{rotate: '-28deg'}]}}>
      <Ionicons name="hand-left-outline" size={size} color={color} />
    </View>
  </View>
);

export default PrayerHandsIcon;
