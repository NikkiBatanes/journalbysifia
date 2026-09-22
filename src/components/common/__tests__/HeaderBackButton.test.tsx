import React from 'react';
import {StyleSheet} from 'react-native';
import {fireEvent, render} from '@testing-library/react-native';

jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');

import HeaderBackButton, {HEADER_NAV_ICON_SIZE} from '../HeaderBackButton';

it('uses the shared transparent header treatment and close-icon sizing', () => {
  const onPress = jest.fn();
  const {getByLabelText, UNSAFE_getByType} = render(
    <HeaderBackButton
      accessibilityLabel="Return"
      color="#123456"
      onPress={onPress}
      style={{backgroundColor: 'red', width: 80}}
    />,
  );

  const button = getByLabelText('Return');
  expect(StyleSheet.flatten(button.props.style)).toMatchObject({
    width: 42,
    height: 42,
    backgroundColor: 'transparent',
  });
  expect(UNSAFE_getByType('Ionicons' as any).props).toMatchObject({
    name: 'chevron-back',
    size: HEADER_NAV_ICON_SIZE,
    color: '#123456',
  });

  fireEvent.press(button);
  expect(onPress).toHaveBeenCalledTimes(1);
});
