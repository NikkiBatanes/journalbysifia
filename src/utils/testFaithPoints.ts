/**
 * Test Faith Points System
 * Use this to verify faith points are working correctly
 */

import { faithPointsService } from '../services/faithPointsService';
import { generateProgressReport, printProgressReport } from './progressReport';

export const testFaithPointsSystem = async (userId: string) => {
  console.log('🧪 Testing Faith Points System...');
  
  try {
    // Test 1: Get or create user profile
    console.log('📊 Step 1: Getting user profile...');
    const profile = await faithPointsService.getUserProfile(userId);
    console.log('✅ User Profile:', {
      totalPoints: profile.totalPoints,
      currentLevel: profile.currentLevel,
      currentStreak: profile.currentStreak
    });

    // Test 2: Award points for devotional completion
    console.log('🎯 Step 2: Awarding points for devotional...');
    const result = await faithPointsService.awardPoints(userId, 'devotional_generated', {
      testMode: true,
      timestamp: new Date().toISOString()
    });
    console.log('✅ Points Awarded:', result);

    // Test 3: Get recent transactions
    console.log('📋 Step 3: Getting recent transactions...');
    const transactions = await faithPointsService.getRecentTransactions(userId, 5);
    console.log('✅ Recent Transactions:', transactions.length, 'found');

    // Test 4: Get updated profile
    console.log('🔄 Step 4: Getting updated profile...');
    const updatedProfile = await faithPointsService.getUserProfile(userId);
    console.log('✅ Updated Profile:', {
      totalPoints: updatedProfile.totalPoints,
      currentLevel: updatedProfile.currentLevel,
      currentStreak: updatedProfile.currentStreak,
      pointsGained: updatedProfile.totalPoints - profile.totalPoints
    });

    // Test 5: Generate progress report
    console.log('📊 Step 5: Generating progress report...');
    const progressReport = await generateProgressReport(userId);
    printProgressReport(progressReport);

    console.log('🎉 Faith Points System Test Complete!');
    return {
      success: true,
      initialPoints: profile.totalPoints,
      finalPoints: updatedProfile.totalPoints,
      pointsAwarded: result.pointsAwarded,
      newLevel: result.newLevel,
      transactionCount: transactions.length,
      progressReport
    };

  } catch (error) {
    console.error('❌ Faith Points Test Failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

export const logFaithPointsStatus = async (userId: string) => {
  try {
    const profile = await faithPointsService.getUserProfile(userId);
    const transactions = await faithPointsService.getRecentTransactions(userId, 10);
    
    console.log('📊 FAITH POINTS STATUS REPORT');
    console.log('================================');
    console.log(`👤 User ID: ${userId}`);
    console.log(`🏆 Total Points: ${profile.totalPoints}`);
    console.log(`📊 Current Level: ${profile.currentLevel}`);
    console.log(`🔥 Current Streak: ${profile.currentStreak}`);
    console.log(`🎯 Weekly Progress: ${profile.weeklyProgress}/${profile.weeklyGoal}`);
    console.log(`📋 Recent Activities: ${transactions.length}`);
    console.log('================================');
    
    if (transactions.length > 0) {
      console.log('🕐 Recent Activities:');
      transactions.forEach((t: any, i) => {
        console.log(`  ${i + 1}. ${t.activity_type || t.reason} (+${t.points} pts)`);
      });
    }
    
  } catch (error) {
    console.error('❌ Failed to get faith points status:', error);
  }
};
