import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const USERNAME_KEY = 'user_name';

type UserContextType = {
  id: string | null;
  name: string;
  setName: (name: string) => void;
  setId: (id: string | null) => void;
};

const UserContext = createContext<UserContextType>({
  id: null,
  name: '',
  setName: () => {},
  setId: () => {},
});

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [name, setNameState] = useState('');
  const [id, setIdState] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(USERNAME_KEY).then((stored) => {
      if (stored) setNameState(stored);
    });
    // Load id from Supabase session in AsyncStorage
    AsyncStorage.getItem('@supabase_session').then((sessionStr) => {
      if (sessionStr) {
        try {
          const session = JSON.parse(sessionStr);
          // Supabase session user id may be at session.user.id or session.user?.id
          const userId = session?.user?.id || session?.user_id || null;
          setIdState(userId);
        } catch (e) {
          setIdState(null);
        }
      }
    });
  }, []);

  const setName = async (newName: string) => {
    setNameState(newName);
    await AsyncStorage.setItem(USERNAME_KEY, newName);
  };

  const setId = (newId: string | null) => {
    setIdState(newId);
    // Optionally persist id if needed
  };

  return (
    <UserContext.Provider value={{ id, name, setName, setId }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  // Fallback: If name is blank, try to get email from Supabase session and use username part
  if (!context.name) {
    // Try to get email from Supabase session
    if (typeof window !== 'undefined' && window.localStorage) {
      const sessionStr = window.localStorage.getItem('@supabase_session');
      if (sessionStr) {
        try {
          const session = JSON.parse(sessionStr);
          const email = session?.user?.email || '';
          if (email && email.includes('@')) {
            return { ...context, name: email.split('@')[0] };
          }
        } catch (e) {}
      }
    }
    // React Native fallback: try AsyncStorage (sync not possible, so skip)
  }
  return context;
};

