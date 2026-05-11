import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  FlatList,
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  UIManager,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { Colors } from '../theme/colors';
import { triggerLightHaptic } from '../utils/haptics';

const ADMIN_EMAILS = ['nikki.batanes@sifia.app', 'nikkibatanes@gmail.com'];

type FilterTab = 'overview' | 'trials' | 'paid' | 'issues' | 'webhooks';

interface Overview {
  total_users: number;
  active_trials: number;
  stuck_trials: number;
  paid_active: number;
  converted_trials: number;
  cancelled: number;
  expired: number;
  billing_issues: number;
  total_trials_ever: number;
  seeker_free: number;
}

interface SubscriptionRow {
  user_id: string;
  email: string | null;
  first_name: string | null;
  full_name: string | null;
  tier: string;
  status: string;
  subscription_display_name: string | null;
  trial_chosen_tier: string | null;
  billing_cycle: string | null;
  trial_start_date: string | null;
  trial_end_date: string | null;
  trial_converted_date: string | null;
  trial_cancelled_date: string | null;
  cancellation_date: string | null;
  subscription_start_date: string | null;
  subscription_end_date: string | null;
  auto_renew_enabled: boolean | null;
  billing_issue: boolean | null;
  grace_period_end_date: string | null;
  original_transaction_id: string | null;
  platform_transaction_id: string | null;
  updated_at: string | null;
  days_remaining: number | null;
}

interface WebhookRow {
  id: number;
  received_at: string;
  notification_type: string | null;
  subtype: string | null;
  transaction_id: string | null;
  original_transaction_id: string | null;
  product_id: string | null;
}

function formatDate(iso: string | null): string {
  if (!iso) { return '—'; }
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function displayName(row: SubscriptionRow): string {
  if (row.full_name?.trim()) { return row.full_name.trim(); }
  if (row.first_name?.trim()) { return row.first_name.trim(); }
  return row.email || row.user_id.slice(0, 8);
}

function tierColor(row: SubscriptionRow): string {
  if (row.billing_issue) { return '#FF3B30'; }
  if (row.tier === 'free_trial') {
    if (row.trial_end_date && new Date(row.trial_end_date) < new Date()) { return '#FF9500'; }
    if (row.trial_cancelled_date) { return '#FF9500'; }
    return '#FFC107';
  }
  if (row.tier === 'seeker') { return 'rgba(255,255,255,0.35)'; }
  if (row.status === 'expired') { return 'rgba(255,255,255,0.35)'; }
  return Colors.growthGreen;
}

function tierLabel(row: SubscriptionRow): string {
  if (row.billing_issue) { return 'BILLING ISSUE'; }
  if (row.tier === 'free_trial') {
    if (row.trial_end_date && new Date(row.trial_end_date) < new Date()) { return 'TRIAL EXPIRED'; }
    if (row.trial_cancelled_date) { return 'TRIAL CANCELLED'; }
    return 'FREE TRIAL';
  }
  if (row.tier === 'seeker' && !row.original_transaction_id && !row.trial_start_date) { return 'FREE'; }
  return (row.tier || '').toUpperCase().replace('_', ' ');
}

const FILTER_TABS: { key: FilterTab; label: string; icon: string }[] = [
  { key: 'overview', label: 'Overview', icon: 'analytics' },
  { key: 'trials', label: 'Trials', icon: 'timer' },
  { key: 'paid', label: 'Paid', icon: 'card' },
  { key: 'issues', label: 'Issues', icon: 'warning' },
  { key: 'webhooks', label: 'Webhooks', icon: 'webhook' },
];

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// StepFadeIn component
interface StepFadeInProps {
  delay?: number;
  children: React.ReactNode;
  style?: any;
}

const StepFadeIn: React.FC<StepFadeInProps> = ({ delay = 0, children, style }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 340,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          tension: 55,
          friction: 10,
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);
    return () => clearTimeout(t);
  }, [delay, opacity, translateY]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
};

interface Props {
  navigation: any;
}

