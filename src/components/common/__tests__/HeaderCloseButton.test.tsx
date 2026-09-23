import React from 'react';
import {StyleSheet} from 'react-native';
import {fireEvent, render} from '@testing-library/react-native';

jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');

import HeaderCloseButton from '../HeaderCloseButton';
import {HEADER_NAV_ICON_SIZE} from '../HeaderBackButton';
import {Colors} from '../../../theme/colors';

it('uses the shared circular close-button treatment', () => {
  const onPress = jest.fn();
  const {getByLabelText, UNSAFE_getByType} = render(
    <HeaderCloseButton
      accessibilityLabel="Close review"
      color="#123456"
      onPress={onPress}
      style={{backgroundColor: 'red', width: 80}}
    />,
  );

  const button = getByLabelText('Close review');
  expect(StyleSheet.flatten(button.props.style)).toMatchObject({
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.cardBackground,
  });
  expect(UNSAFE_getByType('Ionicons' as any).props).toMatchObject({
    name: 'close',
    size: HEADER_NAV_ICON_SIZE,
    color: '#123456',
  });

  fireEvent.press(button);
  expect(onPress).toHaveBeenCalledTimes(1);
});
