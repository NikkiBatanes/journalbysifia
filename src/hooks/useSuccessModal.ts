import { useState, useCallback } from 'react';
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
