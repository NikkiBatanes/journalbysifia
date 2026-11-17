import type {CustomerInfo, PurchasesOfferings} from 'react-native-purchases';

import {
  JournalCloudAccountRequiredError,
  JournalCloudBillingCoordinator,
  hasActiveJournalCloudEntitlement,
  toJournalCloudEntitlementSnapshot,
  toJournalCloudOfferingSnapshot,
  toJournalCloudPlanSnapshots,
  validateJournalCloudOffering,
  type JournalCloudBillingSdk,
} from '../journalCloudBillingService';

const customerInfo = (active = false): CustomerInfo => ({
  entitlements: {
    active: active
      ? {
          journal_cloud: {
            expirationDate: '2027-01-01T00:00:00Z',
            willRenew: true,
          },
        }
      : {},
  },
} as unknown as CustomerInfo);

const createSdk = (): jest.Mocked<JournalCloudBillingSdk> => ({
  setLogLevel: jest.fn().mockResolvedValue(undefined),
  configure: jest.fn(),
  logIn: jest.fn().mockResolvedValue({}),
  logOut: jest.fn().mockResolvedValue(customerInfo()),
  getCustomerInfo: jest.fn().mockResolvedValue(customerInfo()),
  getOfferings: jest.fn().mockResolvedValue({} as PurchasesOfferings),
  restorePurchases: jest.fn().mockResolvedValue(customerInfo(true)),
});

const createCoordinator = (
  sdk: jest.Mocked<JournalCloudBillingSdk>,
  apiKey = 'appl_public_test_key',
) => new JournalCloudBillingCoordinator(sdk, {
  platform: 'ios',
  apiKey,
  entitlementIdentifier: 'journal_cloud',
  debugLogging: false,
});

describe('JournalCloudBillingCoordinator', () => {
  it('stays disabled when no public SDK key is configured', async () => {
    const sdk = createSdk();
    const coordinator = createCoordinator(sdk, '');

    await coordinator.syncIdentity('user-a');

    expect(coordinator.isConfigured()).toBe(false);
    expect(sdk.configure).not.toHaveBeenCalled();
    expect(sdk.logIn).not.toHaveBeenCalled();
  });

  it('configures once with the signed-in Supabase user ID', async () => {
    const sdk = createSdk();
    const coordinator = createCoordinator(sdk);

    await coordinator.syncIdentity(' user-a ');
    await coordinator.syncIdentity('user-a');

    expect(sdk.configure).toHaveBeenCalledTimes(1);
    expect(sdk.configure).toHaveBeenCalledWith({
      apiKey: 'appl_public_test_key',
      appUserID: 'user-a',
    });
    expect(sdk.logIn).not.toHaveBeenCalled();
  });

  it('identifies an anonymous session after sign-in and logs out on app sign-out', async () => {
    const sdk = createSdk();
    const coordinator = createCoordinator(sdk);

    await coordinator.syncIdentity(null);
    await coordinator.syncIdentity('user-a');
    await coordinator.syncIdentity(null);

    expect(sdk.configure).toHaveBeenCalledWith({apiKey: 'appl_public_test_key'});
    expect(sdk.logIn).toHaveBeenCalledWith('user-a');
    expect(sdk.logOut).toHaveBeenCalledTimes(1);
  });

  it('switches directly between authenticated accounts', async () => {
    const sdk = createSdk();
    const coordinator = createCoordinator(sdk);

    await coordinator.syncIdentity('user-a');
    await coordinator.syncIdentity('user-b');

    expect(sdk.logIn).toHaveBeenCalledWith('user-b');
    expect(sdk.logOut).not.toHaveBeenCalled();
  });

  it('requires an account before restoring purchases', async () => {
    const sdk = createSdk();
    const coordinator = createCoordinator(sdk);

    await coordinator.syncIdentity(null);

    await expect(coordinator.restorePurchases()).rejects.toBeInstanceOf(
      JournalCloudAccountRequiredError,
    );
    expect(sdk.restorePurchases).not.toHaveBeenCalled();
  });

  it('returns the active Journal Cloud entitlement after restore', async () => {
    const sdk = createSdk();
    const coordinator = createCoordinator(sdk);

    await coordinator.syncIdentity('user-a');

    await expect(coordinator.restorePurchases()).resolves.toEqual({
      active: true,
      entitlementIdentifier: 'journal_cloud',
      expirationDate: '2027-01-01T00:00:00Z',
      willRenew: true,
    });
  });
});

