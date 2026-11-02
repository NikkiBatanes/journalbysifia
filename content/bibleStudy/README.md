# Bible study content source

This directory contains editorial source content for Bible study collections. The current John collection is temporarily imported into the React Native bundle so it can be reviewed in TestFlight.

## Release model

- The app owns the reusable study UI, local answer storage, offline cache, and entitlement checks.
- Supabase owns the published collection catalog, chapter content, release state, access model, and announcements.
- Editorial files in this directory are validated and uploaded to Supabase by a publishing workflow.
- A chapter stores the key-verse reference and study note only; the app retrieves the verse text in the reader's selected Bible version.
- Publishing or correcting a chapter updates remote content and does not require an App Store or Play Store build.
- A new app build is needed only when the study schema, reader behavior, purchase flow, or visual experience changes.

`john.ts` is the complete editorial source for John 1–21. John and the Matthew 23 sample are currently available from Bible Study in both debug and TestFlight builds. Replace this temporary bundled connection with the remote catalog and entitlement loader before using paid access or releasing future collections without an app update.
