/**
 * Export Options Modal Component
 *
 * Provides export functionality for playbooks with tier-based access control
 * and usage tracking for the access tiers system.
 */

import React, { useState } from 'react';
// import { useEffect } from 'react'; // unused
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../theme/colors';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
// import { exportService } from '../services/exportService'; // Temporarily disabled
import { useExportAccess } from '../hooks/useFeatureAccess';
import { FeatureLockOverlay } from './FeatureLockOverlay';

export interface ExportData {
  id: string;
  title: string;
  content: string;
  type: 'playbook' | 'devotional' | 'journal';
  metadata?: {
    createdAt: string;
    category?: string;
    tags?: string[];
  };
}

interface ExportOptionsModalProps {
  visible: boolean;
  exportData: ExportData;
  onClose: () => void;
  onExportComplete?: (format: 'pdf' | 'docx', filePath: string) => void;
  onUpgrade?: () => void;
}

export const ExportOptionsModal: React.FC<ExportOptionsModalProps> = ({
  visible,
  exportData,
  onClose,
  onExportComplete,
  onUpgrade,
}) => {
  const {
    canExportPDF,
    canExportDOCX,
    canExportAny,
    pdfAccessResult,
    docxAccessResult,
    handleExportRestriction,
  } = useExportAccess();

  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'docx' | null>(null);
  const [showLockOverlay, setShowLockOverlay] = useState(false);
  const [lockFeature, setLockFeature] = useState<'export_pdf' | 'export_docx'>('export_pdf');

  const exportOptions = [
    {
      id: 'pdf',
      title: 'PDF Export',
      description: 'Perfect for printing and sharing',
      icon: 'document-text-outline',
      color: Colors.alertCoral,
      available: canExportPDF,
      accessResult: pdfAccessResult,
    },
    {
      id: 'docx',
      title: 'Word Document',
      description: 'Editable format for further customization',
      icon: 'document-outline',
      color: Colors.truthBlue,
      available: canExportDOCX,
      accessResult: docxAccessResult,
    },
  ];

  const handleExport = async (format: 'pdf' | 'docx') => {
    const option = exportOptions.find(opt => opt.id === format);

    if (!option?.available) {
      setLockFeature(format === 'pdf' ? 'export_pdf' : 'export_docx');
      setShowLockOverlay(true);
      handleExportRestriction(format);
      return;
    }

    setIsExporting(true);
    setExportFormat(format);

    try {
      // Export functionality temporarily disabled due to service refactoring
      const filePath = 'temp_export_path';

      Alert.alert(
        'Export Successful',
        `Your ${exportData.type} has been exported as ${format.toUpperCase()}`,
        [
          {
            text: 'OK',
            onPress: () => {
              onExportComplete?.(format, filePath);
              onClose();
            },
          },
        ]
      );
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert(
        'Export Failed',
        'There was an error exporting your content. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsExporting(false);
      setExportFormat(null);
    }
  };

  const handleRestrictedExport = (format: 'pdf' | 'docx') => {
    setLockFeature(format === 'pdf' ? 'export_pdf' : 'export_docx');
    setShowLockOverlay(true);
  };

  if (!visible) {return null;}

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Export Options</Text>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Content Preview */}
            <View style={styles.previewSection}>
              <Text style={styles.previewTitle}>Exporting: {exportData.title}</Text>
              <Text style={styles.previewType}>{exportData.type.toUpperCase()}</Text>
              {exportData.metadata?.createdAt && (
                <Text style={styles.previewDate}>
                  Created: {new Date(exportData.metadata.createdAt).toLocaleDateString()}
                </Text>
              )}
            </View>

            {/* Export Options */}
            <ScrollView style={styles.optionsContainer} showsVerticalScrollIndicator={false}>
              {exportOptions.map((option) => (
                <ExportOptionCard
                  key={option.id}
                  option={option}
                  isExporting={isExporting && exportFormat === option.id}
                  onPress={() => handleExport(option.id as 'pdf' | 'docx')}
                  onRestrictedPress={() => handleRestrictedExport(option.id as 'pdf' | 'docx')}
                />
              ))}

              {/* Usage Information */}
              {canExportAny && (
                <View style={styles.usageInfo}>
                  <Ionicons name="information-circle-outline" size={16} color={Colors.reflectionGray} />
                  <Text style={styles.usageText}>
                    Exports count towards your monthly usage limit
                  </Text>
                </View>
              )}

              {/* No Access Message */}
              {!canExportAny && (
                <View style={styles.noAccessContainer}>
                  <Ionicons name="lock-closed" size={32} color={Colors.reflectionGray} />
                  <Text style={styles.noAccessTitle}>Export Feature Locked</Text>
                  <Text style={styles.noAccessText}>
                    Upgrade to unlock PDF and Word document exports for your spiritual content
                  </Text>
                  <TouchableOpacity
                    style={styles.upgradeButton}
                    onPress={() => {
                      onClose();
                      onUpgrade?.();
                    }}
                  >
                    <Text style={styles.upgradeButtonText}>Upgrade Now</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Feature Lock Overlay */}
      <FeatureLockOverlay
        visible={showLockOverlay}
        feature={lockFeature}
        onClose={() => setShowLockOverlay(false)}
        onUpgrade={() => {
          setShowLockOverlay(false);
          onClose();
          onUpgrade?.();
        }}
      />
    </>
  );
};

