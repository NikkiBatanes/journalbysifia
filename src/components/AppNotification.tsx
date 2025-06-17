import React, { useContext, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { DevotionalContext } from '../context/DevotionalContext';
import SuccessNotification from './SuccessNotification';

const AppNotification: React.FC = () => {
  const { successMessage, clearSuccessMessage } = useContext(DevotionalContext);

  return (
    <View style={styles.container} pointerEvents="box-none">
      <SuccessNotification 
        message={successMessage} 
        onDismiss={clearSuccessMessage} 
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
});

export default AppNotification;
