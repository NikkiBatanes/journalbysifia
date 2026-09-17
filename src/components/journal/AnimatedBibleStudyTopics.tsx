import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleProp, StyleSheet, TextStyle, TouchableOpacity, View, ViewStyle } from 'react-native';
import { BibleStudyTopic } from '../../data/bibleStudyTopics';
import ThemedText from '../common/ThemedText';

interface Props {
  suggestions: BibleStudyTopic[];
  topics: BibleStudyTopic[];
  expanded: boolean;
  reduceMotion: boolean;
  onSelect: (topic: BibleStudyTopic) => void;
  gridStyle: StyleProp<ViewStyle>;
  buttonStyle: StyleProp<ViewStyle>;
  textStyle: StyleProp<TextStyle>;
}

export default function AnimatedBibleStudyTopics({ suggestions, topics, expanded, reduceMotion, onSelect, gridStyle, buttonStyle, textStyle }: Props) {
  const height = useRef(new Animated.Value(0)).current;
  const initialized = useRef(false);
  const pillValues = useRef(new Map(topics.map(topic => [topic.id, new Animated.Value(0)]))).current;
  const extraAnimations = useMemo(() => topics.filter(topic => !suggestions.some(suggestion => suggestion.id === topic.id))
    .map(topic => pillValues.get(topic.id)!), [topics, suggestions, pillValues]);
  const [collapsedHeight, setCollapsedHeight] = useState(0);
  const [expandedHeight, setExpandedHeight] = useState(0);
  const ordered = [...suggestions, ...topics.filter(topic => !suggestions.some(suggestion => suggestion.id === topic.id))];
  useEffect(() => {
    let cancelled = false;
    if (!collapsedHeight || !expandedHeight) {return;}
    const target = expanded ? expandedHeight : collapsedHeight;
    if (!initialized.current || reduceMotion) {
      initialized.current = true;
      height.setValue(target);
      extraAnimations.forEach(value => value.setValue(expanded ? 1 : 0));
      return;
    }
    extraAnimations.forEach(value => value.stopAnimation());
    if (expanded) {height.setValue(expandedHeight);}
    const animation = expanded ? Animated.stagger(38, [...extraAnimations].reverse().map(value =>
      Animated.spring(value, { toValue: 1, tension: 90, friction: 12, useNativeDriver: true }),
    )) : Animated.stagger(28, extraAnimations.map(value =>
      Animated.timing(value, { toValue: 0, duration: 130, useNativeDriver: true }),
    ));
    animation.start(({ finished }) => {
      if (finished && !cancelled && !expanded) {height.setValue(collapsedHeight);}
    });
    return () => { cancelled = true; animation.stop(); };
  }, [collapsedHeight, expandedHeight, expanded, extraAnimations, height, reduceMotion]);
  return <Animated.View style={[styles.clip, { height }]}>
    <View style={[gridStyle, styles.measured]} onLayout={event => setExpandedHeight(event.nativeEvent.layout.height)}>
      {ordered.map((topic, index) => <Animated.View key={topic.id} style={index >= suggestions.length && {
        opacity: pillValues.get(topic.id)!.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }), transform: [
          { translateY: pillValues.get(topic.id)!.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
          { scale: pillValues.get(topic.id)!.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
        ],
      }}>
        <TouchableOpacity style={buttonStyle} activeOpacity={0.65}
        disabled={!expanded && index >= suggestions.length} accessibilityElementsHidden={!expanded && index >= suggestions.length}
        importantForAccessibility={!expanded && index >= suggestions.length ? 'no-hide-descendants' : 'auto'} onPress={() => onSelect(topic)}>
        <ThemedText style={textStyle}>{topic.title}</ThemedText>
        </TouchableOpacity>
      </Animated.View>)}
    </View>
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={[gridStyle, styles.measured, styles.invisible]} onLayout={event => setCollapsedHeight(event.nativeEvent.layout.height)}>
      {suggestions.map(topic => <View key={topic.id} style={buttonStyle}><ThemedText style={textStyle}>{topic.title}</ThemedText></View>)}
    </View>
  </Animated.View>;
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  measured: { position: 'absolute', top: 0, left: 0, right: 0 },
  invisible: { opacity: 0 },
});
