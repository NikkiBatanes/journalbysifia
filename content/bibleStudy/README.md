# Bible study content source

This directory contains editorial source content for Bible study collections. It is intentionally outside `src/`, so the content is not included in the React Native bundle unless application code imports it.

## Release model

- The app owns the reusable study UI, local answer storage, offline cache, and entitlement checks.
- Supabase owns the published collection catalog, chapter content, release state, access model, and announcements.
- Editorial files in this directory are validated and uploaded to Supabase by a publishing workflow.
- A chapter stores the key-verse reference and study note only; the app retrieves the verse text in the reader's selected Bible version.
- Publishing or correcting a chapter updates remote content and does not require an App Store or Play Store build.
- A new app build is needed only when the study schema, reader behavior, purchase flow, or visual experience changes.

`john.ts` is the complete editorial source for John 1–21. It is not currently exposed as free bundled content. Matthew 23 remains the bundled sample until the remote catalog and entitlement loader are introduced.

During development, `BibleStudyScreen` imports John behind `__DEV__` so the collection can be reviewed in the app. The preview entry and registry are disabled in release mode; replace this temporary development connection with the remote loader before publishing John.
