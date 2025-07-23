import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabaseApi';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import { diagnoseAuth, fixAuthSession, testDatabaseWithCurrentAuth } from '../../utils/authFix';

export const AuthDebugger: React.FC = () => {
  const { user, accessToken, isAuthenticated } = useAuth();
  const [diagnosing, setDiagnosing] = useState(false);

  const testDatabaseConnection = async () => {
    console.log('🔍 Testing Database Connection...');
    
    // Log current auth state
    console.log('Auth State:', {
      isAuthenticated,
      hasUser: !!user,
      userId: user?.id,
      userIdType: typeof user?.id,
      userIdLength: user?.id?.length,
      hasAccessToken: !!accessToken,
      tokenLength: accessToken?.length,
    });

    // Test Supabase session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    console.log('Supabase Session:', {
      hasSession: !!session,
      sessionUserId: session?.user?.id,
      sessionExpiry: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : 'No expiry',
      sessionError: sessionError?.message,
    });

    // Test database insert with current user
    if (user?.id) {
      try {
        const testEntry = {
          user_id: user.id,
          content_type: 'gratitude' as const,
          content: 'Auth debug test - ' + new Date().toISOString(),
          selected_date: new Date().toISOString().split('T')[0],
        };

        console.log('Attempting insert with:', testEntry);

        const { data, error } = await supabase
          .from('journal_entries')
          .insert(testEntry)
          .select()
          .single();

        if (error) {
          console.error('❌ Insert failed:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
          });
        } else {
          console.log('✅ Insert successful:', data);
          
          // Clean up test data
          await supabase
            .from('journal_entries')
            .delete()
            .eq('id', data.id);
          console.log('🧹 Test data cleaned up');
        }
      } catch (err) {
        console.error('❌ Unexpected error:', err);
      }
    } else {
      console.log('❌ No user ID available for testing');
    }
  };

  const checkSupabaseAuth = async () => {
    const { data: { user: supabaseUser }, error } = await supabase.auth.getUser();
    console.log('Supabase Auth Check:', {
      hasSupabaseUser: !!supabaseUser,
      supabaseUserId: supabaseUser?.id,
      contextUserId: user?.id,
      idsMatch: supabaseUser?.id === user?.id,
      error: error?.message,
    });
  };

  const runFullDiagnostic = async () => {
    setDiagnosing(true);
    try {
      console.log('🔍 Running Full Authentication Diagnostic...');
      const diagnostic = await diagnoseAuth();
      
      console.log('📊 Diagnostic Results:', diagnostic);
      
      let alertMessage = 'Authentication Diagnostic Results:\n\n';
      alertMessage += `Supabase Session: ${diagnostic.hasSupabaseSession ? '✅' : '❌'}\n`;
      alertMessage += `User ID Format: ${diagnostic.userIdFormat}\n`;
      alertMessage += `Access Token: ${diagnostic.accessTokenPresent ? '✅' : '❌'}\n`;
      alertMessage += `Session Expired: ${diagnostic.sessionExpired ? '❌' : '✅'}\n\n`;
      
      if (diagnostic.recommendations.length > 0) {
        alertMessage += 'Recommendations:\n';
        diagnostic.recommendations.forEach((rec, index) => {
          alertMessage += `${index + 1}. ${rec}\n`;
        });
      }
      
      Alert.alert('Auth Diagnostic', alertMessage);
    } catch (error) {
      console.error('Diagnostic failed:', error);
      Alert.alert('Error', 'Failed to run diagnostic');
    } finally {
      setDiagnosing(false);
    }
  };

  const fixAuthentication = async () => {
    try {
      console.log('🔧 Attempting to fix authentication...');
      const result = await fixAuthSession();
      
      Alert.alert(
        result.success ? 'Success' : 'Failed',
        result.message
      );
      
      console.log('Fix result:', result);
    } catch (error) {
      console.error('Fix failed:', error);
      Alert.alert('Error', 'Failed to fix authentication');
    }
  };

  const testDatabaseAuth = async () => {
    try {
      console.log('🧪 Testing database with current auth...');
      const result = await testDatabaseWithCurrentAuth();
      
      Alert.alert(
        result.success ? 'Database Test Passed' : 'Database Test Failed',
        result.message
      );
      
      console.log('Database test result:', result);
    } catch (error) {
      console.error('Database test failed:', error);
      Alert.alert('Error', 'Failed to test database');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔍 Auth Debugger</Text>
      
      <View style={styles.section}>
        <Text style={styles.label}>Authentication Status:</Text>
        <Text style={[styles.value, { color: isAuthenticated ? Colors.growthGreen : Colors.alertCoral }]}>
          {isAuthenticated ? '✅ Authenticated' : '❌ Not Authenticated'}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>User ID:</Text>
        <Text style={styles.value}>
          {user?.id || 'No user ID'}
        </Text>
        {user?.id && (
          <Text style={styles.subValue}>
            Length: {user.id.length} | Type: {typeof user.id}
          </Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Access Token:</Text>
        <Text style={styles.value}>
          {accessToken ? `✅ Present (${accessToken.length} chars)` : '❌ Missing'}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>User Email:</Text>
        <Text style={styles.value}>
          {user?.email || 'No email'}
        </Text>
      </View>

      <TouchableOpacity style={styles.button} onPress={testDatabaseConnection}>
        <Text style={styles.buttonText}>Test Database Connection</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={checkSupabaseAuth}>
        <Text style={styles.buttonText}>Check Supabase Auth</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.button, styles.diagnosticButton, diagnosing && styles.disabledButton]} 
        onPress={runFullDiagnostic}
        disabled={diagnosing}
      >
        <Text style={styles.buttonText}>
          {diagnosing ? 'Running Diagnostic...' : '🔍 Full Diagnostic'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, styles.fixButton]} onPress={fixAuthentication}>
        <Text style={styles.buttonText}>🔧 Fix Authentication</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, styles.testButton]} onPress={testDatabaseAuth}>
        <Text style={styles.buttonText}>🧪 Test Database Auth</Text>
      </TouchableOpacity>

      <Text style={styles.note}>
        Check console for detailed logs
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: Colors.hopeWhite,
    margin: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.lightGray,
  },
  title: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    color: Colors.darkGray,
    marginBottom: 15,
    textAlign: 'center',
  },
  section: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: Colors.darkGray,
    marginBottom: 4,
  },
  value: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.mediumGray,
    paddingLeft: 10,
  },
  subValue: {
    fontSize: 11,
    fontFamily: Fonts.regular,
    color: Colors.lightGray,
    paddingLeft: 20,
    fontStyle: 'italic',
  },
  button: {
    backgroundColor: Colors.anchorBlue,
    padding: 12,
    borderRadius: 6,
    marginVertical: 8,
  },
  diagnosticButton: {
    backgroundColor: Colors.faithGold,
  },
  fixButton: {
    backgroundColor: Colors.growthGreen,
  },
  testButton: {
    backgroundColor: Colors.devotionalPurple,
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    color: Colors.hopeWhite,
    fontFamily: Fonts.medium,
    textAlign: 'center',
    fontSize: 14,
  },
  note: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.lightGray,
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
  },
});
