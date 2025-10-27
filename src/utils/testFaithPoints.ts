/**
 * Test Faith Points System
 * Use this to verify faith points are working correctly
 */

import { faithPointsService } from '../services/faithPointsService';
import { generateProgressReport, printProgressReport } from './progressReport';

export const testFaithPointsSystem = async (userId: string) => {

  try {
    // Test 1: Get initial user profile
    const initialProfile = await faithPointsService.getUserProfile(userId);

    // Test 1 completed - profile retrieved

    // Test 2: Award points for devotional completion

    const result = await faithPointsService.awardPoints(userId, 'devotional_generated', {
      testMode: true,
      timestamp: new Date().toISOString(),
    });

    // Test 3: Get recent transactions

    const transactions = await faithPointsService.getRecentTransactions(userId, 5);

    // Test 4: Get updated profile

    const updatedProfile = await faithPointsService.getUserProfile(userId);

    // Test 5: Generate progress report

    const progressReport = await generateProgressReport(userId);
    printProgressReport(progressReport);

    return {
      success: true,
      initialPoints: initialProfile.totalPoints,
      finalPoints: updatedProfile.totalPoints,
      pointsAwarded: result.pointsAwarded,
      newLevel: result.newLevel,
      transactionCount: transactions.length,
      progressReport,
    };

  } catch (error) {
    console.error('❌ Faith Points Test Failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

export const logFaithPointsStatus = async (userId: string) => {
  try {
    await faithPointsService.getUserProfile(userId);
    const transactions = await faithPointsService.getRecentTransactions(userId, 10);

    if (transactions.length > 0) {

      transactions.forEach(() => {

      });
    }

  } catch (error) {
    console.error('❌ Failed to get faith points status:', error);
  }
};
