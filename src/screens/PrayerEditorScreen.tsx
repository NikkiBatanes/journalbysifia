import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, TextInput, StatusBar } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Colors } from '../theme/colors';
import { Fonts } from '../theme/fonts';
import { triggerSelectionHaptic, triggerSuccessHaptic } from '../utils/haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ThemedText from '../components/common/ThemedText';
import { useCreatePrayer, useMarkPrayerRequestPrayed } from '../services/hooks/usePrayerData';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../services/queryKeys';

type RootStackParamList = {
  PrayerEditor: {
    prayerRequest: {
      person_name: string;
      content: string;
      id: string;
      user_id: string;
      selected_date: string;
    };
  };
};

type PrayerEditorScreenProps = NativeStackScreenProps<RootStackParamList, 'PrayerEditor'>;

const PrayerEditorScreen: React.FC<PrayerEditorScreenProps> = ({ route, navigation }) => {
  const { prayerRequest } = route.params;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [modalPrayerRequest, setModalPrayerRequest] = useState('');
  const [savingModalPrayer, setSavingModalPrayer] = useState(false);

  const createPrayerMutation = useCreatePrayer();
  const markPrayedMutation = useMarkPrayerRequestPrayed();

  const handleSaveModalPrayer = async () => {
    if (!modalPrayerRequest.trim()) {
      Alert.alert('Missing Prayer', 'Please enter your prayer before saving.');
      return;
    }

    setSavingModalPrayer(true);
    try {
      // Create the prayer
      await createPrayerMutation.mutateAsync({
        user_id: user!.id,
        prayer_type: 'people' as const,
        content: modalPrayerRequest,
        person_name: prayerRequest.person_name,
        metadata: {
          prayer_type: 'prayer-request',
          original_request_content: prayerRequest.content,
          prayer_request_display: prayerRequest.content,
        },
        selected_date: new Date().toLocaleDateString('en-CA'),
      });

      // Mark the prayer request as prayed
      if (prayerRequest?.id) {
        await markPrayedMutation.mutateAsync({
          id: prayerRequest.id,
          isPrayed: true,
          _userId: prayerRequest.user_id,
          _dateStr: prayerRequest.selected_date,
        });
      }

      triggerSuccessHaptic();

      // Navigate back
      navigation.goBack();
    } catch (e) {
      console.error('Failed to save prayer', e);
      Alert.alert('Error', 'Failed to save prayer. Please try again.');
    } finally {
      setSavingModalPrayer(false);
    }
  };

  const handleCancel = () => {
    triggerSelectionHaptic();
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar hidden />
      <View style={styles.fullScreenPrayerModalContainer}>
        <TouchableOpacity
          style={[styles.prayerModalCancelButton, { top: insets.top + 8 }]}
          onPress={handleCancel}
          disabled={savingModalPrayer}
        >
          <Ionicons name="close" size={17} color="rgba(255,255,255,0.65)" />
        </TouchableOpacity>

        <View style={styles.prayerModalHeader}>
          <View style={styles.prayerModalHeaderLeft}>
            <MaterialCommunityIcons name="hands-pray" size={20} color={Colors.alertCoral} />
            <ThemedText weight="bold" style={styles.prayerModalTitle}>
              PRAY FOR {prayerRequest.person_name || 'Someone'}
            </ThemedText>
          </View>
        </View>

        <ThemedText weight="regular" style={styles.prayerModalSubtitle}>
          Lift up a prayer for {prayerRequest.person_name || 'them'}
        </ThemedText>

        {/* Name field - pre-filled and non-editable */}
        <TextInput
          style={[styles.prayerModalNameInput, { fontFamily: Fonts.regular }]}
          value={prayerRequest.person_name}
          placeholder="Name (optional)"
          placeholderTextColor={Colors.placeholderText}
          keyboardAppearance="dark"
          editable={false}
        />

        {/* Combined field: Prayer input + Prayer Request inside same card */}
        <View style={styles.combinedPrayerField}>
          <TextInput
            style={[styles.combinedPrayerInput, { fontFamily: Fonts.regular }]}
            placeholder={`Write a prayer for ${prayerRequest.person_name || 'them'}…`}
            placeholderTextColor={Colors.placeholderText}
            value={modalPrayerRequest}
            onChangeText={setModalPrayerRequest}
            onFocus={triggerSelectionHaptic}
            multiline
            numberOfLines={6}
            autoFocus
            keyboardAppearance="dark"
          />
          <View style={styles.combinedDivider} />
          <View style={styles.combinedReadOnlyInner}>
            <ThemedText weight="semiBold" style={styles.prayerModalFieldLabel}>Prayer Request</ThemedText>
            <ThemedText weight="regular" style={styles.prayerModalReadOnlyText}>{prayerRequest.content || ''}</ThemedText>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.prayerModalSaveButton, { bottom: insets.bottom - 10, opacity: modalPrayerRequest.trim() ? 1 : 0 }]}
          onPress={handleSaveModalPrayer}
          disabled={savingModalPrayer || !modalPrayerRequest.trim()}
        >
          <Ionicons name="checkmark" size={24} color={Colors.hopeWhite} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
    zIndex: 1,
  },
  fullScreenPrayerModalContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  prayerModalCancelButton: {
    position: 'absolute',
    right: 20,
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  prayerModalHeader: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  prayerModalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
  },
  prayerModalTitle: {
    color: Colors.hopeWhite,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  prayerModalSubtitle: {
    color: Colors.secondaryText,
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  prayerModalNameInput: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    padding: 14,
    marginBottom: 20,
    color: Colors.hopeWhite,
    fontSize: 14,
  },
  combinedPrayerField: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    padding: 14,
    minHeight: 150,
  },
  combinedPrayerInput: {
    color: Colors.hopeWhite,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 80,
  },
  combinedDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginVertical: 12,
  },
  combinedReadOnlyInner: {
    backgroundColor: 'rgba(26,60,109,0.15)',
    borderRadius: 8,
    padding: 12,
  },
  prayerModalFieldLabel: {
    color: Colors.hopeWhite,
    fontSize: 12,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  prayerModalReadOnlyText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 20,
  },
  prayerModalSaveButton: {
    position: 'absolute',
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.alertCoral,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
  },
});

export default PrayerEditorScreen;
