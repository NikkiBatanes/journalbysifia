/**
 * Onboarding Localization Service
 * Multi-language support for international markets
 * Phase 4: Multi-language Support
 */

import { supabase } from './supabaseClient';

export interface LocalizedContent {
  key: string;
  language: string;
  content: string;
  context?: string;
  metadata?: Record<string, any>;
}

export interface SupportedLanguage {
  code: string;
  name: string;
  nativeName: string;
  isRTL: boolean;
  isActive: boolean;
  completionPercentage: number;
  region?: string;
}

export interface LocalizationMetrics {
  totalKeys: number;
  translatedKeys: Record<string, number>;
  completionRates: Record<string, number>;
  missingTranslations: Record<string, string[]>;
  recentUpdates: Array<{
    language: string;
    key: string;
    updatedAt: string;
  }>;
}

class OnboardingLocalizationService {
  private supabase = supabase;
  private fallbackLanguage = 'en';
  private currentLanguage = 'en';
  private translationCache: Map<string, Map<string, string>> = new Map();

  /**
   * Supported languages for onboarding
   */
  private supportedLanguages: SupportedLanguage[] = [
    {
      code: 'en',
      name: 'English',
      nativeName: 'English',
      isRTL: false,
      isActive: true,
      completionPercentage: 100,
      region: 'US',
    },
    {
      code: 'es',
      name: 'Spanish',
      nativeName: 'Español',
      isRTL: false,
      isActive: true,
      completionPercentage: 95,
      region: 'ES',
    },
    {
      code: 'pt',
      name: 'Portuguese',
      nativeName: 'Português',
      isRTL: false,
      isActive: true,
      completionPercentage: 90,
      region: 'BR',
    },
    {
      code: 'fr',
      name: 'French',
      nativeName: 'Français',
      isRTL: false,
      isActive: true,
      completionPercentage: 85,
      region: 'FR',
    },
    {
      code: 'de',
      name: 'German',
      nativeName: 'Deutsch',
      isRTL: false,
      isActive: true,
      completionPercentage: 80,
      region: 'DE',
    },
    {
      code: 'zh',
      name: 'Chinese (Simplified)',
      nativeName: '简体中文',
      isRTL: false,
      isActive: true,
      completionPercentage: 75,
      region: 'CN',
    },
    {
      code: 'ko',
      name: 'Korean',
      nativeName: '한국어',
      isRTL: false,
      isActive: true,
      completionPercentage: 70,
      region: 'KR',
    },
    {
      code: 'ja',
      name: 'Japanese',
      nativeName: '日本語',
      isRTL: false,
      isActive: true,
      completionPercentage: 65,
      region: 'JP',
    },
    {
      code: 'ar',
      name: 'Arabic',
      nativeName: 'العربية',
      isRTL: true,
      isActive: true,
      completionPercentage: 60,
      region: 'SA',
    },
    {
      code: 'hi',
      name: 'Hindi',
      nativeName: 'हिन्दी',
      isRTL: false,
      isActive: true,
      completionPercentage: 55,
      region: 'IN',
    },
    {
      code: 'tl',
      name: 'Filipino',
      nativeName: 'Filipino',
      isRTL: false,
      isActive: true,
      completionPercentage: 90,
      region: 'PH',
    },
  ];

