import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { getFontFamily } from '../../theme/fonts';
import { useTheme } from '../../hooks/useTheme';
import { FamilyActivity, FamilyActivityType } from '../../types/subscription';
import { formatDistanceToNow } from 'date-fns';

interface FamilyActivityLogProps {
  activities: FamilyActivity[];
  maxItems?: number;
}

/**
 * FamilyActivityLog
 *
 * Displays recent family subscription activities
 * Shows icons, descriptions, and timestamps
 */
export const FamilyActivityLog: React.FC<FamilyActivityLogProps> = ({
  activities,
  maxItems = 10,
}) => {
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';

  const fonts = useMemo(() => ({
    regular: getFontFamily(fontKey, 'regular'),
    medium: getFontFamily(fontKey, 'medium'),
    semiBold: getFontFamily(fontKey, 'semiBold'),
    bold: getFontFamily(fontKey, 'bold'),
  }), [fontKey]);

  const styles = useMemo(() => createStyles(fonts), [fonts]);

  const getActivityIcon = (type: FamilyActivityType): string => {
    const iconMap: Record<FamilyActivityType, string> = {
      group_created: 'people-circle',
      member_added: 'person-add',
      member_removed: 'person-remove',
      member_suspended: 'ban',
      invitation_sent: 'mail',
      invitation_accepted: 'checkmark-circle',
      invitation_declined: 'close-circle',
      invitation_cancelled: 'close',
      subscription_upgraded: 'arrow-up-circle',
      subscription_downgraded: 'arrow-down-circle',
      subscription_renewed: 'refresh-circle',
      subscription_cancelled: 'stop-circle',
      payment_successful: 'card',
      payment_failed: 'alert-circle',
      admin_changed: 'shield',
      group_name_changed: 'create',
      capacity_increased: 'trending-up',
    };
    return iconMap[type] || 'information-circle';
  };

  const getActivityColor = (type: FamilyActivityType): string => {
    if (type.includes('success') || type.includes('accepted') || type.includes('added')) {
      return Colors.growthGreen;
    }
    if (type.includes('failed') || type.includes('declined') || type.includes('removed') || type.includes('cancelled')) {
      return Colors.error;
    }
    if (type.includes('upgraded') || type.includes('renewed')) {
      return Colors.anchorBlue;
    }
    return Colors.textGray;
  };

  const formatActivityDescription = (activity: FamilyActivity): string => {
    if (activity.activity_description) {
      return activity.activity_description;
    }

    // Generate description based on type
    const userName = activity.user_name || 'A member';
    const affectedUserName = activity.affected_user_name || 'a member';

    const descriptions: Partial<Record<FamilyActivityType, string>> = {
      group_created: `${userName} created the family group`,
      member_added: `${userName} added ${affectedUserName}`,
      member_removed: `${userName} removed ${affectedUserName}`,
      member_suspended: `${userName} suspended ${affectedUserName}`,
      invitation_sent: `${userName} sent an invitation to ${affectedUserName}`,
      invitation_accepted: `${affectedUserName} accepted the invitation`,
      invitation_declined: `${affectedUserName} declined the invitation`,
      invitation_cancelled: `${userName} cancelled an invitation`,
      subscription_upgraded: `${userName} upgraded the subscription`,
      subscription_downgraded: `${userName} downgraded the subscription`,
      subscription_renewed: 'Subscription renewed successfully',
      subscription_cancelled: `${userName} cancelled the subscription`,
      payment_successful: 'Payment processed successfully',
      payment_failed: 'Payment failed',
      admin_changed: `${affectedUserName} is now the admin`,
      group_name_changed: `${userName} changed the group name`,
      capacity_increased: `${userName} increased member capacity`,
    };

    return descriptions[activity.activity_type] || 'Activity occurred';
  };

  const displayActivities = useMemo(() => {
    return activities.slice(0, maxItems);
  }, [activities, maxItems]);

  if (displayActivities.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="time-outline" size={48} color={Colors.textGray} />
        <Text style={styles.emptyText}>No recent activity</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {displayActivities.map((activity, index) => {
        const icon = getActivityIcon(activity.activity_type);
        const color = getActivityColor(activity.activity_type);
        const description = formatActivityDescription(activity);
        const timeAgo = formatDistanceToNow(new Date(activity.created_at), { addSuffix: true });

        return (
          <View key={activity.id} style={styles.activityItem}>
            <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
              <Ionicons name={icon} size={20} color={color} />
            </View>
            <View style={styles.activityContent}>
              <Text style={styles.activityDescription}>{description}</Text>
              <Text style={styles.activityTime}>{timeAgo}</Text>
            </View>
            {index < displayActivities.length - 1 && <View style={styles.divider} />}
          </View>
        );
      })}
    </ScrollView>
  );
};

const createStyles = (fonts: any) =>
  StyleSheet.create({
    container: {
      maxHeight: 400,
    },
    activityItem: {
      flexDirection: 'row',
      paddingVertical: 12,
      position: 'relative',
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    activityContent: {
      flex: 1,
      justifyContent: 'center',
    },
    activityDescription: {
      fontSize: 14,
      fontFamily: fonts.medium,
      color: Colors.text,
      lineHeight: 20,
      marginBottom: 4,
    },
    activityTime: {
      fontSize: 12,
      fontFamily: fonts.regular,
      color: Colors.textGray,
    },
    divider: {
      position: 'absolute',
      bottom: 0,
      left: 52,
      right: 0,
      height: 1,
      backgroundColor: Colors.lightGray,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
    },
    emptyText: {
      fontSize: 16,
      fontFamily: fonts.regular,
      color: Colors.textGray,
      marginTop: 12,
    },
  });
