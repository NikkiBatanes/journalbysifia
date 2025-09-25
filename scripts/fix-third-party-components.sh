#!/bin/bash

# Fix for TestFlight crash: RCTThirdPartyComponentsProvider nil object issue
# This script applies nil safety checks to prevent crashes when third-party components are missing

PROVIDER_FILE="build/generated/ios/RCTThirdPartyComponentsProvider.mm"

echo "🔧 Applying TestFlight crash fix to $PROVIDER_FILE"

if [ ! -f "$PROVIDER_FILE" ]; then
    echo "❌ File not found: $PROVIDER_FILE"
    echo "   Run 'npx react-native run-ios' first to generate the file"
    exit 1
fi

# Check if fix is already applied
if grep -q "addComponent" "$PROVIDER_FILE"; then
    echo "✅ Fix already applied to $PROVIDER_FILE"
    exit 0
fi

echo "📝 Backing up original file..."
cp "$PROVIDER_FILE" "$PROVIDER_FILE.backup"

echo "🛠️  Applying nil safety fix..."

# Apply the fix using sed
sed -i '' '
/dispatch_once(&nativeComponentsToken, \^{/,/};/ {
    /dispatch_once(&nativeComponentsToken, \^{/a\
    NSMutableDictionary<NSString *, Class<RCTComponentViewProtocol>> *components = [[NSMutableDictionary alloc] init];\
    \
    // Helper function to safely add components\
    void (^addComponent)(NSString *, NSString *) = ^(NSString *key, NSString *className) {\
      Class componentClass = NSClassFromString(className);\
      if (componentClass != nil) {\
        components[key] = componentClass;\
      }\
    };\
    \
    // Add components with nil safety
    
    s/thirdPartyComponents = @{/\/\/ Original dictionary replaced with nil-safe version/
    s/@".*": NSClassFromString(@".*"),.*\/\/ \(.*\)/addComponent(@"\1", @"\2"); \/\/ \3/
    s/    };/    \
    thirdPartyComponents = [components copy];/
}
' "$PROVIDER_FILE"

echo "✅ Fix applied successfully!"
echo "📄 Original file backed up as: $PROVIDER_FILE.backup"
echo ""
echo "🚀 You can now build and archive your app for TestFlight"
