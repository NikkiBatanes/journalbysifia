import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeJsonParse } from '../utils/safeJsonParse';

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
      if (stored) {setNameState(stored);}
    });
    // Load id from Supabase session in AsyncStorage
    AsyncStorage.getItem('@supabase_session').then((sessionStr) => {
      if (sessionStr) {
        try {
          const session = safeJsonParse<{user?: {id?: string}; user_id?: string}>(sessionStr, {
            fallback: null,
            context: 'UserContext:session',
          });
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

// Helper function to safely get session from web storage
type SessionData = {
  user?: {
    email?: string;
  };
};

const getWebSession = (): SessionData | null => {
  // This is a no-op in React Native
  // For web, this will be replaced with the actual implementation during build
  return null;
};

export const useUser = () => {
  const context = useContext(UserContext);

  // If we already have a name, return the context as is
  if (context.name) {
    return context;
  }

  // Try to get email from Supabase session (web only)
  const session = getWebSession();
  if (session?.user?.email) {
    const email = session.user.email;
    if (email.includes('@')) {
      return { ...context, name: email.split('@')[0] };
    }
  }

  // Return original context if no session found
  return context;
};

