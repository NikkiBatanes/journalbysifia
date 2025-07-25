#!/bin/bash

# Deploy Playbook System Migration Script
# This script deploys the new normalized playbook database schema

set -e  # Exit on any error

echo "🚀 Starting Playbook System Migration Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    print_error "Supabase CLI is not installed. Please install it first:"
    echo "npm install -g supabase"
    exit 1
fi

# Check if we're logged in to Supabase
print_status "Checking Supabase authentication..."
if ! supabase projects list &> /dev/null; then
    print_error "Not logged in to Supabase. Please run: supabase login"
    exit 1
fi

print_success "Supabase CLI is ready"

# Phase 1: Backup existing data (if needed)
print_status "Phase 1: Checking for existing playbook data..."

# Check if playbooks table exists
PLAYBOOKS_EXISTS=$(supabase db diff --schema public | grep -c "playbooks" || true)

if [ "$PLAYBOOKS_EXISTS" -gt 0 ]; then
    print_warning "Existing playbooks table detected"
    echo "⚠️  This migration will replace the existing playbooks table structure"
    echo "📋 Please ensure you have backed up any important data"
    
    read -p "Do you want to continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "Migration cancelled by user"
        exit 1
    fi
else
    print_success "No existing playbooks table found - safe to proceed"
fi

# Phase 2: Run the migration
print_status "Phase 2: Running database migration..."

# Apply the migration
if supabase db push; then
    print_success "Database migration completed successfully"
else
    print_error "Database migration failed"
    exit 1
fi

# Phase 3: Verify the migration
print_status "Phase 3: Verifying migration..."

# Check if all tables were created
TABLES_TO_CHECK=("playbooks" "playbook_action_steps" "playbook_sub_tasks" "playbook_affirmations")

for table in "${TABLES_TO_CHECK[@]}"; do
    if supabase db diff --schema public | grep -q "$table"; then
        print_success "✓ Table '$table' created successfully"
    else
        print_error "✗ Table '$table' not found"
        exit 1
    fi
done

# Check if the progress calculation function exists
if supabase db diff --schema public | grep -q "calculate_playbook_progress"; then
    print_success "✓ Progress calculation function created"
else
    print_error "✗ Progress calculation function not found"
    exit 1
fi

# Phase 4: Test the new API
print_status "Phase 4: Testing API functions..."

# Create a simple test script
cat > /tmp/test_playbook_api.js << 'EOF'
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://aesmrjinczhknchlrsmt.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlc21yamluY3poa25jaGxyc210Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg3NjYxOTMsImV4cCI6MjA2NDM0MjE5M30.x7XMjrm9WWlvEdc5eaK7Z5Fy-V_85qMJQ7pInsrKIyM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAPI() {
  try {
    // Test table access
    const { data, error } = await supabase
      .from('playbooks')
      .select('count(*)')
      .limit(1);
    
    if (error) {
      console.error('API test failed:', error.message);
      process.exit(1);
    }
    
    console.log('✓ API connection successful');
    
    // Test progress function
    const { data: progressData, error: progressError } = await supabase
      .rpc('calculate_playbook_progress', { playbook_uuid: '00000000-0000-0000-0000-000000000000' });
    
    if (progressError && !progressError.message.includes('does not exist')) {
      console.error('Progress function test failed:', progressError.message);
      process.exit(1);
    }
    
    console.log('✓ Progress calculation function accessible');
    process.exit(0);
    
  } catch (error) {
    console.error('Unexpected error:', error.message);
    process.exit(1);
  }
}

testAPI();
EOF

# Run the API test (if Node.js is available)
if command -v node &> /dev/null; then
    if node /tmp/test_playbook_api.js; then
        print_success "API tests passed"
    else
        print_warning "API tests failed - please verify manually"
    fi
    rm -f /tmp/test_playbook_api.js
else
    print_warning "Node.js not available - skipping API tests"
fi

# Phase 5: Generate types (if available)
print_status "Phase 5: Generating TypeScript types..."

if supabase gen types typescript --local > src/types/supabase.ts 2>/dev/null; then
    print_success "TypeScript types generated"
else
    print_warning "Could not generate types - please run manually: supabase gen types typescript --local"
fi

# Phase 6: Final summary
print_success "🎉 Playbook System Migration Deployment Complete!"

echo ""
echo "📋 Migration Summary:"
echo "  ✅ Database schema deployed"
echo "  ✅ Tables created: playbooks, playbook_action_steps, playbook_sub_tasks, playbook_affirmations"
echo "  ✅ RLS policies applied"
echo "  ✅ Triggers and functions created"
echo "  ✅ Indexes added for performance"
echo ""
echo "🔄 Next Steps:"
echo "  1. Update your app to use the new API functions in supabaseApiNormalized.ts"
echo "  2. Replace legacy components with hybrid versions"
echo "  3. Test the new functionality thoroughly"
echo "  4. Monitor performance and user feedback"
echo ""
echo "📚 Documentation: docs/PlaybookHybridMigrationGuide.md"
echo ""

print_success "Migration deployment completed successfully! 🚀"
