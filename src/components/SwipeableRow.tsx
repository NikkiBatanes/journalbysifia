import React, { useRef } from 'react';
import { Animated, StyleSheet, View, Dimensions, TouchableOpacity } from 'react-native';
import { BorderRadii } from '../theme/styles';
import { MaterialIcons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPEABLE_WIDTH = 80;

type SwipeableRowProps = {
  children: React.ReactNode;
  onDelete: () => void;
};

const SwipeableRow: React.FC<SwipeableRowProps> = ({ children, onDelete }) => {
  const translateX = useRef(new Animated.Value(0)).current;

  const handleSwipe = (direction: 'left' | 'right') => {
    Animated.spring(translateX, {
      toValue: direction === 'left' ? -SWIPEABLE_WIDTH : 0,
      useNativeDriver: true,
      bounciness: 0,
    }).start();
  };

  const handleDelete = () => {
    Animated.timing(translateX, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => onDelete());
  };

  return (
    <View style={styles.container}>
      <View style={styles.deleteButton}>
        <TouchableOpacity onPress={handleDelete} style={styles.deleteButtonContent}>
          <MaterialIcons name="delete" size={24} color="white" />
        </TouchableOpacity>
      </View>
      <Animated.View
        style={[
          styles.content,
          {
            transform: [{ translateX }],
          },
        ]}
        onTouchStart={() => {}}
        onTouchMove={(e) => {
          const { pageX } = e.nativeEvent;
          if (pageX < 0) {return;}
          translateX.setValue(-pageX / 3);
        }}
        onTouchEnd={(e) => {
          const { pageX } = e.nativeEvent;
          if (pageX < SCREEN_WIDTH / 2) {
            handleSwipe('left');
          } else {
            handleSwipe('right');
          }
        }}
      >
        {children}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: BorderRadii.card,
    marginVertical: 4,
  },
  content: {
    backgroundColor: 'white',
  },
  deleteButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: SWIPEABLE_WIDTH,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default SwipeableRow;
