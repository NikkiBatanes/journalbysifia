import {Platform} from 'react-native';
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesConfiguration,
  type PurchasesOfferings,
} from 'react-native-purchases';

import {ENV} from '../config/environment';
import {Logger} from '../utils/ProductionLogger';

export const DEFAULT_JOURNAL_CLOUD_ENTITLEMENT = 'journal_cloud';

export type JournalCloudBillingPlatform = 'ios' | 'android' | 'unsupported';

export interface JournalCloudBillingSdk {
  setLogLevel: (level: LOG_LEVEL) => Promise<void>;
  configure: (configuration: PurchasesConfiguration) => void;
  logIn: (appUserID: string) => Promise<unknown>;
  logOut: () => Promise<CustomerInfo>;
  getCustomerInfo: () => Promise<CustomerInfo>;
  getOfferings: () => Promise<PurchasesOfferings>;
  restorePurchases: () => Promise<CustomerInfo>;
}

interface JournalCloudBillingConfiguration {
  platform: JournalCloudBillingPlatform;
  apiKey: string;
  entitlementIdentifier: string;
  debugLogging: boolean;
}

export interface JournalCloudEntitlementSnapshot {
  active: boolean;
  entitlementIdentifier: string;
  expirationDate: string | null;
  willRenew: boolean;
}

export class JournalCloudAccountRequiredError extends Error {
  constructor() {
    super('Sign in to a siFia account before restoring Journal Cloud purchases.');
    this.name = 'JournalCloudAccountRequiredError';
  }
}

const normalizeUserId = (userId: string | null | undefined): string | null => {
  const normalized = userId?.trim();
  return normalized ? normalized : null;
};

export const hasActiveJournalCloudEntitlement = (
  customerInfo: CustomerInfo,
  entitlementIdentifier = DEFAULT_JOURNAL_CLOUD_ENTITLEMENT,
): boolean => Boolean(customerInfo.entitlements.active[entitlementIdentifier]);

export const toJournalCloudEntitlementSnapshot = (
  customerInfo: CustomerInfo,
  entitlementIdentifier = DEFAULT_JOURNAL_CLOUD_ENTITLEMENT,
): JournalCloudEntitlementSnapshot => {
  const entitlement = customerInfo.entitlements.active[entitlementIdentifier];

  return {
    active: Boolean(entitlement),
    entitlementIdentifier,
    expirationDate: entitlement?.expirationDate ?? null,
    willRenew: entitlement?.willRenew ?? false,
  };
};

export class JournalCloudBillingCoordinator {
  private configured = false;
  private disabled = false;
  private currentUserId: string | null = null;
  private identityQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly sdk: JournalCloudBillingSdk,
    private readonly configuration: JournalCloudBillingConfiguration,
  ) {}

  isConfigured(): boolean {
    return this.configured;
  }

  getAuthenticatedUserId(): string | null {
    return this.currentUserId;
  }

  initialize(userId?: string | null): boolean {
    if (this.configured) {
      return true;
    }

    if (
      this.disabled ||
      this.configuration.platform === 'unsupported' ||
      !this.configuration.apiKey.trim()
    ) {
      this.disabled = true;
      return false;
    }

    const normalizedUserId = normalizeUserId(userId);

    if (this.configuration.debugLogging) {
      this.sdk.setLogLevel(LOG_LEVEL.DEBUG).catch(error => {
        Logger.warn('RevenueCat debug logging could not be enabled', {
          component: 'JournalCloudBilling',
          reason: error instanceof Error ? error.message : String(error),
        });
      });
    }

    this.sdk.configure({
      apiKey: this.configuration.apiKey.trim(),
      ...(normalizedUserId ? {appUserID: normalizedUserId} : {}),
    });
    this.currentUserId = normalizedUserId;
    this.configured = true;
    return true;
  }

  async syncIdentity(userId: string | null | undefined): Promise<void> {
    const normalizedUserId = normalizeUserId(userId);

    if (!this.initialize(normalizedUserId)) {
      return;
    }

    this.identityQueue = this.identityQueue
      .catch(() => undefined)
      .then(async () => {
        if (normalizedUserId === this.currentUserId) {
          return;
        }

        if (normalizedUserId) {
          await this.sdk.logIn(normalizedUserId);
          this.currentUserId = normalizedUserId;
          return;
        }

        if (this.currentUserId) {
          await this.sdk.logOut();
          this.currentUserId = null;
        }
      });

    return this.identityQueue;
  }

  async getEntitlementSnapshot(): Promise<JournalCloudEntitlementSnapshot | null> {
    if (!this.initialize(this.currentUserId)) {
      return null;
    }

    const customerInfo = await this.sdk.getCustomerInfo();
    return toJournalCloudEntitlementSnapshot(
      customerInfo,
      this.configuration.entitlementIdentifier,
    );
  }

  async getOfferings(): Promise<PurchasesOfferings | null> {
    if (!this.initialize(this.currentUserId)) {
      return null;
    }

    return this.sdk.getOfferings();
  }

  async restorePurchases(): Promise<JournalCloudEntitlementSnapshot> {
    if (!this.currentUserId) {
      throw new JournalCloudAccountRequiredError();
    }

    if (!this.initialize(this.currentUserId)) {
      throw new Error('Journal Cloud billing is not configured.');
    }

    const customerInfo = await this.sdk.restorePurchases();
    return toJournalCloudEntitlementSnapshot(
      customerInfo,
      this.configuration.entitlementIdentifier,
    );
  }
}

const platform: JournalCloudBillingPlatform =
  Platform.OS === 'ios' || Platform.OS === 'android'
    ? Platform.OS
    : 'unsupported';

const apiKey =
  platform === 'ios'
    ? ENV.REVENUECAT_IOS_API_KEY
    : platform === 'android'
      ? ENV.REVENUECAT_ANDROID_API_KEY
      : '';

/**
 * Client CustomerInfo is a presentation cache only. Journal Cloud upload and
 * download authorization must use the server-owned entitlement mirror.
 */
export const journalCloudBillingService = new JournalCloudBillingCoordinator(
  Purchases,
  {
    platform,
    apiKey,
    entitlementIdentifier:
      ENV.REVENUECAT_JOURNAL_CLOUD_ENTITLEMENT ||
      DEFAULT_JOURNAL_CLOUD_ENTITLEMENT,
    debugLogging: __DEV__,
  },
);
