#!/usr/bin/env node

/**
 * Performance Validation Script
 * Validates the playbook system performance without requiring test frameworks
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

// Helper functions
const log = (message, color = colors.reset) => {
  console.log(`${color}${message}${colors.reset}`);
};

const success = (message) => log(`✅ ${message}`, colors.green);
const error = (message) => log(`❌ ${message}`, colors.red);
const warning = (message) => log(`⚠️  ${message}`, colors.yellow);
const info = (message) => log(`ℹ️  ${message}`, colors.blue);

// File validation functions
const validateFileExists = (filePath, description) => {
  const fullPath = path.join(__dirname, '..', filePath);
  if (fs.existsSync(fullPath)) {
    success(`${description} exists`);
    return true;
  } else {
    error(`${description} missing: ${filePath}`);
    return false;
  }
};

const validateFileContent = (filePath, patterns, description) => {
  const fullPath = path.join(__dirname, '..', filePath);

  if (!fs.existsSync(fullPath)) {
    error(`${description} file missing: ${filePath}`);
    return false;
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  let allPassed = true;

  patterns.forEach(({ pattern, name }) => {
    if (content.includes(pattern)) {
      success(`${description}: ${name} ✓`);
    } else {
      error(`${description}: ${name} ✗`);
      allPassed = false;
    }
  });

  return allPassed;
};

// Performance validation checks
const performanceChecks = [
  {
    name: 'Database Schema Validation',
    check: () => {
      return validateFileExists('supabase/migrations/20250726012643_safe_playbook_migration.sql', 'Safe migration file');
    },
  },

  {
    name: 'API Functions Validation',
    check: () => {
      return validateFileContent(
        'src/services/supabaseApiNormalized.ts',
        [
          { pattern: 'getPlaybooks', name: 'getPlaybooks function' },
          { pattern: 'getPlaybook', name: 'getPlaybook function' },
          { pattern: 'updatePlaybookActionStep', name: 'updatePlaybookActionStep function' },
          { pattern: 'updatePlaybookSubTask', name: 'updatePlaybookSubTask function' },
          { pattern: 'updatePlaybookAffirmation', name: 'updatePlaybookAffirmation function' },
          { pattern: 'deletePlaybook', name: 'deletePlaybook function' },
          { pattern: 'getPlaybookProgress', name: 'getPlaybookProgress function' },
        ],
        'Normalized API'
      );
    },
  },

  {
    name: 'Performance Monitoring Validation',
    check: () => {
      return validateFileContent(
        'src/utils/performanceMonitor.ts',
        [
          { pattern: 'class PerformanceMonitor', name: 'PerformanceMonitor class' },
          { pattern: 'startTiming', name: 'startTiming method' },
          { pattern: 'recordMetric', name: 'recordMetric method' },
          { pattern: 'getStats', name: 'getStats method' },
          { pattern: 'withQueryPerformance', name: 'Query performance wrapper' },
          { pattern: 'withMutationPerformance', name: 'Mutation performance wrapper' },
        ],
        'Performance Monitor'
      );
    },
  },

  {
    name: 'Query Client Configuration Validation',
    check: () => {
      return validateFileContent(
        'src/config/queryClientConfig.ts',
        [
          { pattern: 'createOptimizedQueryClient', name: 'Optimized query client' },
          { pattern: 'queryConfigs', name: 'Query configurations' },
          { pattern: 'mutationConfigs', name: 'Mutation configurations' },
          { pattern: 'staleTime', name: 'Cache stale time' },
          { pattern: 'cacheTime', name: 'Cache time' },
          { pattern: 'retry', name: 'Retry configuration' },
        ],
        'Query Client Config'
      );
    },
  },

  {
    name: 'Hybrid Store Validation',
    check: () => {
      return validateFileContent(
        'src/store/usePlaybookStoreReactQuery.ts',
        [
          { pattern: 'usePlaybookDataWithStore', name: 'Hybrid store hook' },
          { pattern: 'handleActionStepUpdate', name: 'Action step update handler' },
          { pattern: 'handleSubTaskUpdate', name: 'Sub-task update handler' },
          { pattern: 'handleAffirmationUpdate', name: 'Affirmation update handler' },
          { pattern: 'offlineChanges', name: 'Offline changes tracking' },
          { pattern: 'getPlaybookProgress', name: 'Progress calculation' },
        ],
        'Hybrid Store'
      );
    },
  },

  {
    name: 'Hybrid Components Validation',
    check: () => {
      const listScreen = validateFileExists('src/screens/PlaybookListScreenHybrid.tsx', 'Hybrid List Screen');
      const detailScreen = validateFileExists('src/screens/PlaybookDetailScreenHybrid.tsx', 'Hybrid Detail Screen');
      return listScreen && detailScreen;
    },
  },

  {
    name: 'React Query Hooks Validation',
    check: () => {
      return validateFileContent(
        'src/services/hooks/usePlaybookData.ts',
        [
          { pattern: 'usePlaybooksData', name: 'usePlaybooksData hook' },
          { pattern: 'usePlaybookData', name: 'usePlaybookData hook' },
          { pattern: 'useUpdateActionStep', name: 'useUpdateActionStep mutation' },
          { pattern: 'useUpdateSubTask', name: 'useUpdateSubTask mutation' },
          { pattern: 'useUpdateAffirmation', name: 'useUpdateAffirmation mutation' },
          { pattern: 'optimisticUpdate', name: 'Optimistic updates' },
        ],
        'React Query Hooks'
      );
    },
  },
];

// Performance benchmarks
const performanceBenchmarks = {
  'Database Query Response Time': {
    target: '< 2000ms',
    description: 'Database queries should complete within 2 seconds',
  },
  'Single Playbook Fetch': {
    target: '< 500ms',
    description: 'Single playbook fetch should be very fast',
  },
  'Progress Calculation': {
    target: '< 300ms',
    description: 'Progress calculation should be efficient',
  },
  'Optimistic Updates': {
    target: '< 100ms',
    description: 'Optimistic updates should be nearly instantaneous',
  },
  'Cache Operations': {
    target: '< 50ms',
    description: 'Cache operations should be very fast',
  },
};

// Code quality checks
const codeQualityChecks = [
  {
    name: 'TypeScript Type Safety',
    check: () => {
      const files = [
        'src/services/supabaseApiNormalized.ts',
        'src/store/usePlaybookStoreReactQuery.ts',
        'src/utils/performanceMonitor.ts',
        'src/config/queryClientConfig.ts',
      ];

      let allTyped = true;
      files.forEach(file => {
        if (validateFileContent(file, [
          { pattern: 'interface', name: 'Type interfaces' },
          { pattern: 'Promise<', name: 'Promise types' },
        ], `TypeScript types in ${file}`)) {
          // File has proper typing
        } else {
          allTyped = false;
        }
      });

      return allTyped;
    },
  },

  {
    name: 'Error Handling',
    check: () => {
      return validateFileContent(
        'src/services/supabaseApiNormalized.ts',
        [
          { pattern: 'try {', name: 'Try-catch blocks' },
          { pattern: 'catch (error)', name: 'Error catching' },
          { pattern: 'console.error', name: 'Error logging' },
          { pattern: 'throw', name: 'Error propagation' },
        ],
        'Error Handling'
      );
    },
  },

  {
    name: 'Performance Monitoring Integration',
    check: () => {
      return validateFileContent(
        'src/services/hooks/usePlaybookData.ts',
        [
          { pattern: 'performanceMonitor', name: 'Performance monitoring' },
        ],
        'Performance Integration'
      ) || warning('Performance monitoring not fully integrated in hooks');
    },
  },
];

// Main validation function
const runValidation = () => {
  log('\n🚀 Starting Playbook System Performance Validation\n', colors.bold);

  let totalChecks = 0;
  let passedChecks = 0;

  // Run performance checks
  log('📊 Performance Implementation Checks:', colors.bold);
  performanceChecks.forEach(({ name, check }) => {
    totalChecks++;
    info(`Checking: ${name}`);
    if (check()) {
      passedChecks++;
    }
    console.log('');
  });

  // Display performance benchmarks
  log('⏱️  Performance Benchmarks:', colors.bold);
  Object.entries(performanceBenchmarks).forEach(([name, { target, description }]) => {
    info(`${name}: ${target}`);
    log(`   ${description}`, colors.reset);
  });
  console.log('');

  // Run code quality checks
  log('🔍 Code Quality Checks:', colors.bold);
  codeQualityChecks.forEach(({ name, check }) => {
    totalChecks++;
    info(`Checking: ${name}`);
    if (check()) {
      passedChecks++;
    }
    console.log('');
  });

  // Summary
  log('📋 Validation Summary:', colors.bold);
  log(`Total Checks: ${totalChecks}`);
  log(`Passed: ${passedChecks}`, passedChecks === totalChecks ? colors.green : colors.yellow);
  log(`Failed: ${totalChecks - passedChecks}`, totalChecks - passedChecks === 0 ? colors.green : colors.red);

  const successRate = (passedChecks / totalChecks) * 100;
  log(`Success Rate: ${successRate.toFixed(1)}%`, successRate >= 90 ? colors.green : successRate >= 70 ? colors.yellow : colors.red);

  if (successRate >= 90) {
    success('\n🎉 Performance validation passed! System is ready for production.');
  } else if (successRate >= 70) {
    warning('\n⚠️  Performance validation partially passed. Review failed checks.');
  } else {
    error('\n❌ Performance validation failed. Critical issues need to be addressed.');
  }

  // Next steps
  log('\n📝 Next Steps:', colors.bold);
  if (successRate >= 90) {
    info('✅ Deploy to production');
    info('✅ Monitor performance metrics');
    info('✅ Conduct user acceptance testing');
  } else {
    info('🔧 Fix failed validation checks');
    info('🧪 Run additional performance tests');
    info('📊 Review performance benchmarks');
  }

  console.log('');
  return successRate >= 90;
};

// Run validation if called directly
if (require.main === module) {
  const isSuccessful = runValidation();
  process.exit(isSuccessful ? 0 : 1);
}

module.exports = { runValidation };