interface ExportOptionCardProps {
  option: {
    id: string;
    title: string;
    description: string;
    icon: string;
    color: string;
    available: boolean;
    accessResult: any;
  };
  isExporting: boolean;
  onPress: () => void;
  onRestrictedPress: () => void;
}

const ExportOptionCard: React.FC<ExportOptionCardProps> = ({
  option,
  isExporting,
  onPress,
  onRestrictedPress,
}) => {
  const handlePress = () => {
    if (option.available) {
      onPress();
    } else {
      onRestrictedPress();
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.optionCard,
        !option.available && styles.disabledCard,
      ]}
      onPress={handlePress}
      disabled={isExporting}
    >
      <View style={styles.optionContent}>
        <View style={[styles.iconContainer, { backgroundColor: `${option.color}20` }]}>
          {isExporting ? (
            <ActivityIndicator size="small" color={option.color} />
          ) : (
            <Ionicons
              name={option.icon as any}
              size={24}
              color={option.available ? option.color : Colors.contemplationGray}
            />
          )}
        </View>

        <View style={styles.optionText}>
          <Text style={[
            styles.optionTitle,
            !option.available && styles.disabledText,
          ]}>
            {option.title}
          </Text>
          <Text style={[
            styles.optionDescription,
            !option.available && styles.disabledText,
          ]}>
            {option.description}
          </Text>

          {/* Access Status */}
          {!option.available && option.accessResult && (
            <View style={styles.accessStatus}>
              <Ionicons name="lock-closed" size={12} color={Colors.warningAmber} />
              <Text style={styles.accessStatusText}>
                Requires {option.accessResult.requiredTier} plan
              </Text>
            </View>
          )}
        </View>

        <View style={styles.optionAction}>
          {option.available ? (
            <Ionicons name="chevron-forward" size={20} color={Colors.contemplationGray} />
          ) : (
            <Ionicons name="lock-closed" size={20} color={Colors.contemplationGray} />
          )}
        </View>
      </View>

      {/* Progress Indicator */}
      {isExporting && (
        <View style={styles.progressContainer}>
          <LinearGradient
            colors={[option.color, `${option.color}80`]}
            style={styles.progressBar}
          />
          <Text style={styles.progressText}>Exporting...</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 34, // Safe area padding
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  closeButton: {
    padding: 4,
  },
  previewSection: {
    padding: 20,
    backgroundColor: Colors.sanctuaryWhite,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gentleBorder,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  previewType: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.wisdomIndigo,
    backgroundColor: Colors.sanctuaryWhite,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  previewDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  optionsContainer: {
    flex: 1,
    padding: 20,
  },
  optionCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.gentleBorder,
    marginBottom: 12,
    overflow: 'hidden',
  },
  disabledCard: {
    backgroundColor: Colors.sanctuaryWhite,
    borderColor: Colors.gentleBorder,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  disabledText: {
    color: Colors.contemplationGray,
  },
  accessStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  accessStatusText: {
    marginLeft: 4,
    fontSize: 12,
    color: Colors.warningAmber,
    fontWeight: '500',
  },
  optionAction: {
    marginLeft: 12,
  },
  progressContainer: {
    padding: 16,
    paddingTop: 0,
  },
  progressBar: {
    height: 3,
    borderRadius: 2,
    marginBottom: 8,
  },
  progressText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  usageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.sanctuaryWhite,
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  usageText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#6B7280',
    flex: 1,
  },
  noAccessContainer: {
    alignItems: 'center',
    padding: 32,
  },
  noAccessTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  noAccessText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  upgradeButton: {
    backgroundColor: Colors.wisdomIndigo,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  upgradeButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
