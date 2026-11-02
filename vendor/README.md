# Shared contract artifact

`@sifia/journal-contract` is installed from the checked-in versioned archive.
Its source lives in `packages/journal-contract` in this repository. The same
archive is used by the siFia app; application builds need no sibling checkout.

Build: `npm run contract:pack`. Verify source/archive agreement:
`npm run contract:check`. The pack script refuses to replace an existing archive
with different bytes at the same version. For changes, bump the package version,
pack the new archive, update both apps' dependency paths and lockfiles, and test
both consumers. Never patch the installed package in `node_modules`.

Archives contain only compiled JavaScript, declarations, and package documentation.
They contain no credentials, journal records, native modules, or install scripts.

The current Journal dependency graph needs `--legacy-peer-deps` with npm 11
because the existing masonry-list/Expo peer tree conflicts with React 19.
This integration installed just the contract archive offline with install scripts
disabled; it did not upgrade React, Expo, or any native dependency. The archive
itself installs in a clean consumer with ordinary offline npm install/npm ci.
Whole-app CI dependency-policy cleanup remains separate from this package check.
