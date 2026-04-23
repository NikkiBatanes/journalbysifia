import React, { useRef } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import TimeBlockLogEditor, { TimeBlockLogEditorRef } from '../components/journal/TimeBlockLogEditor';
import { useRoute, useNavigation } from '@react-navigation/native';
import { toLocalDateString } from '../utils/date';
import { useAuth } from '../context/IndustryStandardAuthContext';

interface RouteParams {
  selectedDate?: string;
  existingTimeBlock?: any;
}

const TimeBlockEditorScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { user } = useAuth();
  const timeBlockEditorRef = useRef<TimeBlockLogEditorRef>(null);

  const params = route.params as RouteParams;
  const selectedDate = params?.selectedDate || toLocalDateString(new Date());
  const existingTimeBlock = params?.existingTimeBlock;

  const handleSave = (data: any) => {
    console.log('TimeBlock saved:', data);
    navigation.goBack();
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  const handleUpgradeRequired = () => {
    navigation.goBack();
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1A237E" />
      <View style={styles.container}>
        <TimeBlockLogEditor
          ref={timeBlockEditorRef}
          onSave={handleSave}
          onCancel={handleCancel}
          onUpgradeRequired={handleUpgradeRequired}
          initialContent={existingTimeBlock?.description || ''}
          subtaskTitle=""
          _subtaskId={undefined}
          _stepId={undefined}
          playbookTitle={undefined}
          actionStepNumber={undefined}
          actionStepTitle={undefined}
          isLoading={false}
          existingTimeBlock={existingTimeBlock}
          context="journal"
          dateString={new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        />
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A237E',
  },
});

export default TimeBlockEditorScreen;
