# Journal by siFia — Early Access site

A responsive landing page and two-step research funnel for `journalby.sifia.app`.

The first step saves the required email address and platform immediately. The optional second step adds product, pricing, and tester research to the same record. This means someone is still on the Early Access list if they leave before finishing the survey.

## Copy reference

The landing page leads with “Know where to begin. Have something to return to.” Its story is practical: prompts help you begin, prayers and notes stay together, and Reviews help you revisit what you wrote. Selected language from `src/screens/journalOnboarding/JournalOnboardingScreen.tsx` supports that story: “The desire is there. The rhythm is hard,” and “Begin and end your day with God” in the Morning and Evening section. The page is not a reproduction of the onboarding walkthrough.

Product details are checked against Today, Bible Study, the shared Sermon Notes blocks, prayer history, and the Review project notes. Keep all four Review cadences and the distinction between journal entry categories and note types inside Sermon Notes. No health-outcome claims, research statistics, or personal setup questions are included. Early Access remains a signup, not a preorder; the survey’s ₱599 question is hypothetical, and volunteering does not guarantee a testing place.

## Replace the phone screenshots

Seven phone frames are already placed on the page. Each currently displays a labeled SVG placeholder, not an actual app screenshot.

| File in assets/screenshots/ | Position | Suggested app screen |
| --- | --- | --- |
| today.svg | Hero | Today dashboard |
| morning.svg | Morning card | Check-in or Psalm reflection |
| evening.svg | Evening card | Gratitude or evening reflection |
| journal.svg | More ways to journal | Journal entries and notes |
| sermon-note-types.svg | Inside Sermon Notes | Add note type menu showing Outline, Language Note, Book to Read, and other note types |
| reviews.svg | Reviews section | Weekly Review |
| prayer.svg | Prayer history | A prayer with updates |

To replace one:

1. Save a portrait screenshot into assets/screenshots/, for example morning.png.
2. In index.html, find data-screenshot="morning" and change the image src from assets/screenshots/morning.svg to assets/screenshots/morning.png.
3. Update the image alt text to describe the real screen. Remove the words "— screenshot placeholder" from it and remove the "Screenshot placeholder" span in that figure's caption.
4. Update width and height to the screenshot's pixel dimensions. The frame scales with the image without cropping it.

Use screenshots without an existing phone bezel; the page supplies the frame. The SVG placeholders are for layout review and should be replaced before publishing.

Frame styling is in mockups.css, which must be uploaded alongside styles.css. No JavaScript change is needed to replace screenshots.

## SiteGround setup

1. In **Site Tools → Site → MySQL**, create a database and a database user. Give the user full access to that database.
2. Open **phpMyAdmin**, select the new database, choose **Import**, and import `schema.sql`.
3. Copy `journal-early-access-config.example.php`, rename the copy to `journal-early-access-config.php`, and add the SiteGround database credentials.
4. Upload `journal-early-access-config.php` one level **above** the subdomain's `public_html` directory. For a standard SiteGround subdomain layout, the files should resemble:

   ```text
   journalby.sifia.app/
   ├── journal-early-access-config.php  ← database credentials
   └── public_html/
       ├── index.html
       ├── styles.css
       ├── mockups.css
       ├── app.js
       ├── .htaccess
       ├── assets/
       └── api/
   ```

5. Upload everything else in this folder to the `public_html` directory for `journalby.sifia.app`. The example config, `schema.sql`, and this README do not need to be in `public_html`.
6. Open `https://journalby.sifia.app`, submit a test entry, and confirm that it appears in `journal_early_access` in phpMyAdmin.

If the SiteGround document-root layout differs, the PHP endpoint also accepts server environment variables named `JOURNAL_DB_HOST`, `JOURNAL_DB_PORT`, `JOURNAL_DB_NAME`, `JOURNAL_DB_USER`, and `JOURNAL_DB_PASSWORD`.

## View and export signups

In phpMyAdmin, open `journal_early_access` and choose **Export → CSV**. Useful filters include:

- All interested people: `email_consent = 1 AND unsubscribed_at IS NULL`
- Testers: `tester_opt_in = 1 AND unsubscribed_at IS NULL`
- Completed research: `survey_completed_at IS NOT NULL`
- iPhone or Android: filter the `platform` column

The multi-choice answers are stored as JSON arrays inside text columns, which keeps the setup compatible with common SiteGround MariaDB versions.

## Form behavior

- Email, phone platform, and email consent are required.
- All product and pricing questions are optional.
- Choosing early testing does not put everyone on the tester list—only explicit opt-ins.
- Resubmitting the same email updates the existing record instead of creating a duplicate.
- UTM parameters (`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`) are captured automatically.
- The hidden honeypot field reduces basic form spam.
- Successful interactions push `early_access_joined`, `early_access_survey_completed`, or `early_access_survey_skipped` to `window.dataLayer` if analytics is added later.

## Before launch

- Replace the privacy and terms links if Journal will use different legal pages from `sifia.app`.
- Submit on both iPhone and Android screen sizes.
- Send a real test email through the list tool you plan to use and include an unsubscribe link in every marketing message.
- Delete the test database row before announcing the page.
