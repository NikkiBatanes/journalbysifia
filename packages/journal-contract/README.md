# siFia Journal contract

Pure TypeScript protocol shared by siFia and Journal by siFia. No React Native,
Supabase, device calendar, keychain, filesystem, or generation dependencies.

Exports capability/persistence policy, metadata-only merge preflight, common
field validators, and the first Time Block field boundary. App-specific daily,
prayer, and reflection adapters remain in Journal and use this shared core.

Version 0.1.1 carries capability contract version 3. This is a preparation
library: it does not authorize a user, enroll a device, grant upload consent,
run sync, or prove a local snapshot is consistent.

Time Blocks currently support explicit-zone one-off records. Derived virtual
occurrences, recurring series, exception records, missing zones, and conflicting
dates are held for mapping review. Native calendar IDs and alarm configuration
stay on their device. Proven playbook context is explicitly projected; private
metadata is preserved locally by text-patch preparation.

Source of truth: this directory in the JournalBySiFia repository. Build with the
root `contract:pack` script. Both app repositories install the same versioned
archive from `vendor/`, pinned by package-lock integrity. This lets independent
CI checkouts use the contract without requiring a sibling repository. Bump the
package version whenever changing an archive already committed as a checkpoint.
Do not edit installed files or maintain a second source copy in the siFia app.
