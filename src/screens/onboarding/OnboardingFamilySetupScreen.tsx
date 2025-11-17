import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { withErrorBoundary } from '../../components/ErrorBoundary/withErrorBoundary';
import { useTheme } from '../../hooks/useTheme';
import { getFontFamily } from '../../theme/fonts';
import { FamilySubscriptionService } from '../../services/FamilySubscriptionService';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { Logger } from '../../utils/ProductionLogger';
import ThemedText from '../../components/common/ThemedText';

/**
 * OnboardingFamilySetupScreen
 * 
 * Enterprise-grade family subscription setup during onboarding
 * Features:
 * - Group name configuration
 * - Member capacity selection
 * - Initial invitation setup
 * - Billing cycle selection
 */

interface FamilySetupFormData {
  groupName: string;
  maxMembers: number;
  billingCycle: 'monthly' | 'annual';
  initialInvites: string[];
}

const OnboardingFamilySetupScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';

  const fonts = useMemo(() => ({
    regular: getFontFamily(fontKey, 'regular'),
    medium: getFontFamily(fontKey, 'medium'),
    semiBold: getFontFamily(fontKey, 'semiBold'),
    bold: getFontFamily(fontKey, 'bold'),
  }), [fontKey]);

  const styles = useMemo(() => createStyles(fonts), [fonts]);

  // Form state
  const [formData, setFormData] = useState<FamilySetupFormData>({
    groupName: '',
    maxMembers: 5,
    billingCycle: 'annual',
    initialInvites: ['', '', '', ''],
  });

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [isCreating, setIsCreating] = useState(false);

  // Update form field
  const updateField = useCallback((field: keyof FamilySetupFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  // Update invite email
  const updateInvite = useCallback((index: number, email: string) => {
    setFormData(prev => {
      const newInvites = [...prev.initialInvites];
      newInvites[index] = email;
      return { ...prev, initialInvites: newInvites };
    });
  }, []);

  // Validate email
  const isValidEmail = (email: string): boolean => {
    if (!email) return true; // Empty is valid (optional)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Validate step 1
  const canProceedStep1 = useMemo(() => {
    return formData.groupName.trim().length >= 3;
  }, [formData.groupName]);

  // Validate step 2
  const canProceedStep2 = useMemo(() => {
    return formData.maxMembers >= 2 && formData.maxMembers <= 10;
  }, [formData.maxMembers]);

  // Validate step 3
  const canProceedStep3 = useMemo(() => {
    const validEmails = formData.initialInvites.filter(email => 
      email.trim() && isValidEmail(email)
    );
    return validEmails.length >= 0; // Can proceed with 0 invites
  }, [formData.initialInvites]);

  // Handle step navigation
  const handleNext = () => {
    if (currentStep === 1 && canProceedStep1) {
      setCurrentStep(2);
    } else if (currentStep === 2 && canProceedStep2) {
      setCurrentStep(3);
    } else if (currentStep === 3 && canProceedStep3) {
      handleCreateFamily();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as 1 | 2 | 3);
    } else {
      navigation.goBack();
    }
  };

  // Create family group
  const handleCreateFamily = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    setIsCreating(true);

    try {
      // Create family group
      const familyGroup = await FamilySubscriptionService.createFamilyGroup({
        admin_user_id: user.id,
        group_name: formData.groupName.trim(),
        max_members: formData.maxMembers,
        billing_cycle: formData.billingCycle,
      });

      Logger.info('Family group created', { familyGroupId: familyGroup.id });

      // Send invitations
      const validInvites = formData.initialInvites.filter(email => 
        email.trim() && isValidEmail(email)
      );

      const invitationPromises = validInvites.map(email =>
        FamilySubscriptionService.inviteMember({
          family_group_id: familyGroup.id,
          invited_email: email.trim(),
          invited_by_user_id: user.id,
        })
      );

      await Promise.allSettled(invitationPromises);

      Logger.info('Family invitations sent', { count: validInvites.length });

      // Show success and navigate
      Alert.alert(
        'Family Created!',
        `Your family group "${formData.groupName}" has been created. ${validInvites.length > 0 ? `Invitations sent to ${validInvites.length} member(s).` : ''}`,
        [
          {
            text: 'Continue',
            onPress: () => {
              // Navigate to main app or next onboarding step
              navigation.navigate('MainTabs' as never);
            },
          },
        ]
      );
    } catch (error) {
      Logger.error('Failed to create family group', error as Error, {
        component: 'OnboardingFamilySetupScreen',
      });
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to create family group'
      );
    } finally {
      setIsCreating(false);
    }
  };

  // Skip family setup
  const handleSkip = () => {
    Alert.alert(
      'Skip Family Setup?',
      'You can always set up a family subscription later from your profile settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Skip',
          onPress: () => navigation.navigate('MainTabs' as never),
        },
      ]
    );
  };

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <View style={styles.stepContent}>
            <View style={styles.iconContainer}>
              <Ionicons name="people" size={64} color={Colors.anchorBlue} />
            </View>
            
            <ThemedText style={styles.stepTitle}>Name Your Family Group</ThemedText>
            <ThemedText style={styles.stepDescription}>
              Choose a name that represents your family. This will be visible to all members.
            </ThemedText>

            <View style={styles.inputContainer}>
              <ThemedText style={styles.inputLabel}>Group Name</ThemedText>
              <TextInput
                style={styles.textInput}
                value={formData.groupName}
                onChangeText={(text) => updateField('groupName', text)}
                placeholder="e.g., The Smith Family"
                placeholderTextColor={Colors.textGray}
                maxLength={50}
              />
              <ThemedText style={styles.inputHint}>
                {formData.groupName.length}/50 characters
              </ThemedText>
            </View>

            <View style={styles.exampleBox}>
              <Ionicons name="bulb-outline" size={20} color={Colors.anchorBlue} />
              <ThemedText style={styles.exampleText}>
                Examples: "The Johnson Family", "Our Faith Journey", "Family of Grace"
              </ThemedText>
            </View>
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContent}>
            <View style={styles.iconContainer}>
              <Ionicons name="people-circle" size={64} color={Colors.anchorBlue} />
            </View>
            
            <ThemedText style={styles.stepTitle}>Set Member Capacity</ThemedText>
            <ThemedText style={styles.stepDescription}>
              How many family members will use siFia? You can always adjust this later.
            </ThemedText>

            <View style={styles.capacitySelector}>
              {[2, 3, 4, 5, 6, 8, 10].map((capacity) => (
                <TouchableOpacity
                  key={capacity}
                  style={[
                    styles.capacityOption,
                    formData.maxMembers === capacity && styles.capacityOptionSelected,
                  ]}
                  onPress={() => updateField('maxMembers', capacity)}
                >
                  <ThemedText
                    style={[
                      styles.capacityText,
                      formData.maxMembers === capacity && styles.capacityTextSelected,
                    ]}
                  >
                    {capacity}
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.capacityLabel,
                      formData.maxMembers === capacity && styles.capacityLabelSelected,
                    ]}
                  >
                    members
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.billingSection}>
              <ThemedText style={styles.inputLabel}>Billing Cycle</ThemedText>
              <View style={styles.billingOptions}>
                <TouchableOpacity
                  style={[
                    styles.billingOption,
                    formData.billingCycle === 'monthly' && styles.billingOptionSelected,
                  ]}
                  onPress={() => updateField('billingCycle', 'monthly')}
                >
                  <ThemedText
                    style={[
                      styles.billingText,
                      formData.billingCycle === 'monthly' && styles.billingTextSelected,
                    ]}
                  >
                    Monthly
                  </ThemedText>
                  <ThemedText style={styles.billingPrice}>$44.99/mo</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.billingOption,
                    formData.billingCycle === 'annual' && styles.billingOptionSelected,
                  ]}
                  onPress={() => updateField('billingCycle', 'annual')}
                >
                  <View style={styles.saveBadge}>
                    <ThemedText style={styles.saveText}>Save 17%</ThemedText>
                  </View>
                  <ThemedText
                    style={[
                      styles.billingText,
                      formData.billingCycle === 'annual' && styles.billingTextSelected,
                    ]}
                  >
                    Annual
                  </ThemedText>
                  <ThemedText style={styles.billingPrice}>$449.99/yr</ThemedText>
                  <ThemedText style={styles.billingSubtext}>$37.50/mo</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContent}>
            <View style={styles.iconContainer}>
              <Ionicons name="mail" size={64} color={Colors.anchorBlue} />
            </View>
            
            <ThemedText style={styles.stepTitle}>Invite Family Members</ThemedText>
            <ThemedText style={styles.stepDescription}>
              Add email addresses to invite family members. They'll receive an invitation code to join.
            </ThemedText>

            <View style={styles.invitesContainer}>
              {formData.initialInvites.map((email, index) => (
                <View key={index} style={styles.inviteInputRow}>
                  <View style={styles.inviteNumber}>
                    <ThemedText style={styles.inviteNumberText}>{index + 1}</ThemedText>
                  </View>
                  <TextInput
                    style={[
                      styles.inviteInput,
                      email && !isValidEmail(email) && styles.inviteInputError,
                    ]}
                    value={email}
                    onChangeText={(text) => updateInvite(index, text)}
                    placeholder="family@example.com"
                    placeholderTextColor={Colors.textGray}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {email && !isValidEmail(email) && (
                    <Ionicons name="alert-circle" size={20} color={Colors.error} />
                  )}
                </View>
              ))}
            </View>

            <View style={styles.infoBox}>
              <Ionicons name="information-circle" size={20} color={Colors.anchorBlue} />
              <ThemedText style={styles.infoText}>
                You can skip this step and invite members later from the Family Dashboard.
              </ThemedText>
            </View>
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.anchorBlue} />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>Family Setup</ThemedText>
          <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
            <ThemedText style={styles.skipText}>Skip</ThemedText>
          </TouchableOpacity>
        </View>

        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          {[1, 2, 3].map((step) => (
            <View
              key={step}
              style={[
                styles.progressDot,
                step <= currentStep && styles.progressDotActive,
              ]}
            />
          ))}
        </View>

        {/* Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {renderStepContent()}
        </ScrollView>

        {/* Footer Actions */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.nextButton,
              (currentStep === 1 && !canProceedStep1) ||
              (currentStep === 2 && !canProceedStep2) ||
              isCreating
                ? styles.nextButtonDisabled
                : {},
            ]}
            onPress={handleNext}
            disabled={
              (currentStep === 1 && !canProceedStep1) ||
              (currentStep === 2 && !canProceedStep2) ||
              isCreating
            }
          >
            <ThemedText style={styles.nextButtonText}>
              {isCreating
                ? 'Creating...'
                : currentStep === 3
                ? 'Create Family'
                : 'Next'}
            </ThemedText>
            {!isCreating && (
              <Ionicons
                name={currentStep === 3 ? 'checkmark' : 'arrow-forward'}
                size={20}
                color={Colors.hopeWhite}
              />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const createStyles = (fonts: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.hopeWhite,
    },
    keyboardView: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: Colors.lightGray,
    },
    backButton: {
      padding: 8,
    },
    headerTitle: {
      fontSize: 18,
      fontFamily: fonts.semiBold,
      color: Colors.anchorBlue,
    },
    skipButton: {
      padding: 8,
    },
    skipText: {
      fontSize: 16,
      fontFamily: fonts.medium,
      color: Colors.textGray,
    },
    progressContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 20,
      gap: 12,
    },
    progressDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: Colors.lightGray,
    },
    progressDotActive: {
      backgroundColor: Colors.anchorBlue,
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 24,
    },
    stepContent: {
      alignItems: 'center',
    },
    iconContainer: {
      marginBottom: 24,
    },
    stepTitle: {
      fontSize: 28,
      fontFamily: fonts.bold,
      color: Colors.anchorBlue,
      textAlign: 'center',
      marginBottom: 12,
    },
    stepDescription: {
      fontSize: 16,
      fontFamily: fonts.regular,
      color: Colors.textGray,
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: 32,
      paddingHorizontal: 20,
    },
    inputContainer: {
      width: '100%',
      marginBottom: 24,
    },
    inputLabel: {
      fontSize: 16,
      fontFamily: fonts.semiBold,
      color: Colors.text,
      marginBottom: 8,
    },
    textInput: {
      borderWidth: 2,
      borderColor: Colors.lightGray,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      fontFamily: fonts.regular,
      color: Colors.text,
      backgroundColor: Colors.hopeWhite,
    },
    inputHint: {
      fontSize: 14,
      fontFamily: fonts.regular,
      color: Colors.textGray,
      marginTop: 6,
      textAlign: 'right',
    },
    exampleBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Colors.lightGray,
      borderRadius: 12,
      padding: 16,
      width: '100%',
      gap: 12,
    },
    exampleText: {
      flex: 1,
      fontSize: 14,
      fontFamily: fonts.regular,
      color: Colors.textGray,
      lineHeight: 20,
    },
    capacitySelector: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 12,
      marginBottom: 32,
      width: '100%',
    },
    capacityOption: {
      width: 80,
      height: 80,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: Colors.lightGray,
      backgroundColor: Colors.hopeWhite,
      alignItems: 'center',
      justifyContent: 'center',
    },
    capacityOptionSelected: {
      borderColor: Colors.anchorBlue,
      backgroundColor: Colors.anchorBlue + '10',
    },
    capacityText: {
      fontSize: 24,
      fontFamily: fonts.bold,
      color: Colors.text,
    },
    capacityTextSelected: {
      color: Colors.anchorBlue,
    },
    capacityLabel: {
      fontSize: 12,
      fontFamily: fonts.regular,
      color: Colors.textGray,
      marginTop: 4,
    },
    capacityLabelSelected: {
      color: Colors.anchorBlue,
    },
    billingSection: {
      width: '100%',
      marginTop: 8,
    },
    billingOptions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 12,
    },
    billingOption: {
      flex: 1,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: Colors.lightGray,
      backgroundColor: Colors.hopeWhite,
      padding: 16,
      alignItems: 'center',
      position: 'relative',
    },
    billingOptionSelected: {
      borderColor: Colors.anchorBlue,
      backgroundColor: Colors.anchorBlue + '10',
    },
    saveBadge: {
      position: 'absolute',
      top: -8,
      right: 8,
      backgroundColor: Colors.growthGreen,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    saveText: {
      fontSize: 10,
      fontFamily: fonts.bold,
      color: Colors.hopeWhite,
    },
    billingText: {
      fontSize: 16,
      fontFamily: fonts.semiBold,
      color: Colors.text,
      marginBottom: 4,
    },
    billingTextSelected: {
      color: Colors.anchorBlue,
    },
    billingPrice: {
      fontSize: 20,
      fontFamily: fonts.bold,
      color: Colors.anchorBlue,
    },
    billingSubtext: {
      fontSize: 12,
      fontFamily: fonts.regular,
      color: Colors.textGray,
      marginTop: 2,
    },
    invitesContainer: {
      width: '100%',
      gap: 12,
      marginBottom: 24,
    },
    inviteInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    inviteNumber: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: Colors.anchorBlue,
      alignItems: 'center',
      justifyContent: 'center',
    },
    inviteNumberText: {
      fontSize: 14,
      fontFamily: fonts.semiBold,
      color: Colors.hopeWhite,
    },
    inviteInput: {
      flex: 1,
      borderWidth: 2,
      borderColor: Colors.lightGray,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      fontFamily: fonts.regular,
      color: Colors.text,
      backgroundColor: Colors.hopeWhite,
    },
    inviteInputError: {
      borderColor: Colors.error,
    },
    infoBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Colors.anchorBlue + '10',
      borderRadius: 12,
      padding: 16,
      width: '100%',
      gap: 12,
    },
    infoText: {
      flex: 1,
      fontSize: 14,
      fontFamily: fonts.regular,
      color: Colors.anchorBlue,
      lineHeight: 20,
    },
    footer: {
      padding: 20,
      borderTopWidth: 1,
      borderTopColor: Colors.lightGray,
    },
    nextButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors.anchorBlue,
      borderRadius: 12,
      paddingVertical: 16,
      gap: 8,
    },
    nextButtonDisabled: {
      backgroundColor: Colors.textGray,
    },
    nextButtonText: {
      fontSize: 18,
      fontFamily: fonts.semiBold,
      color: Colors.hopeWhite,
    },
  });

export default withErrorBoundary(OnboardingFamilySetupScreen, 'OnboardingFamilySetupScreen');
