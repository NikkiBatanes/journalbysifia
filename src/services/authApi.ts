import { supabase } from './supabaseClient';
import { 
  User, 
  LoginCredentials, 
  RegisterData, 
  AuthError,
  UserPreferences 
} from '../types/auth';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: AuthError;
}

interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

interface SocialLoginData {
  provider: 'google' | 'apple' | 'facebook';
  token: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  };
}

class AuthApiService {
  async login(credentials: LoginCredentials): Promise<ApiResponse<AuthResponse>> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      if (error) {
        return {
          success: false,
          error: {
            code: error.message.includes('Invalid') ? 'INVALID_CREDENTIALS' : 'LOGIN_FAILED',
            message: this.getErrorMessage(error.message),
          },
        };
      }

      if (!data.user || !data.session) {
        return {
          success: false,
          error: {
            code: 'LOGIN_FAILED',
            message: 'Login failed. Please try again.',
          },
        };
      }

      // Get user profile
      const userProfile = await this.getUserProfile(data.user.id);
      
      const user: User = {
        id: data.user.id,
        email: data.user.email!,
        firstName: userProfile?.first_name || '',
        lastName: userProfile?.last_name || '',
        displayName: userProfile?.display_name || `${userProfile?.first_name} ${userProfile?.last_name}`.trim(),
        avatar: userProfile?.avatar_url,
        phoneNumber: userProfile?.phone_number,
        dateOfBirth: userProfile?.date_of_birth,
        gender: userProfile?.gender,
        spiritualLevel: userProfile?.spiritual_level || 'beginner',
        denomination: userProfile?.denomination,
        churchName: userProfile?.church_name,
        level: userProfile?.level || 1,
        experience: userProfile?.experience || 0,
        streak: userProfile?.streak || 0,
        longestStreak: userProfile?.longest_streak || 0,
        totalPoints: userProfile?.total_points || 0,
        badges: userProfile?.badges || [],
        preferences: userProfile?.preferences || this.getDefaultPreferences(),
        createdAt: data.user.created_at,
        updatedAt: userProfile?.updated_at || data.user.created_at,
        lastLoginAt: new Date().toISOString(),
        emailVerified: data.user.email_confirmed_at !== null,
        phoneVerified: data.user.phone_confirmed_at !== null,
      };

      // Update last login
      await this.updateLastLogin(data.user.id);

