import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  FlatList,
  Alert,
  Animated,
  Platform,
  UIManager,
  StatusBar,
  TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { Colors } from '../theme/colors';
import { triggerLightHaptic } from '../utils/haptics';
import { adminDashboardService, DashboardMetrics } from '../services/adminDashboardService';
import ThemedText from '../components/common/ThemedText';
import { Logger } from '../utils/ProductionLogger';

const ADMIN_EMAILS = ['nikki.batanes@sifia.app', 'nikkibatanes@gmail.com', 'bynikkib@gmail.com', 'pzgttqh2gh@privaterelay.appleid.com'];
const ADMIN_USER_IDS = ['f683eb02-c824-4c24-991c-69b8b5397ca3'];

type FilterTab = 'overview' | 'trials' | 'paid' | 'issues' | 'webhooks' | 'feedback';
type AnalyticsRange = 'daily' | 'weekly' | 'monthly' | 'custom';
type MonthRange = 'jan' | 'feb' | 'mar' | 'apr' | 'may' | 'jun' | 'jul' | 'aug' | 'sep' | 'oct' | 'nov' | 'dec' | 'all';
type DrilldownKey =
  | 'all_users'
  | 'new_registered'
  | 'active_users'
  | 'trials_started'
  | 'new_subscribers'
  | 'monthly_subscribers'
  | 'yearly_subscribers'
  | 'upcoming_renewals'
  | 'cancelled'
  | 'cancelled_subscriptions'
  | 'cancelled_trials'
  | null;
type OverviewMetric =
  | 'active_trials'
  | 'stuck_trials'
  | 'paid_active'
  | 'converted_trials'
  | 'cancelled'
  | 'expired'
  | 'billing_issues'
  | 'seeker_free'
  | 'total_users'
  | 'total_trials_ever'
  | null;

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
  locale: string | null;
  payment_amount?: number | null;
  payment_currency?: string | null;
  onboarding_completed: boolean | null;
  account_created_at: string | null;
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

interface AdminInsight {
  label: string;
  value: number;
  subtitle: string;
  color: string;
  drilldown?: DrilldownKey;
}

interface ActivityEvent {
  id?: string | number;
  user_id: string;
  event_type: string | null;
  event_category: string | null;
  properties: Record<string, any> | null;
  platform: string | null;
  created_at: string | null;
}

interface DailyActivityRow {
  user_id: string;
  date: string | null;
  app_opens?: number | null;
  session_duration_seconds?: number | null;
  playbook_views?: number | null;
  devotional_views?: number | null;
  journal_opens?: number | null;
  todays_focus_used?: boolean | null;
  todos_used?: boolean | null;
  timeblock_used?: boolean | null;
  prayer_used?: boolean | null;
  gratitude_used?: boolean | null;
  reflection_used?: boolean | null;
  looking_forward_used?: boolean | null;
  today_win_used?: boolean | null;
  playbooks_created?: number | null;
  devotionals_created?: number | null;
  updated_at?: string | null;
}

