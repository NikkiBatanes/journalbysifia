import React, { useMemo, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Pencil as LuPencil } from 'lucide-react-native';
import { Colors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import UsageTooltipModal, { TooltipType } from './UsageTooltipModal';
import { triggerLightHaptic } from '../../utils/haptics';
import BadgesModal from '../BadgesModal';

export interface ProfileStatsLite {
  faithPoints: number;
  level: number;
  // Optional extras for top-row chips
  badgesCount?: number;
}

interface UsageSummary {
  playbooks: { used: number; limit: number };
  devotionals: { used: number; limit: number };
}

// Map level number to title (kept in sync with faithPointsService LEVELS)
const LEVEL_TITLES: Record<number, string> = {
  1: 'Seeker',
  2: 'Believer',
  3: 'Disciple',
  4: 'Servant',
  5: 'Leader',
  6: 'Teacher',
  7: 'Mentor',
  8: 'Elder',
  9: 'Steward',
  10: 'Ambassador',
};

interface Props {
  user: any | null;
  stats: ProfileStatsLite | null;
  onEditPress?: () => void;
  onEditAvatar?: () => void;
  plan?: string; // e.g., 'Starter', 'Growth', 'Premium', 'Basic'
  usage?: UsageSummary | null;
  subscription?: any | null; // Add subscription data for tooltips
  isLoading?: boolean; // Add loading state
}

const ProfileHeader: React.FC<Props> = ({ user, stats, onEditPress, onEditAvatar: _onEditAvatar, plan, usage, subscription, isLoading = false }) => {
  const theme = useTheme();
  const font = useMemo(() => ({ fontFamily: theme.fontFamily }), [theme.fontFamily]);

  // Tooltip state
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipType, setTooltipType] = useState<TooltipType | null>(null);
  // Badges modal state
  const [badgesModalVisible, setBadgesModalVisible] = useState(false);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);

  const showTooltip = (type: TooltipType) => {
    try { triggerLightHaptic(); } catch {}
    setTooltipType(type);
    setTooltipVisible(true);
  };

  const hideTooltip = () => {
    setTooltipVisible(false);
    // Clear type after animation completes to prevent flash
    setTimeout(() => setTooltipType(null), 300);
  };

  const showBadgesModal = () => {
    try { triggerLightHaptic(); } catch {}
    setBadgesModalVisible(true);
  };
  const displayName = useMemo(() => {
    const meta = (user as any)?.user_metadata || {};
    return (
      (user as any)?.displayName ||
      meta.full_name ||
      [meta.first_name, meta.last_name].filter(Boolean).join(' ').trim() ||
      user?.email ||
      'User'
    );
  }, [user]);

  const level = stats?.level ?? 1;
  const points = stats?.faithPoints ?? 0;
  const badgesCount = (stats as any)?.badgesCount ?? (user as any)?.badgesCount ?? 0;

  const progress = useMemo(() => {
    // Mirror logic from screen: linear progress between levels
    const levels = [
      { level: 1, pointsRequired: 0 },
      { level: 2, pointsRequired: 100 },
      { level: 3, pointsRequired: 300 },
      { level: 4, pointsRequired: 600 },
      { level: 5, pointsRequired: 1000 },
      { level: 6, pointsRequired: 1500 },
      { level: 7, pointsRequired: 2500 },
      { level: 8, pointsRequired: 4000 },
      { level: 9, pointsRequired: 6000 },
      { level: 10, pointsRequired: 10000 },
    ];
    const current = levels.find(l => l.level === level);
    const next = levels.find(l => l.level === level + 1);
    if (!current || !next) {return level >= 10 ? 1 : 0;}
    const span = next.pointsRequired - current.pointsRequired;
    const inLevel = points - current.pointsRequired;
    return Math.max(0, Math.min(1, inLevel / span));
  }, [level, points]);

  // Use custom avatar URL from user profile if available, but only allow local file URIs
  const avatarUrl = (user as any)?.user_metadata?.avatar_url;

  // Only allow local file URIs (starting with file://) - block any external URLs
  const safeAvatarUrl = avatarUrl && avatarUrl.startsWith('file://') ? avatarUrl : null;

  const initialLetter = (displayName || 'U').trim().charAt(0).toUpperCase();

  // Reset image load state when user or avatar URL changes
  React.useEffect(() => {
    setImageLoadFailed(false);
  }, [user, safeAvatarUrl]);

  // Skeleton loading component
  const renderSkeleton = () => (
    <View style={styles.planAndUsageRow}>
      <View style={[styles.planPill, styles.skeletonPill]}>
        <View style={styles.skeletonText} />
        <View style={styles.pillsRow}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={[styles.usagePill, styles.skeletonUsagePill]}>
              <View style={styles.skeletonUsageItem} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.headerGradient}>
      {isLoading ? renderSkeleton() : (!!plan || !!usage) && (
        <View style={styles.planAndUsageRow}>
          {!!plan && (
            <View style={styles.planPill}>
              <Text style={[styles.planText, font]}>{String(plan)}</Text>
              {!!usage && (
                <View style={styles.pillsRow}>
                  <TouchableOpacity
                    style={styles.usagePill}
                    onPress={() => { try { triggerLightHaptic(); } catch {} showTooltip('playbooks'); }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.usageItemRow}>
                      <MaterialCommunityIcons name="clipboard-text-play" size={14} color={Colors.hopeWhite} />
                      <Text style={[styles.usageText, font]}>
                        {usage.playbooks.used}
                        {usage.playbooks.limit >= 0 ? `/${usage.playbooks.limit}` : '/∞'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.usagePill}
                    onPress={() => { try { triggerLightHaptic(); } catch {} showTooltip('devotionals'); }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.usageItemRow}>
                      <MaterialCommunityIcons name="book" size={14} color={Colors.hopeWhite} />
                      <Text style={[styles.usageText, font]}>
                        {usage.devotionals.used}
                        {usage.devotionals.limit >= 0 ? `/${usage.devotionals.limit}` : '/∞'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  {/* Usage stats: Playbooks, Devotionals, Faith Points, Badges */}
                  <TouchableOpacity
                    style={styles.usagePill}
                    onPress={() => { try { triggerLightHaptic(); } catch {} showTooltip('faithPoints'); }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.usageItemRow}>
                      <MaterialCommunityIcons name="star-four-points" size={14} color={Colors.hopeWhite} />
                      <Text style={[styles.usageText, font]}>{points} FP</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.usagePill}
                    onPress={showBadgesModal}
                    activeOpacity={0.7}
                  >
                    <View style={styles.usageItemRow}>
                      <MaterialCommunityIcons name="trophy" size={14} color={Colors.hopeWhite} />
                      <Text style={[styles.usageText, font]}>{badgesCount}</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
          {!plan && !!usage && (
            <>
              <View style={styles.usagePill}>
                <View style={styles.usageItemRow}>
                  <MaterialCommunityIcons name="clipboard-text-play" size={12} color={Colors.hopeWhite} />
                  <Text style={[styles.usageText, font]}>
                    {usage.playbooks.used}
                    {usage.playbooks.limit >= 0 ? `/${usage.playbooks.limit}` : '/∞'}
                  </Text>
                </View>
              </View>
              <View style={styles.usagePill}>
                <View style={styles.usageItemRow}>
                  <MaterialCommunityIcons name="book" size={12} color={Colors.hopeWhite} />
                  <Text style={[styles.usageText, font]}>
                    {usage.devotionals.used}
                    {usage.devotionals.limit >= 0 ? `/${usage.devotionals.limit}` : '/∞'}
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>
      )}
      <View style={styles.profileHeader}>
        <TouchableOpacity
          style={styles.avatarContainer}
          onPress={() => {

            if (onEditPress) { onEditPress(); }
          }}
          accessibilityRole="button"
          accessibilityLabel="Edit profile"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {safeAvatarUrl && !imageLoadFailed ? (
            <Image
              source={{ uri: safeAvatarUrl }}
              style={styles.avatar}
              onError={(error) => {
                setImageLoadFailed(true);
              }}
              onLoad={() => {
                setImageLoadFailed(false);
              }}
            />
          ) : (
            <View style={[styles.avatar, styles.initialAvatar]}>
              <Text style={[styles.initialLetter, font]}>{initialLetter}</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.editAvatarButton}
            onPress={() => {

              if (onEditPress) { onEditPress(); }
            }}
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <LuPencil size={14} color={Colors.alertCoral} />
          </TouchableOpacity>
        </TouchableOpacity>

        <View style={styles.profileInfo}>
          <View style={styles.nameRow}>
            <Text style={[styles.userName, font]} numberOfLines={1} ellipsizeMode="tail">{displayName}</Text>
          </View>
          {!!user?.email && (
            <Text style={[styles.userEmail, font]} numberOfLines={1} ellipsizeMode="tail">{user.email}</Text>
          )}

          {/* Hidden level and progress bar per user request */}
          {/* <View style={styles.levelContainer}>
            <Text style={[styles.levelText, font]}>Level {level}: {LEVEL_TITLES[level] || ''}</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
          </View> */}
        </View>

        {/* Right-side edit pencil removed per request */}
      </View>

      {/* Tooltip Modal */}
      <UsageTooltipModal
        visible={tooltipVisible}
        type={tooltipType}
        onClose={hideTooltip}
        subscription={subscription || null}
        usage={usage || null}
        stats={stats}
      />

      {/* Badges Modal */}
      <BadgesModal
        visible={badgesModalVisible}
        onClose={() => setBadgesModalVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  headerGradient: {
    backgroundColor: Colors.hopeWhite,
    paddingTop: 0,
    paddingBottom: 40,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'transparent',
    resizeMode: 'cover',
  },
  initialAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.alertCoral,
  },
  initialLetter: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.hopeWhite,
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: Colors.hopeWhite,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  profileInfo: {
    flex: 1,
    minWidth: 0, // allow Text to shrink and truncate within row
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8 as any,
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.anchorBlue,
    marginBottom: 4,
  },
  planPill: {
    marginLeft: 0,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 22,
    backgroundColor: Colors.faithGold,
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 8 as any,
    // subtle floating shadow
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  planText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginRight: 4,
    alignSelf: 'center',
    textAlign: 'center',
  },
  usagePill: {
    marginLeft: 0,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    // Transparent with visible border
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(242, 245, 247, 0.45)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  pillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    gap: 4 as any,
    flexShrink: 1,
  },
  faithPointsPill: {
    marginLeft: 0,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 18,
    backgroundColor: Colors.faithGold,
    borderWidth: 1,
    borderColor: Colors.faithGold,
    flexDirection: 'row',
    alignItems: 'center',
  },
  usageItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4 as any,
  },
  usageText: {
    fontSize: 12,
    color: Colors.hopeWhite,
    fontWeight: '700',
  },
  usageDivider: {
    width: 1,
    height: 12,
    backgroundColor: Colors.cardBorder,
    marginHorizontal: 6,
  },
  userEmail: {
    fontSize: 12,
    color: Colors.textGray,
    fontWeight: '600',
    marginTop: 2,
    marginBottom: 6,
  },
  planAndUsageRow: {
    position: 'absolute',
    top: 65,
    left: 0,
    right: 0,
    zIndex: 10,
    width: '100%',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8 as any,
  },
  levelContainer: {
    marginTop: 0,
  },
  levelText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.anchorBlue,
    opacity: 0.9,
  },
  progressBar: {
    height: 12,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 6,
    marginTop: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: 12,
    backgroundColor: Colors.alertCoral,
    borderRadius: 6,
  },
  faithPointsText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.anchorBlue,
    marginTop: 4,
  },
  // Skeleton styles
  skeletonPill: {
    // Darker container background than inner elements
    backgroundColor: Colors.trustGrey,
  },
  skeletonText: {
    height: 12,
    width: 90,
    // Lighter than container for contrast
    backgroundColor: Colors.borderLight,
    borderRadius: 6,
    alignSelf: 'center',
  },
  skeletonUsagePill: {
    // Much lighter to mimic progress bar background
    backgroundColor: Colors.borderLight,
  },
  skeletonUsageItem: {
    height: 14,
    width: 38,
    // Very light bar like 'no fill' progress
    backgroundColor: Colors.trustGrey,
    borderRadius: 5,
  },
});

export default ProfileHeader;