      return {
        success: true,
        data: {
          user,
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'LOGIN_FAILED',
          message: 'An unexpected error occurred. Please try again.',
        },
      };
    }
  }

  async register(data: RegisterData & { preferences: UserPreferences }): Promise<ApiResponse<AuthResponse>> {
    try {
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            first_name: data.firstName,
            last_name: data.lastName,
            display_name: `${data.firstName} ${data.lastName}`.trim(),
          },
        },
      });

      if (error) {
        return {
          success: false,
          error: {
            code: error.message.includes('already') ? 'EMAIL_EXISTS' : 'REGISTRATION_FAILED',
            message: this.getErrorMessage(error.message),
          },
        };
      }

      if (!authData.user || !authData.session) {
        return {
          success: false,
          error: {
            code: 'REGISTRATION_FAILED',
            message: 'Registration failed. Please try again.',
          },
        };
      }

      // Create user profile
      const userProfile = {
        id: authData.user.id,
        email: authData.user.email!,
        first_name: data.firstName,
        last_name: data.lastName,
        display_name: `${data.firstName} ${data.lastName}`.trim(),
        level: 1,
        experience: 0,
        streak: 0,
        longest_streak: 0,
        total_points: 0,
        badges: [],
        preferences: data.preferences,
        spiritual_level: 'beginner',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert([userProfile]);

      if (profileError) {
        console.error('Profile creation error:', profileError);
        // Continue anyway, profile can be created later
      }

      const user: User = {
        id: authData.user.id,
        email: authData.user.email!,
        firstName: data.firstName,
        lastName: data.lastName,
        displayName: `${data.firstName} ${data.lastName}`.trim(),
        level: 1,
        experience: 0,
        streak: 0,
        longestStreak: 0,
        totalPoints: 0,
        badges: [],
        preferences: data.preferences,
        spiritualLevel: 'beginner',
        createdAt: authData.user.created_at,
        updatedAt: new Date().toISOString(),
        emailVerified: false,
        phoneVerified: false,
      };

      return {
        success: true,
        data: {
          user,
          accessToken: authData.session.access_token,
          refreshToken: authData.session.refresh_token,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'REGISTRATION_FAILED',
          message: 'An unexpected error occurred. Please try again.',
        },
      };
    }
  }

  async socialLogin(socialData: SocialLoginData): Promise<ApiResponse<AuthResponse>> {
    try {
      let authResponse;

      if (socialData.provider === 'google') {
        authResponse = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: socialData.token,
        });
      } else if (socialData.provider === 'apple') {
        authResponse = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: socialData.token,
        });
      } else {
        return {
          success: false,
          error: {
            code: 'UNSUPPORTED_PROVIDER',
            message: 'Social login provider not supported',
          },
        };
      }

      const { data, error } = authResponse;

      if (error) {
        return {
          success: false,
          error: {
            code: 'SOCIAL_LOGIN_FAILED',
            message: this.getErrorMessage(error.message),
          },
        };
      }

      if (!data.user || !data.session) {
        return {
          success: false,
          error: {
            code: 'SOCIAL_LOGIN_FAILED',
            message: 'Social login failed. Please try again.',
          },
        };
      }

      // Check if user profile exists, create if not
      let userProfile = await this.getUserProfile(data.user.id);
      
      if (!userProfile) {
        const newProfile = {
          id: data.user.id,
          email: data.user.email!,
          first_name: socialData.user.firstName,
          last_name: socialData.user.lastName,
          display_name: `${socialData.user.firstName} ${socialData.user.lastName}`.trim(),
          avatar_url: socialData.user.avatar,
          level: 1,
          experience: 0,
          streak: 0,
          longest_streak: 0,
          total_points: 0,
          badges: [],
          preferences: this.getDefaultPreferences(),
          spiritual_level: 'beginner',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert([newProfile]);

        if (!profileError) {
          userProfile = newProfile;
        }
      }

      const user: User = {
        id: data.user.id,
        email: data.user.email!,
        firstName: userProfile?.first_name || socialData.user.firstName,
        lastName: userProfile?.last_name || socialData.user.lastName,
        displayName: userProfile?.display_name || `${socialData.user.firstName} ${socialData.user.lastName}`.trim(),
        avatar: userProfile?.avatar_url || socialData.user.avatar,
        level: userProfile?.level || 1,
        experience: userProfile?.experience || 0,
        streak: userProfile?.streak || 0,
        longestStreak: userProfile?.longest_streak || 0,
        totalPoints: userProfile?.total_points || 0,
        badges: userProfile?.badges || [],
        preferences: userProfile?.preferences || this.getDefaultPreferences(),
        spiritualLevel: userProfile?.spiritual_level || 'beginner',
        createdAt: data.user.created_at,
        updatedAt: userProfile?.updated_at || data.user.created_at,
        lastLoginAt: new Date().toISOString(),
        emailVerified: data.user.email_confirmed_at !== null,
        phoneVerified: data.user.phone_confirmed_at !== null,
      };

      // Update last login
      await this.updateLastLogin(data.user.id);

      return {
        success: true,
        data: {
          user,
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'SOCIAL_LOGIN_FAILED',
          message: 'Social login failed. Please try again.',
        },
      };
    }
  }

  async logout(accessToken: string): Promise<ApiResponse> {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Logout error:', error);
        // Don't fail logout if API call fails
      }

      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: true }; // Always succeed for logout
    }
  }

  async refreshToken(refreshToken: string): Promise<ApiResponse<AuthResponse>> {
    try {
      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (error || !data.session || !data.user) {
        return {
          success: false,
          error: {
            code: 'REFRESH_FAILED',
            message: 'Failed to refresh authentication',
          },
        };
      }

      const userProfile = await this.getUserProfile(data.user.id);
      
      const user: User = {
        id: data.user.id,
        email: data.user.email!,
        firstName: userProfile?.first_name || '',
        lastName: userProfile?.last_name || '',
        displayName: userProfile?.display_name || '',
        avatar: userProfile?.avatar_url,
        phoneNumber: userProfile?.phone_number,
        dateOfBirth: userProfile?.date_of_birth,
        gender: userProfile?.gender,
        spiritualLevel: userProfile?.spiritual_level || 'beginner',
        denomination: userProfile?.denomination,
        churchName: userProfile?.church_name,
        level: userProfile?.level || 1,
        experience: userProfile?.experience || 0,
        streak: userProfile?.streak || 0,
        longestStreak: userProfile?.longest_streak || 0,
        totalPoints: userProfile?.total_points || 0,
        badges: userProfile?.badges || [],
        preferences: userProfile?.preferences || this.getDefaultPreferences(),
        createdAt: data.user.created_at,
        updatedAt: userProfile?.updated_at || data.user.created_at,
        emailVerified: data.user.email_confirmed_at !== null,
        phoneVerified: data.user.phone_confirmed_at !== null,
      };

      return {
        success: true,
        data: {
          user,
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'REFRESH_FAILED',
          message: 'Failed to refresh authentication',
        },
      };
    }
  }

  async validateToken(accessToken: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.auth.getUser(accessToken);
      return !error && !!data.user;
    } catch (error) {
      return false;
    }
  }

  async forgotPassword(email: string): Promise<ApiResponse> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'sifia://reset-password',
      });

      if (error) {
        return {
          success: false,
          error: {
            code: 'FORGOT_PASSWORD_FAILED',
            message: this.getErrorMessage(error.message),
          },
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'FORGOT_PASSWORD_FAILED',
          message: 'Failed to send reset email',
        },
      };
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<ApiResponse> {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        return {
          success: false,
          error: {
            code: 'RESET_PASSWORD_FAILED',
            message: this.getErrorMessage(error.message),
          },
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'RESET_PASSWORD_FAILED',
          message: 'Failed to reset password',
        },
      };
    }
  }

  async changePassword(accessToken: string, currentPassword: string, newPassword: string): Promise<ApiResponse> {
    try {
      // First verify current password by attempting to sign in
      const { data: currentUser } = await supabase.auth.getUser(accessToken);
      
      if (!currentUser.user?.email) {
        return {
          success: false,
          error: {
            code: 'INVALID_USER',
            message: 'User not found',
          },
        };
      }

      // Verify current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: currentUser.user.email,
        password: currentPassword,
      });

      if (signInError) {
        return {
          success: false,
          error: {
            code: 'INVALID_CURRENT_PASSWORD',
            message: 'Current password is incorrect',
          },
        };
      }

      // Update password
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        return {
          success: false,
          error: {
            code: 'CHANGE_PASSWORD_FAILED',
            message: this.getErrorMessage(error.message),
          },
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'CHANGE_PASSWORD_FAILED',
          message: 'Failed to change password',
        },
      };
    }
  }

  async sendEmailVerification(accessToken: string): Promise<ApiResponse> {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: '', // Will use current user's email
      });

      if (error) {
        return {
          success: false,
          error: {
            code: 'EMAIL_VERIFICATION_FAILED',
            message: this.getErrorMessage(error.message),
          },
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'EMAIL_VERIFICATION_FAILED',
          message: 'Failed to send verification email',
        },
      };
    }
  }

  async verifyEmail(token: string): Promise<ApiResponse> {
    try {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: 'email',
      });

      if (error) {
        return {
          success: false,
          error: {
            code: 'EMAIL_VERIFICATION_FAILED',
            message: this.getErrorMessage(error.message),
          },
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'EMAIL_VERIFICATION_FAILED',
          message: 'Failed to verify email',
        },
      };
    }
  }

  async deleteAccount(accessToken: string): Promise<ApiResponse> {
    try {
      // First delete user profile and related data
      const { data: user } = await supabase.auth.getUser(accessToken);
      
      if (user.user) {
        // Delete user profile
        await supabase
          .from('user_profiles')
          .delete()
          .eq('id', user.user.id);

        // Delete other user data
        await Promise.all([
          supabase.from('user_goals').delete().eq('user_id', user.user.id),
          supabase.from('user_progress').delete().eq('user_id', user.user.id),
          supabase.from('devotional_completions').delete().eq('user_id', user.user.id),
          supabase.from('journal_entries').delete().eq('user_id', user.user.id),
        ]);
      }

      // Delete auth user
      const { error } = await supabase.auth.admin.deleteUser(user.user!.id);

      if (error) {
        return {
          success: false,
          error: {
            code: 'DELETE_ACCOUNT_FAILED',
            message: this.getErrorMessage(error.message),
          },
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'DELETE_ACCOUNT_FAILED',
          message: 'Failed to delete account',
        },
      };
    }
  }

  private async getUserProfile(userId: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Get user profile error:', error);
        
        // If profile doesn't exist, create a default one
        if (error.code === 'PGRST116') {
          console.log('Creating default profile for user:', userId);
          return await this.createDefaultProfile(userId);
        }
        
        return null;
      }

      return data;
    } catch (error) {
      console.error('Get user profile error:', error);
      return null;
    }
  }

  private async updateLastLogin(userId: string): Promise<void> {
    try {
      await supabase
        .from('user_profiles')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', userId);
    } catch (error) {
      console.error('Update last login error:', error);
    }
  }

  private async createDefaultProfile(userId: string): Promise<any> {
    try {
      // Get user email from Supabase auth
      const { data: authUser } = await supabase.auth.getUser();
      const userEmail = authUser.user?.email || 'user@example.com';
      
      // Use the secure database function to create profile (bypasses RLS)
      const { data, error } = await supabase.rpc('create_default_user_profile', {
        p_user_id: userId,
        p_email: userEmail
      });

      if (error) {
        console.error('Create default profile error:', error);
        return null;
      }

      console.log('Default profile created successfully:', data);
      return data;
    } catch (error) {
      console.error('Create default profile error:', error);
      return null;
    }
  }

  private getDefaultPreferences(): UserPreferences {
    return {
      notifications: {
        dailyDevotional: true,
        prayerReminders: true,
        journalPrompts: true,
        playbookUpdates: true,
        achievements: true,
        weeklyReports: true,
        pushEnabled: true,
        emailEnabled: true,
        reminderTime: '08:00',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      theme: 'system',
      fontSize: 'medium',
      colorScheme: 'default',
      privacy: {
        profileVisibility: 'friends',
        shareProgress: true,
        shareJournal: false,
        allowFriendRequests: true,
      },
      content: {
        language: 'en',
        bibleVersion: 'NIV',
        autoPlayAudio: false,
        downloadForOffline: true,
        showVerseOfDay: true,
      },
    };
  }

  private getErrorMessage(error: string): string {
    const errorMap: Record<string, string> = {
      'Invalid login credentials': 'Invalid email or password',
      'Email not confirmed': 'Please verify your email address',
      'User already registered': 'An account with this email already exists',
      'Password should be at least 6 characters': 'Password must be at least 6 characters long',
      'Unable to validate email address: invalid format': 'Please enter a valid email address',
    };

    return errorMap[error] || error;
  }
}

export const authApi = new AuthApiService();
