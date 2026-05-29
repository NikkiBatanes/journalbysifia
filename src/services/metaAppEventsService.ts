import { NativeModules, Platform } from 'react-native';
import { AppEventsLogger, Settings } from 'react-native-fbsdk-next';
import type { Params } from 'react-native-fbsdk-next';
import { ENV } from '../config/environment';
import { Logger } from '../utils/ProductionLogger';

const META_COMPONENT = 'MetaAppEventsService';
const DEFAULT_FACEBOOK_APP_ID = '966515746211770';

export type MetaRegistrationMethod = 'email' | 'google' | 'apple' | 'oauth' | 'unknown';

interface TrialStartedParams {
  tier?: string | null;
  billingCycle?: string | null;
  transactionId?: string | null;
  productId?: string | null;
  platform?: string | null;
}

interface PurchaseParams extends TrialStartedParams {
  amount: number;
  currency?: string | null;
  isTrial?: boolean | null;
}

interface SubscriptionConvertedParams extends TrialStartedParams {
  amount?: number | null;
  currency?: string | null;
}

class MetaAppEventsService {
  private initialized = false;
  private missingNativeModuleWarned = false;
  private missingClientTokenWarned = false;

  initialize(): boolean {
    if (this.initialized) {
      return true;
    }

    if (!this.hasNativeModules()) {
      if (!this.missingNativeModuleWarned) {
        Logger.warn('Meta SDK native modules are not available yet', {
          component: META_COMPONENT,
          action: 'initialize',
        });
        this.missingNativeModuleWarned = true;
      }
      return false;
    }

    try {
      const appId = (ENV.FACEBOOK_APP_ID || DEFAULT_FACEBOOK_APP_ID).trim();
      const clientToken = (ENV.FACEBOOK_CLIENT_TOKEN || '').trim();

      Settings.setAppID(appId);
      Settings.setAppName('siFia');
      Settings.setAutoLogAppEventsEnabled(true);
      Settings.setAdvertiserIDCollectionEnabled(ENV.META_ADVERTISER_ID_COLLECTION_ENABLED);

      if (clientToken && !clientToken.includes('your_')) {
        Settings.setClientToken(clientToken);
      } else if (!this.missingClientTokenWarned) {
        Logger.warn('Meta client token is missing; add FACEBOOK_CLIENT_TOKEN to enable full SDK event delivery', {
          component: META_COMPONENT,
          action: 'initialize',
          appId,
        });
        this.missingClientTokenWarned = true;
      }

      Settings.initializeSDK();
      this.initialized = true;

      Logger.info('Meta SDK initialized for App Events', {
        component: META_COMPONENT,
        action: 'initialize',
        appId,
        advertiserIdCollectionEnabled: ENV.META_ADVERTISER_ID_COLLECTION_ENABLED,
      });

      return true;
    } catch (error) {
      Logger.error('Failed to initialize Meta SDK', error as Error, {
        component: META_COMPONENT,
        action: 'initialize',
      });
      return false;
    }
  }

  trackRegistration(method: MetaRegistrationMethod): void {
    this.logEvent(this.getEventName('CompletedRegistration', 'fb_mobile_complete_registration'), {
      [this.getParamName('RegistrationMethod', 'fb_registration_method')]: method,
      platform: Platform.OS,
    });
  }

  trackTrialStarted(params: TrialStartedParams): void {
    this.logEvent(this.getEventName('StartTrial', 'StartTrial'), {
      [this.getParamName('ContentType', 'fb_content_type')]: 'subscription_trial',
      [this.getParamName('ContentID', 'fb_content_id')]: params.productId || params.tier || 'subscription_trial',
      [this.getParamName('OrderId', 'fb_order_id')]: params.transactionId,
      tier: this.normalizeTier(params.tier),
      billing_cycle: params.billingCycle || this.getBillingCycle(params.productId),
      platform: params.platform || Platform.OS,
    });
  }

  trackPurchase(params: PurchaseParams): void {
    const amount = Number(params.amount);

    if (params.isTrial || !Number.isFinite(amount) || amount <= 0) {
      this.trackTrialStarted(params);
      return;
    }

    if (!this.initialize()) {
      return;
    }

    try {
      AppEventsLogger.logPurchase(amount, (params.currency || 'PHP').toUpperCase(), this.cleanParams({
        [this.getParamName('ContentType', 'fb_content_type')]: 'subscription',
        [this.getParamName('ContentID', 'fb_content_id')]: params.productId || params.tier || 'subscription',
        [this.getParamName('OrderId', 'fb_order_id')]: params.transactionId,
        tier: this.normalizeTier(params.tier),
        billing_cycle: params.billingCycle || this.getBillingCycle(params.productId),
        platform: params.platform || Platform.OS,
      }));
      AppEventsLogger.flush();
    } catch (error) {
      Logger.error('Failed to track Meta purchase event', error as Error, {
        component: META_COMPONENT,
        action: 'track_purchase',
        productId: params.productId,
      });
    }
  }

  trackSubscriptionConverted(params: SubscriptionConvertedParams): void {
    this.logEvent(this.getEventName('Subscribe', 'Subscribe'), {
      [this.getParamName('ContentType', 'fb_content_type')]: 'subscription',
      [this.getParamName('ContentID', 'fb_content_id')]: params.productId || params.tier || 'subscription',
      [this.getParamName('Currency', 'fb_currency')]: (params.currency || 'PHP').toUpperCase(),
      [this.getParamName('OrderId', 'fb_order_id')]: params.transactionId,
      tier: this.normalizeTier(params.tier),
      billing_cycle: params.billingCycle || this.getBillingCycle(params.productId),
      platform: params.platform || Platform.OS,
      value: params.amount,
    });
  }

  private logEvent(eventName: string, params: Record<string, unknown>): void {
    if (!this.initialize()) {
      return;
    }

    try {
      AppEventsLogger.logEvent(eventName, this.cleanParams(params));
      AppEventsLogger.flush();
    } catch (error) {
      Logger.error('Failed to track Meta app event', error as Error, {
        component: META_COMPONENT,
        action: 'log_event',
        eventName,
      });
    }
  }

  private hasNativeModules(): boolean {
    return Boolean(NativeModules.FBSettings && NativeModules.FBAppEventsLogger);
  }

  private getEventName(key: string, fallback: string): string {
    const events = AppEventsLogger.AppEvents as Record<string, string> | undefined;
    return events?.[key] || fallback;
  }

  private getParamName(key: string, fallback: string): string {
    const params = AppEventsLogger.AppEventParams as Record<string, string> | undefined;
    return params?.[key] || fallback;
  }

  private cleanParams(params: Record<string, unknown>): Params {
    return Object.entries(params).reduce<Params>((cleaned, [key, value]) => {
      if (value === undefined || value === null || value === '') {
        return cleaned;
      }

      if (typeof value === 'number' && Number.isFinite(value)) {
        cleaned[key] = value;
      } else if (typeof value === 'boolean') {
        cleaned[key] = value ? 1 : 0;
      } else {
        cleaned[key] = String(value);
      }

      return cleaned;
    }, {});
  }

  private normalizeTier(tier?: string | null): string | undefined {
    if (!tier) {
      return undefined;
    }

    return tier.replace('_annual', '');
  }

  private getBillingCycle(productId?: string | null): string | undefined {
    if (!productId) {
      return undefined;
    }

    if (productId.includes('annual')) {
      return 'annual';
    }

    if (productId.includes('monthly')) {
      return 'monthly';
    }

    return undefined;
  }
}

export const metaAppEventsService = new MetaAppEventsService();
export const initializeMetaAppEvents = () => metaAppEventsService.initialize();
