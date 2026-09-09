import React from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';

interface ContentSafetyAlertProps {
  visible: boolean;
  onClose: () => void;
  onSelectAlternative?: (alternative: string) => void;
  message: string;
  alternatives?: string[];
  category?: string;
}

export const ContentSafetyAlert: React.FC<ContentSafetyAlertProps> = ({
  visible,
  onClose,
  onSelectAlternative,
  message,
  alternatives = [],
  category: _category,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <ScrollView style={styles.scrollView}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerIcon}>🙏</Text>
              <Text style={styles.title}>Walking in God's Love</Text>
            </View>

            {/* Message */}
            <Text style={styles.message}>{message}</Text>

            {/* Alternatives Section */}
            {alternatives.length > 0 && (
              <View style={styles.alternativesSection}>
                <Text style={styles.alternativesTitle}>
                  Instead, let's create a playbook for:
                </Text>
                {alternatives.map((alternative, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.alternativeButton}
                    onPress={() => {
                      onSelectAlternative?.(alternative);
                      onClose();
                    }}
                  >
                    <Text style={styles.alternativeIcon}>✨</Text>
                    <Text style={styles.alternativeText}>{alternative}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Support Resources */}
            <View style={styles.supportSection}>
              <Text style={styles.supportTitle}>Need Someone to Talk To?</Text>
              <Text style={styles.supportText}>
                We encourage you to speak with:
              </Text>
              <Text style={styles.supportItem}>• A Christian counselor or pastor</Text>
              <Text style={styles.supportItem}>• A trusted church leader</Text>
              <Text style={styles.supportItem}>• A mental health professional</Text>
            </View>
          </ScrollView>

          {/* Close Button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
          >
            <Text style={styles.closeButtonText}>I Understand</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    maxWidth: 480,
    width: '100%',
    maxHeight: '85%',
    overflow: 'hidden',
  },
  scrollView: {
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  headerIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    color: Colors.textGray,
    marginBottom: 24,
    textAlign: 'center',
  },
  alternativesSection: {
    marginBottom: 24,
  },
  alternativesTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 16,
  },
  alternativeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.lightBackground,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  alternativeIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  alternativeText: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500',
  },
  supportSection: {
    backgroundColor: Colors.sanctuaryWhite,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  supportTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  supportText: {
    fontSize: 14,
    color: Colors.textGray,
    marginBottom: 8,
  },
  supportItem: {
    fontSize: 14,
    color: Colors.textGray,
    marginBottom: 4,
  },
  closeButton: {
    backgroundColor: Colors.sage,
    padding: 16,
    margin: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