  /**
   * Onboarding translation keys
   */
  private onboardingTranslationKeys = {
    // Welcome Screen
    'onboarding.welcome.title': 'Welcome to siFia',
    'onboarding.welcome.subtitle': 'Your journey of faith begins here',
    'onboarding.welcome.description': 'Let us help you grow in your relationship with Christ through personalized content and community.',
    'onboarding.welcome.getStarted': 'Get Started',
    'onboarding.welcome.skip': 'Skip for now',

    // Personal Profile
    'onboarding.profile.title': 'Tell us about yourself',
    'onboarding.profile.firstName': 'First Name',
    'onboarding.profile.lastName': 'Last Name',
    'onboarding.profile.email': 'Email Address',
    'onboarding.profile.phone': 'Phone Number (Optional)',
    'onboarding.profile.ageRange': 'Age Range',
    'onboarding.profile.location': 'Location',
    'onboarding.profile.occupation': 'Occupation (Optional)',
    'onboarding.profile.continue': 'Continue',
    'onboarding.profile.back': 'Back',

    // Faith Journey
    'onboarding.faith.title': 'Your Faith Journey',
    'onboarding.faith.subtitle': 'Help us understand where you are in your spiritual walk',
    'onboarding.faith.christAcceptance': 'Have you accepted Jesus Christ as your personal savior?',
    'onboarding.faith.christAcceptance.yes': 'Yes',
    'onboarding.faith.christAcceptance.no': 'No',
    'onboarding.faith.christAcceptance.unsure': 'I\'m not sure',
    'onboarding.faith.acceptanceContext': 'When did this happen?',
    'onboarding.faith.acceptanceContext.childhood': 'In childhood',
    'onboarding.faith.acceptanceContext.teenager': 'As a teenager',
    'onboarding.faith.acceptanceContext.adult': 'As an adult',
    'onboarding.faith.acceptanceContext.recent': 'Recently',
    'onboarding.faith.spiritualMaturity': 'How would you describe your spiritual maturity?',
    'onboarding.faith.spiritualMaturity.newBeliever': 'New believer',
    'onboarding.faith.spiritualMaturity.growing': 'Growing in faith',
    'onboarding.faith.spiritualMaturity.mature': 'Mature believer',
    'onboarding.faith.spiritualMaturity.leader': 'Spiritual leader',
    'onboarding.faith.churchAttendance': 'How often do you attend church?',
    'onboarding.faith.bibleReading': 'How often do you read the Bible?',
    'onboarding.faith.prayer': 'How often do you pray?',
    'onboarding.faith.baptism': 'Have you been baptized?',

    // Goals
    'onboarding.goals.title': 'Your Spiritual Goals',
    'onboarding.goals.subtitle': 'What would you like to focus on in your faith journey?',
    'onboarding.goals.dailyDevotions': 'Daily devotions',
    'onboarding.goals.bibleStudy': 'Bible study',
    'onboarding.goals.prayer': 'Prayer life',
    'onboarding.goals.worship': 'Worship and praise',
    'onboarding.goals.community': 'Christian community',
    'onboarding.goals.service': 'Service and ministry',
    'onboarding.goals.evangelism': 'Sharing faith',
    'onboarding.goals.discipleship': 'Discipleship',
    'onboarding.goals.customGoal': 'Add custom goal',
    'onboarding.goals.selectAtLeast': 'Please select at least one goal',

    // Preferences
    'onboarding.preferences.title': 'Your Preferences',
    'onboarding.preferences.subtitle': 'Help us personalize your experience',
    'onboarding.preferences.contentLength': 'Preferred content length',
    'onboarding.preferences.contentLength.short': 'Short (2-5 minutes)',
    'onboarding.preferences.contentLength.medium': 'Medium (5-15 minutes)',
    'onboarding.preferences.contentLength.long': 'Long (15+ minutes)',
    'onboarding.preferences.learningStyle': 'Learning style',
    'onboarding.preferences.learningStyle.visual': 'Visual',
    'onboarding.preferences.learningStyle.auditory': 'Auditory',
    'onboarding.preferences.learningStyle.reading': 'Reading/Writing',
    'onboarding.preferences.learningStyle.kinesthetic': 'Hands-on',
    'onboarding.preferences.notifications': 'Notification preferences',
    'onboarding.preferences.dailyReminders': 'Daily reminders',
    'onboarding.preferences.weeklyInsights': 'Weekly insights',
    'onboarding.preferences.communityUpdates': 'Community updates',

    // Trial Setup
    'onboarding.trial.title': 'Start Your Free Trial',
    'onboarding.trial.subtitle': 'Experience the full power of siFia for 14 days',
    'onboarding.trial.features.smartJournaling': 'AI-powered spiritual journaling',
    'onboarding.trial.features.personalizedContent': 'Personalized devotions and studies',
    'onboarding.trial.features.progressTracking': 'Track your spiritual growth',
    'onboarding.trial.features.community': 'Connect with believers worldwide',
    'onboarding.trial.startTrial': 'Start Free Trial',
    'onboarding.trial.skipTrial': 'Continue with basic features',
    'onboarding.trial.noPayment': 'No payment required',

    // Common
    'common.next': 'Next',
    'common.back': 'Back',
    'common.skip': 'Skip',
    'common.continue': 'Continue',
    'common.finish': 'Finish',
    'common.loading': 'Loading...',
    'common.error': 'An error occurred',
    'common.retry': 'Try again',
    'common.optional': 'Optional',
    'common.required': 'Required',

    // Frequency options
    'frequency.never': 'Never',
    'frequency.rarely': 'Rarely',
    'frequency.weekly': 'Weekly',
    'frequency.daily': 'Daily',
    'frequency.multipleDaily': 'Multiple times daily',
    'frequency.monthly': 'Monthly',
    'frequency.multipleWeekly': 'Multiple times weekly',

    // Validation messages
    'validation.required': 'This field is required',
    'validation.email': 'Please enter a valid email address',
    'validation.phone': 'Please enter a valid phone number',
    'validation.minLength': 'Must be at least {min} characters',
    'validation.maxLength': 'Must be no more than {max} characters',

    // Success messages
    'success.profileSaved': 'Profile saved successfully',
    'success.faithJourneySaved': 'Faith journey information saved',
    'success.goalsSaved': 'Goals saved successfully',
    'success.preferencesSaved': 'Preferences saved successfully',
    'success.onboardingComplete': 'Welcome to siFia! Your journey begins now.',

    // Christ acceptance
    'christAcceptance.title': 'A Special Moment',
    'christAcceptance.subtitle': 'Would you like to accept Jesus Christ as your personal savior?',
    'christAcceptance.description': 'This is a personal decision between you and God. There\'s no pressure - take your time.',
    'christAcceptance.prayer': 'Prayer of Salvation',
    'christAcceptance.prayerText': 'Dear Jesus, I believe you died for my sins and rose again. I accept you as my personal savior. Please come into my heart and life. Amen.',
    'christAcceptance.accept': 'Yes, I accept Jesus',
    'christAcceptance.notReady': 'I\'m not ready yet',
    'christAcceptance.alreadyAccepted': 'I\'ve already accepted Jesus',
    'christAcceptance.congratulations': 'Congratulations! Welcome to the family of God!',
    'christAcceptance.nextSteps': 'We\'d love to help you take your next steps in faith.',
    'christAcceptance.baptismInterest': 'I\'m interested in baptism',
    'christAcceptance.churchConnection': 'I\'d like to connect with a local church',
    'christAcceptance.discipleship': 'I want to learn more about following Jesus',
  };

