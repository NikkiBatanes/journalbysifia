import {Platform} from 'react-native';
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type MakePurchaseResult,
  type PurchasesOffering,
  type PurchasesConfiguration,
  type PurchasesOfferings,
  type PurchasesPackage,
} from 'react-native-purchases';

import {ENV} from '../config/environment';
import {Logger} from '../utils/ProductionLogger';

export const DEFAULT_JOURNAL_CLOUD_ENTITLEMENT = 'journal_cloud';
export const DEFAULT_JOURNAL_CLOUD_OFFERING = 'default';
export const JOURNAL_CLOUD_MONTHLY_PACKAGE = '$rc_monthly';
export const JOURNAL_CLOUD_ANNUAL_PACKAGE = '$rc_annual';
export const JOURNAL_CLOUD_MONTHLY_PRODUCTS = new Set([
  'app.journal.sifia.cloud.monthly',
  'journal_cloud:monthly',
]);
export const JOURNAL_CLOUD_ANNUAL_PRODUCTS = new Set([
  'app.journal.sifia.cloud.annual',
  'journal_cloud:annual',
]);

export type JournalCloudBillingPlatform = 'ios' | 'android' | 'unsupported';

export interface JournalCloudBillingSdk {
  setLogLevel: (level: LOG_LEVEL) => Promise<void>;
  configure: (configuration: PurchasesConfiguration) => void;
  logIn: (appUserID: string) => Promise<unknown>;
  logOut: () => Promise<CustomerInfo>;
  getCustomerInfo: () => Promise<CustomerInfo>;
  getOfferings: () => Promise<PurchasesOfferings>;
  purchasePackage: (
    packageItem: PurchasesPackage,
  ) => Promise<MakePurchaseResult>;
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

export interface JournalCloudOfferingPackageSnapshot {
  packageIdentifier: string;
  packageType: string;
  productIdentifier: string;
  localizedPrice: string;
  currencyCode: string;
  subscriptionPeriod: string | null;
}

export interface JournalCloudOfferingSnapshot {
  offeringIdentifier: string;
  packages: JournalCloudOfferingPackageSnapshot[];
}

export interface JournalCloudPlanSnapshot {
  billingPeriod: 'monthly' | 'annual';
  localizedPrice: string;
  productIdentifier: string;
}

export interface JournalCloudPurchaseSnapshot {
  productIdentifier: string;
  clientEntitlement: JournalCloudEntitlementSnapshot;
  serverConfirmationRequired: true;
}

const findJournalCloudPlanPackage = (
  snapshot: JournalCloudOfferingSnapshot,
  billingPeriod: JournalCloudPlanSnapshot['billingPeriod'],
): JournalCloudOfferingPackageSnapshot | undefined => {
  const packageIdentifier =
    billingPeriod === 'monthly'
      ? JOURNAL_CLOUD_MONTHLY_PACKAGE
      : JOURNAL_CLOUD_ANNUAL_PACKAGE;
  const acceptedProducts =
    billingPeriod === 'monthly'
      ? JOURNAL_CLOUD_MONTHLY_PRODUCTS
      : JOURNAL_CLOUD_ANNUAL_PRODUCTS;

  return snapshot.packages.find(
    packageItem =>
      packageItem.packageIdentifier === packageIdentifier &&
      acceptedProducts.has(packageItem.productIdentifier),
  );
};

export class JournalCloudAccountRequiredError extends Error {
  constructor() {
    super(
      'Create a Journal account or sign in before purchasing or restoring Journal Cloud.',
    );
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

export const toJournalCloudOfferingSnapshot = (
  offering: PurchasesOffering | null,
): JournalCloudOfferingSnapshot | null => {
  if (!offering) {
    return null;
  }

  return {
    offeringIdentifier: offering.identifier,
    packages: offering.availablePackages.map(packageItem => ({
      packageIdentifier: packageItem.identifier,
      packageType: packageItem.packageType,
      productIdentifier: packageItem.product.identifier,
      localizedPrice: packageItem.product.priceString,
      currencyCode: packageItem.product.currencyCode,
      subscriptionPeriod: packageItem.product.subscriptionPeriod,
    })),
  };
};

export const validateJournalCloudOffering = (
  snapshot: JournalCloudOfferingSnapshot | null,
): string[] => {
  if (!snapshot) {
    return ['current_offering_missing'];
  }

  const issues: string[] = [];
  if (snapshot.offeringIdentifier !== DEFAULT_JOURNAL_CLOUD_OFFERING) {
    issues.push('unexpected_current_offering');
  }

  const monthly = findJournalCloudPlanPackage(snapshot, 'monthly');
  const annual = findJournalCloudPlanPackage(snapshot, 'annual');

  if (!monthly) {
    issues.push('monthly_product_missing');
  } else if (monthly.subscriptionPeriod !== 'P1M') {
    issues.push('monthly_period_invalid');
  }

  if (!annual) {
    issues.push('annual_product_missing');
  } else if (annual.subscriptionPeriod !== 'P1Y') {
    issues.push('annual_period_invalid');
  }

  return issues;
};

/**
 * Returns display-only plan data in the order used by the Journal Cloud screen.
 * An invalid or incomplete catalog never falls back to a hardcoded price.
 */
export const toJournalCloudPlanSnapshots = (
  snapshot: JournalCloudOfferingSnapshot | null,
): JournalCloudPlanSnapshot[] => {
  if (validateJournalCloudOffering(snapshot).length > 0 || !snapshot) {
    return [];
  }

  const annual = findJournalCloudPlanPackage(snapshot, 'annual');
  const monthly = findJournalCloudPlanPackage(snapshot, 'monthly');

  if (!annual || !monthly) {
    return [];
  }

  return [
    {
      billingPeriod: 'annual',
      localizedPrice: annual.localizedPrice,
      productIdentifier: annual.productIdentifier,
    },
    {
      billingPeriod: 'monthly',
      localizedPrice: monthly.localizedPrice,
      productIdentifier: monthly.productIdentifier,
    },
  ];
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

  async getCurrentOfferingSnapshot(): Promise<JournalCloudOfferingSnapshot | null> {
    const offerings = await this.getOfferings();
    return toJournalCloudOfferingSnapshot(offerings?.current ?? null);
  }

  async purchasePlan(
    billingPeriod: JournalCloudPlanSnapshot['billingPeriod'],
  ): Promise<JournalCloudPurchaseSnapshot> {
    if (!this.currentUserId) {
      throw new JournalCloudAccountRequiredError();
    }

    if (!this.initialize(this.currentUserId)) {
      throw new Error('Journal Cloud billing is not configured.');
    }

    const offerings = await this.sdk.getOfferings();
    const currentOffering = offerings.current ?? null;
    const snapshot = toJournalCloudOfferingSnapshot(currentOffering);
    const validationIssues = validateJournalCloudOffering(snapshot);
    if (!currentOffering || validationIssues.length > 0) {
      throw new Error(
        `Journal Cloud store catalog is unavailable (${
          validationIssues.join(',') || 'missing_offering'
        }).`,
      );
    }

    const expectedPackage = findJournalCloudPlanPackage(
      snapshot!,
      billingPeriod,
    );
    const packageItem = currentOffering.availablePackages.find(
      item =>
        item.identifier === expectedPackage?.packageIdentifier &&
        item.product.identifier === expectedPackage?.productIdentifier,
    );
    if (!packageItem) {
      throw new Error('The selected Journal Cloud plan is unavailable.');
    }

    const result = await this.sdk.purchasePackage(packageItem);
    if (result.productIdentifier !== expectedPackage?.productIdentifier) {
      throw new Error(
        'The store returned an unexpected Journal Cloud product.',
      );
    }

    return {
      productIdentifier: result.productIdentifier,
      clientEntitlement: toJournalCloudEntitlementSnapshot(
        result.customerInfo,
        this.configuration.entitlementIdentifier,
      ),
      // CustomerInfo is useful for immediate UX only. The mobile app must wait
      // for the owner-scoped Supabase projection before enabling cloud access.
      serverConfirmationRequired: true,
    };
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
