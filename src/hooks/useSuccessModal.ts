import { useState, useCallback } from 'react';
import { Keyboard } from 'react-native';
import { SuccessModalConfig } from '../components/NewSuccessModal';

export interface UseSuccessModalReturn {
  isVisible: boolean;
  config: SuccessModalConfig | null;
  showSuccess: (config: SuccessModalConfig) => void;
  hideSuccess: () => void;
  handleDone: () => void;
  handleEdit: () => void;
}

export const useSuccessModal = (
  onDone?: () => void,
  onEdit?: () => void
): UseSuccessModalReturn => {
  const [isVisible, setIsVisible] = useState(false);
  const [config, setConfig] = useState<SuccessModalConfig | null>(null);

  const showSuccess = useCallback((newConfig: SuccessModalConfig) => {
    setConfig(newConfig);
    setIsVisible(true);
  }, []);

  const hideSuccess = useCallback(() => {
    setIsVisible(false);
    setConfig(null);
  }, []);

  const handleDone = useCallback(() => {
    // Dismiss keyboard BEFORE closing the modal. NewSuccessModal is a
    // transparent overlay — when it closes iOS restores focus to whatever
    // TextInput was active beneath it, briefly re-showing the keyboard.
    // Dismissing first prevents that focus-restoration from firing.
    Keyboard.dismiss();
    hideSuccess();
    onDone?.();
  }, [hideSuccess, onDone]);

  const handleEdit = useCallback(() => {
    hideSuccess();
    onEdit?.();
  }, [hideSuccess, onEdit]);

  return {
    isVisible,
    config,
    showSuccess,
    hideSuccess,
    handleDone,
    handleEdit,
  };
};