describe('Journal Cloud entitlement helpers', () => {
  it('treats only the named active entitlement as active', () => {
    expect(hasActiveJournalCloudEntitlement(customerInfo(true))).toBe(true);
    expect(hasActiveJournalCloudEntitlement(customerInfo(false))).toBe(false);
    expect(toJournalCloudEntitlementSnapshot(customerInfo(false))).toEqual({
      active: false,
      entitlementIdentifier: 'journal_cloud',
      expirationDate: null,
      willRenew: false,
    });
  });
});

describe('Journal Cloud offering helpers', () => {
  const offering = {
    identifier: 'default',
    availablePackages: [
      {
        identifier: '$rc_monthly',
        packageType: 'MONTHLY',
        product: {
          identifier: 'app.journal.sifia.cloud.monthly',
          priceString: '₱59.00',
          currencyCode: 'PHP',
          subscriptionPeriod: 'P1M',
        },
      },
      {
        identifier: '$rc_annual',
        packageType: 'ANNUAL',
        product: {
          identifier: 'app.journal.sifia.cloud.annual',
          priceString: '₱599.00',
          currencyCode: 'PHP',
          subscriptionPeriod: 'P1Y',
        },
      },
    ],
  } as unknown as NonNullable<PurchasesOfferings['current']>;

  it('keeps only safe catalog fields for the paywall read path', () => {
    expect(toJournalCloudOfferingSnapshot(offering)).toEqual({
      offeringIdentifier: 'default',
      packages: [
        {
          packageIdentifier: '$rc_monthly',
          packageType: 'MONTHLY',
          productIdentifier: 'app.journal.sifia.cloud.monthly',
          localizedPrice: '₱59.00',
          currencyCode: 'PHP',
          subscriptionPeriod: 'P1M',
        },
        {
          packageIdentifier: '$rc_annual',
          packageType: 'ANNUAL',
          productIdentifier: 'app.journal.sifia.cloud.annual',
          localizedPrice: '₱599.00',
          currencyCode: 'PHP',
          subscriptionPeriod: 'P1Y',
        },
      ],
    });
  });

  it('accepts the expected default monthly and annual catalog', () => {
    expect(validateJournalCloudOffering(toJournalCloudOfferingSnapshot(offering)))
      .toEqual([]);
  });

  it('builds annual-first display plans using only store-localized prices', () => {
    expect(toJournalCloudPlanSnapshots(toJournalCloudOfferingSnapshot(offering)))
      .toEqual([
        {
          billingPeriod: 'annual',
          localizedPrice: '₱599.00',
          productIdentifier: 'app.journal.sifia.cloud.annual',
        },
        {
          billingPeriod: 'monthly',
          localizedPrice: '₱59.00',
          productIdentifier: 'app.journal.sifia.cloud.monthly',
        },
      ]);
  });

  it('does not invent prices when the store catalog is incomplete', () => {
    expect(toJournalCloudPlanSnapshots(null)).toEqual([]);
    expect(toJournalCloudPlanSnapshots({
      offeringIdentifier: 'default',
      packages: [],
    })).toEqual([]);
  });

  it('reports missing products without treating the catalog as purchase authority', () => {
    expect(validateJournalCloudOffering(null)).toEqual([
      'current_offering_missing',
    ]);
    expect(
      validateJournalCloudOffering({
        offeringIdentifier: 'default',
        packages: [],
      }),
    ).toEqual(['monthly_product_missing', 'annual_product_missing']);
  });
});
