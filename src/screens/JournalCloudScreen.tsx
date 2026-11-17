import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';

import HeaderBackButton from '../components/common/HeaderBackButton';
import ThemedText from '../components/common/ThemedText';
import {useAuth} from '../context/IndustryStandardAuthContext';
import {
  journalCloudBillingService,
  toJournalCloudPlanSnapshots,
  type JournalCloudPlanSnapshot,
} from '../services/journalCloudBillingService';
import {Colors} from '../theme/colors';
import {triggerLightHaptic} from '../utils/haptics';
import {navigateFromRoot} from '../utils/navigationHelpers';
import {Logger} from '../utils/ProductionLogger';

const FEATURES = [
  'Automatic backup and sync across your devices',
  'Restore after reinstalling or moving to a new phone',
  'Journal-only entries, note blocks and compressed photos',
  '5 GB total storage for one private Journal Vault',
];

const JournalCloudScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const {user} = useAuth();
  const [plans, setPlans] = useState<JournalCloudPlanSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogUnavailable, setCatalogUnavailable] = useState(false);

  const loadPlans = useCallback(async () => {
    setLoading(true);
    setCatalogUnavailable(false);
    try {
      const snapshot = await journalCloudBillingService.getCurrentOfferingSnapshot();
      const nextPlans = toJournalCloudPlanSnapshots(snapshot);
      setPlans(nextPlans);
      setCatalogUnavailable(nextPlans.length === 0);
    } catch (error) {
      setPlans([]);
      setCatalogUnavailable(true);
      Logger.warn('Journal Cloud offering could not be displayed', {
        component: 'JournalCloudScreen',
        reason: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const openLegal = useCallback((url: string) => {
    triggerLightHaptic();
    Linking.openURL(url).catch(error => {
      Logger.warn('Journal Cloud legal link could not be opened', {
        component: 'JournalCloudScreen',
        reason: error instanceof Error ? error.message : String(error),
      });
    });
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={Colors.lightBackground}
      />
      <View style={styles.header}>
        <HeaderBackButton
          accessibilityLabel="Close Journal Cloud"
          onPress={() => {
            triggerLightHaptic();
            navigation.goBack();
          }}
        />
        <ThemedText weight="semiBold" style={styles.headerTitle}>
          Journal Cloud
        </ThemedText>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          {paddingBottom: Math.max(insets.bottom, 20) + 24},
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.previewBadge}>
          <Ionicons name="shield-checkmark-outline" size={15} color={Colors.sage} />
          <ThemedText weight="semiBold" style={styles.previewBadgeText}>
            SECURE PREVIEW
          </ThemedText>
        </View>

        <View style={styles.heroIcon}>
          <Ionicons name="cloud-done-outline" size={42} color={Colors.sage} />
        </View>
        <ThemedText weight="bold" style={styles.title}>
          Your journal, backed up wherever you go.
        </ThemedText>
        <ThemedText style={styles.subtitle}>
          Protect the Journal by siFia content that lives beyond the siFia app,
          including richer entries, note blocks and photos.
        </ThemedText>

        <View style={styles.boundaryCard}>
          <Ionicons name="sync-outline" size={22} color={Colors.sage} />
          <View style={styles.boundaryCopy}>
            <ThemedText weight="semiBold" style={styles.boundaryTitle}>
              Your existing siFia sync stays free
            </ThemedText>
            <ThemedText style={styles.boundaryText}>
              Compatible records from your siFia account continue syncing at no
              extra cost. Journal Cloud covers Journal-only data and media.
            </ThemedText>
          </View>
        </View>

        <ThemedText weight="semiBold" style={styles.sectionTitle}>
          What Journal Cloud protects
        </ThemedText>
        <View style={styles.featureCard}>
          {FEATURES.map(feature => (
            <View key={feature} style={styles.featureRow}>
              <View style={styles.checkIcon}>
                <Ionicons name="checkmark" size={15} color={Colors.hopeWhite} />
              </View>
              <ThemedText style={styles.featureText}>{feature}</ThemedText>
            </View>
          ))}
        </View>

        <ThemedText weight="semiBold" style={styles.sectionTitle}>
          Choose a plan
        </ThemedText>
        <ThemedText style={styles.storePriceNote}>
          Your App Store shows the final price for your country.
        </ThemedText>

        {loading ? (
          <View style={styles.catalogState} accessibilityLabel="Loading Journal Cloud prices">
            <ActivityIndicator size="small" color={Colors.sage} />
            <ThemedText style={styles.catalogStateText}>Loading store prices…</ThemedText>
          </View>
        ) : catalogUnavailable ? (
          <View style={styles.catalogState}>
            <ThemedText weight="semiBold" style={styles.catalogStateTitle}>
              Store prices are temporarily unavailable
            </ThemedText>
            <ThemedText style={styles.catalogStateText}>
              No price has been guessed or substituted. Check your connection and try again.
            </ThemedText>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Retry loading Journal Cloud prices"
              activeOpacity={0.7}
              onPress={() => {
                triggerLightHaptic();
                loadPlans();
              }}
              style={styles.retryButton}>
              <ThemedText weight="semiBold" style={styles.retryButtonText}>Retry</ThemedText>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.plans}>
            {plans.map(plan => {
              const annual = plan.billingPeriod === 'annual';
              return (
                <View
                  key={plan.productIdentifier}
                  accessibilityLabel={`${annual ? 'Annual' : 'Monthly'} plan, ${plan.localizedPrice}`}
                  style={[styles.planCard, annual && styles.recommendedPlan]}>
                  <View style={styles.planHeading}>
                    <View>
                      <ThemedText weight="semiBold" style={styles.planTitle}>
                        {annual ? 'Annual' : 'Monthly'}
                      </ThemedText>
                      <ThemedText style={styles.planCaption}>
                        {annual ? 'Billed once each year' : 'Billed every month'}
                      </ThemedText>
                    </View>
                    {annual && (
                      <View style={styles.valueBadge}>
                        <ThemedText weight="semiBold" style={styles.valueBadgeText}>
                          BEST VALUE
                        </ThemedText>
                      </View>
                    )}
                  </View>
                  <View style={styles.priceRow}>
                    <ThemedText weight="bold" style={styles.price}>{plan.localizedPrice}</ThemedText>
                    <ThemedText style={styles.pricePeriod}>/{annual ? 'year' : 'month'}</ThemedText>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {!user ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Sign in to continue with Journal Cloud"
            activeOpacity={0.8}
            onPress={() => {
              triggerLightHaptic();
              navigateFromRoot(navigation, 'Auth', {screen: 'Login'});
            }}
            style={styles.primaryButton}>
            <ThemedText weight="semiBold" style={styles.primaryButtonText}>
              Sign in to continue
            </ThemedText>
          </TouchableOpacity>
        ) : (
          <View
            accessibilityLabel="Journal Cloud purchases are not enabled yet"
            style={[styles.primaryButton, styles.disabledButton]}>
            <Ionicons name="lock-closed-outline" size={17} color={Colors.textGray} />
            <ThemedText weight="semiBold" style={styles.disabledButtonText}>
              Secure purchase setup in progress
            </ThemedText>
          </View>
        )}

        <ThemedText style={styles.purchaseNotice}>
          Purchases and cloud uploads are not enabled in this preview. A store
          receipt alone will never authorize access to private journal data.
        </ThemedText>

        <TouchableOpacity
          disabled
          accessibilityRole="button"
          accessibilityState={{disabled: true}}
          accessibilityLabel="Restore purchases, not yet available"
          style={styles.restoreButton}>
          <ThemedText weight="semiBold" style={styles.restoreText}>
            Restore purchases · Not yet available
          </ThemedText>
        </TouchableOpacity>

        <View style={styles.legalRow}>
          <TouchableOpacity
            accessibilityRole="link"
            onPress={() => openLegal('https://sifia.app/legal/terms')}>
            <ThemedText style={styles.legalLink}>Terms</ThemedText>
          </TouchableOpacity>
          <ThemedText style={styles.legalDot}>•</ThemedText>
          <TouchableOpacity
            accessibilityRole="link"
            onPress={() => openLegal('https://sifia.app/legal/privacy')}>
            <ThemedText style={styles.legalLink}>Privacy</ThemedText>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: Colors.lightBackground},
  header: {
    minHeight: 56,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {fontSize: 17, color: Colors.text},
  headerPlaceholder: {width: 42, height: 42},
  content: {paddingHorizontal: 22, paddingTop: 12},
  previewBadge: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
    backgroundColor: Colors.anchorBlueLight,
    borderWidth: 1,
    borderColor: Colors.lightBorder,
  },
  previewBadgeText: {fontSize: 11, letterSpacing: 0.8, color: Colors.sage},
  heroIcon: {
    alignSelf: 'center',
    marginTop: 22,
    width: 76,
    height: 76,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.hopeWhite,
    borderWidth: 1,
    borderColor: Colors.lightBorder,
  },
  title: {
    marginTop: 18,
    fontSize: 30,
    lineHeight: 38,
    color: Colors.text,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 23,
    color: Colors.textGray,
    textAlign: 'center',
  },
  boundaryCard: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 18,
    backgroundColor: Colors.anchorBlueLight,
    borderWidth: 1,
    borderColor: Colors.lightBorder,
  },
  boundaryCopy: {flex: 1, marginLeft: 12},
  boundaryTitle: {fontSize: 15, lineHeight: 20, color: Colors.text},
  boundaryText: {marginTop: 5, fontSize: 13, lineHeight: 20, color: Colors.textGray},
  sectionTitle: {marginTop: 28, fontSize: 18, color: Colors.text},
  featureCard: {
    marginTop: 12,
    padding: 16,
    borderRadius: 18,
    backgroundColor: Colors.hopeWhite,
    borderWidth: 1,
    borderColor: Colors.lightBorder,
    gap: 14,
  },
  featureRow: {flexDirection: 'row', alignItems: 'flex-start'},
  checkIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.sage,
    marginTop: 1,
  },
  featureText: {flex: 1, marginLeft: 11, fontSize: 14, lineHeight: 21, color: Colors.text},
  storePriceNote: {marginTop: 5, fontSize: 13, lineHeight: 19, color: Colors.textGray},
  catalogState: {
    marginTop: 12,
    minHeight: 126,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 18,
    backgroundColor: Colors.hopeWhite,
    borderWidth: 1,
    borderColor: Colors.lightBorder,
  },
  catalogStateTitle: {fontSize: 15, textAlign: 'center', color: Colors.text},
  catalogStateText: {marginTop: 8, fontSize: 13, lineHeight: 19, textAlign: 'center', color: Colors.textGray},
  retryButton: {marginTop: 14, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 999, backgroundColor: Colors.anchorBlueLight},
  retryButtonText: {fontSize: 14, color: Colors.sage},
  plans: {marginTop: 12, gap: 12},
  planCard: {
    padding: 17,
    borderRadius: 18,
    backgroundColor: Colors.hopeWhite,
    borderWidth: 1,
    borderColor: Colors.lightBorder,
  },
  recommendedPlan: {borderWidth: 2, borderColor: Colors.sage},
  planHeading: {flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between'},
  planTitle: {fontSize: 17, color: Colors.text},
  planCaption: {marginTop: 3, fontSize: 12, color: Colors.textGray},
  valueBadge: {paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: Colors.sage},
  valueBadgeText: {fontSize: 10, letterSpacing: 0.6, color: Colors.hopeWhite},
  priceRow: {marginTop: 17, flexDirection: 'row', alignItems: 'baseline'},
  price: {fontSize: 25, color: Colors.text},
  pricePeriod: {marginLeft: 5, fontSize: 13, color: Colors.textGray},
  primaryButton: {
    minHeight: 52,
    marginTop: 22,
    borderRadius: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.sage,
    gap: 8,
  },
  primaryButtonText: {fontSize: 16, color: Colors.hopeWhite},
  disabledButton: {backgroundColor: Colors.lightGray},
  disabledButtonText: {fontSize: 15, color: Colors.textGray},
  purchaseNotice: {marginTop: 12, fontSize: 12, lineHeight: 18, textAlign: 'center', color: Colors.textGray},
  restoreButton: {alignSelf: 'center', marginTop: 18, paddingVertical: 8, opacity: 0.6},
  restoreText: {fontSize: 13, color: Colors.textGray},
  legalRow: {marginTop: 18, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10},
  legalLink: {fontSize: 12, color: Colors.sage, textDecorationLine: 'underline'},
  legalDot: {fontSize: 12, color: Colors.textGray},
});

export default JournalCloudScreen;
