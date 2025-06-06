import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Colors } from '../theme';

const LoadingScreen: React.FC = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.hopeWhite }}>
    <ActivityIndicator size="large" color={Colors.anchorBlue} />
  </View>
);

export default LoadingScreen;
