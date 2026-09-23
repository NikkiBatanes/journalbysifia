import React from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  type TouchableOpacityProps,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import {Colors} from '../../theme/colors';
import {HEADER_NAV_ICON_SIZE} from './HeaderBackButton';

type HeaderCloseButtonProps = Omit<TouchableOpacityProps, 'children'> & {
  color?: string;
};

/** Shared presentation for close navigation rendered in a screen header. */
const HeaderCloseButton: React.FC<HeaderCloseButtonProps> = ({
  accessibilityLabel = 'Close',
  accessibilityRole = 'button',
  activeOpacity = 0.7,
  color = Colors.sage,
  hitSlop = {top: 8, bottom: 8, left: 8, right: 8},
  style,
  ...props
}) => (
  <TouchableOpacity
    {...props}
    accessibilityLabel={accessibilityLabel}
    accessibilityRole={accessibilityRole}
    activeOpacity={activeOpacity}
    hitSlop={hitSlop}
    style={[style, styles.button]}>
    <Ionicons name="close" size={HEADER_NAV_ICON_SIZE} color={color} />
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  button: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.cardBackground,
  },
});

export default HeaderCloseButton;
