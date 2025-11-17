import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Colors } from '../../theme/colors';
import { getFontFamily } from '../../theme/fonts';
import { useTheme } from '../../hooks/useTheme';
import { FamilyMemberUsage } from '../../types/subscription';

interface FamilyUsageChartProps {
  memberUsage: FamilyMemberUsage[];
  type: 'playbooks' | 'devotionals';
}

/**
 * FamilyUsageChart
 * 
 * Visualizes family member usage with horizontal bar chart
 * Shows percentage distribution and actual counts
 */
export const FamilyUsageChart: React.FC<FamilyUsageChartProps> = ({ memberUsage, type }) => {
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';

  const fonts = useMemo(() => ({
    regular: getFontFamily(fontKey, 'regular'),
    medium: getFontFamily(fontKey, 'medium'),
    semiBold: getFontFamily(fontKey, 'semiBold'),
    bold: getFontFamily(fontKey, 'bold'),
  }), [fontKey]);

  const styles = useMemo(() => createStyles(fonts), [fonts]);

  const total = useMemo(() => {
    return memberUsage.reduce((sum, member) => {
      return sum + (type === 'playbooks' ? member.playbooks : member.devotionals);
    }, 0);
  }, [memberUsage, type]);

  const sortedMembers = useMemo(() => {
    return [...memberUsage].sort((a, b) => {
      const aValue = type === 'playbooks' ? a.playbooks : a.devotionals;
      const bValue = type === 'playbooks' ? b.playbooks : b.devotionals;
      return bValue - aValue;
    });
  }, [memberUsage, type]);

  const getColor = (index: number) => {
    const colors = [
      Colors.anchorBlue,
      Colors.faithGold,
      Colors.growthGreen,
      Colors.devotionalPurple,
      Colors.spiritualPink,
    ];
    return colors[index % colors.length];
  };

  return (
    <View style={styles.container}>
      {sortedMembers.map((member, index) => {
        const value = type === 'playbooks' ? member.playbooks : member.devotionals;
        const percentage = total > 0 ? (value / total) * 100 : 0;
        const color = getColor(index);

        return (
          <View key={member.userId} style={styles.memberRow}>
            <View style={styles.memberInfo}>
              <View style={[styles.avatar, { backgroundColor: color + '30' }]}>
                <Text style={[styles.avatarText, { color }]}>
                  {member.fullName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.memberDetails}>
                <Text style={styles.memberName}>{member.fullName}</Text>
                <Text style={styles.memberValue}>
                  {value} {type === 'playbooks' ? 'playbooks' : 'devotionals'}
                </Text>
              </View>
            </View>
            <View style={styles.barContainer}>
              <View style={styles.barBackground}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${percentage}%`,
                      backgroundColor: color,
                    },
                  ]}
                />
              </View>
              <Text style={styles.percentage}>{percentage.toFixed(0)}%</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
};

const createStyles = (fonts: any) =>
  StyleSheet.create({
    container: {
      gap: 16,
    },
    memberRow: {
      gap: 12,
    },
    memberInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 8,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontSize: 16,
      fontFamily: fonts.semiBold,
    },
    memberDetails: {
      flex: 1,
    },
    memberName: {
      fontSize: 15,
      fontFamily: fonts.semiBold,
      color: Colors.text,
    },
    memberValue: {
      fontSize: 13,
      fontFamily: fonts.regular,
      color: Colors.textGray,
      marginTop: 2,
    },
    barContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    barBackground: {
      flex: 1,
      height: 24,
      backgroundColor: Colors.lightGray,
      borderRadius: 12,
      overflow: 'hidden',
    },
    barFill: {
      height: '100%',
      borderRadius: 12,
      minWidth: 4,
    },
    percentage: {
      fontSize: 14,
      fontFamily: fonts.semiBold,
      color: Colors.text,
      width: 45,
      textAlign: 'right',
    },
  });
