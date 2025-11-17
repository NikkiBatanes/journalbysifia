import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { withErrorBoundary } from '../components/ErrorBoundary/withErrorBoundary';
import { useFamilySubscription } from '../hooks/useFamilySubscription';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { Colors } from '../theme/colors';
import { FamilyNotificationService } from '../services/FamilyNotificationService';

const FamilyInvitationScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { acceptInvitation } = useFamilySubscription();
  const [invitationCode, setInvitationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingInvitations, setPendingInvitations] = useState<any[]>([]);

  const handleAcceptInvitation = async () => {
    if (!invitationCode.trim()) {
      Alert.alert('Error', 'Please enter an invitation code');
      return;
    }

    setLoading(true);
    try {
      const success = await acceptInvitation(invitationCode.trim().toUpperCase());
      if (success) {
        Alert.alert(
          'Success!',
          'You have successfully joined the family subscription!',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('MainTabs' as never),
            },
          ]
        );
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to accept invitation');
    } finally {
      setLoading(false);
    }
  };

  // Load pending invitations
  useEffect(() => {
    const loadInvitations = async () => {
      if (user?.id) {
        const invites = await FamilyNotificationService.getPendingInvitations(user.id);
        setPendingInvitations(invites);
      }
    };
    loadInvitations();
  }, [user?.id]);

  const handleAcceptFromNotification = async (code: string, notificationId: string) => {
    setLoading(true);
    try {
      const success = await acceptInvitation(code);
      if (success) {
        await FamilyNotificationService.markAsRead(notificationId);
        Alert.alert(
          'Success!',
          'You have successfully joined the family subscription!',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('MainTabs' as never),
            },
          ]
        );
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to accept invitation');
    } finally {
      setLoading(false);
    }
  };

  const formatInvitationCode = (text: string) => {
    // Remove any non-alphanumeric characters and convert to uppercase
    const cleaned = text.replace(/[^A-Z0-9]/g, '').toUpperCase();
    // Limit to 8 characters
    return cleaned.slice(0, 8);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.hopeWhite} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Join Family</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Pending Invitations */}
        {pendingInvitations.length > 0 && (
          <View style={styles.invitationsSection}>
            <Text style={styles.sectionTitle}>Pending Invitations</Text>
            {pendingInvitations.map((invite) => (
              <TouchableOpacity
                key={invite.id}
                style={styles.invitationCard}
                onPress={() => handleAcceptFromNotification(invite.data?.invitation_code, invite.id)}
                disabled={loading}
              >
                <View style={styles.invitationIcon}>
                  <Ionicons name="mail" size={24} color={Colors.anchorBlue} />
                </View>
                <View style={styles.invitationContent}>
                  <Text style={styles.invitationTitle}>{invite.title}</Text>
                  <Text style={styles.invitationMessage}>{invite.message}</Text>
                  <Text style={styles.invitationCode}>Code: {invite.data?.invitation_code}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.anchorBlue} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <KeyboardAvoidingView
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.content}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <Ionicons name="people" size={80} color={Colors.anchorBlue} />
          </View>

          {/* Title and Description */}
          <Text style={styles.title}>Join a Family Subscription</Text>
          <Text style={styles.description}>
            Enter the invitation code you received to join a family subscription group and enjoy unlimited access to siFia.
          </Text>

          {/* Invitation Code Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Invitation Code</Text>
            <TextInput
              style={styles.codeInput}
              value={invitationCode}
              onChangeText={(text) => setInvitationCode(formatInvitationCode(text))}
              placeholder="Enter 8-character code"
              placeholderTextColor={Colors.textGray}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={8}
              textAlign="center"
            />
            <Text style={styles.inputHint}>
              The code should be 8 characters long (letters and numbers)
            </Text>
          </View>

          {/* Accept Button */}
          <TouchableOpacity
            style={[styles.acceptButton, loading && styles.acceptButtonDisabled]}
            onPress={handleAcceptInvitation}
            disabled={loading || invitationCode.length !== 8}
          >
            <Text style={styles.acceptButtonText}>
              {loading ? 'Joining...' : 'Join Family'}
            </Text>
          </TouchableOpacity>

          {/* Help Section */}
          <View style={styles.helpSection}>
            <Text style={styles.helpTitle}>Need help?</Text>
            <Text style={styles.helpText}>
              • Ask the family administrator for the invitation code
            </Text>
            <Text style={styles.helpText}>
              • Make sure you enter the code exactly as provided
            </Text>
            <Text style={styles.helpText}>
              • Invitation codes expire after 7 days
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.hopeWhite,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.anchorBlue,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.hopeWhite,
  },
  placeholder: {
    width: 40,
  },
  invitationsSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.hopeWhite,
    marginBottom: 16,
  },
  invitationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.hopeWhite,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  invitationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.anchorBlue + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  invitationContent: {
    flex: 1,
  },
  invitationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  invitationMessage: {
    fontSize: 14,
    color: Colors.textGray,
    marginBottom: 4,
  },
  invitationCode: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.anchorBlue,
    fontFamily: 'monospace',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.anchorBlue,
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: Colors.textGray,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 32,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  codeInput: {
    borderWidth: 2,
    borderColor: Colors.anchorBlue,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 24,
    fontWeight: '600',
    color: Colors.anchorBlue,
    backgroundColor: Colors.lightGray,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  inputHint: {
    fontSize: 14,
    color: Colors.textGray,
    textAlign: 'center',
    marginTop: 8,
  },
  acceptButton: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    marginBottom: 40,
  },
  acceptButtonDisabled: {
    backgroundColor: Colors.textGray,
  },
  acceptButtonText: {
    color: Colors.hopeWhite,
    fontSize: 18,
    fontWeight: '600',
  },
  helpSection: {
    width: '100%',
    backgroundColor: Colors.lightGray,
    borderRadius: 12,
    padding: 20,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.anchorBlue,
    marginBottom: 12,
  },
  helpText: {
    fontSize: 14,
    color: Colors.textGray,
    lineHeight: 20,
    marginBottom: 8,
  },
});

export default withErrorBoundary(FamilyInvitationScreen, 'FamilyInvitationScreen');
