import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

type PrayerHandsIconProps = {
  size: number;
  color: string;
  style?: StyleProp<ViewStyle>;
  strokeWidth?: number;
};

const PrayerHandsIcon: React.FC<PrayerHandsIconProps> = ({size, color, style, strokeWidth}) => (
  <View style={[{width: size, height: size, alignItems: 'center', justifyContent: 'center'}, style]}>
    <View style={{transform: [{rotate: '-28deg'}]}}>
      {strokeWidth ? (
        <View style={{width: size, height: size}}>
          <Ionicons
            name="hand-left-outline"
            size={size}
            color={color}
            style={{position: 'absolute', left: -0.3, top: 0}}
          />
          <Ionicons
            name="hand-left-outline"
            size={size}
            color={color}
            style={{position: 'absolute', left: 0.3, top: 0}}
          />
        </View>
      ) : (
        <Ionicons name="hand-left-outline" size={size} color={color} />
      )}
    </View>
  </View>
);

export default PrayerHandsIcon;
