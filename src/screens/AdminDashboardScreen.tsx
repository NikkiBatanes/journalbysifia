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
  StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { Colors } from '../theme/colors';
import { triggerLightHaptic } from '../utils/haptics';
import { adminDashboardService, DashboardMetrics } from '../services/adminDashboardService';

const ADMIN_EMAILS = ['nikki.batanes@sifia.app', 'nikkibatanes@gmail.com'];

type FilterTab = 'overview' | 'trials' | 'paid' | 'issues' | 'webhooks';
type AnalyticsRange = 'daily' | 'weekly' | 'monthly' | 'custom';
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

function isPaidSubscriptionRow(row: SubscriptionRow): boolean {
  const hasPaidTier = row.tier !== 'seeker' && row.tier !== 'free_trial' && row.tier !== 'unknown';
  const hasAppleTransaction = !!row.original_transaction_id || !!row.platform_transaction_id;
  const hasValidEndDate = !row.subscription_end_date || new Date(row.subscription_end_date) >= new Date();
  return hasPaidTier && hasAppleTransaction && row.status === 'active' && hasValidEndDate;
}

const FILTER_TABS: { key: FilterTab; label: string; icon: string; subtitle: string }[] = [
  { key: 'overview', label: 'Overview', icon: 'analytics', subtitle: 'Dashboard snapshot' },
  { key: 'trials', label: 'Trials', icon: 'timer', subtitle: 'Active trial users' },
  { key: 'paid', label: 'Paid', icon: 'card', subtitle: 'Subscribed members' },
  { key: 'issues', label: 'Issues', icon: 'warning', subtitle: 'Needs attention' },
  { key: 'webhooks', label: 'Webhooks', icon: 'webhook', subtitle: 'Incoming events' },
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
  const [selectedMetric, setSelectedMetric] = useState<OverviewMetric>(null);
  const [analyticsRange, setAnalyticsRange] = useState<AnalyticsRange>('daily');
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics | null>(null);
  const [analyticsRows, setAnalyticsRows] = useState<SubscriptionRow[]>([]);
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [dailyActivity, setDailyActivity] = useState<DailyActivityRow[]>([]);
  const [selectedDrilldown, setSelectedDrilldown] = useState<DrilldownKey>('all_users');

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

  const getAnalyticsWindow = useCallback(() => {
    const endDate = new Date();
    const startDate = analyticsRange === 'daily'
      ? daysAgo(0)
      : analyticsRange === 'weekly'
        ? daysAgo(6)
        : analyticsRange === 'monthly'
          ? daysAgo(29)
          : daysAgo(89);
    return { startDate, endDate };
  }, [analyticsRange]);

  const loadAnalytics = useCallback(async () => {
    const { startDate, endDate } = getAnalyticsWindow();
    const metrics = await adminDashboardService.getAllDashboardMetrics(startDate, endDate);
    setDashboardMetrics(metrics);

    const [subscriptionResult, eventsResult, activityResult] = await Promise.all([
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
    ]);

    if (!subscriptionResult.error) {
      setAnalyticsRows((subscriptionResult.data as SubscriptionRow[]) || []);
    }
    if (!eventsResult.error) {
      setActivityEvents((eventsResult.data as ActivityEvent[]) || []);
    }
    if (!activityResult.error) {
      setDailyActivity((activityResult.data as DailyActivityRow[]) || []);
    }
  }, [getAnalyticsWindow]);

  const refresh = useCallback(async (tab: FilterTab = activeTab) => {
    setLoading(true);
    try {
      await loadOverview();
      await loadAnalytics();
      if (tab === 'webhooks') {
        await loadWebhooks();
      } else if (tab !== 'overview') {
        await loadRows(tab);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, loadAnalytics, loadOverview, loadRows, loadWebhooks]);

  useEffect(() => {
    if (isAdmin) { refresh(activeTab); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, activeTab, analyticsRange]);

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
    if (!selectedMetric) { return items; }

    return items.filter(item => {
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
  }, [selectedMetric]);

  const analyticsWindow = getAnalyticsWindow();
  const activePaidRows = analyticsRows.filter(isPaidSubscriptionRow);
  const upcomingRenewals = activePaidRows
    .filter(row => row.auto_renew_enabled !== false && row.subscription_end_date)
    .sort((a, b) => new Date(a.subscription_end_date || 0).getTime() - new Date(b.subscription_end_date || 0).getTime())
    .slice(0, 8);
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
  const trackedSignupCount = dashboardMetrics?.userSignups.daily.reduce((sum, item) => sum + item.count, 0) || 0;
  const trackedDauCount = dashboardMetrics?.dailyActiveUsers.reduce((sum, item) => sum + item.total_dau, 0) || 0;
  const rangeLabel = analyticsRange === 'daily'
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

  const getUserSummaries = (sourceRows: SubscriptionRow[]): UserActivitySummary[] => {
    const rowMap = new Map(sourceRows.map(row => [row.user_id, row]));

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
        });
      }
    });

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

  const allUserSummaries = getUserSummaries(analyticsRows);
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
    { label: 'Cancelled', value: cancelledRows.length, subtitle: rangeLabel, color: '#FF9500', drilldown: 'cancelled' },
  ];

  const renderTabChoices = () => (
    <View style={styles.choiceGrid}>
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
            style={[styles.choiceCard, isSelected && styles.choiceCardSelected]}
            onPress={() => {
              triggerLightHaptic();
              openTab(tab.key);
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.choiceCount}>{loading ? '…' : String(count ?? 0)}</Text>
            <View style={styles.choiceIconContainer}>
              <View style={[styles.choiceIconCircle, isSelected && styles.choiceIconCircleSelected]}>
                <Ionicons
                  name={tab.icon as any}
                  size={18}
                  color={isSelected ? Colors.hopeWhite : Colors.alertCoral}
                />
              </View>
            </View>
            <Text style={styles.choiceName}>{tab.label}</Text>
            <Text style={[styles.choiceDescription, isSelected && styles.choiceDescriptionSelected]}>
              {tab.subtitle}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

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

  const renderMetricCard = (label: string, value: number | undefined, color: string, delay: number = 0, tab: FilterTab = 'overview', metric: OverviewMetric = null) => {
    const selected = activeTab === tab && selectedMetric === metric;
    return (
      <StepFadeIn delay={delay} style={styles.metricCardWrap}>
        <TouchableOpacity
          onPress={() => {
            triggerLightHaptic();
            openTab(tab, metric);
          }}
          activeOpacity={0.85}
          style={[styles.metricCard, { borderColor: color }, selected && styles.metricCardSelected]}
        >
          <Text style={[styles.metricValue, { color }]}>{value ?? '—'}</Text>
          <Text style={styles.metricLabel}>{label}</Text>
          <Text style={styles.metricSub}>{metric ? 'Tap to view data' : 'Overview'}</Text>
        </TouchableOpacity>
      </StepFadeIn>
    );
  };

  const renderInsightGrid = (items: AdminInsight[]) => (
    <View style={styles.metricGrid}>
      {items.map(item => (
        <TouchableOpacity
          key={item.label}
          style={[
            styles.insightCard,
            { borderColor: item.color },
            selectedDrilldown === item.drilldown && styles.metricCardSelected,
          ]}
          onPress={() => openDrilldown(item.drilldown || null)}
          activeOpacity={0.85}
        >
          <Text style={[styles.metricValue, { color: item.color }]}>{item.value}</Text>
          <Text style={styles.metricLabel}>{item.label}</Text>
          <Text style={styles.metricSub}>{item.subtitle}</Text>
          <Text style={styles.tapHint}>Tap to view</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderUserActivityRows = () => (
    <StepFadeIn delay={240} style={styles.sectionContainer}>
      <View style={styles.filteredHeaderRow}>
        <Text style={styles.sectionTitle}>{drilldownTitle}</Text>
        <Text style={styles.filteredHeaderText}>{drilldownRows.length} users</Text>
      </View>
      {drilldownRows.length === 0 ? (
        <Text style={styles.emptyMiniText}>No user records found for this card and date range.</Text>
      ) : (
        drilldownRows.slice(0, 50).map(item => (
          <View key={`${selectedDrilldown || 'all'}-${item.user_id}`} style={styles.activityUserRow}>
            <View style={styles.activityUserHeader}>
              <View style={styles.activityUserInfo}>
                <Text style={styles.activityUserName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.activityUserEmail} numberOfLines={1}>{item.email || item.user_id}</Text>
              </View>
              <View style={styles.activityBadge}>
                <Text style={styles.activityBadgeText}>{item.tier}</Text>
              </View>
            </View>
            <Text style={styles.activitySummary}>{item.activity_summary}</Text>
            <View style={styles.activityMetaRow}>
              <Text style={styles.activityMeta}>Last action: {item.last_event.replace(/_/g, ' ')}</Text>
              <Text style={styles.activityMeta}>{formatDate(item.last_activity_at)}</Text>
            </View>
            <View style={styles.activityMetaRow}>
              <Text style={styles.activityMeta}>Status: {item.status}</Text>
              <Text style={styles.activityMeta}>{item.billing_cycle ? `${item.billing_cycle} plan` : 'No paid plan'}</Text>
            </View>
          </View>
        ))
      )}
    </StepFadeIn>
  );

  const renderRangeSelector = () => (
    <View style={styles.rangeSelector}>
      {(['daily', 'weekly', 'monthly', 'custom'] as AnalyticsRange[]).map(range => {
        const selected = analyticsRange === range;
        return (
          <TouchableOpacity
            key={range}
            onPress={() => {
              triggerLightHaptic();
              setAnalyticsRange(range);
            }}
            style={[styles.rangeButton, selected && styles.rangeButtonSelected]}
            activeOpacity={0.85}
          >
            <Text style={[styles.rangeButtonText, selected && styles.rangeButtonTextSelected]}>
              {range === 'custom' ? '90d' : range.charAt(0).toUpperCase() + range.slice(1)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderMiniRows = (title: string, items: SubscriptionRow[], empty: string, previewLimit = 8) => (
    <StepFadeIn delay={360} style={styles.sectionContainer}>
      <View style={styles.filteredHeaderRow}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.filteredHeaderText}>{items.length} total</Text>
      </View>
      {items.length === 0 ? (
        <Text style={styles.emptyMiniText}>{empty}</Text>
      ) : (
        <>
          {items.slice(0, previewLimit).map(item => (
            <View key={`${title}-${item.user_id}`} style={styles.miniRow}>
              <View style={styles.miniRowLeft}>
                <Text style={styles.miniRowTitle} numberOfLines={1}>{displayName(item)}</Text>
                <Text style={styles.miniRowSub} numberOfLines={1}>{item.email || item.tier}</Text>
              </View>
              <View style={styles.miniRowRight}>
                <Text style={styles.miniRowDate}>
                  {item.subscription_end_date ? formatDate(item.subscription_end_date) : formatDate(item.trial_end_date)}
                </Text>
                <Text style={styles.miniRowCycle}>
                  {item.billing_cycle === 'annual' ? '★ Annual' : item.billing_cycle === 'monthly' ? 'Monthly' : item.status}
                </Text>
              </View>
            </View>
          ))}
          {items.length > previewLimit && (
            <Text style={styles.moreRowsText}>Showing {previewLimit} of {items.length}. Use SQL/export for the full list.</Text>
          )}
        </>
      )}
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

      <StepFadeIn delay={120}>
        {renderTabChoices()}
      </StepFadeIn>

      <StepFadeIn delay={160} style={styles.sectionContainer}>
        <View style={styles.analyticsHeader}>
          <Text style={styles.sectionTitle}>Analytics Range</Text>
          <Text style={styles.analyticsRangeText}>{rangeLabel}</Text>
        </View>
        {renderRangeSelector()}
      </StepFadeIn>

      <StepFadeIn delay={180} style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Downloads & New Users</Text>
        {renderInsightGrid(acquisitionInsights)}
      </StepFadeIn>

      <StepFadeIn delay={200} style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Subscriber Breakdown</Text>
        {renderInsightGrid(subscriptionInsights)}
      </StepFadeIn>

      {renderUserActivityRows()}

      <StepFadeIn delay={220} style={styles.conversionBox}>
        <Text style={styles.conversionLabel}>Subscription Health</Text>
        <Text style={styles.conversionValue}>{activePaidRows.length}</Text>
        <Text style={styles.conversionSub}>
          {monthlySubscriberRows.length} paid monthly · {yearlySubscriberRows.length} paid yearly · {upcomingRenewalRows.length} renewing soon
        </Text>
      </StepFadeIn>

      {renderMiniRows('Next Renewals', upcomingRenewals, 'No upcoming renewals found')}
      {renderMiniRows('Needs Attention', attentionRows, 'No billing, cancellation, or stale status issues')}

      <StepFadeIn delay={260} style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Subscriptions</Text>
        <View style={styles.metricGrid}>
          {renderMetricCard('Active Trials', overview?.active_trials, '#FFC107', 0, 'trials', 'active_trials')}
          {renderMetricCard('Paid Active', overview?.paid_active, Colors.growthGreen, 40, 'paid', 'paid_active')}
          {renderMetricCard('Converted', overview?.converted_trials, '#34C759', 80, 'paid', 'converted_trials')}
          {renderMetricCard('Billing Issues', overview?.billing_issues, '#FF3B30', 120, 'issues', 'billing_issues')}
        </View>
        <View style={styles.metricGrid}>
          {renderMetricCard('Stuck Trials', overview?.stuck_trials, '#FF9500', 0, 'trials', 'stuck_trials')}
          {renderMetricCard('Cancelled', overview?.cancelled, '#FF9500', 40, 'trials', 'cancelled')}
          {renderMetricCard('Expired', overview?.expired, 'rgba(255,255,255,0.4)', 80, 'trials', 'expired')}
          {renderMetricCard('Free (No Sub)', overview?.seeker_free, 'rgba(255,255,255,0.4)', 120, 'overview', 'seeker_free')}
        </View>
      </StepFadeIn>

      <StepFadeIn delay={240} style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Lifetime</Text>
        <View style={styles.metricGrid}>
          {renderMetricCard('Total Users', overview?.total_users, Colors.hopeWhite, 0, 'overview', 'total_users')}
          {renderMetricCard('Total Trials Started', overview?.total_trials_ever, '#FFC107', 40, 'trials', 'total_trials_ever')}
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

      {selectedMetric && (
        <StepFadeIn delay={380} style={styles.filteredSection}>
          <Text style={styles.sectionTitle}>{getMetricLabel(selectedMetric)}</Text>
          <View style={styles.filteredHeaderRow}>
            <Text style={styles.filteredHeaderText}>
              {getFilteredRows(rows).length} matching records
            </Text>
            <TouchableOpacity
              onPress={() => {
                triggerLightHaptic();
                openTab(activeTab, null);
              }}
              style={styles.filteredClearButton}
              activeOpacity={0.8}
            >
              <Text style={styles.filteredClearButtonText}>Clear</Text>
            </TouchableOpacity>
          </View>
        </StepFadeIn>
      )}

      <StepFadeIn delay={420} style={styles.overviewActionWrap}>
        <TouchableOpacity
          onPress={() => {
            triggerLightHaptic();
            refresh('overview');
          }}
          style={styles.overviewActionButton}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator size="small" color={Colors.hopeWhite} />
          ) : (
            <Ionicons name="refresh" size={18} color={Colors.hopeWhite} />
          )}
        </TouchableOpacity>
      </StepFadeIn>

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
    const daysColor = daysLeft === null ? 'transparent'
      : daysLeft < 0 ? '#FF3B30'
      : daysLeft < 7 ? '#FF9500'
      : Colors.hopeWhite;

    // Subscription window string e.g. "Dec 11, 2025 → Dec 23, 2026"
    const subWindow = item.subscription_start_date && item.subscription_end_date
      ? `${formatDate(item.subscription_start_date)} → ${formatDate(item.subscription_end_date)}`
      : null;

    // Trial window string
    const trialWindow = item.trial_start_date && item.trial_end_date
      ? `${formatDate(item.trial_start_date)} → ${formatDate(item.trial_end_date)}`
      : null;

    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => setExpandedId(expanded ? null : item.user_id)}
        activeOpacity={0.75}
      >
        {/* Left accent bar */}
        <View style={[styles.rowAccentBar, { backgroundColor: accentColor }]} />

        <View style={styles.rowInner}>
          <View style={styles.rowTop}>
            {/* Plan pill */}
            <View style={[styles.planPill, isAnnual && styles.planPillAnnual]}>
              <Text style={[styles.planPillText, isAnnual && styles.planPillTextAnnual]}>
                {isAnnual ? '★ ' : ''}{label}
              </Text>
            </View>
            {/* Days countdown */}
            {daysLeft !== null && (
              <Text style={[styles.daysText, { color: daysColor }]}>
                {daysLeft < 0
                  ? `${Math.abs(Math.round(daysLeft))}d ago`
                  : daysLeft < 1 ? 'expires today'
                  : `${Math.round(daysLeft)}d left`}
              </Text>
            )}
          </View>

          <View style={styles.rowMid}>
            <View style={styles.rowInfo}>
              <Text style={styles.rowName} numberOfLines={1}>{name}</Text>
              <Text style={styles.rowStatusLine} numberOfLines={1}>{getStatusLine(item)}</Text>
              <Text style={styles.rowEmail} numberOfLines={1}>{item.email || '—'}</Text>
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
              {/* Subscription section */}
              <Text style={styles.detailSection}>SUBSCRIPTION</Text>
              <DetailRow label="Plan" value={item.subscription_display_name || item.tier} />
              <DetailRow label="Status" value={item.status} />
              <DetailRow label="Billing" value={item.billing_cycle === 'annual' ? 'Annual' : item.billing_cycle === 'monthly' ? 'Monthly' : '—'} />
              {subWindow && <DetailRow label="Active from → to" value={subWindow} />}
              {item.auto_renew_enabled === false && item.subscription_end_date && new Date(item.subscription_end_date) > new Date() && (
                <DetailRow label="Auto-renew" value={`Off — access until ${formatDate(item.subscription_end_date)}`} highlight />
              )}
              {item.cancellation_date && !(item.subscription_end_date && new Date(item.subscription_end_date) > new Date()) && (
                <DetailRow label="Cancelled on" value={formatDate(item.cancellation_date)} highlight />
              )}
              {item.billing_issue && (
                <DetailRow label="Billing issue" value="Payment failed" highlight />
              )}
              {item.grace_period_end_date && (
                <DetailRow label="Grace period ends" value={formatDate(item.grace_period_end_date)} highlight />
              )}

              {/* Trial section — only show if trial data exists */}
              {(item.trial_start_date || item.trial_chosen_tier) && (
                <>
                  <Text style={[styles.detailSection, { marginTop: 12 }]}>TRIAL</Text>
                  {item.trial_chosen_tier && <DetailRow label="Trial plan" value={item.trial_chosen_tier} />}
                  {trialWindow && <DetailRow label="Trial period" value={trialWindow} />}
                  {item.trial_converted_date && <DetailRow label="Converted on" value={formatDate(item.trial_converted_date)} />}
                  {item.trial_cancelled_date && <DetailRow label="Trial cancelled" value={formatDate(item.trial_cancelled_date)} highlight />}
                </>
              )}

              {/* Payment section */}
              <Text style={[styles.detailSection, { marginTop: 12 }]}>PAYMENT</Text>
              <DetailRow label="Transaction ID" value={item.original_transaction_id || '—'} />
              <DetailRow label="Record last synced" value={formatDate(item.updated_at)} />
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
          <Text style={styles.webhookType}>{item.notification_type || '—'}</Text>
          {item.subtype ? <Text style={styles.webhookSub}>{item.subtype}</Text> : null}
          {productShort ? <Text style={styles.webhookProduct}>{productShort}</Text> : null}
        </View>
        <View style={styles.webhookRight}>
          <Text style={styles.webhookDate}>{formatDate(item.received_at)}</Text>
          <Text style={[styles.webhookDetail, { color: hasTxn ? Colors.growthGreen : '#FF9500' }]}>
            {hasTxn ? `txn …${item.transaction_id!.slice(-6)}` : 'no txn id'}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} translucent={false} />
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

      {/* Content */}
      {activeTab === 'overview' && renderOverview()}

      {(activeTab === 'trials' || activeTab === 'paid' || activeTab === 'issues') && (
        <>
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
                <Text style={styles.emptyText}>
                  {selectedMetric ? `No ${getMetricLabel(selectedMetric).toLowerCase()} records` : 'No records'}
                </Text>
              </View>
            )
          }
          ListHeaderComponent={
            <View>
              {renderTabChoices()}
              {getFilteredRows(rows).length > 0 ? (
                <Text style={styles.rowCount}>{getFilteredRows(rows).length} records</Text>
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
                <Text style={styles.emptyText}>No webhook events</Text>
              </View>
            )
          }
          ListHeaderComponent={
            <View>
              {renderTabChoices()}
              {webhooks.length > 0 ? (
                <Text style={styles.rowCount}>{webhooks.length} events</Text>
              ) : null}
            </View>
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
    right: 20,
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderRadius: 999,
    zIndex: 100,
  },

  // Walkthrough-style layout
  stepScroll: { flex: 1 },
  stepContent: { paddingHorizontal: 24, paddingBottom: 40 },
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

  choiceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 8,
  },
  choiceCount: {
    fontSize: 26,
    fontWeight: '800',
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
    borderRadius: 18,
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
    fontWeight: '600',
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
  metricValue: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.hopeWhite,
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 12,
    color: Colors.hopeWhite,
    marginBottom: 4,
    textAlign: 'center',
    fontWeight: '600',
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
    fontWeight: '800',
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
    fontWeight: '600',
    marginBottom: 12,
  },
  rangeSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  rangeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 18,
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
    fontWeight: '700',
  },
  rangeButtonTextSelected: {
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
  miniRowTitle: { color: Colors.hopeWhite, fontSize: 13, fontWeight: '700' },
  miniRowSub: { color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 },
  miniRowRight: { alignItems: 'flex-end' },
  miniRowDate: { color: Colors.growthGreen, fontSize: 12, fontWeight: '800' },
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
    borderRadius: 16,
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
    fontWeight: '800',
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
    fontWeight: '800',
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
  filteredHeaderText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '500',
  },
  filteredClearButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  filteredClearButtonText: {
    fontSize: 12,
    color: Colors.hopeWhite,
    fontWeight: '700',
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

  overviewActionWrap: {
    marginTop: 24,
    alignItems: 'flex-end',
  },
  overviewActionButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
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
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12, marginBottom: 10, overflow: 'hidden',
    flexDirection: 'row',
  },
  rowAccentBar: { width: 4, borderRadius: 2 },
  rowInner: { flex: 1, paddingHorizontal: 12, paddingVertical: 12 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  rowMid: { flexDirection: 'row', alignItems: 'flex-start' },
  planPill: {
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  planPillAnnual: { backgroundColor: 'rgba(255,200,60,0.18)' },
  planPillText: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.7)', letterSpacing: 0.4 },
  planPillTextAnnual: { color: '#FFC83C' },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: '700', color: Colors.hopeWhite },
  rowStatusLine: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 3, fontWeight: '500' },
  rowEmail: { fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 },
  daysText: { fontSize: 12, fontWeight: '700' },
  cycleText: { fontSize: 10, color: 'rgba(255,255,255,0.4)' },

  rowDetail: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
    marginTop: 10, paddingTop: 12, gap: 8,
  },
  detailSection: {
    fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.3)',
    letterSpacing: 1.1, marginBottom: 4,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  detailLabel: { fontSize: 12, color: 'rgba(255,255,255,0.4)', width: 140 },
  detailValue: { fontSize: 12, color: 'rgba(255,255,255,0.8)', flex: 1, textAlign: 'right' },
  detailHighlight: { color: '#FF3B30', fontWeight: '700' },

  webhookRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  webhookLeft: { flex: 1 },
  webhookType: { fontSize: 14, fontWeight: '600', color: Colors.hopeWhite },
  webhookSub: { fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  webhookProduct: { fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 },
  webhookRight: { alignItems: 'flex-end' },
  webhookDate: { fontSize: 12, color: 'rgba(255,255,255,0.45)' },
  webhookDetail: { fontSize: 11, fontWeight: '600', marginTop: 4 },

  emptyText: { color: 'rgba(255,255,255,0.35)', fontSize: 14 },
});
