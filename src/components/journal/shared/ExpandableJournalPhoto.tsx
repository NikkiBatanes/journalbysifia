import React, {useEffect, useState} from 'react';
import {
  Image,
  type ImageStyle,
  StyleProp,
  StyleSheet,
  TouchableOpacity,
  type LayoutChangeEvent,
} from 'react-native';

import {triggerLightHaptic} from '../../../utils/haptics';

export const ExpandableJournalPhoto = ({
  uri,
  imageStyle,
  accessibilityLabel = 'Journal photo',
  onImageResult,
}: {
  uri: string;
  imageStyle?: StyleProp<ImageStyle>;
  accessibilityLabel?: string;
  onImageResult?: (loaded: boolean) => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [availableWidth, setAvailableWidth] = useState(0);

  useEffect(() => {
    setExpanded(false);
    setAspectRatio(null);
  }, [uri]);

  const toggle = () => {
    triggerLightHaptic();
    setExpanded(current => !current);
  };

  const onLayout = ({nativeEvent}: LayoutChangeEvent) => {
    const nextWidth = nativeEvent.layout.width;
    if (nextWidth > 0 && nextWidth !== availableWidth) {
      setAvailableWidth(nextWidth);
    }
  };

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{expanded}}
      accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} ${accessibilityLabel.toLowerCase()}`}
      activeOpacity={0.9}
      style={styles.container}
      onLayout={onLayout}
      onPress={toggle}>
      <Image
        source={{uri}}
        style={[
          imageStyle,
          expanded && {
            width: '100%',
            height:
              availableWidth > 0 && aspectRatio
                ? availableWidth / aspectRatio
                : 220,
            borderRadius: 16,
          },
        ]}
        onError={onImageResult ? () => onImageResult(false) : undefined}
        resizeMode={expanded ? 'contain' : 'cover'}
        onLoad={({nativeEvent}) => {
          const {width, height} = nativeEvent.source;
          const loaded = width > 0 && height > 0;
          onImageResult?.(loaded);
          if (loaded) {
            setAspectRatio(width / height);
          }
        }}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignSelf: 'stretch',
    borderRadius: 16,
    overflow: 'hidden',
  },
});

export default ExpandableJournalPhoto;