interface UserActivitySummary {
  user_id: string;
  email: string | null;
  name: string;
  tier: string;
  status: string;
  billing_cycle: string | null;
  registered_at: string | null;
  last_activity_at: string | null;
  last_event: string;
  activity_summary: string;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatDate(iso: string | null): string {
  if (!iso) { return '—'; }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) { return '—'; }
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function formatShortDate(iso: string | null): string {
  if (!iso) { return '—'; }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) { return '—'; }
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function displayName(row: SubscriptionRow): string {
  if (row.full_name?.trim()) { return row.full_name.trim(); }
  if (row.first_name?.trim()) { return row.first_name.trim(); }
  return row.email || row.user_id.slice(0, 8);
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysAgo(days: number): Date {
  const d = startOfDay(new Date());
  d.setDate(d.getDate() - days);
  return d;
}

function isWithinRange(value: string | null, startDate: Date, endDate: Date): boolean {
  if (!value) { return false; }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) { return false; }
  return date >= startDate && date <= endDate;
}

function getStatusLine(row: SubscriptionRow): string {
  const now = new Date();
  const cycle = row.billing_cycle === 'annual' ? 'Annual' : row.billing_cycle === 'monthly' ? 'Monthly' : null;

  if (row.billing_issue) {
    const graceEnd = row.grace_period_end_date ? ` · Grace ends ${formatShortDate(row.grace_period_end_date)}` : '';
    return `⚠ Payment failed${graceEnd}`;
  }

  if (row.tier === 'free_trial') {
    if (row.trial_cancelled_date) {
      return `Cancelled ${formatShortDate(row.trial_cancelled_date)}`;
    }
    if (row.trial_end_date && new Date(row.trial_end_date) < now) {
      return `Trial ended ${formatShortDate(row.trial_end_date)}`;
    }
    if (row.trial_end_date) {
      return `Trial ends ${formatShortDate(row.trial_end_date)}`;
    }
    return 'Free trial';
  }

  if (row.tier === 'seeker') {
    if (row.cancellation_date) {
      return `Cancelled ${formatShortDate(row.cancellation_date)}`;
    }
    if (row.trial_start_date) { return 'Trial expired → Free'; }
    return 'Free plan';
  }

  const endDate = row.subscription_end_date ? new Date(row.subscription_end_date) : null;
  const isStillActive = endDate && endDate > now;

  if (isStillActive) {
    // Active subscriber — use auto_renew_enabled, not cancellation_date, as source of truth
    if (row.auto_renew_enabled === false) {
      return `${cycle || 'Paid'} · Expires ${formatShortDate(row.subscription_end_date)}`;
    }
    return `${cycle || 'Paid'} · Renews ${formatShortDate(row.subscription_end_date)}`;
  }

  // Subscription has ended
  if (row.cancellation_date) {
    const expiry = endDate ? ` · Expired ${formatShortDate(row.subscription_end_date)}` : '';
    return `Cancelled ${formatShortDate(row.cancellation_date)}${expiry}`;
  }

  if (endDate && endDate < now) {
    return `Expired ${formatShortDate(row.subscription_end_date)}`;
  }

  return cycle || 'Active';
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

function getMarket(row: SubscriptionRow): 'PH' | 'GLOBAL' {
  // Actual payment currency is the strongest market signal when available.
  const paymentCurrency = row.payment_currency?.toUpperCase();
  if (paymentCurrency === 'PHP') {
    return 'PH';
  }
  if (paymentCurrency === 'USD') {
    return 'GLOBAL';
  }

  // Check locale field if available (primary method)
  if (row.locale) {
    const localeLower = row.locale.toLowerCase();
    if (
      localeLower.includes('ph') ||
      localeLower.includes('philippines') ||
      localeLower.includes('en-ph') ||
      localeLower.includes('fil-ph')
    ) {
      return 'PH';
    }
  }

  // Fallback to email domain check
  const email = (row.email || '').toLowerCase();
  if (
    email.endsWith('.ph') ||
    email.includes('philippines')
  ) {
    return 'PH';
  }
  return 'GLOBAL';
}

function getMarketEmoji(row: SubscriptionRow): string {
  return getMarket(row) === 'PH' ? '🇵🇭' : '🌍';
}

function isPaidSubscriptionRow(row: SubscriptionRow): boolean {
  const hasPaidTier = row.tier !== 'seeker' && row.tier !== 'free_trial' && row.tier !== 'unknown';
  const hasAppleTransaction = !!row.original_transaction_id || !!row.platform_transaction_id;
  const hasValidEndDate = !row.subscription_end_date || new Date(row.subscription_end_date) >= new Date();
  return hasPaidTier && hasAppleTransaction && row.status === 'active' && hasValidEndDate;
}

// Tier-based pricing (PHP and USD)
// Monthly prices per tier. Annual MRR = annual_price / 12.
const PHP_PRICES: Record<string, { monthly: number; annual: number }> = {
  spark:          { monthly: 199,  annual: 1990  },
  growth:         { monthly: 399,  annual: 3990  },
  transformation: { monthly: 599,  annual: 5990  },
};
const USD_PRICES: Record<string, { monthly: number; annual: number }> = {
  spark:          { monthly: 4.99,  annual: 49.99  },
  growth:         { monthly: 7.99,  annual: 79.99  },
  transformation: { monthly: 9.99,  annual: 99.99  },
};

function getBaseTier(tier: string): string {
  return tier.replace('_annual', '').toLowerCase();
}

// Returns MRR contribution for one subscriber in their currency
function getMRRContribution(row: SubscriptionRow, market: 'PH' | 'GLOBAL'): number {
  const baseTier = getBaseTier(row.tier);
  const isAnnual = row.billing_cycle === 'annual' || row.tier.includes('annual');
  const prices = market === 'PH' ? PHP_PRICES : USD_PRICES;
  const tierPrices = prices[baseTier];
  if (!tierPrices) { return market === 'PH' ? 299 : 7.99; } // fallback Growth price
  return isAnnual ? tierPrices.annual / 12 : tierPrices.monthly;
}

const FILTER_TABS: { key: FilterTab; label: string; icon: string; subtitle: string }[] = [
  { key: 'overview', label: 'Overview', icon: 'analytics', subtitle: 'Dashboard snapshot' },
  { key: 'trials', label: 'Trials', icon: 'timer', subtitle: 'Active trial users' },
  { key: 'paid', label: 'Paid', icon: 'card', subtitle: 'Subscribed members' },
  { key: 'issues', label: 'Issues', icon: 'warning', subtitle: 'Needs attention' },
  { key: 'webhooks', label: 'Webhooks', icon: 'webhook', subtitle: 'Incoming events' },
  { key: 'feedback', label: 'Feedback', icon: 'chatbubbles', subtitle: 'Bug reports & feature requests' },
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
  const [bugReports, setBugReports] = useState<any[]>([]);
  const [featureRequests, setFeatureRequests] = useState<any[]>([]);
  const [feedbackSubTab, setFeedbackSubTab] = useState<'bugs' | 'features'>('bugs');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<OverviewMetric>(null);
  const [analyticsRange, setAnalyticsRange] = useState<AnalyticsRange>('daily');
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics | null>(null);
  const [analyticsRows, setAnalyticsRows] = useState<SubscriptionRow[]>([]);
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [dailyActivity, setDailyActivity] = useState<DailyActivityRow[]>([]);
  const [selectedDrilldown, setSelectedDrilldown] = useState<DrilldownKey>('all_users');
  const [searchQuery, setSearchQuery] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [_collapsedSections, _setCollapsedSections] = useState<Set<string>>(new Set(['downloads_users', 'subscriber_breakdown', 'subscription_health', 'next_renewals', 'needs_attention', 'subscriptions', 'lifetime']));
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<MonthRange>('all');
  const [userContentStats, setUserContentStats] = useState<Map<string, { playbooks: number; devotionals: number; guidance: number; refinements: number }>>(new Map());

  const userEmail = (user as any)?.email || '';
  const isAdmin = ADMIN_EMAILS.includes(userEmail) || ADMIN_USER_IDS.includes(user?.id ?? '');

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

  const loadBugReports = useCallback(async () => {
    const { data, error } = await supabase
      .from('bug_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) {
      Logger.error('Error loading bug reports', new Error(error.message), {
        component: 'AdminDashboardScreen',
      });
    } else {
      Logger.info('Loaded bug reports', {
        component: 'AdminDashboardScreen',
        count: data?.length || 0,
      });
      setBugReports((data as any[]) || []);
    }
  }, []);

  const loadFeatureRequests = useCallback(async () => {
    const { data, error } = await supabase
      .from('feature_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) {
      Logger.error('Error loading feature requests', new Error(error.message), {
        component: 'AdminDashboardScreen',
      });
    } else {
      Logger.info('Loaded feature requests', {
        component: 'AdminDashboardScreen',
        count: data?.length || 0,
      });
      setFeatureRequests((data as any[]) || []);
    }
  }, []);

  const getAnalyticsWindow = useCallback(() => {
    const now = new Date();
    const endDate = new Date();
    const startDate = new Date();

    if (selectedMonth !== 'all') {
      // Specific month selection
      const monthIndex = MONTHS.indexOf(selectedMonth.charAt(0).toUpperCase() + selectedMonth.slice(1));
      startDate.setFullYear(now.getFullYear(), monthIndex, 1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setFullYear(now.getFullYear(), monthIndex + 1, 0);
      endDate.setHours(23, 59, 59, 999);
    } else {
      // Range-based selection
      if (analyticsRange === 'daily') {
        startDate.setTime(daysAgo(0).getTime());
      } else if (analyticsRange === 'weekly') {
        startDate.setTime(daysAgo(6).getTime());
      } else if (analyticsRange === 'monthly') {
        startDate.setTime(daysAgo(29).getTime());
      } else {
        startDate.setTime(daysAgo(89).getTime());
      }
    }

    return { startDate, endDate };
  }, [analyticsRange, selectedMonth]);

  const loadAnalytics = useCallback(async () => {
    const { startDate, endDate } = getAnalyticsWindow();
    const metrics = await adminDashboardService.getAllDashboardMetrics(startDate, endDate);
    setDashboardMetrics(metrics);

    const [subscriptionResult, eventsResult, activityResult, contentStatsResult, paymentResult] = await Promise.all([
      supabase.rpc('admin_get_subscriptions', { p_filter: 'all' }),
      supabase
        .from('analytics_events')
        .select('id,user_id,event_type,event_category,properties,platform,created_at')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('user_activity_daily')
        .select('*')
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0])
        .order('date', { ascending: false })
        .limit(500),
      supabase.rpc('admin_get_user_content_stats'),
      supabase
        .from('payment_analytics')
        .select('user_id,amount,currency,created_at')
        .eq('status', 'success')
        .order('created_at', { ascending: false })
        .limit(1000),
    ]);

    if (!subscriptionResult.error) {
      const latestPaymentByUser = new Map<string, { amount: number | null; currency: string | null }>();
      if (!paymentResult.error) {
        (paymentResult.data || []).forEach((payment: any) => {
          if (!latestPaymentByUser.has(payment.user_id)) {
            latestPaymentByUser.set(payment.user_id, {
              amount: payment.amount ?? null,
              currency: payment.currency ?? null,
            });
          }
        });
      }

      const subscriptionRows = ((subscriptionResult.data as SubscriptionRow[]) || []).map(row => {
        const payment = latestPaymentByUser.get(row.user_id);
        return {
          ...row,
          payment_amount: payment?.amount ?? null,
          payment_currency: payment?.currency ?? null,
        };
      });

      setAnalyticsRows(subscriptionRows);
    }
    if (!eventsResult.error) {
      setActivityEvents((eventsResult.data as ActivityEvent[]) || []);
    }
    if (!activityResult.error) {
      setDailyActivity((activityResult.data as DailyActivityRow[]) || []);
    }

    // Build per-user content stats from admin RPC (bypasses RLS)
    const statsMap = new Map<string, { playbooks: number; devotionals: number; guidance: number; refinements: number }>();
    (contentStatsResult.data || []).forEach((r: any) => {
      statsMap.set(r.user_id, {
        playbooks: r.playbook_count ?? 0,
        devotionals: r.devotional_count ?? 0,
        guidance: r.wisdom_count ?? 0,
        refinements: r.refinement_count ?? 0,
      });
    });

    setUserContentStats(statsMap);
  }, [getAnalyticsWindow]);

  const refresh = useCallback(async (tab: FilterTab = activeTab) => {
    setLoading(true);
    try {
      await loadOverview();
      await loadAnalytics();
      if (tab === 'webhooks') {
        await loadWebhooks();
      } else if (tab === 'feedback') {
        await loadBugReports();
        await loadFeatureRequests();
      } else if (tab !== 'overview') {
        await loadRows(tab);
      }
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, loadAnalytics, loadOverview, loadRows, loadWebhooks, loadBugReports, loadFeatureRequests]);

  useEffect(() => {
    if (isAdmin) { refresh(activeTab); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, activeTab, analyticsRange, selectedMonth]);

  const openTab = useCallback(async (tab: FilterTab, metric: OverviewMetric = null) => {
    setActiveTab(tab);
    setExpandedId(null);
    setSelectedMetric(metric);
    setRefreshing(true);
    await refresh(tab);
  }, [refresh]);

  const openDrilldown = useCallback((drilldown: DrilldownKey) => {
    triggerLightHaptic();
    setSelectedDrilldown(drilldown);
  }, []);

  const getMetricLabel = useCallback((metric: OverviewMetric): string => {
    switch (metric) {
      case 'active_trials': return 'Active Trials';
      case 'stuck_trials': return 'Stuck Trials';
      case 'paid_active': return 'Paid Active';
      case 'converted_trials': return 'Converted';
      case 'cancelled': return 'Cancelled';
      case 'expired': return 'Expired';
      case 'billing_issues': return 'Billing Issues';
      case 'seeker_free': return 'Free (No Sub)';
      case 'total_users': return 'Total Users';
      case 'total_trials_ever': return 'Total Trials Started';
      default: return '';
    }
  }, []);

  const getFilteredRows = useCallback((items: SubscriptionRow[]) => {
    // For paid tab: exclude seeker/free/unknown tiers
    let filtered = activeTab === 'paid'
      ? items.filter(r => !['seeker', 'free_trial', 'unknown'].includes(r.tier?.toLowerCase() || ''))
      : items;

    // Apply metric filter
    if (selectedMetric) {
      filtered = filtered.filter(item => {
        const isExpired = item.status === 'expired' || !!item.trial_end_date && new Date(item.trial_end_date) < new Date();
        const isCancelled = item.status === 'cancelled' || !!item.trial_cancelled_date || !!item.cancellation_date;
        const isConverted = !!item.trial_converted_date || (item.tier !== 'free_trial' && item.status === 'active');
        const isBillingIssue = !!item.billing_issue;
        const isFree = item.tier === 'seeker' && !item.original_transaction_id && !item.trial_start_date;
        const isPaidActive = item.tier !== 'free_trial' && item.status === 'active';
        const isActiveTrial = item.tier === 'free_trial' && !isExpired && !isCancelled && !isConverted;
        const isStuckTrial = item.tier === 'free_trial' && !isConverted && !isCancelled;

        switch (selectedMetric) {
          case 'active_trials': return isActiveTrial;
          case 'stuck_trials': return isStuckTrial;
          case 'paid_active': return isPaidActive;
          case 'converted_trials': return isConverted;
          case 'cancelled': return isCancelled;
          case 'expired': return isExpired;
          case 'billing_issues': return isBillingIssue;
          case 'seeker_free': return isFree;
          default: return true;
        }
      });
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => {
        const name = displayName(item).toLowerCase();
        const email = (item.email || '').toLowerCase();
        const userId = item.user_id.toLowerCase();
        return name.includes(query) || email.includes(query) || userId.includes(query);
      });
    }

    return filtered;
  }, [selectedMetric, searchQuery, activeTab]);

  const analyticsWindow = getAnalyticsWindow();
  const activePaidRows = analyticsRows.filter(isPaidSubscriptionRow);
  const phPaidRows = activePaidRows.filter(row => getMarket(row) === 'PH');
  const globalPaidRows = activePaidRows.filter(row => getMarket(row) === 'GLOBAL');

  // MRR: sum of per-tier monthly contribution, annual divided by 12
  const phpMRR = phPaidRows.reduce((sum, row) => sum + getMRRContribution(row, 'PH'), 0);
  const usdMRR = globalPaidRows.reduce((sum, row) => sum + getMRRContribution(row, 'GLOBAL'), 0);

  // All upcoming renewals (not sliced) for accurate count
  const allUpcomingRenewals = activePaidRows
    .filter(row => row.auto_renew_enabled !== false && row.subscription_end_date)
    .sort((a, b) => new Date(a.subscription_end_date || 0).getTime() - new Date(b.subscription_end_date || 0).getTime());
  const upcomingRenewals = allUpcomingRenewals.slice(0, 8);

  // Trials expiring in the 3-day trial window (for the Active Trials card)
  const now3 = new Date();
  now3.setDate(now3.getDate() + 3);
  const trialsExpiringSoon = analyticsRows.filter(row =>
    row.tier === 'free_trial' &&
    row.trial_end_date &&
    new Date(row.trial_end_date) > new Date() &&
    new Date(row.trial_end_date) <= now3
  );

  // New paid subscribers this week (for hero card trend)
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const newPaidThisWeek = activePaidRows.filter(row =>
    row.subscription_start_date &&
    new Date(row.subscription_start_date) >= oneWeekAgo
  ).length;

  // --- Per-tier goal tracking ---
  // Handles both compound names (e.g. 'spark_annual') and separate tier+billing_cycle
  const getTierCount = (tier: string, cycle: 'monthly' | 'annual') =>
    activePaidRows.filter(r => {
      const t = r.tier?.toLowerCase() || '';
      const bc = r.billing_cycle?.toLowerCase() || '';
      if (cycle === 'annual') {
        return t === `${tier}_annual` || t === `${tier}_yearly` ||
               (t === tier && (bc === 'annual' || bc === 'yearly'));
      } else {
        return (t === tier || t === `${tier}_monthly`) && (bc === 'monthly' || bc === '');
      }
    }).length;

  const goalData = [
    { tier: 'Growth',         cycle: 'Monthly', count: getTierCount('growth', 'monthly'),        goal: 1000, isMainGoal: true },
    { tier: 'Growth',         cycle: 'Yearly',  count: getTierCount('growth', 'annual'),          goal: null, isMainGoal: false },
    { tier: 'Transformation', cycle: 'Monthly', count: getTierCount('transformation', 'monthly'), goal: null, isMainGoal: false },
    { tier: 'Transformation', cycle: 'Yearly',  count: getTierCount('transformation', 'annual'),  goal: null, isMainGoal: false },
    { tier: 'Spark',          cycle: 'Monthly', count: getTierCount('spark', 'monthly'),          goal: null, isMainGoal: false },
    { tier: 'Spark',          cycle: 'Yearly',  count: getTierCount('spark', 'annual'),           goal: null, isMainGoal: false },
  ];
  const attentionRows = analyticsRows.filter(row => {
    const now = new Date();
    const isBillingIssue = !!row.billing_issue;
    const isStuckTrial = row.tier === 'free_trial' &&
      !!row.trial_end_date &&
      new Date(row.trial_end_date) < now &&
      !row.trial_converted_date;
    const isPaidButExpired = !['seeker', 'free_trial'].includes(row.tier) &&
      !!row.subscription_end_date &&
      new Date(row.subscription_end_date) < now &&
      !row.cancellation_date;
    return isBillingIssue || isStuckTrial || isPaidButExpired;
  });
  // --- Window-filtered subscription activity (responds to month picker) ---
  const { startDate: windowStart, endDate: windowEnd } = analyticsWindow;

  // New users in window — use actual account_created_at (real signup date)
  const windowNewUsers = analyticsRows.filter(row =>
    row.account_created_at && isWithinRange(row.account_created_at, windowStart, windowEnd)
  );
  const trackedSignupCount = windowNewUsers.length;

  // Daily active users — average across days in window (not a sum)
  const dauDays = dashboardMetrics?.dailyActiveUsers || [];
  const trackedDauCount = dauDays.length > 0
    ? Math.round(dauDays.reduce((sum, item) => sum + item.total_dau, 0) / dauDays.length)
    : 0;

  const windowNewTrials = analyticsRows.filter(row =>
    row.trial_start_date && isWithinRange(row.trial_start_date, windowStart, windowEnd)
  );
  const windowNewPaid = analyticsRows.filter(row =>
    row.trial_converted_date && isWithinRange(row.trial_converted_date, windowStart, windowEnd)
  );
  const windowCancellations = analyticsRows.filter(row =>
    (row.cancellation_date && isWithinRange(row.cancellation_date, windowStart, windowEnd)) ||
    (row.trial_cancelled_date && isWithinRange(row.trial_cancelled_date, windowStart, windowEnd))
  );
  const windowOnboardingCompleted = analyticsRows.filter(row =>
    row.onboarding_completed === true &&
    row.account_created_at && isWithinRange(row.account_created_at, windowStart, windowEnd)
  );
  const windowNetGrowth = windowNewPaid.length - windowCancellations.filter(r => !['seeker','free_trial'].includes(r.tier)).length;

  const rangeLabel = selectedMonth !== 'all'
    ? selectedMonth.charAt(0).toUpperCase() + selectedMonth.slice(1)
    : analyticsRange === 'daily'
      ? 'Today'
      : analyticsRange === 'weekly'
        ? 'Last 7 days'
        : analyticsRange === 'monthly'
          ? 'Last 30 days'
          : 'Last 90 days';

  const activityByUser = dailyActivity.reduce<Record<string, DailyActivityRow[]>>((acc, item) => {
    acc[item.user_id] = [...(acc[item.user_id] || []), item];
    return acc;
  }, {});

  const latestEventByUser = activityEvents.reduce<Record<string, ActivityEvent>>((acc, event) => {
    if (!event.user_id) { return acc; }
    const current = acc[event.user_id];
    if (!current || new Date(event.created_at || 0) > new Date(current.created_at || 0)) {
      acc[event.user_id] = event;
    }
    return acc;
  }, {});

  const signupUserIds = new Set(
    activityEvents
      .filter(event => event.event_type === 'user_signup')
      .map(event => event.user_id)
  );
  const activeUserIds = new Set([
    ...activityEvents.map(event => event.user_id),
    ...dailyActivity.map(item => item.user_id),
  ].filter(Boolean));

  const summarizeDailyActivity = (items: DailyActivityRow[]): string => {
    const totals = items.reduce((acc, item) => ({
      appOpens: acc.appOpens + (item.app_opens || 0),
      playbooks: acc.playbooks + (item.playbook_views || 0),
      devotionals: acc.devotionals + (item.devotional_views || 0),
      journal: acc.journal + (item.journal_opens || 0),
      created: acc.created + (item.playbooks_created || 0) + (item.devotionals_created || 0),
      prayer: acc.prayer || !!item.prayer_used,
      gratitude: acc.gratitude || !!item.gratitude_used,
      reflection: acc.reflection || !!item.reflection_used,
      focus: acc.focus || !!item.todays_focus_used,
    }), {
      appOpens: 0,
      playbooks: 0,
      devotionals: 0,
      journal: 0,
      created: 0,
      prayer: false,
      gratitude: false,
      reflection: false,
      focus: false,
    });

    const parts = [
      totals.appOpens ? `${totals.appOpens} opens` : null,
      totals.playbooks ? `${totals.playbooks} playbook views` : null,
      totals.devotionals ? `${totals.devotionals} devotional views` : null,
      totals.journal ? `${totals.journal} journal opens` : null,
      totals.created ? `${totals.created} created` : null,
      totals.focus ? 'focus' : null,
      totals.prayer ? 'prayer' : null,
      totals.gratitude ? 'gratitude' : null,
      totals.reflection ? 'reflection' : null,
    ].filter(Boolean);

    return parts.length ? parts.join(' · ') : 'No activity details tracked in this range';
  };

  const getUserSummaries = (sourceRows: SubscriptionRow[], includeEvents = false): UserActivitySummary[] => {
    const rowMap = new Map(sourceRows.map(row => [row.user_id, row]));

    if (includeEvents) {
      activityEvents.forEach(event => {
      if (!rowMap.has(event.user_id)) {
        rowMap.set(event.user_id, {
          user_id: event.user_id,
          email: null,
          first_name: null,
          full_name: null,
          tier: 'unknown',
          status: 'unknown',
          subscription_display_name: null,
          trial_chosen_tier: null,
          billing_cycle: null,
          trial_start_date: null,
          trial_end_date: null,
          trial_converted_date: null,
          trial_cancelled_date: null,
          cancellation_date: null,
          subscription_start_date: null,
          subscription_end_date: null,
          auto_renew_enabled: null,
          billing_issue: null,
          grace_period_end_date: null,
          original_transaction_id: null,
          platform_transaction_id: null,
          updated_at: null,
          days_remaining: null,
          locale: null,
          payment_amount: null,
          payment_currency: null,
          onboarding_completed: null,
          account_created_at: null,
        });
      }
    });
    }

    return Array.from(rowMap.values()).map(row => {
      const latestEvent = latestEventByUser[row.user_id];
      const activity = activityByUser[row.user_id] || [];
      return {
        user_id: row.user_id,
        email: row.email,
        name: displayName(row),
        tier: row.tier,
        status: row.status,
        billing_cycle: row.billing_cycle,
        registered_at: latestEvent?.event_type === 'user_signup' ? latestEvent.created_at : null,
        last_activity_at: latestEvent?.created_at || activity[0]?.updated_at || row.updated_at,
        last_event: latestEvent?.event_type || 'No tracked event',
        activity_summary: summarizeDailyActivity(activity),
      };
    }).sort((a, b) => new Date(b.last_activity_at || 0).getTime() - new Date(a.last_activity_at || 0).getTime());
  };

  const allUserSummaries = getUserSummaries(analyticsRows, true);
  const newRegisteredRows = allUserSummaries.filter(item => signupUserIds.has(item.user_id));
  const activeUserRows = allUserSummaries.filter(item => activeUserIds.has(item.user_id));
  const trialsStartedRows = getUserSummaries(analyticsRows.filter(row => isWithinRange(row.trial_start_date, analyticsWindow.startDate, analyticsWindow.endDate)));
  const newSubscriberRows = getUserSummaries(activePaidRows.filter(row => isWithinRange(row.subscription_start_date, analyticsWindow.startDate, analyticsWindow.endDate)));
  const monthlySubscriberRows = getUserSummaries(activePaidRows.filter(row => row.billing_cycle === 'monthly'));
  const yearlySubscriberRows = getUserSummaries(activePaidRows.filter(row => row.billing_cycle === 'annual' || row.billing_cycle === 'yearly'));
  const upcomingRenewalRows = getUserSummaries(upcomingRenewals);
  const cancelledRows = getUserSummaries(analyticsRows.filter(row =>
    isWithinRange(row.cancellation_date, analyticsWindow.startDate, analyticsWindow.endDate) ||
    isWithinRange(row.trial_cancelled_date, analyticsWindow.startDate, analyticsWindow.endDate)
  ));
  // ALL-TIME cancelled subscriptions (not date-filtered — shows full history)
  const cancelledSubscriptionRows = getUserSummaries(analyticsRows.filter(row =>
    row.cancellation_date && !['seeker', 'free_trial'].includes(row.tier)
  ));
  const cancelledTrialRows = getUserSummaries(analyticsRows.filter(row =>
    row.trial_cancelled_date
  ));
  const drilldownRows = (() => {
    switch (selectedDrilldown) {
      case 'new_registered':
        return newRegisteredRows;
      case 'active_users':
        return activeUserRows;
      case 'trials_started':
        return trialsStartedRows;
      case 'new_subscribers':
        return newSubscriberRows;
      case 'monthly_subscribers':
        return monthlySubscriberRows;
      case 'yearly_subscribers':
        return yearlySubscriberRows;
      case 'upcoming_renewals':
        return upcomingRenewalRows;
      case 'cancelled':
        return cancelledRows;
      case 'cancelled_subscriptions':
        return cancelledSubscriptionRows;
      case 'cancelled_trials':
        return cancelledTrialRows;
      case 'all_users':
      default:
        return allUserSummaries;
    }
  })();

  const drilldownTitle = selectedDrilldown === 'new_registered'
    ? 'New Registered Users'
    : selectedDrilldown === 'active_users'
      ? 'Active Users & App Activity'
      : selectedDrilldown === 'trials_started'
        ? 'Trials Started'
        : selectedDrilldown === 'new_subscribers'
          ? 'New Subscribers'
          : selectedDrilldown === 'monthly_subscribers'
            ? 'Monthly Subscribers'
            : selectedDrilldown === 'yearly_subscribers'
              ? 'Yearly Subscribers'
              : selectedDrilldown === 'upcoming_renewals'
                ? 'Upcoming Renewals'
                : selectedDrilldown === 'cancelled'
                  ? 'Cancelled'
                  : selectedDrilldown === 'cancelled_subscriptions'
                    ? 'Cancelled Subscriptions'
                    : selectedDrilldown === 'cancelled_trials'
                      ? 'Cancelled Trials'
                      : 'All Users';

  const acquisitionInsights: AdminInsight[] = [
    { label: 'All Users', value: allUserSummaries.length, subtitle: 'View everyone', color: Colors.hopeWhite, drilldown: 'all_users' },
    { label: 'New Registered', value: newRegisteredRows.length, subtitle: trackedSignupCount !== newRegisteredRows.length ? 'Some signups lack user detail' : rangeLabel, color: Colors.hopeWhite, drilldown: 'new_registered' },
    { label: 'Active Users', value: activeUserRows.length, subtitle: trackedDauCount !== activeUserRows.length ? 'Users with tracked activity' : 'Opened or used app', color: Colors.growthGreen, drilldown: 'active_users' },
    { label: 'Trials', value: trialsStartedRows.length, subtitle: 'Started trial', color: '#FFC107', drilldown: 'trials_started' },
    { label: 'New Paid', value: newSubscriberRows.length, subtitle: 'Verified paid users', color: Colors.alertCoral, drilldown: 'new_subscribers' },
  ];

  const subscriptionInsights: AdminInsight[] = [
    { label: 'Paid Monthly', value: monthlySubscriberRows.length, subtitle: 'Verified paid active', color: Colors.growthGreen, drilldown: 'monthly_subscribers' },
    { label: 'Paid Yearly', value: yearlySubscriberRows.length, subtitle: 'Verified paid active', color: '#34C759', drilldown: 'yearly_subscribers' },
    { label: 'Renewing Soon', value: upcomingRenewalRows.length, subtitle: 'Next renewal dates', color: '#FFC107', drilldown: 'upcoming_renewals' },
    { label: 'Cancelled Subs', value: cancelledSubscriptionRows.length, subtitle: 'All-time paid cancellations', color: '#FF3B30', drilldown: 'cancelled_subscriptions' },
    { label: 'Cancelled Trials', value: cancelledTrialRows.length, subtitle: 'All-time trial cancellations', color: '#FF9500', drilldown: 'cancelled_trials' },
  ];

  const renderTabChoices = () => (
    <View style={styles.navigationList}>
      {FILTER_TABS.map(tab => {
        const isSelected = activeTab === tab.key && selectedMetric === null;
        const count = tab.key === 'overview'
          ? overview?.total_users
          : tab.key === 'trials'
            ? overview?.active_trials
            : tab.key === 'paid'
              ? overview?.paid_active
              : tab.key === 'issues'
                ? overview?.billing_issues
                : webhooks.length;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.navigationItem, isSelected && styles.navigationItemSelected]}
            onPress={() => {
              triggerLightHaptic();
              openTab(tab.key);
            }}
            activeOpacity={0.7}
          >
            <View style={styles.navigationItemLeft}>
              <View style={[styles.navigationItemIcon, isSelected && styles.navigationItemIconSelected]}>
                <Ionicons
                  name={tab.icon as any}
                  size={20}
                  color={isSelected ? Colors.hopeWhite : 'rgba(255,255,255,0.6)'}
                />
              </View>
              <View style={styles.navigationItemTextContainer}>
                <ThemedText weight="semiBold" style={[styles.navigationItemTitle, isSelected && styles.navigationItemTitleSelected]}>
                  {tab.label}
                </ThemedText>
                <ThemedText weight="regular" style={styles.navigationItemSubtitle}>{tab.subtitle}</ThemedText>
              </View>
            </View>
            <View style={styles.navigationItemCount}>
              <ThemedText weight="bold" style={styles.navigationItemCountValue}>{loading ? '…' : String(count ?? 0)}</ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={18} style={styles.navigationItemArrow} />
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderSearchBar = () => (
    <View style={styles.searchContainer}>
      <Ionicons name="search" size={18} color="rgba(255,255,255,0.4)" style={styles.searchIcon} />
      <TextInput
        style={styles.searchInput}
        placeholder="Search by name, email, or user ID..."
        placeholderTextColor="rgba(255,255,255,0.4)"
        value={searchQuery}
        onChangeText={setSearchQuery}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {searchQuery.length > 0 && (
        <TouchableOpacity
          onPress={() => {
            triggerLightHaptic();
            setSearchQuery('');
          }}
          style={styles.searchClearButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.5)" />
        </TouchableOpacity>
      )}
    </View>
  );

  const renderLastUpdated = () => {
    if (!lastUpdated) {return null;}
    const timeDiff = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
    let timeString = '';
    if (timeDiff < 60) {timeString = 'just now';}
    else if (timeDiff < 3600) {timeString = `${Math.floor(timeDiff / 60)}m ago`;}
    else if (timeDiff < 86400) {timeString = `${Math.floor(timeDiff / 3600)}h ago`;}
    else {timeString = `${Math.floor(timeDiff / 86400)}d ago`;}

    return (
      <View style={styles.lastUpdatedContainer}>
        <View style={[styles.statusDot, { backgroundColor: Colors.growthGreen }]} />
        <ThemedText weight="medium" style={styles.lastUpdatedText}>Updated {timeString}</ThemedText>
      </View>
    );
  };


  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Ionicons name="lock-closed" size={48} color="rgba(255,255,255,0.4)" />
          <ThemedText weight="medium" style={styles.noAccessText}>Admin access only</ThemedText>
        </View>
      </SafeAreaView>
    );
  }


  const renderInsightGrid = (items: AdminInsight[]) => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.insightScrollContainer}
    >
      {items.map(item => (
        <TouchableOpacity
          key={item.label}
          style={[
            styles.insightCardHorizontal,
            { borderColor: item.color },
            selectedDrilldown === item.drilldown && styles.metricCardSelected,
          ]}
          onPress={() => openDrilldown(item.drilldown || null)}
          activeOpacity={0.85}
        >
          <ThemedText weight="bold" style={[styles.metricValue, { color: item.color }]}>{item.value}</ThemedText>
          <ThemedText weight="semiBold" style={styles.metricLabel}>{item.label}</ThemedText>
          <ThemedText weight="regular" style={styles.metricSub}>{item.subtitle}</ThemedText>
          <ThemedText weight="bold" style={styles.tapHint}>Tap to view</ThemedText>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );


  const renderRangeSelector = () => (
    <View style={styles.rangeSelectorWrapper}>
      {/* Period tabs */}
      <View style={styles.rangeSelector}>
        {([
          { key: 'daily', label: 'Today' },
          { key: 'weekly', label: 'This Week' },
          { key: 'monthly', label: 'This Month' },
          { key: 'custom', label: '90 Days' },
        ] as { key: AnalyticsRange; label: string }[]).map(({ key, label }) => {
          const selected = analyticsRange === key && selectedMonth === 'all';
          return (
            <TouchableOpacity
              key={key}
              onPress={() => {
                triggerLightHaptic();
                setAnalyticsRange(key);
                setSelectedMonth('all');
              }}
              style={[styles.rangeButton, selected && styles.rangeButtonSelected]}
              activeOpacity={0.85}
            >
              <ThemedText weight="semiBold" style={[styles.rangeButtonText, selected && styles.rangeButtonTextSelected]}>
                {label}
              </ThemedText>
            </TouchableOpacity>
          );
        })}
      </View>
      {/* Month picker */}
      <View style={{ marginBottom: 8 }} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.monthScroll}>
        {(['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] as MonthRange[]).map(month => {
          const selected = selectedMonth === month;
          return (
            <TouchableOpacity
              key={month}
              onPress={() => {
                triggerLightHaptic();
                setSelectedMonth(month === selectedMonth ? 'all' : month);
                setAnalyticsRange('monthly');
              }}
              style={[styles.monthButton, selected && styles.monthButtonSelected]}
              activeOpacity={0.85}
            >
              <ThemedText weight="semiBold" style={[styles.monthButtonText, selected && styles.monthButtonTextSelected]}>
                {month.charAt(0).toUpperCase() + month.slice(1)}
              </ThemedText>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );


  const renderOverview = () => (
    <ScrollView
      style={styles.stepScroll}
      contentContainerStyle={styles.stepContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); refresh('overview'); }} tintColor={Colors.hopeWhite} />}
      showsVerticalScrollIndicator={false}
    >
      {/* HEADER */}
      <StepFadeIn delay={0}>
        <View style={styles.newHeader}>
          <View>
            <ThemedText weight="bold" style={styles.newHeaderTitle}>Admin Dashboard</ThemedText>
            {renderLastUpdated()}
          </View>
        </View>
      </StepFadeIn>

      {/* PERIOD FILTER */}
      <StepFadeIn delay={50}>
        {renderRangeSelector()}
      </StepFadeIn>

      {/* SECTION 1 - BUSINESS HEALTH (Layer 1: Executive Snapshot) */}
      <View style={{ marginBottom: 8 }} />
      <StepFadeIn delay={100}>
        <ThemedText weight="semiBold" style={styles.newSectionLabel}>Business Health</ThemedText>
      </StepFadeIn>
      <StepFadeIn delay={120}>
        {/* Row 1: Paid + Trials */}
        <View style={styles.healthRow}>
          <View style={[styles.healthCard, { flex: 1 }]}>
            <ThemedText weight="bold" style={styles.healthCardHeroValue}>{overview?.total_users || analyticsRows.length}</ThemedText>
            <ThemedText weight="regular" style={styles.healthCardLabel}>Total Users</ThemedText>
            <View style={styles.healthCardTrend}>
              <Ionicons name="people" size={13} color="rgba(255,255,255,0.5)" />
              <ThemedText weight="regular" style={styles.healthCardTrendText}>all time</ThemedText>
            </View>
          </View>
          <View style={[styles.healthCard, { flex: 1 }]}>
            <ThemedText weight="bold" style={styles.healthCardHeroValue}>{activePaidRows.length}</ThemedText>
            <ThemedText weight="regular" style={styles.healthCardLabel}>Paid Subscribers</ThemedText>
            <View style={styles.healthCardTrend}>
              <Ionicons name="trending-up" size={13} color={Colors.growthGreen} />
              <ThemedText weight="regular" style={styles.healthCardTrendText}>
                {newPaidThisWeek > 0 ? `+${newPaidThisWeek} this week` : 'No new this week'}
              </ThemedText>
            </View>
          </View>
          <View style={[styles.healthCard, { flex: 1 }]}>
            <ThemedText weight="bold" style={styles.healthCardHeroValue}>{overview?.active_trials || 0}</ThemedText>
            <ThemedText weight="regular" style={styles.healthCardLabel}>Active Trials</ThemedText>
            <View style={styles.healthCardTrend}>
              <Ionicons name="time" size={13} color="#FFC107" />
              <ThemedText weight="regular" style={[styles.healthCardTrendText, { color: '#FFC107' }]}>
                {trialsExpiringSoon.length > 0 ? `${trialsExpiringSoon.length} expiring in 3d` : 'none expiring soon'}
              </ThemedText>
            </View>
          </View>
        </View>

        {/* Row 2: MRR + Issues */}
        <View style={[styles.healthRow, { marginTop: 12, marginBottom: 32 }]}>
          <View style={[styles.healthCard, { flex: 2 }]}>
            <ThemedText weight="semiBold" style={styles.healthCardRevenueTitle}>Est. MRR</ThemedText>
            {phpMRR > 0 && (
              <View style={styles.marketRevenueRow}>
                <ThemedText weight="regular" style={styles.marketRevenueLabel}>🇵🇭 PHP</ThemedText>
                <ThemedText weight="bold" style={styles.marketRevenueValue}>₱{Math.round(phpMRR).toLocaleString()}</ThemedText>
              </View>
            )}
            {usdMRR > 0 && (
              <View style={styles.marketRevenueRow}>
                <ThemedText weight="regular" style={styles.marketRevenueLabel}>🌍 USD</ThemedText>
                <ThemedText weight="bold" style={styles.marketRevenueValue}>${usdMRR.toFixed(2)}</ThemedText>
              </View>
            )}
            {phpMRR === 0 && usdMRR === 0 && (
              <ThemedText weight="regular" style={styles.marketRevenueLabel}>No paid MRR yet</ThemedText>
            )}
          </View>
          <View style={[styles.healthCard, { flex: 1, backgroundColor: (overview?.billing_issues || 0) > 0 ? 'rgba(255,59,48,0.12)' : 'rgba(255,255,255,0.04)' }]}>
            <ThemedText weight="bold" style={[styles.healthCardHeroValue, { color: (overview?.billing_issues || 0) > 0 ? '#FF3B30' : Colors.hopeWhite }]}>
              {overview?.billing_issues || 0}
            </ThemedText>
            <ThemedText weight="regular" style={styles.healthCardLabel}>Issues</ThemedText>
            <View style={styles.healthCardTrend}>
              <Ionicons
                name={(overview?.billing_issues || 0) > 0 ? 'alert-circle' : 'checkmark-circle'}
                size={13}
                color={(overview?.billing_issues || 0) > 0 ? '#FF3B30' : Colors.growthGreen}
              />
              <ThemedText weight="regular" style={[styles.healthCardTrendText, { color: (overview?.billing_issues || 0) > 0 ? '#FF3B30' : Colors.growthGreen }]}>
                {(overview?.billing_issues || 0) > 0 ? 'needs attention' : 'all clear'}
              </ThemedText>
            </View>
          </View>
        </View>
      </StepFadeIn>

      {/* SECTION 2 - GOALS */}
      <StepFadeIn delay={130}>
        <ThemedText weight="semiBold" style={styles.newSectionLabel}>Goals</ThemedText>
      </StepFadeIn>
      <StepFadeIn delay={135}>
        {/* Main goal: Growth Monthly → 1000 */}
        {(() => {
          const main = goalData.find(g => g.isMainGoal)!;
          const pct = Math.min(100, Math.round((main.count / 1000) * 100));
          return (
            <View style={styles.mainGoalCard}>
              <View style={styles.mainGoalHeader}>
                <ThemedText weight="bold" style={styles.mainGoalTitle}>🎯 Growth Monthly</ThemedText>
                <ThemedText weight="bold" style={styles.mainGoalCount}>{main.count} <ThemedText weight="regular" style={styles.mainGoalOf}>/ 1,000</ThemedText></ThemedText>
              </View>
              <View style={styles.goalProgressTrack}>
                <View style={[styles.goalProgressFill, { width: `${pct}%` as any }]} />
              </View>
              <ThemedText weight="regular" style={styles.mainGoalPct}>{pct}% to goal</ThemedText>
            </View>
          );
        })()}
        {/* Tier breakdown grid */}
        <View style={styles.goalGrid}>
          {goalData.filter(g => !g.isMainGoal).map(g => (
            <View key={`${g.tier}-${g.cycle}`} style={styles.goalCard}>
              <ThemedText weight="bold" style={styles.goalCardCount}>{g.count}</ThemedText>
              <ThemedText weight="semiBold" style={styles.goalCardTier}>{g.tier}</ThemedText>
              <ThemedText weight="regular" style={styles.goalCardCycle}>{g.cycle}</ThemedText>
            </View>
          ))}
        </View>
      </StepFadeIn>

      {/* SECTION 3 - NEEDS ATTENTION (Layer 2: Action Needed) */}
      <StepFadeIn delay={140}>
        <ThemedText weight="semiBold" style={styles.newSectionLabel}>Needs Attention</ThemedText>
      </StepFadeIn>
      <StepFadeIn delay={160}>
        <View style={styles.attentionContainer}>
          {(overview?.billing_issues || 0) > 0 && overview && (
            <TouchableOpacity
              style={styles.attentionItem}
              onPress={() => {
                triggerLightHaptic();
                setActiveTab('issues');
                setSelectedMetric('billing_issues');
              }}
              activeOpacity={0.7}
            >
              <ThemedText weight="regular" style={styles.attentionIcon}>⚠</ThemedText>
              <ThemedText weight="regular" style={styles.attentionText}>{overview.billing_issues} billing failures → review users</ThemedText>
            </TouchableOpacity>
          )}
          {(overview?.stuck_trials || 0) > 0 && overview && (
            <TouchableOpacity
              style={styles.attentionItem}
              onPress={() => {
                triggerLightHaptic();
                setActiveTab('trials');
              }}
              activeOpacity={0.7}
            >
              <ThemedText weight="regular" style={styles.attentionIcon}>⚠</ThemedText>
              <ThemedText weight="regular" style={styles.attentionText}>{overview.stuck_trials} expired trials not converted → review trials</ThemedText>
            </TouchableOpacity>
          )}
          {upcomingRenewals.filter(r => r.days_remaining && r.days_remaining <= 1).length > 0 && (
            <TouchableOpacity
              style={styles.attentionItem}
              onPress={() => {
                triggerLightHaptic();
                setActiveTab('trials');
              }}
              activeOpacity={0.7}
            >
              <ThemedText weight="regular" style={styles.attentionIcon}>⚠</ThemedText>
              <ThemedText weight="regular" style={styles.attentionText}>{upcomingRenewals.filter(r => r.days_remaining && r.days_remaining <= 1).length} trials expiring today → review trials</ThemedText>
            </TouchableOpacity>
          )}
          {attentionRows.length === 0 && (overview?.billing_issues || 0) === 0 && (overview?.stuck_trials || 0) === 0 && (
            <ThemedText weight="regular" style={styles.noAttentionText}>All systems healthy ✓</ThemedText>
          )}
        </View>
      </StepFadeIn>

      {/* SECTION 3 - GROWTH (Simplified) */}
      <StepFadeIn delay={200}>
        <ThemedText weight="semiBold" style={styles.newSectionLabel}>Growth</ThemedText>
      </StepFadeIn>
      <StepFadeIn delay={220}>
        <View style={styles.growthHeroContainer}>
          <ThemedText weight="bold" style={styles.growthHeroValue}>+{trackedSignupCount}</ThemedText>
          <ThemedText weight="regular" style={styles.growthHeroLabel}>new users this {selectedMonth !== 'all' ? selectedMonth : analyticsRange}</ThemedText>
        </View>
      </StepFadeIn>
      <StepFadeIn delay={240}>
        <View style={styles.growthSecondaryContainer}>
          <View style={styles.growthMetric}>
            <ThemedText weight="regular" style={styles.growthLabel}>Active Users</ThemedText>
            <ThemedText weight="bold" style={styles.growthValue}>{trackedDauCount}</ThemedText>
            <ThemedText weight="regular" style={styles.growthSub}>Daily average</ThemedText>
          </View>
          <View style={styles.growthMetric}>
            <ThemedText weight="regular" style={styles.growthLabel}>Conversions</ThemedText>
            <ThemedText weight="bold" style={styles.growthValue}>{windowNewPaid.length}</ThemedText>
            <ThemedText weight="regular" style={styles.growthSub}>Trial to paid</ThemedText>
          </View>
        </View>
      </StepFadeIn>

      {/* SECTION 4 - MARKET BREAKDOWN */}
      <StepFadeIn delay={250}>
        <ThemedText weight="semiBold" style={styles.newSectionLabel}>
          Market Breakdown
        </ThemedText>
      </StepFadeIn>
      <StepFadeIn delay={260}>
        <View style={styles.marketBreakdownContainer}>
          <View style={styles.marketBreakdownCard}>
            <ThemedText weight="regular" style={styles.marketBreakdownEmoji}>🇵🇭</ThemedText>
            <ThemedText weight="bold" style={styles.marketBreakdownValue}>
              {phPaidRows.length}
            </ThemedText>
            <ThemedText weight="regular" style={styles.marketBreakdownLabel}>
              Philippines
            </ThemedText>
            <ThemedText weight="regular" style={styles.marketBreakdownSub}>
              PHP pricing
            </ThemedText>
          </View>
          <View style={styles.marketBreakdownCard}>
            <ThemedText weight="regular" style={styles.marketBreakdownEmoji}>🌍</ThemedText>
            <ThemedText weight="bold" style={styles.marketBreakdownValue}>
              {globalPaidRows.length}
            </ThemedText>
            <ThemedText weight="regular" style={styles.marketBreakdownLabel}>
              International
            </ThemedText>
            <ThemedText weight="regular" style={styles.marketBreakdownSub}>
              USD pricing
            </ThemedText>
          </View>
        </View>
      </StepFadeIn>

      {/* SECTION 5 - PERIOD ACTIVITY (fully window-scoped) */}
      <StepFadeIn delay={265}>
        <ThemedText weight="semiBold" style={styles.newSectionLabel}>
          Activity · {rangeLabel}
        </ThemedText>
        <View style={styles.periodActivityGrid}>
          <View style={styles.periodActivityCard}>
            <ThemedText weight="bold" style={styles.periodActivityValue}>{windowNewUsers.length}</ThemedText>
            <ThemedText weight="regular" style={styles.periodActivityLabel}>New Users</ThemedText>
          </View>
          <View style={styles.periodActivityCard}>
            <ThemedText weight="bold" style={styles.periodActivityValue}>{windowOnboardingCompleted.length}</ThemedText>
            <ThemedText weight="regular" style={styles.periodActivityLabel}>Personalized</ThemedText>
          </View>
          <View style={styles.periodActivityCard}>
            <ThemedText weight="bold" style={styles.periodActivityValue}>{windowNewTrials.length}</ThemedText>
            <ThemedText weight="regular" style={styles.periodActivityLabel}>New Trials</ThemedText>
          </View>
          <View style={styles.periodActivityCard}>
            <ThemedText weight="bold" style={[styles.periodActivityValue, { color: Colors.growthGreen }]}>{windowNewPaid.length}</ThemedText>
            <ThemedText weight="regular" style={styles.periodActivityLabel}>Converted</ThemedText>
          </View>
          <View style={styles.periodActivityCard}>
            <ThemedText weight="bold" style={[styles.periodActivityValue, windowCancellations.length > 0 ? { color: '#FF3B30' } : {}]}>{windowCancellations.length}</ThemedText>
            <ThemedText weight="regular" style={styles.periodActivityLabel}>Cancelled</ThemedText>
          </View>
          <View style={styles.periodActivityCard}>
            <ThemedText weight="bold" style={[styles.periodActivityValue, windowNetGrowth > 0 ? { color: Colors.growthGreen } : windowNetGrowth < 0 ? { color: '#FF3B30' } : {}]}>
              {windowNetGrowth >= 0 ? `+${windowNetGrowth}` : `${windowNetGrowth}`}
            </ThemedText>
            <ThemedText weight="regular" style={styles.periodActivityLabel}>Net Growth</ThemedText>
          </View>
        </View>
      </StepFadeIn>

      {/* SECTION 6 - LIFECYCLE FUNNEL */}
      <StepFadeIn delay={270}>
        <ThemedText weight="semiBold" style={styles.newSectionLabel}>
          User Journey Funnel
        </ThemedText>
      </StepFadeIn>
      <StepFadeIn delay={280}>
        <View style={styles.funnelContainer}>
          <View style={styles.funnelStage}>
            <ThemedText weight="bold" style={styles.funnelValue}>{dashboardMetrics?.lifecycleFunnel?.signups || 0}</ThemedText>
            <ThemedText weight="regular" style={styles.funnelLabel}>Signups</ThemedText>
            <ThemedText style={styles.funnelArrow}>↓</ThemedText>
          </View>
          <View style={styles.funnelStage}>
            <ThemedText weight="bold" style={styles.funnelValue}>{dashboardMetrics?.lifecycleFunnel?.onboarding_completed ?? '—'}</ThemedText>
            <ThemedText weight="regular" style={styles.funnelLabel}>Personalization Done</ThemedText>
            <ThemedText style={styles.funnelArrow}>↓</ThemedText>
          </View>
          <View style={styles.funnelStage}>
            <ThemedText weight="bold" style={styles.funnelValue}>{dashboardMetrics?.lifecycleFunnel?.first_playbook_generated ?? '—'}</ThemedText>
            <ThemedText weight="regular" style={styles.funnelLabel}>First Playbook Generated</ThemedText>
            <ThemedText style={styles.funnelArrow}>↓</ThemedText>
          </View>
          <View style={styles.funnelStage}>
            <ThemedText weight="bold" style={styles.funnelValue}>{dashboardMetrics?.lifecycleFunnel?.trial_started || 0}</ThemedText>
            <ThemedText weight="regular" style={styles.funnelLabel}>Trial Started</ThemedText>
            <ThemedText style={styles.funnelArrow}>↓</ThemedText>
          </View>
          <View style={styles.funnelStage}>
            <ThemedText weight="bold" style={[styles.funnelValue, { color: Colors.growthGreen }]}>{dashboardMetrics?.lifecycleFunnel?.subscription_purchased || 0}</ThemedText>
            <ThemedText weight="regular" style={styles.funnelLabel}>Paid</ThemedText>
          </View>
        </View>
      </StepFadeIn>


      {/* SECTION 7 - CONVERSION RATES */}
      <StepFadeIn delay={310}>
        <ThemedText weight="semiBold" style={styles.newSectionLabel}>
          Conversion Rates
        </ThemedText>
      </StepFadeIn>
      <StepFadeIn delay={320}>
        <View style={styles.conversionRatesContainer}>
          <View style={styles.conversionRateCard}>
            <ThemedText weight="bold" style={styles.conversionRateValue}>
              {dashboardMetrics?.conversionRates?.signup_to_onboarding != null ? `${dashboardMetrics.conversionRates.signup_to_onboarding}%` : '—'}
            </ThemedText>
            <ThemedText weight="regular" style={styles.conversionRateLabel}>Signup → Onboarding</ThemedText>
          </View>
          <View style={styles.conversionRateCard}>
            <ThemedText weight="bold" style={styles.conversionRateValue}>{dashboardMetrics?.conversionRates?.onboarding_to_playbook !== null && dashboardMetrics?.conversionRates ? `${dashboardMetrics.conversionRates.onboarding_to_playbook}%` : '—'}</ThemedText>
            <ThemedText weight="regular" style={styles.conversionRateLabel}>Onboarding → Playbook</ThemedText>
          </View>
          <View style={styles.conversionRateCard}>
            <ThemedText weight="bold" style={styles.conversionRateValue}>{dashboardMetrics?.conversionRates?.playbook_to_trial !== null && dashboardMetrics?.conversionRates ? `${dashboardMetrics.conversionRates.playbook_to_trial}%` : '—'}</ThemedText>
            <ThemedText weight="regular" style={styles.conversionRateLabel}>Onboarding → Trial</ThemedText>
          </View>
          <View style={styles.conversionRateCard}>
            <ThemedText weight="bold" style={styles.conversionRateValue}>{dashboardMetrics?.conversionRates?.trial_to_paid !== null && dashboardMetrics?.conversionRates ? `${dashboardMetrics.conversionRates.trial_to_paid}%` : '—'}</ThemedText>
            <ThemedText weight="regular" style={styles.conversionRateLabel}>Trial → Paid</ThemedText>
          </View>
        </View>
      </StepFadeIn>

      {/* SECTION 8 - CHURN VIEW */}
      <StepFadeIn delay={330}>
        <ThemedText weight="semiBold" style={styles.newSectionLabel}>
          Churn Overview
        </ThemedText>
      </StepFadeIn>
      <StepFadeIn delay={340}>
        <View style={styles.churnContainer}>
          <View style={styles.churnMetric}>
            <ThemedText weight="bold" style={[styles.churnMetricValue, { color: Colors.growthGreen }]}>{dashboardMetrics?.churnMetrics?.new_paid || 0}</ThemedText>
            <ThemedText weight="regular" style={styles.churnMetricLabel}>New Paid</ThemedText>
          </View>
          <View style={styles.churnMetric}>
            <ThemedText weight="bold" style={[styles.churnMetricValue, { color: '#FF3B30' }]}>{dashboardMetrics?.churnMetrics?.cancelled || 0}</ThemedText>
            <ThemedText weight="regular" style={styles.churnMetricLabel}>Cancelled</ThemedText>
          </View>
          <View style={styles.churnMetric}>
            <ThemedText weight="bold" style={[styles.churnMetricValue, { color: (dashboardMetrics?.churnMetrics?.net_growth ?? 0) >= 0 ? Colors.growthGreen : '#FF3B30' }]}>{(dashboardMetrics?.churnMetrics?.net_growth ?? 0) >= 0 ? '+' : ''}{dashboardMetrics?.churnMetrics?.net_growth ?? 0}</ThemedText>
            <ThemedText weight="regular" style={styles.churnMetricLabel}>Net Growth</ThemedText>
          </View>
          <View style={styles.churnMetric}>
            <ThemedText weight="bold" style={[styles.churnMetricValue, { color: (dashboardMetrics?.churnMetrics?.churn_rate ?? 0) > 10 ? '#FF3B30' : Colors.hopeWhite }]}>{dashboardMetrics?.churnMetrics?.churn_rate ?? 0}%</ThemedText>
            <ThemedText weight="regular" style={styles.churnMetricLabel}>Churn Rate</ThemedText>
          </View>
        </View>
      </StepFadeIn>

      {/* SECTION 9 - PLAYBOOK DROPOFF */}
      <StepFadeIn delay={350}>
        <ThemedText weight="semiBold" style={styles.newSectionLabel}>
          Activation Issues
        </ThemedText>
      </StepFadeIn>
      <StepFadeIn delay={360}>
        <View style={styles.dropoffContainer}>
          <View style={styles.dropoffCard}>
            <ThemedText weight="bold" style={[styles.dropoffValue, { color: '#FF9500' }]}>{dashboardMetrics?.playbookDropoff?.signed_up_no_playbook || 0}</ThemedText>
            <ThemedText weight="regular" style={styles.dropoffLabel}>Personalized but No Playbook</ThemedText>
          </View>
          <View style={styles.dropoffCard}>
            <ThemedText weight="bold" style={styles.dropoffValue}>{dashboardMetrics?.playbookDropoff?.avg_time_to_first_playbook_hours || 0}h</ThemedText>
            <ThemedText weight="regular" style={styles.dropoffLabel}>Avg Time to First Playbook</ThemedText>
          </View>
        </View>
      </StepFadeIn>

      {/* SECTION 10 - RECENT USERS FEED */}
      <StepFadeIn delay={370}>
        <ThemedText weight="semiBold" style={styles.newSectionLabel}>
          Recent Users
        </ThemedText>
      </StepFadeIn>
      <StepFadeIn delay={380}>
        <View style={styles.recentUsersContainer}>
          {dashboardMetrics?.recentUsers?.slice(0, 5).map((recentUser) => (
            <View key={recentUser.user_id} style={styles.recentUserRow}>
              <View style={styles.recentUserInfo}>
                <ThemedText weight="semiBold" style={styles.recentUserName}>{recentUser.name || 'Unknown'}</ThemedText>
                <ThemedText weight="regular" style={styles.recentUserEmail}>{recentUser.email || 'No email'}</ThemedText>
              </View>
              <View style={styles.recentUserStatus}>
                {recentUser.onboarding_completed && (
                  <View style={styles.statusBadge}>
                    <ThemedText weight="regular" style={styles.statusBadgeText}>✓ Onboarding</ThemedText>
                  </View>
                )}
                {recentUser.first_playbook_generated && (
                  <View style={styles.statusBadge}>
                    <ThemedText weight="regular" style={styles.statusBadgeText}>📖 Playbook</ThemedText>
                  </View>
                )}
                {recentUser.trial_started && (
                  <View style={styles.statusBadge}>
                    <ThemedText weight="regular" style={styles.statusBadgeText}>⏱ Trial</ThemedText>
                  </View>
                )}
                {recentUser.subscribed && (
                  <View style={[styles.statusBadge, { backgroundColor: 'rgba(52, 199, 89, 0.2)' }]}>
                    <ThemedText weight="regular" style={[styles.statusBadgeText, { color: Colors.growthGreen }]}>💎 Paid</ThemedText>
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>
      </StepFadeIn>

      {/* SECTION 11 - USERS AT RISK */}
      <StepFadeIn delay={390}>
        <ThemedText weight="semiBold" style={styles.newSectionLabel}>
          Users At Risk
        </ThemedText>
      </StepFadeIn>
      <StepFadeIn delay={400}>
        <View style={styles.atRiskContainer}>
          {dashboardMetrics?.nonConverterSegments?.map((segment) => (
            <View key={segment.state} style={styles.atRiskSegment}>
              <ThemedText weight="bold" style={styles.atRiskSegmentCount}>{segment.count}</ThemedText>
              <ThemedText weight="regular" style={styles.atRiskSegmentLabel}>{segment.label}</ThemedText>
            </View>
          ))}
        </View>
      </StepFadeIn>


      {/* SECTION 14 - EXPLORE DATA */}
      <StepFadeIn delay={450}>
        <ThemedText weight="semiBold" style={styles.newSectionLabel}>Explore Data</ThemedText>
      </StepFadeIn>
      <StepFadeIn delay={460}>
        {renderTabChoices()}
      </StepFadeIn>
      <StepFadeIn delay={470}>
        <ThemedText weight="regular" style={styles.exploreGroupLabel}>ACQUISITION</ThemedText>
        {renderInsightGrid(acquisitionInsights)}
      </StepFadeIn>
      <StepFadeIn delay={480}>
        <ThemedText weight="regular" style={styles.exploreGroupLabel}>SUBSCRIPTIONS</ThemedText>
        {renderInsightGrid(subscriptionInsights)}
      </StepFadeIn>
      {selectedDrilldown && (
        <StepFadeIn delay={0}>
          <View style={styles.drilldownHeader}>
            <ThemedText weight="semiBold" style={styles.sectionTitle}>{drilldownTitle}</ThemedText>
            <ThemedText weight="regular" style={styles.filteredHeaderText}>{drilldownRows.length} users</ThemedText>
          </View>
          {drilldownRows.length === 0 ? (
            <ThemedText weight="regular" style={styles.emptyText}>No users in this segment</ThemedText>
          ) : (
            drilldownRows.slice(0, 50).map(item => {
              const subRow = analyticsRows.find(r => r.user_id === item.user_id);
              const stats = userContentStats.get(item.user_id);
              return (
                <View key={`${selectedDrilldown}-${item.user_id}`} style={styles.drilldownUserCard}>
                  {/* Name + tier pill */}
                  <View style={styles.drilldownUserHeader}>
                    <ThemedText weight="semiBold" style={styles.drilldownUserName}>{item.name}</ThemedText>
                    <View style={[styles.drilldownTierPill, { backgroundColor: tierColor(subRow || {} as any) + '33' }]}>
                      <ThemedText weight="regular" style={[styles.drilldownTierText, { color: tierColor(subRow || {} as any) }]}>
                        {item.tier?.replace(/_/g, ' ').toUpperCase()}
                      </ThemedText>
                    </View>
                  </View>
                  {/* Email */}
                  <ThemedText weight="regular" style={styles.drilldownUserEmail}>{item.email}</ThemedText>
                  {/* Signed up */}
                  <ThemedText weight="regular" style={styles.drilldownUserMeta}>
                    Signed up: {formatDate(subRow?.account_created_at || subRow?.trial_start_date || subRow?.subscription_start_date || null)}
                  </ThemedText>
                  {/* Status line */}
                  {subRow && (
                    <ThemedText weight="regular" style={styles.drilldownUserMeta}>
                      {getStatusLine(subRow)}
                    </ThemedText>
                  )}
                  {/* Content stats */}
                  <View style={styles.drilldownStatsRow}>
                    <View style={styles.drilldownStat}>
                      <ThemedText weight="bold" style={styles.drilldownStatValue}>{stats?.playbooks ?? 0}</ThemedText>
                      <ThemedText weight="regular" style={styles.drilldownStatLabel}>Playbooks</ThemedText>
                    </View>
                    <View style={styles.drilldownStat}>
                      <ThemedText weight="bold" style={styles.drilldownStatValue}>{stats?.devotionals ?? 0}</ThemedText>
                      <ThemedText weight="regular" style={styles.drilldownStatLabel}>Devotionals</ThemedText>
                    </View>
                    <View style={styles.drilldownStat}>
                      <ThemedText weight="bold" style={styles.drilldownStatValue}>{stats?.guidance ?? 0}</ThemedText>
                      <ThemedText weight="regular" style={styles.drilldownStatLabel}>Guidance</ThemedText>
                    </View>
                    <View style={styles.drilldownStat}>
                      <ThemedText weight="bold" style={styles.drilldownStatValue}>{stats?.refinements ?? 0}</ThemedText>
                      <ThemedText weight="regular" style={styles.drilldownStatLabel}>Refinements</ThemedText>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </StepFadeIn>
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );

  const renderRow = ({ item }: { item: SubscriptionRow }) => {
    const expanded = expandedId === item.user_id;
    const accentColor = tierColor(item);
    const label = tierLabel(item);
    const name = displayName(item);
    const daysLeft = item.days_remaining;
    const isAnnual = item.billing_cycle === 'annual';
    // Use theme color for row accent based on active tab
    const rowAccentColor = activeTab === 'paid'
      ? Colors.growthGreen
      : activeTab === 'trials'
        ? '#FFC107'
        : activeTab === 'issues'
          ? '#FF3B30'
          : accentColor;
    const daysColor = daysLeft === null ? 'transparent'
      : daysLeft < 0 ? '#FF3B30'
      : daysLeft < 7 ? '#FF9500'
      : Colors.hopeWhite;

    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => setExpandedId(expanded ? null : item.user_id)}
        activeOpacity={0.75}
      >
        {/* Left accent bar */}
        <View style={[styles.rowAccentBar, { backgroundColor: rowAccentColor }]} />

        <View style={styles.rowInner}>
          <View style={styles.rowTop}>
            {/* Plan pill */}
            <View style={[styles.planPill, isAnnual && styles.planPillAnnual]}>
              <ThemedText weight="semiBold" style={[styles.planPillText, isAnnual && styles.planPillTextAnnual]}>
                {isAnnual ? '★ ' : ''}{label}
              </ThemedText>
            </View>
            {/* Days countdown */}
            {daysLeft !== null && (
              <ThemedText weight="bold" style={[styles.daysText, { color: daysColor }]}>
                {daysLeft < 0
                  ? `${Math.abs(Math.round(daysLeft))}d ago`
                  : daysLeft < 1 ? 'expires today'
                  : `${Math.round(daysLeft)}d left`}
              </ThemedText>
            )}
          </View>

          <View style={styles.rowMid}>
            <View style={styles.rowInfo}>
              <ThemedText weight="semiBold" style={styles.rowName} numberOfLines={1}>{name}</ThemedText>
              <ThemedText weight="regular" style={styles.rowStatusLine} numberOfLines={1}>{getMarketEmoji(item)} {getStatusLine(item)}</ThemedText>
              <ThemedText weight="regular" style={styles.rowEmail} numberOfLines={1}>{item.email || '—'}</ThemedText>
            </View>
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={14}
              color="rgba(255,255,255,0.35)"
              style={{ alignSelf: 'center' }}
            />
          </View>

          {expanded && (
            <View style={styles.rowDetail}>
              <View style={styles.rowDetailSummary}>
                {item.billing_cycle && (
                  <ThemedText weight="regular" style={styles.rowDetailLine}>
                    {item.billing_cycle === 'annual' ? 'Annual' : 'Monthly'}
                    {item.subscription_end_date && new Date(item.subscription_end_date) > new Date() && ` · Renews ${formatDate(item.subscription_end_date)}`}
                  </ThemedText>
                )}
                {item.trial_converted_date && (
                  <ThemedText weight="regular" style={styles.rowDetailLine}>Trial converted {formatDate(item.trial_converted_date)}</ThemedText>
                )}
                {item.auto_renew_enabled !== false ? (
                  <ThemedText weight="regular" style={styles.rowDetailLine}>Auto-renew ON</ThemedText>
                ) : item.subscription_end_date && new Date(item.subscription_end_date) > new Date() ? (
                  <ThemedText weight="regular" style={styles.rowDetailLine}>Auto-renew OFF · Access until {formatDate(item.subscription_end_date)}</ThemedText>
                ) : null}
                {item.billing_issue && (
                  <ThemedText weight="regular" style={[styles.rowDetailLine, { color: '#FF3B30' }]}>Payment failed</ThemedText>
                )}
                {item.cancellation_date && !(item.subscription_end_date && new Date(item.subscription_end_date) > new Date()) && (
                  <ThemedText weight="regular" style={[styles.rowDetailLine, { color: '#FF9500' }]}>Cancelled {formatDate(item.cancellation_date)}</ThemedText>
                )}
              </View>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderWebhookRow = ({ item }: { item: WebhookRow }) => {
    const hasTxn = !!item.transaction_id;
    const productShort = item.product_id
      ? item.product_id.replace('app.sifia.com.', '').replace('.freetrial', ' (trial)')
      : null;
    return (
      <View style={styles.webhookRow}>
        <View style={styles.webhookLeft}>
          <ThemedText weight="semiBold" style={styles.webhookType}>{item.notification_type || '—'}</ThemedText>
          {item.subtype ? <ThemedText weight="regular" style={styles.webhookSub}>{item.subtype}</ThemedText> : null}
          {productShort ? <ThemedText weight="regular" style={styles.webhookProduct}>{productShort}</ThemedText> : null}
        </View>
        <View style={styles.webhookRight}>
          <ThemedText weight="regular" style={styles.webhookDate}>{formatDate(item.received_at)}</ThemedText>
          <ThemedText weight="regular" style={[styles.webhookDetail, { color: hasTxn ? Colors.growthGreen : '#FF9500' }]}>
            {hasTxn ? `txn …${item.transaction_id!.slice(-6)}` : 'no txn id'}
          </ThemedText>
        </View>
      </View>
    );
  };

  const renderBugReportRow = ({ item }: { item: any }) => {
    return (
      <View style={styles.feedbackRow}>
        <View style={styles.feedbackLeft}>
          <ThemedText weight="semiBold" style={styles.feedbackMessage}>{item.message || '—'}</ThemedText>
          <ThemedText weight="regular" style={styles.feedbackMeta}>
            {item.platform} · {item.os_version} · {item.screen}
          </ThemedText>
        </View>
        <View style={styles.feedbackRight}>
          <ThemedText weight="regular" style={styles.feedbackDate}>{formatDate(item.created_at)}</ThemedText>
        </View>
      </View>
    );
  };

  const renderFeatureRequestRow = ({ item }: { item: any }) => {
    return (
      <View style={styles.feedbackRow}>
        <View style={styles.feedbackLeft}>
          <ThemedText weight="semiBold" style={styles.feedbackMessage}>{item.message || '—'}</ThemedText>
          <ThemedText weight="regular" style={styles.feedbackMeta}>
            {item.category} · {item.platform} · {item.os_version}
          </ThemedText>
        </View>
        <View style={styles.feedbackRight}>
          <ThemedText weight="regular" style={styles.feedbackDate}>{formatDate(item.created_at)}</ThemedText>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
      {/* Close and refresh buttons - top right */}
      {activeTab === 'overview' && (
        <View style={[styles.headerButtonsContainer, { top: insets.top + 16 }]}>
          <TouchableOpacity
            onPress={() => {
              triggerLightHaptic();
              refresh('overview');
            }}
            style={styles.headerRefreshButton}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={20} color={Colors.hopeWhite} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              triggerLightHaptic();
              navigation.goBack();
            }}
            style={styles.headerCloseButton}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={17} color="rgba(255,255,255,0.65)" />
          </TouchableOpacity>
        </View>
      )}

      {/* Content */}
      {activeTab === 'overview' && renderOverview()}

      {(activeTab === 'trials' || activeTab === 'paid' || activeTab === 'issues') && (
        <>
        <View style={[styles.stickyHeader, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity
            onPress={() => {
              triggerLightHaptic();
              setActiveTab('overview');
            }}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={28} color={Colors.hopeWhite} />
          </TouchableOpacity>
          <View style={styles.stickyHeaderContent}>
            <ThemedText weight="semiBold" style={styles.stickyHeaderTitle}>
              {activeTab === 'paid' ? 'Paid Subscribers' : activeTab === 'trials' ? 'Active Trials' : 'Issues'}
            </ThemedText>
          </View>
          <TouchableOpacity
            onPress={() => setShowQuickActions(!showQuickActions)}
            style={styles.searchIconButton}
            activeOpacity={0.7}
          >
            <Ionicons name="options-outline" size={20} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
        </View>
        {showQuickActions && (
          <StepFadeIn delay={0}>
            <View style={styles.searchBarContainer}>
              {renderSearchBar()}
            </View>
          </StepFadeIn>
        )}
        <FlatList
          data={getFilteredRows(rows)}
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
                <Ionicons name="document-text-outline" size={48} color="rgba(255,255,255,0.2)" />
                <ThemedText weight="regular" style={styles.emptyText}>
                  {searchQuery ? 'No matching records found' : selectedMetric ? `No ${getMetricLabel(selectedMetric).toLowerCase()} records` : 'No records'}
                </ThemedText>
                {searchQuery && (
                  <TouchableOpacity
                    onPress={() => {
                      triggerLightHaptic();
                      setSearchQuery('');
                    }}
                    style={styles.emptyActionButton}
                  >
                    <ThemedText weight="semiBold" style={styles.emptyActionText}>Clear search</ThemedText>
                  </TouchableOpacity>
                )}
              </View>
            )
          }
          ListHeaderComponent={
            <View>
              {getFilteredRows(rows).length > 0 ? (
                <ThemedText weight="regular" style={styles.rowCount}>{getFilteredRows(rows).length} records {searchQuery ? '(filtered)' : ''}</ThemedText>
              ) : null}
            </View>
          }
        />
        </>
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
                <ThemedText weight="regular" style={styles.emptyText}>No webhook events</ThemedText>
              </View>
            )
          }
          ListHeaderComponent={
            <View>
              {renderTabChoices()}
              {webhooks.length > 0 ? (
                <ThemedText weight="regular" style={styles.rowCount}>{webhooks.length} events</ThemedText>
              ) : null}
            </View>
          }
        />
      )}

      {activeTab === 'feedback' && (
        <View style={styles.feedbackContainer}>
          {renderTabChoices()}
          <View style={styles.feedbackTabs}>
            <TouchableOpacity
              style={[styles.feedbackTab, feedbackSubTab === 'bugs' && styles.feedbackTabActive]}
              onPress={() => { try { triggerLightHaptic(); } catch {} setFeedbackSubTab('bugs'); }}
            >
              <ThemedText weight="semiBold" style={[styles.feedbackTabText, feedbackSubTab === 'bugs' && styles.feedbackTabTextActive]}>Bug Reports ({bugReports.length})</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.feedbackTab, feedbackSubTab === 'features' && styles.feedbackTabActive]}
              onPress={() => { try { triggerLightHaptic(); } catch {} setFeedbackSubTab('features'); }}
            >
              <ThemedText weight="semiBold" style={[styles.feedbackTabText, feedbackSubTab === 'features' && styles.feedbackTabTextActive]}>Feature Requests ({featureRequests.length})</ThemedText>
            </TouchableOpacity>
          </View>

          <FlatList
            data={feedbackSubTab === 'bugs' ? bugReports : featureRequests}
            keyExtractor={item => String(item.id)}
            renderItem={feedbackSubTab === 'bugs' ? renderBugReportRow : renderFeatureRequestRow}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); refresh('feedback'); }}
                tintColor={Colors.hopeWhite}
              />
            }
            ListEmptyComponent={
              loading ? null : (
                <View style={styles.center}>
                  <ThemedText weight="regular" style={styles.emptyText}>
                    {feedbackSubTab === 'bugs' ? 'No bug reports' : 'No feature requests'}
                  </ThemedText>
                </View>
              )
            }
          />
        </View>
      )}
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
    right: 20,
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderRadius: 999,
    zIndex: 100,
  },

  // Header buttons container (side-by-side)
  headerButtonsContainer: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    gap: 8,
    zIndex: 100,
  },

  headerRefreshButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Walkthrough-style layout
  stepScroll: { flex: 1 },
  stepContent: { paddingHorizontal: 24, paddingTop: 72, paddingBottom: 40 },
  focusLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  labelIcon: { marginRight: 6 },
  focusLabel: {
    fontSize: 11,
    color: Colors.alertCoral,
    letterSpacing: 1.2,
  },
  titleRow: { marginBottom: 8 },
  stepTitle: {
    fontSize: 28,
    color: Colors.hopeWhite,
    lineHeight: 34,
  },
  sectionContainer: { marginTop: 32 },

  choiceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 8,
  },
  choiceCount: {
    fontSize: 26,
    color: Colors.hopeWhite,
    marginBottom: 2,
  },
  choiceCard: {
    width: '31%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 12,
    marginBottom: 12,
    minHeight: 100,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceCardSelected: {
    backgroundColor: 'rgba(255, 107, 107, 0.18)',
    borderColor: Colors.alertCoral,
  },
  choiceIconContainer: {
    marginBottom: 8,
  },
  choiceIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 20,
    backgroundColor: Colors.anchorBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceIconCircleSelected: {
    backgroundColor: Colors.alertCoral,
  },
  choiceName: {
    fontSize: 12,
    color: Colors.hopeWhite,
    marginBottom: 4,
    textAlign: 'center',
  },
  choiceDescription: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 14,
    textAlign: 'center',
  },
  choiceDescriptionSelected: {
    color: 'rgba(255, 255, 255, 0.9)',
  },

  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 8,
  },
  metricCardWrap: {
    width: '48%',
    marginBottom: 12,
  },
  metricCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 12,
    minHeight: 100,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricCardSelected: {
    backgroundColor: 'rgba(255, 107, 107, 0.18)',
    borderColor: Colors.alertCoral,
  },
  insightCard: {
    width: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 12,
    minHeight: 100,
    borderWidth: 0.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  insightScrollContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 4,
  },
  insightCardHorizontal: {
    width: 140,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 12,
    minHeight: 100,
    borderWidth: 0.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: {
    fontSize: 26,
    color: Colors.hopeWhite,
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 12,
    color: Colors.hopeWhite,
    marginBottom: 4,
    textAlign: 'center',
  },
  metricSub: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 14,
    textAlign: 'center',
  },
  tapHint: {
    color: Colors.alertCoral,
    fontSize: 10,
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  analyticsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  analyticsRangeText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    marginBottom: 12,
  },
  rangeSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  rangeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
  },
  rangeButtonSelected: {
    backgroundColor: Colors.alertCoral,
    borderColor: Colors.alertCoral,
  },
  rangeButtonText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
  },
  rangeButtonTextSelected: {
    color: Colors.hopeWhite,
  },
  monthSelector: {
    marginTop: 12,
  },
  monthSelectorLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 8,
  },
  monthScroll: {
    flexDirection: 'row',
  },
  monthButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.18)',
    marginRight: 8,
  },
  monthButtonSelected: {
    backgroundColor: Colors.alertCoral,
    borderColor: Colors.alertCoral,
  },
  monthButtonText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.65)',
  },
  monthButtonTextSelected: {
    color: Colors.hopeWhite,
  },
  miniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  miniRowLeft: { flex: 1, paddingRight: 12 },
  miniRowTitle: { color: Colors.hopeWhite, fontSize: 13 },
  miniRowSub: { color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 },
  miniRowRight: { alignItems: 'flex-end' },
  miniRowDate: { color: Colors.growthGreen, fontSize: 12 },
  miniRowCycle: { color: 'rgba(255,255,255,0.45)', fontSize: 10, marginTop: 2 },
  emptyMiniText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: 14,
  },
  moreRowsText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 6,
  },
  activityUserRow: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20,
    padding: 14,
    marginBottom: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  activityUserHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  activityUserInfo: { flex: 1 },
  activityUserName: {
    color: Colors.hopeWhite,
    fontSize: 14,
  },
  activityUserEmail: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    marginTop: 2,
  },
  activityBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(255,107,107,0.16)',
  },
  activityBadgeText: {
    color: Colors.alertCoral,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  activitySummary: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 10,
  },
  activityMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
  },
  activityMeta: {
    color: 'rgba(255,255,255,0.42)',
    fontSize: 10,
    flex: 1,
  },

  filteredSection: {
    marginTop: 24,
  },
  filteredHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  drilldownUserCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  drilldownUserHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  drilldownUserName: {
    fontSize: 15,
    color: Colors.hopeWhite,
    flex: 1,
  },
  drilldownTierPill: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginLeft: 8,
  },
  drilldownTierText: {
    fontSize: 10,
    letterSpacing: 0.5,
  },
  drilldownUserEmail: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    marginBottom: 6,
  },
  drilldownUserMeta: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 2,
  },
  drilldownStatsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  drilldownStat: {
    flex: 1,
    alignItems: 'center',
  },
  drilldownStatValue: {
    fontSize: 20,
    color: Colors.hopeWhite,
    marginBottom: 2,
  },
  drilldownStatLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
  },
  exploreGroupLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 16,
  },
  drilldownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 12,
  },
  filteredHeaderText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.65)',
  },
  filteredClearButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  filteredClearButtonText: {
    fontSize: 12,
    color: Colors.hopeWhite,
  },

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
  tabText: { fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  tabTextActive: { color: Colors.hopeWhite },

  // Floating refresh button
  floatingRefreshButton: {
    position: 'absolute',
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },

  // Overview content
  sectionTitle: { fontSize: 12, color: 'rgba(255,255,255,0.5)', letterSpacing: 1.2, marginBottom: 12 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    flex: 1, minWidth: '44%',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14, padding: 16,
    borderLeftWidth: 3,
  },
  statValue: { fontSize: 28, marginBottom: 4 },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.5)' },

  conversionBox: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 20, padding: 24, marginTop: 20,
    alignItems: 'center',
  },
  conversionLabel: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 8 },
  conversionValue: { fontSize: 44, color: Colors.growthGreen },
  conversionSub: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 6 },

  overviewActionWrap: {
    marginTop: 24,
    alignItems: 'flex-end',
  },
  overviewActionButton: {
    width: 42,
    height: 42,
    borderRadius: 20,
    backgroundColor: Colors.alertCoral,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },

  // List content
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  rowCount: { fontSize: 11, color: 'rgba(255,255,255,0.35)', paddingVertical: 8, paddingHorizontal: 2 },

  row: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    marginBottom: 14,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  rowAccentBar: { width: 4, borderRadius: 2 },
  rowInner: { flex: 1, paddingHorizontal: 12, paddingVertical: 12 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  rowMid: { flexDirection: 'row', alignItems: 'flex-start' },
  planPill: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  planPillAnnual: { backgroundColor: 'rgba(255,200,60,0.18)' },
  planPillText: { fontSize: 10, color: 'rgba(255,255,255,0.5)', letterSpacing: 0.3 },
  planPillTextAnnual: { color: '#FFC83C' },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 14, color: Colors.hopeWhite },
  rowStatusLine: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 3 },
  rowEmail: { fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 },
  daysText: { fontSize: 12 },
  cycleText: { fontSize: 10, color: 'rgba(255,255,255,0.4)' },

  rowDetail: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
    marginTop: 12,
    paddingTop: 16,
    gap: 12,
  },
  rowDetailSummary: {
    gap: 10,
  },
  rowDetailLine: {
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.72)',
  },
  detailSection: {
    fontSize: 10, color: 'rgba(255,255,255,0.3)',
    letterSpacing: 1.1, marginBottom: 4,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  detailLabel: { fontSize: 12, color: 'rgba(255,255,255,0.4)', width: 140 },
  detailValue: { fontSize: 12, color: 'rgba(255,255,255,0.8)', flex: 1, textAlign: 'right' },
  detailHighlight: { color: '#FF3B30' },

  webhookRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  webhookLeft: { flex: 1 },
  webhookType: { fontSize: 14, color: Colors.hopeWhite },
  webhookSub: { fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  webhookProduct: { fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 },
  webhookRight: { alignItems: 'flex-end' },
  webhookDate: { fontSize: 12, color: 'rgba(255,255,255,0.45)' },
  webhookDetail: { fontSize: 11, marginTop: 4 },

  // Feedback styles
  feedbackContainer: { flex: 1 },
  feedbackTabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  feedbackTab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
  },
  feedbackTabActive: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  feedbackTabText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },
  feedbackTabTextActive: {
    color: Colors.hopeWhite,
  },
  feedbackRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingVertical: 12, paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  feedbackLeft: { flex: 1 },
  feedbackMessage: { fontSize: 14, color: Colors.hopeWhite, marginBottom: 4 },
  feedbackMeta: { fontSize: 12, color: 'rgba(255,255,255,0.45)' },
  feedbackRight: { alignItems: 'flex-end' },
  feedbackDate: { fontSize: 12, color: 'rgba(255,255,255,0.45)' },

  emptyText: { color: 'rgba(255,255,255,0.35)', fontSize: 14 },

  // Search bar styles
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
  },
  searchIcon: { marginRight: 12 },
  searchInput: {
    flex: 1,
    color: Colors.hopeWhite,
    fontSize: 14,
  },
  searchClearButton: { marginLeft: 8 },

  // Last updated indicator
  lastUpdatedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  lastUpdatedText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
  },

  // Collapsible sections
  collapsibleSection: {
    marginTop: 24,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 20,
    overflow: 'hidden',
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  collapsibleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  collapsibleTitle: {
    fontSize: 13,
    color: Colors.hopeWhite,
  },
  collapsibleContent: {
    paddingTop: 12,
  },
  countBadge: {
    backgroundColor: Colors.alertCoral,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  countBadgeText: {
    fontSize: 11,
    color: Colors.hopeWhite,
  },

  // Quick actions
  quickActionsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
  },
  quickActionText: {
    fontSize: 12,
    color: Colors.hopeWhite,
  },

  // Enhanced empty states
  emptyActionButton: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.alertCoral,
    borderRadius: 14,
  },
  emptyActionText: {
    fontSize: 13,
    color: Colors.hopeWhite,
  },

  // New simplified dashboard styles
  newHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingTop: 12,
  },
  newHeaderTitle: {
    fontSize: 28,
    color: Colors.hopeWhite,
    marginBottom: 4,
  },
  newRefreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newSectionLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  healthCardsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 32,
  },
  healthRow: {
    flexDirection: 'row',
    gap: 12,
  },
  mainGoalCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 18,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.25)',
  },
  mainGoalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  mainGoalTitle: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
  mainGoalCount: {
    fontSize: 22,
    color: '#FFD700',
  },
  mainGoalOf: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
  },
  goalProgressTrack: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  goalProgressFill: {
    height: 8,
    backgroundColor: '#FFD700',
    borderRadius: 4,
  },
  mainGoalPct: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
  },
  goalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 28,
  },
  goalCard: {
    width: '30%',
    flexGrow: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  goalCardCount: {
    fontSize: 24,
    color: Colors.hopeWhite,
    marginBottom: 4,
  },
  goalCardTier: {
    fontSize: 13,
    color: Colors.hopeWhite,
  },
  goalCardCycle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 2,
  },
  healthCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 18,
    padding: 20,
    minHeight: 110,
  },
  healthCardHero: {
    flex: 1,
    minWidth: '100%',
    minHeight: 120,
  },
  healthCardSecondary: {
    flex: 1,
    minWidth: '45%',
  },
  healthCardValue: {
    fontSize: 36,
    color: Colors.hopeWhite,
    marginBottom: 8,
  },
  healthCardHeroValue: {
    fontSize: 44,
    color: Colors.hopeWhite,
    marginBottom: 8,
  },
  healthCardLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 12,
  },
  healthCardTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  healthCardTrendText: {
    fontSize: 12,
    color: Colors.growthGreen,
  },
  healthCardRevenueTitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  marketRevenueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  marketRevenueLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },
  marketRevenueValue: {
    fontSize: 18,
    color: Colors.hopeWhite,
  },
  attentionContainer: {
    backgroundColor: 'rgba(255,59,48,0.11)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,59,48,0.22)',
  },
  growthHeroContainer: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  attentionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  attentionIcon: {
    fontSize: 16,
  },
  attentionText: {
    fontSize: 14,
    color: Colors.hopeWhite,
  },
  noAttentionText: {
    fontSize: 14,
    color: Colors.growthGreen,
    textAlign: 'center',
    paddingVertical: 8,
  },
  growthContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  growthHeroValue: {
    fontSize: 56,
    color: Colors.growthGreen,
    marginBottom: 8,
  },
  growthHeroLabel: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
  },
  growthSecondaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  activityWindowGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 28,
  },
  activityWindowCard: {
    flex: 1,
    minWidth: '40%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  activityWindowValue: {
    fontSize: 30,
    color: Colors.hopeWhite,
    marginBottom: 4,
  },
  activityWindowLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
  },
  rangeSelectorWrapper: {
    marginBottom: 8,
  },
  periodActivityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 28,
  },
  periodActivityCard: {
    width: '30%',
    flexGrow: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  periodActivityValue: {
    fontSize: 26,
    color: Colors.hopeWhite,
    marginBottom: 4,
  },
  periodActivityLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
  },
  marketBreakdownContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  marketBreakdownCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
  },
  marketBreakdownEmoji: {
    fontSize: 24,
    marginBottom: 10,
  },
  marketBreakdownValue: {
    fontSize: 28,
    color: Colors.hopeWhite,
    marginBottom: 4,
  },
  marketBreakdownLabel: {
    fontSize: 14,
    color: Colors.hopeWhite,
    marginBottom: 4,
  },
  marketBreakdownSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
  },
  growthMetric: {
    flex: 1,
    alignItems: 'center',
  },
  growthLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 4,
  },
  growthValue: {
    fontSize: 24,
    color: Colors.hopeWhite,
    marginBottom: 4,
  },
  growthSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
  },

  // Large list navigation styles
  navigationList: {
    gap: 4,
  },
  navigationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 18,
    padding: 16,
    minHeight: 64,
  },
  navigationItemSelected: {
    backgroundColor: 'rgba(255,107,107,0.15)',
    borderWidth: 1,
    borderColor: Colors.alertCoral,
  },
  navigationItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 16,
  },
  navigationItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navigationItemIconSelected: {
    backgroundColor: Colors.alertCoral,
  },
  navigationItemTextContainer: {
    flex: 1,
  },
  navigationItemTitle: {
    fontSize: 15,
    color: Colors.hopeWhite,
  },
  navigationItemTitleSelected: {
    color: Colors.alertCoral,
  },
  navigationItemSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  navigationItemArrow: {
    color: 'rgba(255,255,255,0.3)',
  },
  navigationItemCount: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    paddingHorizontal: 8,
  },
  navigationItemCountValue: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
  },
  navigationItemIndicator: {
    position: 'absolute',
    right: 16,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.alertCoral,
  },

  // Sticky header styles for FlatList screens
  stickyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: Colors.anchorBlue,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    zIndex: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
  },
  stickyHeaderContent: {
    flex: 1,
  },
  stickyHeaderTitle: {
    fontSize: 24,
    color: Colors.hopeWhite,
  },
  searchIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -8,
  },
  searchBarContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },

  // Lifecycle Funnel
  funnelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  funnelStage: {
    flex: 1,
    alignItems: 'center',
  },
  funnelValue: {
    fontSize: 28,
    color: Colors.hopeWhite,
    marginBottom: 4,
  },
  funnelLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
  },
  funnelArrow: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 4,
  },

  // Time-Based Metrics
  timeMetricsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  timeMetricCard: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  timeMetricValue: {
    fontSize: 20,
    color: Colors.hopeWhite,
    marginBottom: 4,
  },
  timeMetricLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
  },

  // Conversion Rates
  conversionRatesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  conversionRateCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  conversionRateValue: {
    fontSize: 24,
    color: Colors.growthGreen,
    marginBottom: 4,
  },
  conversionRateLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
  },

  // Churn Metrics
  churnContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  churnMetric: {
    flex: 1,
    alignItems: 'center',
  },
  churnMetricValue: {
    fontSize: 24,
    color: Colors.hopeWhite,
    marginBottom: 4,
  },
  churnMetricLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
  },

  // Playbook Dropoff
  dropoffContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,149,0,0.08)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  dropoffCard: {
    flex: 1,
    alignItems: 'center',
  },
  dropoffValue: {
    fontSize: 28,
    color: '#FF9500',
    marginBottom: 4,
  },
  dropoffLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },

  // Recent Users Feed
  recentUsersContainer: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  recentUserRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  recentUserInfo: {
    flex: 1,
  },
  recentUserName: {
    fontSize: 14,
    color: Colors.hopeWhite,
    marginBottom: 2,
  },
  recentUserEmail: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
  },
  recentUserStatus: {
    flexDirection: 'row',
    gap: 6,
  },
  statusBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
  },

  // Users At Risk
  atRiskContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  atRiskSegment: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'rgba(255,59,48,0.08)',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  atRiskSegmentCount: {
    fontSize: 28,
    color: '#FF3B30',
    marginBottom: 4,
  },
  atRiskSegmentLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },

  // Section Description
  sectionDescription: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 12,
  },

  // High Intent Users
  highIntentContainer: {
    backgroundColor: 'rgba(255,193,7,0.08)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  highIntentUserRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,193,7,0.15)',
  },
  highIntentUserInfo: {
    flex: 1,
  },
  highIntentUserName: {
    fontSize: 14,
    color: Colors.hopeWhite,
    marginBottom: 2,
  },
  highIntentUserEmail: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
  },
  highIntentUserMetrics: {
    alignItems: 'flex-end',
  },
  highIntentUserMetric: {
    fontSize: 12,
    color: '#FFC107',
    marginBottom: 2,
  },
  highIntentUserDays: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
  },

  // User Segments
  segmentsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  segmentCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 14,
  },
  segmentCardHighPriority: {
    backgroundColor: 'rgba(255,59,48,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,59,48,0.3)',
  },
  segmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  segmentLabel: {
    fontSize: 13,
    color: Colors.hopeWhite,
  },
  priorityBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  priorityBadgeHigh: {
    backgroundColor: 'rgba(255,59,48,0.2)',
  },
  priorityBadgeText: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.7)',
  },
  segmentDescription: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 8,
    lineHeight: 14,
  },
  segmentCount: {
    fontSize: 20,
    color: Colors.hopeWhite,
  },
});
