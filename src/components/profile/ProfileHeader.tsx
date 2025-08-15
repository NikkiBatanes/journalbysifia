import React, { useMemo } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Pencil as LuPencil } from 'lucide-react-native';
import { Colors } from '../../theme/colors';

export interface ProfileStatsLite {
  faithPoints: number;
  level: number;
  // Optional extras for top-row chips
  streakDays?: number;
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
  isLoading?: boolean; // Add loading state
}

const ProfileHeader: React.FC<Props> = ({ user, stats, onEditPress, onEditAvatar, plan, usage, isLoading = false }) => {
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
  const streakDays = (stats as any)?.streakDays ?? (user as any)?.streakDays ?? 0;
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

  const avatarUrl = (user as any)?.user_metadata?.avatar_url as string | undefined;
  const initialLetter = (displayName || 'U').trim().charAt(0).toUpperCase();

  // Skeleton loading component
  const renderSkeleton = () => (
    <View style={styles.planAndUsageRow}>
      <View style={[styles.planPill, styles.skeletonPill]}>
        <View style={styles.skeletonText} />
        <View style={styles.pillsRow}>
          {[1, 2, 3, 4, 5].map((i) => (
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
              <Text style={styles.planText}>{String(plan).toUpperCase()}</Text>
              {!!usage && (
                <View style={styles.pillsRow}>
                  <View style={styles.usagePill}>
                    <View style={styles.usageItemRow}>
                      <MaterialCommunityIcons name="clipboard-text-play" size={12} color={Colors.hopeWhite} />
                      <Text style={styles.usageText}>
                        {usage.playbooks.used}
                        {usage.playbooks.limit >= 0 ? `/${usage.playbooks.limit}` : '/∞'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.usagePill}>
                    <View style={styles.usageItemRow}>
                      <MaterialCommunityIcons name="book" size={12} color={Colors.hopeWhite} />
                      <Text style={styles.usageText}>
                        {usage.devotionals.used}
                        {usage.devotionals.limit >= 0 ? `/${usage.devotionals.limit}` : '/∞'}
                      </Text>
                    </View>
                  </View>
                  {/* Move FP, Streak, Badges inside Growth container */}
                  <View style={styles.usagePill}>
                    <View style={styles.usageItemRow}>
                      <MaterialCommunityIcons name="star-four-points" size={12} color={Colors.hopeWhite} />
                      <Text style={styles.usageText}>{points} FP</Text>
                    </View>
                  </View>
                  <View style={styles.usagePill}>
                    <View style={styles.usageItemRow}>
                      <MaterialCommunityIcons name="fire" size={12} color={Colors.hopeWhite} />
                      <Text style={styles.usageText}>{streakDays}</Text>
                    </View>
                  </View>
                  <View style={styles.usagePill}>
                    <View style={styles.usageItemRow}>
                      <MaterialCommunityIcons name="trophy" size={12} color={Colors.hopeWhite} />
                      <Text style={styles.usageText}>{badgesCount}</Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
          )}
          {!plan && !!usage && (
            <>
              <View style={styles.usagePill}>
                <View style={styles.usageItemRow}>
                  <MaterialCommunityIcons name="clipboard-text-play" size={12} color={Colors.hopeWhite} />
                  <Text style={styles.usageText}>
                    {usage.playbooks.used}
                    {usage.playbooks.limit >= 0 ? `/${usage.playbooks.limit}` : '/∞'}
                  </Text>
                </View>
              </View>
              <View style={styles.usagePill}>
                <View style={styles.usageItemRow}>
                  <MaterialCommunityIcons name="book" size={12} color={Colors.hopeWhite} />
                  <Text style={styles.usageText}>
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
            console.log('[ProfileHeader] Avatar pressed');
            if (onEditPress) { onEditPress(); }
          }}
          accessibilityRole="button"
          accessibilityLabel="Edit profile"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.initialAvatar]}>
              <Text style={styles.initialLetter}>{initialLetter}</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.editAvatarButton}
            onPress={() => {
              console.log('[ProfileHeader] Pencil overlay pressed');
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
            <Text style={styles.userName}>{displayName}</Text>
          </View>
          {!!user?.email && <Text style={styles.userEmail}>{user.email}</Text>}

          <View style={styles.levelContainer}>
            <Text style={styles.levelText}>Level {level}: {LEVEL_TITLES[level] || ''}</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
          </View>
        </View>

        {/* Right-side edit pencil removed per request */}
      </View>
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
    backgroundColor: '#ccc',
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 18,
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
    fontSize: 10,
    color: Colors.hopeWhite,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginRight: 4,
    alignSelf: 'center',
    textAlign: 'center',
  },
  usagePill: {
    marginLeft: 0,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 18,
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
    flexWrap: 'wrap',
    gap: 8 as any,
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
    fontSize: 10,
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
    color: Colors.mediumGray,
    fontWeight: '600',
    marginTop: 2,
    marginBottom: 6,
  },
  planAndUsageRow: {
    position: 'absolute',
    top: 105,
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
    backgroundColor: '#E5E7EB', // light gray
  },
  skeletonText: {
    height: 12,
    width: 80,
    backgroundColor: '#D1D5DB', // gray-300
    borderRadius: 6,
    alignSelf: 'center',
  },
  skeletonUsagePill: {
    backgroundColor: '#F1F5F9', // very light gray
  },
  skeletonUsageItem: {
    height: 10,
    width: 24,
    backgroundColor: '#D1D5DB', // gray-300
    borderRadius: 5,
  },
});

export default ProfileHeader;
