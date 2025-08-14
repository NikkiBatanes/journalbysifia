import React, { useMemo } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Pencil as LuPencil } from 'lucide-react-native';
import { Colors } from '../../theme/colors';

export interface ProfileStatsLite {
  faithPoints: number;
  level: number;
}

interface Props {
  user: any | null;
  stats: ProfileStatsLite | null;
  onEditPress?: () => void;
  onEditAvatar?: () => void;
}

const ProfileHeader: React.FC<Props> = ({ user, stats, onEditPress, onEditAvatar }) => {
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

  return (
    <View style={styles.headerGradient}>
      <View style={styles.profileHeader}>
        <TouchableOpacity
          style={styles.avatarContainer}
          onPress={() => {
            console.log('[ProfileHeader] Avatar pressed');
            try {
              const { Alert } = require('react-native');
              Alert.alert('Avatar', 'Avatar area pressed');
            } catch (_) {}
            if (onEditAvatar) {
              onEditAvatar();
            } else {
              try {
                // Lazy import to avoid new dependency here; Alert exists in React Native

                const { Alert } = require('react-native');
                Alert.alert('Avatar', 'Press received, but no handler provided.');
              } catch (_) {}
            }
          }}
          accessibilityRole="button"
          accessibilityLabel="Edit profile photo"
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
              console.log('[ProfileHeader] Camera icon pressed');
              try {
                const { Alert } = require('react-native');
                Alert.alert('Avatar', 'Camera icon pressed');
              } catch (_) {}
              if (onEditAvatar) {onEditAvatar();}
            }}
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="camera" size={16} color="#fff" />
          </TouchableOpacity>
        </TouchableOpacity>

        <View style={styles.profileInfo}>
          <Text style={styles.userName}>{displayName}</Text>
          {!!user?.email && <Text style={styles.userEmail}>{user.email}</Text>}

          <View style={styles.levelContainer}>
            <Text style={styles.levelText}>Level {level}</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
            <Text style={styles.faithPointsText}>{points} Faith Points</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.editButton} onPress={onEditPress}>
          <LuPencil size={20} color={Colors.alertCoral} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerGradient: {
    backgroundColor: Colors.hopeWhite,
    paddingTop: 0,
    paddingBottom: 16,
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
    backgroundColor: Colors.primary,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fff',
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.darkerGray,
  },
  userEmail: {
    fontSize: 12,
    color: Colors.mediumGray,
    marginTop: 2,
  },
  levelContainer: {
    marginTop: 8,
  },
  levelText: {
    fontSize: 12,
    color: Colors.darkerGray,
    opacity: 0.9,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 6,
    marginTop: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    backgroundColor: Colors.alertCoral,
    borderRadius: 6,
  },
  faithPointsText: {
    fontSize: 12,
    color: Colors.mediumGray,
    marginTop: 4,
  },
  editButton: {
    marginLeft: 8,
    padding: 8,
  },
});

export default ProfileHeader;
