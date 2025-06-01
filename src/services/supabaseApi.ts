import AsyncStorage from '@react-native-async-storage/async-storage';

// Supabase project details
const SUPABASE_URL = 'https://aesmrjinczhknchlrsmt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlc21yamluY3poa25jaGxyc210Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg3NjYxOTMsImV4cCI6MjA2NDM0MjE5M30.x7XMjrm9WWlvEdc5eaK7Z5Fy-V_85qMJQ7pInsrKIyM';
const SESSION_KEY = '@supabase_session';

// Session management
export const storeSession = async (session: any) => {
  try {
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return true;
  } catch (error) {
    console.error('Error storing session:', error);
    return false;
  }
};

export const getSession = async () => {
  try {
    const session = await AsyncStorage.getItem(SESSION_KEY);
    return session ? JSON.parse(session) : null;
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
};

export const clearSession = async () => {
  try {
    await AsyncStorage.removeItem(SESSION_KEY);
    return true;
  } catch (error) {
    console.error('Error clearing session:', error);
    return false;
  }
};

// Check if user is authenticated
export const checkAuth = async () => {
  const session = await getSession();
  return !!session?.access_token;
};

// Helper to get the REST endpoint
function getApiUrl(table: string) {
  return `${SUPABASE_URL}/rest/v1/${table}`;
}

// Helper to get default headers
function getHeaders() {
  return {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };
}

// Example: Fetch all rows from a table
export async function fetchTable(table: string) {
  const res = await fetch(getApiUrl(table), {
    method: 'GET',
    headers: getHeaders(),
  });
  console.log('Supabase fetch response:', res);
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}

// Example: Insert a row
export async function insertRow(table: string, data: Record<string, any>) {
  const res = await fetch(getApiUrl(table), {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify([data]),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}

// Example: Update a row by primary key (id)
export async function updateRow(table: string, id: string, data: Record<string, any>) {
  const url = getApiUrl(table) + `?id=eq.${id}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}

// Example: Delete a row by primary key (id)
export async function deleteRow(table: string, id: string) {
  const url = getApiUrl(table) + `?id=eq.${id}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}

// Sign in with email/password
export async function signIn(email: string, password: string) {
  try {
    console.log('Attempting to sign in with:', email);
    console.log('Supabase URL:', SUPABASE_URL);
    console.log('Supabase Key:', SUPABASE_ANON_KEY ? 'Key exists' : 'Key is missing');
    
    // First, let's try to sign in with the password grant type
    let response;
    let data;
    let responseText;
    
    try {
      response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ 
          email, 
          password,
          client_id: SUPABASE_ANON_KEY,
          grant_type: 'password'
        }),
      });
      
      responseText = await response.text();
      console.log('Raw response:', responseText);
      
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (e) {
        console.error('Failed to parse response as JSON:', responseText);
        throw new Error('Invalid server response format');
      }
      
      // If we get a 400 error, it might be because the user needs to confirm their email
      if (response.status === 400 && data.msg?.includes('Email not confirmed')) {
        throw new Error('Please check your email to confirm your account before signing in.');
      }
      
      // If we get a 401 error, the credentials are invalid
      if (response.status === 401) {
        throw new Error('Invalid login credentials. Please check your email and password.');
      }
      
      // If we get any other error status, throw with the error message
      if (!response.ok) {
        throw new Error(data.error_description || data.message || 'Authentication failed');
      }
      
    } catch (error: any) {
      console.error('Sign in error details:', {
        status: response?.status,
        statusText: response?.statusText,
        error: error?.message || 'Unknown error',
        response: data
      });
      throw error; // Re-throw to be caught by the outer catch
    }
    
    console.log('Sign in response status:', response.status);
    console.log('Sign in response headers:', Object.fromEntries(response.headers.entries()));
    console.log('Sign in response data:', data);
    
    if (response.ok) {
      console.log('Sign in successful, storing session');
      await storeSession(data);
      return { data, error: null };
    } else {
      console.error('Sign in failed with status:', response.status);
      console.error('Error details:', data);
      
      // Return a more detailed error object
      return { 
        data: null, 
        error: {
          ...data,
          status: response.status,
          statusText: response.statusText,
          message: data?.error_description || data?.message || 'Authentication failed'
        } 
      };
    }
  } catch (error) {
    console.error('Sign in error:', error);
    return { data: null, error: { message: 'Network error: ' + (error as Error).message } };
  }
}

// Sign up with email/password
export async function signUp(email: string, password: string) {
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    if (response.ok) {
      await storeSession(data);
      return { data, error: null };
    } else {
      return { data: null, error: data };
    }
  } catch (error) {
    console.error('Sign up error:', error);
    return { data: null, error: { message: 'Network error' } };
  }
}

// Sign out
export async function signOut() {
  await clearSession();
}