  /**
   * Set current language
   */
  setLanguage(languageCode: string): void {
    if (this.isLanguageSupported(languageCode)) {
      this.currentLanguage = languageCode;
    } else {
      console.warn(`Language ${languageCode} not supported, using fallback`);
      this.currentLanguage = this.fallbackLanguage;
    }
  }

  /**
   * Get current language
   */
  getCurrentLanguage(): string {
    return this.currentLanguage;
  }

  /**
   * Check if language is supported
   */
  isLanguageSupported(languageCode: string): boolean {
    return this.supportedLanguages.some(lang => lang.code === languageCode && lang.isActive);
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): SupportedLanguage[] {
    return this.supportedLanguages.filter(lang => lang.isActive);
  }

  /**
   * Get translation for key
   */
  async getTranslation(key: string, languageCode?: string, params?: Record<string, string>): Promise<string> {
    const lang = languageCode || this.currentLanguage;

    try {
      // Check cache first
      if (this.translationCache.has(lang) && this.translationCache.get(lang)!.has(key)) {
        let translation = this.translationCache.get(lang)!.get(key)!;
        return this.interpolateParams(translation, params);
      }

      // Fetch from database
      const { data, error } = await this.supabase
        .from('localized_content')
        .select('content')
        .eq('key', key)
        .eq('language', lang)
        .single();

      if (error || !data) {
        // Fallback to default language
        if (lang !== this.fallbackLanguage) {
          return this.getTranslation(key, this.fallbackLanguage, params);
        }

        // Fallback to hardcoded translations
        const fallbackTranslation = this.onboardingTranslationKeys[key as keyof typeof this.onboardingTranslationKeys];
        if (fallbackTranslation) {
          return this.interpolateParams(fallbackTranslation, params);
        }

        // Last resort: return key
        return key;
      }

      // Cache the translation
      if (!this.translationCache.has(lang)) {
        this.translationCache.set(lang, new Map());
      }
      this.translationCache.get(lang)!.set(key, data.content);

      return this.interpolateParams(data.content, params);
    } catch (error) {
      console.error('Error getting translation:', error);
      return key;
    }
  }

  /**
   * Interpolate parameters in translation
   */
  private interpolateParams(translation: string, params?: Record<string, string>): string {
    if (!params) {return translation;}

    let result = translation;
    Object.entries(params).forEach(([key, value]) => {
      result = result.replace(new RegExp(`{${key}}`, 'g'), value);
    });

    return result;
  }

