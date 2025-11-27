# Enterprise Account Deletion System

## Overview

This document outlines the enterprise-grade account deletion system implemented for siFia, which provides secure, compliant, and user-friendly account deletion with proper grace periods and audit trails.

## Architecture

### Components

1. **Frontend Service** (`src/services/accountDeletionService.ts`)
   - Handles client-side account deletion logic
   - Validates birth year for age verification
   - Communicates with secure edge functions
   - Provides status checking and cancellation capabilities

2. **Edge Functions**
   - `delete-account`: Initiates secure account deletion with grace period
   - `process-account-deletions`: Batch processes expired grace periods (cron job)

3. **Database Schema**
   - `account_deletions` table tracks all deletion requests
   - Full audit trail with timestamps and status tracking
   - Row Level Security for user privacy

4. **Automated Processing**
   - Daily cron job processes expired grace periods
   - Atomic deletion operations with proper error handling
   - Comprehensive logging and monitoring

## Features

### 🔒 Security
- **Birth Year Verification**: Age verification (13-120 years)
- **Service Role Authentication**: All operations use admin-level access
- **Audit Trail**: Complete logging of all deletion activities
- **Row Level Security**: Users can only access their own deletion records

### ⏰ Grace Period
- **30-Day Grace Period**: Users can cancel during this window
- **Clear Communication**: Users are informed about the process
- **Status Tracking**: Real-time status updates available
- **Cancellation Support**: Support team can cancel pending deletions

### 🔄 Atomic Operations
- **Transactional Deletion**: All-or-nothing data removal
- **Foreign Key Handling**: Proper order of operations
- **Error Recovery**: Failed deletions are logged and can be retried
- **Data Integrity**: No orphaned records left behind

### 📊 Compliance
- **GDPR Ready**: Right to be forgotten implementation
- **Audit Logs**: Complete record of deletion requests
- **Data Retention**: Configurable grace periods
- **User Consent**: Clear confirmation process

## User Flow

### Initiation
1. User navigates to Profile > Avatar > Delete Account
2. User enters birth year for verification
3. System validates age (13-120 years)
4. User confirms understanding of grace period
5. Deletion request is created with 30-day grace period

### Grace Period
1. Account marked for deletion in `account_deletions` table
2. User can continue using the app during grace period
3. Support team can cancel deletion upon request
4. Daily job checks for expired grace periods

### Final Deletion
1. Cron job identifies expired grace periods
2. Systematically deletes all user data:
   - Playbooks and related data
   - Devotionals and journal entries
   - Preferences and notifications
   - Subscription data
   - Auth user account
3. Updates deletion record with completion status
4. Sends confirmation to monitoring systems

## Database Schema

```sql
account_deletions (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  birth_year integer NOT NULL,
  status text CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  grace_period_ends timestamptz NOT NULL,
  requested_at timestamptz NOT NULL,
  completed_at timestamptz,
  confirmation_token text,
  user_email text,
  user_metadata jsonb,
  deletion_notes text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
)
```

## API Endpoints

### Initiate Deletion
```
POST /functions/v1/delete-account
{
  "userId": "uuid",
  "birthYear": "YYYY",
  "confirmationToken": "optional"
}
```

### Process Deletions (Cron)
```
POST /functions/v1/process-account-deletions
```

### Check Status
```typescript
const status = await accountDeletionService.getDeletionStatus(userId);
```

### Cancel Deletion
```typescript
const success = await accountDeletionService.cancelAccountDeletion(userId, deletionId);
```

## Error Handling

### Validation Errors
- Invalid birth year format
- Age outside allowed range (13-120)
- Missing required fields

### Processing Errors
- Database connection issues
- Foreign key constraint violations
- Auth service unavailable
- Network timeouts

### Recovery Mechanisms
- Retry logic for transient failures
- Failed deletion tracking
- Manual intervention support
- Monitoring and alerting

## Monitoring

### Metrics to Track
- Deletion request volume
- Grace period cancellations
- Processing success/failure rates
- Time to completion

### Alerts
- Failed deletion processing
- High volume of deletion requests
- Service role key expiration
- Database connection issues

## Deployment

### Database Migration
```sql
-- Run the migration to create the account_deletions table
-- File: supabase/migrations/20240101_create_account_deletions_table.sql
```

### Edge Functions
```bash
# Deploy the edge functions
supabase functions deploy delete-account
supabase functions deploy process-account-deletions
```

### Cron Job
```yaml
# Set up the GitHub Actions workflow
# File: .github/workflows/process-account-deletions-cron.yaml
```

## Testing

### Unit Tests
- Birth year validation
- Status checking
- Cancellation logic

### Integration Tests
- End-to-end deletion flow
- Grace period processing
- Error scenarios

### Security Tests
- Unauthorized access attempts
- Data leakage prevention
- Service role misuse

## Support Procedures

### User Requests Cancellation
1. Verify user identity
2. Check deletion status
3. Cancel if still in grace period
4. Notify user of successful cancellation

### Deletion Failed
1. Check error logs
2. Verify data consistency
3. Manual cleanup if needed
4. Update deletion record

### Emergency Deletion
1. Use immediate deletion service
2. Document reason for emergency
3. Notify compliance team
4. Update audit trail

## Compliance Notes

- **Data Retention**: 30-day grace period exceeds minimum requirements
- **User Rights**: Clear opt-out and cancellation options
- **Transparency**: Detailed process documentation
- **Auditability**: Complete logging of all actions

## Future Enhancements

- **Multiple Grace Periods**: Different periods for different user types
- **Partial Deletion**: Option to delete specific data only
- **Export Before Deletion**: Provide data export option
- **Legal Holds**: Prevent deletion for legal requirements
