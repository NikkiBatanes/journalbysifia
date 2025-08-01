import React, { createContext, useContext, useState, ReactNode } from 'react';

interface EditModeContextType {
  isGlobalEditMode: boolean;
  setGlobalEditMode: (isEdit: boolean) => void;
  toggleGlobalEditMode: () => void;
}

const EditModeContext = createContext<EditModeContextType | undefined>(undefined);

interface EditModeProviderProps {
  children: ReactNode;
}

export const EditModeProvider: React.FC<EditModeProviderProps> = ({ children }) => {
  const [isGlobalEditMode, setIsGlobalEditMode] = useState(false);

  const setGlobalEditMode = (isEdit: boolean) => {
    setIsGlobalEditMode(isEdit);
  };

  const toggleGlobalEditMode = () => {
    setIsGlobalEditMode(!isGlobalEditMode);
  };

  return (
    <EditModeContext.Provider
      value={{
        isGlobalEditMode,
        setGlobalEditMode,
        toggleGlobalEditMode,
      }}
    >
      {children}
    </EditModeContext.Provider>
  );
};

export const useEditMode = (): EditModeContextType => {
  const context = useContext(EditModeContext);
  if (context === undefined) {
    throw new Error('useEditMode must be used within an EditModeProvider');
  }
  return context;
};

// Safe version that returns null when provider is not available
export const useEditModeSafe = (): EditModeContextType | null => {
  const context = useContext(EditModeContext);
  return context || null;
};