  /**
   * Get multiple translations
   */
  async getTranslations(keys: string[], languageCode?: string): Promise<Record<string, string>> {
    const translations: Record<string, string> = {};

    for (const key of keys) {
      translations[key] = await this.getTranslation(key, languageCode);
    }

    return translations;
  }

  /**
   * Detect user's preferred language
   */
  detectUserLanguage(): string {
    // Try to detect from device/browser settings
    if (typeof navigator !== 'undefined') {
      const browserLang = navigator.language || (navigator as any).userLanguage;
      if (browserLang) {
        const langCode = browserLang.split('-')[0];
        if (this.isLanguageSupported(langCode)) {
          return langCode;
        }
      }
    }

    return this.fallbackLanguage;
  }

  /**
   * Get language direction (LTR/RTL)
   */
  getLanguageDirection(languageCode?: string): 'ltr' | 'rtl' {
    const lang = languageCode || this.currentLanguage;
    const language = this.supportedLanguages.find(l => l.code === lang);
    return language?.isRTL ? 'rtl' : 'ltr';
  }

  /**
   * Load translations for onboarding screens
   */
  async loadOnboardingTranslations(languageCode?: string): Promise<Record<string, string>> {
    const lang = languageCode || this.currentLanguage;
    const keys = Object.keys(this.onboardingTranslationKeys);

    return this.getTranslations(keys, lang);
  }

  /**
   * Add or update translation
   */
  async updateTranslation(key: string, language: string, content: string, context?: string): Promise<void> {
    const { error } = await this.supabase
      .from('localized_content')
      .upsert([{
        key,
        language,
        content,
        context,
        updated_at: new Date().toISOString(),
      }]);

    if (error) {
      throw new Error(`Failed to update translation: ${error.message}`);
    }

    // Update cache
    if (!this.translationCache.has(language)) {
      this.translationCache.set(language, new Map());
    }
    this.translationCache.get(language)!.set(key, content);
  }

  /**
   * Get localization metrics
   */
  async getLocalizationMetrics(): Promise<LocalizationMetrics> {
    try {
      const { data: allTranslations } = await this.supabase
        .from('localized_content')
        .select('key, language, updated_at');

      if (!allTranslations) {
        throw new Error('No translation data found');
      }

      const totalKeys = Object.keys(this.onboardingTranslationKeys).length;
      const translatedKeys: Record<string, number> = {};
      const completionRates: Record<string, number> = {};
      const missingTranslations: Record<string, string[]> = {};

      // Calculate metrics for each language
      this.supportedLanguages.forEach(lang => {
        const langTranslations = allTranslations.filter(t => t.language === lang.code);
        translatedKeys[lang.code] = langTranslations.length;
        completionRates[lang.code] = (langTranslations.length / totalKeys) * 100;

        // Find missing translations
        const translatedKeySet = new Set(langTranslations.map(t => t.key));
        const allKeySet = new Set(Object.keys(this.onboardingTranslationKeys));
        const missing = Array.from(allKeySet).filter(key => !translatedKeySet.has(key));
        missingTranslations[lang.code] = missing;
      });

      // Recent updates
      const recentUpdates = allTranslations
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 10)
        .map(t => ({
          language: t.language,
          key: t.key,
          updatedAt: t.updated_at,
        }));

      return {
        totalKeys,
        translatedKeys,
        completionRates,
        missingTranslations,
        recentUpdates,
      };
    } catch (error) {
      console.error('Error getting localization metrics:', error);
      return {
        totalKeys: 0,
        translatedKeys: {},
        completionRates: {},
        missingTranslations: {},
        recentUpdates: [],
      };
    }
  }

  /**
   * Initialize default translations
   */
  async initializeDefaultTranslations(): Promise<void> {
    const translations = Object.entries(this.onboardingTranslationKeys).map(([key, content]) => ({
      key,
      language: 'en',
      content,
      context: 'onboarding',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const { error } = await this.supabase
      .from('localized_content')
      .upsert(translations, { onConflict: 'key,language' });

    if (error) {
      throw new Error(`Failed to initialize translations: ${error.message}`);
    }
  }

  /**
   * Clear translation cache
   */
  clearCache(): void {
    this.translationCache.clear();
  }
}

export const onboardingLocalizationService = new OnboardingLocalizationService();