export default function AdminDashboardScreen({ navigation }: Props) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<FilterTab>('overview');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [rows, setRows] = useState<SubscriptionRow[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const userEmail = (user as any)?.email || '';
  const isAdmin = ADMIN_EMAILS.includes(userEmail);

  const loadOverview = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_subscription_overview');
    if (!error && data) { setOverview(data as Overview); }
  }, []);

  const loadRows = useCallback(async (filter: string) => {
    const { data, error } = await supabase.rpc('admin_get_subscriptions', { p_filter: filter });
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setRows((data as SubscriptionRow[]) || []);
    }
  }, []);

  const loadWebhooks = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_get_webhook_events', { p_limit: 100 });
    if (!error) { setWebhooks((data as WebhookRow[]) || []); }
  }, []);

  const refresh = useCallback(async (tab: FilterTab = activeTab) => {
    setLoading(true);
    try {
      await loadOverview();
      if (tab === 'webhooks') {
        await loadWebhooks();
      } else if (tab !== 'overview') {
        await loadRows(tab);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, loadOverview, loadRows, loadWebhooks]);

  useEffect(() => {
    if (isAdmin) { refresh(activeTab); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, activeTab]);

  const onTabPress = (tab: FilterTab) => {
    setActiveTab(tab);
    setExpandedId(null);
  };

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Ionicons name="lock-closed" size={48} color="rgba(255,255,255,0.4)" />
          <Text style={styles.noAccessText}>Admin access only</Text>
        </View>
      </SafeAreaView>
    );
  }

  const renderStatCard = (label: string, value: number | undefined, color: string, delay: number = 0) => (
    <StepFadeIn delay={delay} style={[styles.statCard, { borderLeftColor: color }]}>
      <Text style={[styles.statValue, { color }]}>{value ?? '—'}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </StepFadeIn>
  );

  const renderOverview = () => (
    <ScrollView
      style={styles.stepScroll}
      contentContainerStyle={[styles.stepContent, { paddingTop: insets.top + 8 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); refresh('overview'); }} tintColor={Colors.hopeWhite} />}
      showsVerticalScrollIndicator={false}
    >
      <StepFadeIn delay={0}>
        <View style={styles.focusLabelContainer}>
          <MaterialIcons name="analytics" size={16} color={Colors.alertCoral} style={styles.labelIcon} />
          <Text style={styles.focusLabel}>ADMIN DASHBOARD</Text>
        </View>
      </StepFadeIn>

      <StepFadeIn delay={80}>
        <View style={styles.titleRow}>
          <Text style={styles.stepTitle}>Overview</Text>
        </View>
      </StepFadeIn>

      <StepFadeIn delay={160} style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Subscriptions</Text>
        <View style={styles.statGrid}>
          {renderStatCard('Active Trials', overview?.active_trials, '#FFC107', 0)}
          {renderStatCard('Paid Active', overview?.paid_active, Colors.growthGreen, 40)}
          {renderStatCard('Converted', overview?.converted_trials, '#34C759', 80)}
          {renderStatCard('Billing Issues', overview?.billing_issues, '#FF3B30', 120)}
        </View>
        <View style={styles.statGrid}>
          {renderStatCard('Stuck Trials', overview?.stuck_trials, '#FF9500', 0)}
          {renderStatCard('Cancelled', overview?.cancelled, '#FF9500', 40)}
          {renderStatCard('Expired', overview?.expired, 'rgba(255,255,255,0.4)', 80)}
          {renderStatCard('Free (No Sub)', overview?.seeker_free, 'rgba(255,255,255,0.4)', 120)}
        </View>
      </StepFadeIn>

      <StepFadeIn delay={240} style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Lifetime</Text>
        <View style={styles.statGrid}>
          {renderStatCard('Total Users', overview?.total_users, Colors.hopeWhite, 0)}
          {renderStatCard('Total Trials Started', overview?.total_trials_ever, '#FFC107', 40)}
        </View>
      </StepFadeIn>

      {overview && overview.total_trials_ever > 0 && (
        <StepFadeIn delay={320} style={styles.conversionBox}>
          <Text style={styles.conversionLabel}>Trial → Paid Conversion Rate</Text>
          <Text style={styles.conversionValue}>
            {Math.round(((overview.converted_trials || 0) / overview.total_trials_ever) * 100)}%
          </Text>
          <Text style={styles.conversionSub}>
            {overview.converted_trials} of {overview.total_trials_ever} trials converted
          </Text>
        </StepFadeIn>
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );

  const renderRow = ({ item }: { item: SubscriptionRow }) => {
    const expanded = expandedId === item.user_id;
    const badgeColor = tierColor(item);
    const label = tierLabel(item);
    const name = displayName(item);
    const daysLeft = item.days_remaining;

    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => setExpandedId(expanded ? null : item.user_id)}
        activeOpacity={0.75}
      >
        <View style={styles.rowMain}>
          <View style={[styles.badge, { backgroundColor: badgeColor + '30', borderColor: badgeColor }]}>
            <Text style={[styles.badgeText, { color: badgeColor }]}>{label}</Text>
          </View>
          <View style={styles.rowInfo}>
            <Text style={styles.rowName} numberOfLines={1}>{name}</Text>
            <Text style={styles.rowEmail} numberOfLines={1}>{item.email || '—'}</Text>
          </View>
          <View style={styles.rowRight}>
            {daysLeft !== null && (
              <Text style={[styles.daysText, { color: daysLeft < 0 ? '#FF3B30' : daysLeft < 1 ? '#FF9500' : Colors.hopeWhite }]}>
                {daysLeft < 0 ? `${Math.abs(Math.round(daysLeft))}d ago` : `${Math.round(daysLeft)}d left`}
              </Text>
            )}
            {item.billing_cycle && (
              <Text style={styles.cycleText}>{item.billing_cycle}</Text>
            )}
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color="rgba(255,255,255,0.4)" />
          </View>
        </View>

        {expanded && (
          <View style={styles.rowDetail}>
            <DetailRow label="Tier" value={item.tier} />
            <DetailRow label="Status" value={item.status} />
            <DetailRow label="Trial tier" value={item.trial_chosen_tier} />
            <DetailRow label="Trial start" value={formatDate(item.trial_start_date)} />
            <DetailRow label="Trial end" value={formatDate(item.trial_end_date)} />
            <DetailRow label="Converted" value={formatDate(item.trial_converted_date)} />
            <DetailRow label="Trial cancelled" value={formatDate(item.trial_cancelled_date)} />
            <DetailRow label="Sub start" value={formatDate(item.subscription_start_date)} />
            <DetailRow label="Sub end" value={formatDate(item.subscription_end_date)} />
            <DetailRow label="Cancelled" value={formatDate(item.cancellation_date)} />
            <DetailRow label="Auto-renew" value={item.auto_renew_enabled === null ? '—' : item.auto_renew_enabled ? 'Yes' : 'No'} />
            <DetailRow label="Billing issue" value={item.billing_issue ? 'YES' : 'No'} highlight={!!item.billing_issue} />
            <DetailRow label="Grace period end" value={formatDate(item.grace_period_end_date)} />
            <DetailRow label="Orig TxID" value={item.original_transaction_id ? item.original_transaction_id.slice(0, 16) + '…' : '—'} />
            <DetailRow label="Updated" value={formatDate(item.updated_at)} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderWebhookRow = ({ item }: { item: WebhookRow }) => (
    <View style={styles.webhookRow}>
      <View style={styles.webhookLeft}>
        <Text style={styles.webhookType}>{item.notification_type || '—'}</Text>
        {item.subtype ? <Text style={styles.webhookSub}>{item.subtype}</Text> : null}
      </View>
      <View style={styles.webhookRight}>
        <Text style={styles.webhookDate}>{formatDate(item.received_at)}</Text>
        <Text style={[styles.webhookDetail, { color: item.transaction_id ? Colors.growthGreen : '#FF3B30' }]}>
          {item.transaction_id ? 'has txn' : 'no txn'}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Close button - top right */}
      <View style={[styles.closeButton, { top: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => {
            triggerLightHaptic();
            navigation.goBack();
          }}
          style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={17} color="rgba(255,255,255,0.65)" />
        </TouchableOpacity>
      </View>

      {/* Filter tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabsContent}>
        {FILTER_TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => {
              triggerLightHaptic();
              onTabPress(tab.key);
            }}
          >
            <Ionicons name={tab.icon as any} size={16} color={activeTab === tab.key ? Colors.hopeWhite : 'rgba(255,255,255,0.6)'} style={styles.tabIcon} />
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Refresh button - floating */}
      <TouchableOpacity
        onPress={() => {
          triggerLightHaptic();
          refresh();
        }}
        style={[styles.floatingRefreshButton, { bottom: insets.bottom + 20 }]}
        activeOpacity={0.7}
      >
        {loading
          ? <ActivityIndicator size="small" color={Colors.hopeWhite} />
          : <Ionicons name="refresh" size={20} color={Colors.hopeWhite} />}
      </TouchableOpacity>

      {/* Content */}
      {activeTab === 'overview' && renderOverview()}

      {(activeTab === 'trials' || activeTab === 'paid' || activeTab === 'issues') && (
        <FlatList
          data={rows}
          keyExtractor={item => item.user_id}
          renderItem={renderRow}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); refresh(activeTab); }}
              tintColor={Colors.hopeWhite}
            />
          }
          ListEmptyComponent={
            loading ? null : (
              <View style={styles.center}>
                <Text style={styles.emptyText}>No records</Text>
              </View>
            )
          }
          ListHeaderComponent={
            rows.length > 0 ? (
              <Text style={styles.rowCount}>{rows.length} records</Text>
            ) : null
          }
        />
      )}

      {activeTab === 'webhooks' && (
        <FlatList
          data={webhooks}
          keyExtractor={item => String(item.id)}
          renderItem={renderWebhookRow}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); refresh('webhooks'); }}
              tintColor={Colors.hopeWhite}
            />
          }
          ListEmptyComponent={
            loading ? null : (
              <View style={styles.center}>
                <Text style={styles.emptyText}>No webhook events</Text>
              </View>
            )
          }
          ListHeaderComponent={
            webhooks.length > 0 ? (
              <Text style={styles.rowCount}>{webhooks.length} events</Text>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

function DetailRow({ label, value, highlight = false }: { label: string; value: string | null | undefined; highlight?: boolean }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, highlight && styles.detailHighlight]}>{value || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.anchorBlue },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  noAccessText: { marginTop: 12, color: 'rgba(255,255,255,0.5)', fontSize: 15 },

  // Walkthrough-style close button
  closeButton: {
    position: 'absolute',
    right: 16,
    width: 32,
    height: 32,
    zIndex: 100,
  },

  // Walkthrough-style layout
  stepScroll: { flex: 1 },
  stepContent: { paddingHorizontal: 20, paddingBottom: 40 },
  focusLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  labelIcon: { marginRight: 6 },
  focusLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.alertCoral,
    letterSpacing: 1.2,
  },
  titleRow: { marginBottom: 8 },
  stepTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.hopeWhite,
    lineHeight: 34,
  },
  sectionContainer: { marginTop: 32 },

  // Tab navigation
  tabsScroll: { flexGrow: 0, marginTop: 16 },
  tabsContent: { paddingHorizontal: 16, gap: 8, flexDirection: 'row' },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    gap: 6,
  },
  tabActive: { backgroundColor: Colors.alertCoral },
  tabIcon: {},
  tabText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },
  tabTextActive: { color: Colors.hopeWhite, fontWeight: '700' },

  // Floating refresh button
  floatingRefreshButton: {
    position: 'absolute',
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },

  // Overview content
  sectionTitle: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.5)', letterSpacing: 1.2, marginBottom: 12 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    flex: 1, minWidth: '44%',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12, padding: 16,
    borderLeftWidth: 3,
  },
  statValue: { fontSize: 28, fontWeight: '800', marginBottom: 4 },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },

  conversionBox: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16, padding: 24, marginTop: 20,
    alignItems: 'center',
  },
  conversionLabel: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 8 },
  conversionValue: { fontSize: 44, fontWeight: '900', color: Colors.growthGreen },
  conversionSub: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 6 },

  // List content
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  rowCount: { fontSize: 11, color: 'rgba(255,255,255,0.35)', paddingVertical: 8, paddingHorizontal: 2 },

  row: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12, marginBottom: 10, overflow: 'hidden',
  },
  rowMain: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  badge: {
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
    minWidth: 80, alignItems: 'center',
  },
  badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: '600', color: Colors.hopeWhite },
  rowEmail: { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  daysText: { fontSize: 12, fontWeight: '700' },
  cycleText: { fontSize: 10, color: 'rgba(255,255,255,0.4)' },

  rowDetail: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16, paddingVertical: 12, gap: 8,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between' },
  detailLabel: { fontSize: 12, color: 'rgba(255,255,255,0.4)', width: 130 },
  detailValue: { fontSize: 12, color: 'rgba(255,255,255,0.75)', flex: 1, textAlign: 'right' },
  detailHighlight: { color: '#FF3B30', fontWeight: '700' },

  webhookRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  webhookLeft: { flex: 1 },
  webhookType: { fontSize: 14, fontWeight: '600', color: Colors.hopeWhite },
  webhookSub: { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  webhookRight: { alignItems: 'flex-end' },
  webhookDate: { fontSize: 12, color: 'rgba(255,255,255,0.45)' },
  webhookDetail: { fontSize: 12, fontWeight: '600', marginTop: 4 },

  emptyText: { color: 'rgba(255,255,255,0.35)', fontSize: 14 },
});
