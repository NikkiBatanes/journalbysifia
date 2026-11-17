# Journal Cloud encrypted storage and recovery plan

Status: implementation design; not yet a shipped backup, sync, or recovery feature
Last reviewed: 2026-11-17
Applies to: Journal by siFia on iOS and Android

## Decision summary

Journal by siFia will remain fully usable without an account or Journal Cloud.
Free local export will protect the same authored inventory as the paid cloud
snapshot path. Journal Cloud adds automatic encrypted upload, multi-device
recovery, and version history; it does not replace free compatible siFia sync.

The target security property is client-side encryption with user-controlled
recovery:

- journal plaintext and Journal Cloud decryption keys do not belong in
  Supabase, RevenueCat, analytics, logs, or support tools;
- RevenueCat and the server entitlement projection decide whether an account
  may use paid cloud operations, but never supply a decryption key;
- the siFia account password alone is not enough to decrypt Journal Cloud;
- each authorized installation gets an independently revocable wrapped copy of
  the vault key;
- a user-held recovery method can enroll a replacement device without giving
  siFia a universal content-decryption key;
- free compatible siFia records keep their existing canonical sync path. A
  cloud snapshot may protect a copy for recovery, but restore must reconcile
  IDs rather than create a second canonical record.

This plan deliberately does not select a React Native encryption/database
package yet. The implementation spike must prove that a maintained, audited
native binding works on the repository's exact iOS and Android targets before
we commit user data to its format.

## What exists today

The repository already has a versioned in-memory backup envelope and strict
validation in `src/services/journalBackupContract.ts`. Its read-only inventory
now includes canonical records, reviews, routine state, prayer/session/guided/
routine drafts, Gospel-authored data, and a strict allowlist of meaningful
preferences. Focused tests also prove that authentication tokens, device
secrets, analytics outboxes, offline mutation queues, caches, and temporary
time-block stores are excluded. This is useful groundwork, but it does not
write an archive, encrypt bytes, package media, upload to cloud, or restore data
transactionally.

The current app primarily stores journal state in AsyncStorage. That means a
multi-key save or restore is not a database transaction. The current restore
policy correctly requires a staged rollback snapshot and recovery marker, but
the launch implementation should move durable records to an encrypted
transactional store rather than treating that workaround as the final design.

Media has two different risk profiles:

- selected photos currently retain picker URIs such as `file://`, `content://`,
  or `ph://`. They are not copied into Journal-owned storage and do not yet have
  a durable asset ID, hash, byte size, or verified MIME type;
- voice notes are written into app-owned directories on both platforms, but
  only their URI is linked from a block. They still need a stable asset
  manifest, integrity metadata, reference tracking, and encrypted packaging.

Until those gaps are fixed, the product must not say that every photo or voice
note is backed up.

## Recovery inventory

The inventory is divided by meaning, not merely by key prefix. An unknown key
is excluded by default until its owner and restore behavior are reviewed.

### Tier A — user-authored content: always protect

| Data | Current examples | Required restore behavior |
| --- | --- | --- |
| Canonical journal entries | Heart Journal, gratitude, focus, wins, looking forward, to-do, time blocks | Preserve stable IDs, revisions, selected dates, provenance, tombstones, and links |
| Reflections | Notes, session notes, guided reflections, compatible siFia reflections | Preserve type/source metadata and all structured Journal blocks |
| Prayers | Journal, people, devotional, guided/playbook prayers, answer history | Preserve lifecycle and answer history; never flatten to text only |
| Bible Study sessions | Session record plus reflection/prayer references | Restore referenced records first, then validate every relationship |
| Routine state | Morning/evening progress and content references | Preserve state separately; references remain references |
| Reviews | Answers, memorable items, prayer snapshots, canonical references | Preserve authored answers and snapshots; resolve references without inventing duplicates |
| Prayer drafts | `prayer_draft:` | Restore as drafts, not published records |
| Session Notes drafts | `session_notes_draft_v1:` | Protect because autosaved blocks and prayer text may be the user's only copy |
| Guided reflection drafts | `guided_reflection_draft_v1:` | Protect as unfinished authored work |
| Routine drafts | `routine_draft:` | Protect authored unfinished text; this corrects the current V1 exclusion |
| Gospel people/history | `journal:gospel:people:v1`, share events | Preserve names, notes, prayer dates, and history as sensitive authored records |
| Gospel personal response/testimony | self-response and For Me Day settings | Preserve testimony/story and spiritual dates as sensitive authored content |
| Journal block extensions | text, sections, lists, tables, scripture, quote, song, outline, character, response, question, prayer, photo, voice and related kinds | Preserve unknown future block versions without interpreting or dropping them |
| Media bytes | managed photo and voice assets | Package actual encrypted bytes plus stable asset ID, MIME, size, hash, parent/block references, and capture/import metadata |

Legacy authored records stay in a separate compatibility section until an
explicit, tested mapping exists. They may be preserved in the archive without
being destructively written into a newer canonical table.

### Tier B — meaningful user preferences: protect with lower priority

| Data | Examples | Restore rule |
| --- | --- | --- |
| Local profile/preferences | `journal:local-profile`, `journal:local-preferences`, review week start | Preview identity-bearing values and ask before replacing a current profile |
| Journal setup choices | week start, Bible version, faith goal, rhythm preference | Restore settings only; never treat them as account identity or entitlement |
| Note-block preferences | enabled/favorite block kinds | Migrate by schema version and ignore unknown kinds safely |
| Experience preferences | haptics, sounds, tab labels | Restore only supported values; device accessibility settings remain authoritative |
| Review settings | review cadence and related settings | Restore after authored records |
| Scripture sequence anchor | sequence start date | Restore as a preference, not a content record |
| Reminder preferences | user-selected reminder intent | Restore intent only; recreate OS notifications after current-device permission and confirmation |

Calendar event identifiers, notification identifiers, file-provider bookmarks,
and other installation-owned handles are not portable. The archive can record
the user's intent, but a clean device must ask permission and create new OS
objects.

### Tier C — reconstructable state: do not package as authoritative data

| Data | Examples | Reason |
| --- | --- | --- |
| Local indexes/pointers | journal/reflection/prayer/review indexes, latest Bible Study pointer | Rebuild and validate from canonical records |
| Caches | scripture passage cache, journal cache, rendered/export cache | Can be fetched or regenerated |
| Prompt/completion markers | guided-completed dates, rhythm celebration, review prompt counters, rotation indexes | UI state must not block recovery or overwrite content |
| Retry and synchronization state | upload retries, cursors, transient download state | A restore begins with a fresh reconciliation; old work must not replay blindly |
| Derived recommendations | prayer resurfacing or recommendation state | Recompute from restored records where possible |

### Tier D — prohibited from export or cloud snapshots

| Data | Examples | Risk |
| --- | --- | --- |
| Authentication secrets | access/refresh tokens, Supabase session, cached user session | Would turn a backup into an account takeover credential |
| Device/install identity | push tokens, device IDs, analytics install ID, gospel-share owner/install key | Must not impersonate the old installation |
| Store/billing secrets | RevenueCat credentials, receipt-validation secrets, service-role values | Billing is re-established from authenticated store/server state |
| Analytics/telemetry queues | impact outbox, backfill markers | Can leak behavior or replay stale events |
| Network mutation queues | general offline queue | May replay old remote edits after restore or under the wrong account |
| OS notification/calendar IDs | scheduled notification IDs and external calendar event IDs | Not portable and may target unrelated objects on another device |
| Developer/test fixtures | `dev-*` and QA-only state | Never customer recovery data |
| Logs and crash payloads | local diagnostic or redacted operational state | Not part of a user's journal and may contain unsafe context |

## Target architecture

```text
Journal editor
    |
    v
Encrypted transactional local database ----> managed encrypted media directory
    |                                                   |
    +---- consistent recovery snapshot -----------------+
                         |
                         v
              versioned encrypted manifest
                /                     \
       system file export       private Journal Cloud
                                  ciphertext objects
                                         |
                           Supabase stores only minimal
                         metadata, wrapped keys and status
```

The same snapshot builder serves free file export and paid Journal Cloud so the
product cannot silently protect less data in one path. Transport, retention,
and recovery history differ; the authored inventory does not.

### Local persistence

1. Select an encrypted transactional database that supports iOS and Android,
   schema migrations, crash-safe commits, indexed queries, and backups without
   exposing plaintext temporary files.
2. Generate separate guest-vault and account-vault namespaces. Never merge
   merely because an email string matches.
3. Save a record mutation and its durable sync outbox event in the same
   transaction.
4. Migrate AsyncStorage in a restartable sequence: discover, validate, create
   rollback snapshot, copy, verify counts/hashes/relationships, switch active
   generation, retain a time-bounded rollback copy, then clean up.
5. Keep database keys wrapped by platform-protected device keys. On sign-out,
   close the account vault and cancel/lock its background operations before
   another account can become active.
6. Explicitly configure and test iOS backup exclusion and Android Auto Backup
   rules. A local database copied without its non-migrating device wrapper is
   not a valid recovery method; the app must detect that state and direct the
   user to a manual export or Journal Cloud recovery instead of showing an
   empty vault silently.

### Durable media ingestion

1. When a photo or recording is selected, copy bytes immediately into a
   Journal-owned staging file. Never make the picker URI the permanent record.
2. Validate supported type, actual byte signature where practical, size,
   dimensions/duration, and resource limits.
3. Encrypt into a managed asset object, calculate a ciphertext integrity value,
   and commit asset metadata plus the block reference atomically.
4. If the database commit fails, safely remove the unreferenced staging object.
   If cleanup fails, a reconciler may remove only objects proven unreferenced.
5. Existing missing picker URIs are reported as missing and offered for
   reselection. They must not be counted as protected bytes.

## Key hierarchy and recovery

Names below describe responsibilities; the exact serialized format is versioned
and selected only after the native-library spike.

| Key | Purpose | Storage |
| --- | --- | --- |
| Vault master key (VMK) | Random 256-bit root for one private Journal Vault | Never stored plaintext in app storage or backend |
| Device wrapping key (DWK) | Wraps the VMK for one authorized installation | Non-exportable or platform-protected iOS Keychain / Android Keystore material |
| Recovery wrapping key (RWK) | Wraps the VMK for user-controlled recovery | Derived locally from a high-entropy recovery code, or directly represented by that code; server stores only the wrapped VMK and KDF/version metadata |
| Object data key (ODK) | Encrypts one snapshot/manifest/media object or bounded stream | Random per object, wrapped/derived under the VMK; never reused with an unsafe nonce |

Recommended behavior:

1. Create the VMK on the first Journal Cloud enrollment, locally.
2. Create a device wrapper and upload only the wrapped VMK, wrapper version,
   device public label/ID, and minimal audit timestamps.
3. Generate a high-entropy, human-safe recovery code locally. Require the user
   to save and confirm it before the app claims that new-device recovery is
   ready. A QR representation may improve transfer, but must not be uploaded as
   plaintext.
4. If a user-chosen passphrase wrapper is offered, derive its wrapping key with
   Argon2id using a unique random salt and versioned cost parameters. Benchmark
   lower-memory devices; do not hardcode desktop-only settings. The recovery
   code remains the stronger default.
5. Adding a device requires an existing trusted device or the confirmed
   recovery method. Account password reset, a restored store subscription, or
   support contact cannot independently unwrap the VMK.
6. Revocation removes the device's future server authorization and wrapped-key
   access. It cannot erase journal plaintext already downloaded to that device.
7. Normal key rotation creates new object keys and, when required, a new VMK
   generation. Old snapshots remain readable through an explicitly retained
   prior wrapper until retention expires; rotation must never orphan history.

On iOS, use the most restrictive Keychain accessibility compatible with
background requirements. A `ThisDeviceOnly` key does not migrate to another
device, which is why a separate recovery wrapper is required. On Android, the
Keystore can keep key material non-exportable and restrict authorized use;
hardware backing should be recorded as a security signal, not assumed on every
device.

## Encryption format decision gate

Do not invent cryptography or implement a JavaScript-only cipher. The preferred
archive/cloud candidate is an authenticated chunked stream such as libsodium
`secretstream` using XChaCha20-Poly1305 because it authenticates order,
modification, truncation, and a final chunk while supporting arbitrary file
sizes. AES-256-GCM is also acceptable when provided by a maintained native
library with a reviewed chunk framing and strict nonce-generation strategy.

The spike must prove:

- maintained native implementation on the minimum supported iOS/Android
  versions and the current React Native architecture;
- cryptographically secure random key and nonce generation;
- authenticated version/header metadata and final-chunk detection;
- streaming operation without loading large media into JavaScript memory;
- deterministic failure on wrong keys, corrupt/truncated/reordered chunks, or
  unsupported versions;
- no plaintext temp files, keys, or content in logs/crash reports;
- dependency provenance, update policy, and reproducible build evidence;
- documented test vectors that decrypt on both platforms.

No production archive is created until this gate passes.

### Free-export keying

Free encrypted export cannot depend on a siFia account, RevenueCat, Journal
Cloud, or a device-only wrapping key. At export time the user chooses one of:

- a generated high-entropy recovery code, displayed and confirmed locally; or
- a passphrase-derived archive key using Argon2id with a per-archive random
  salt and versioned, device-tested cost parameters.

The export contains the KDF/cipher version, salt, and authenticated stream
header, but never the recovery code/passphrase or derived key. The app must
warn that neither siFia support nor an account password can recover a lost
export secret. Export success means the encrypted file was handed to the
chosen system destination and its final authenticated marker was written; it
does not mean the user retained the file or secret.

## Versioned archive and cloud object model

The existing backup envelope becomes a manifest inside an encrypted container,
not a plaintext JSON file.

```text
container header (non-secret, authenticated)
  format/version, cipher suite, KDF/wrapper version, stream header
encrypted manifest
  snapshot ID, vault ID, schema versions, record inventory, object map,
  logical hashes, reference graph, tombstones, created/committed timestamps
encrypted object streams
  record chunks and independently addressable media objects
authenticated final marker
```

Only the minimum routing metadata is readable by the backend: owner account ID,
opaque vault/snapshot/object IDs, ciphertext byte size, object kind bucket,
cipher/wrapper version, upload status, retention state, and server timestamps.
Titles, entry types, scripture text, dates chosen by the user, tags, filenames,
media MIME when avoidable, and journal bodies stay encrypted.

Cloud object paths use opaque generated identifiers and private buckets. They
must not contain an email address, title, journal type, selected date, or
RevenueCat product ID.

## Snapshot commit and upload protocol

1. Start from one committed local database generation and pin the referenced
   media set.
2. Build and validate a complete encrypted manifest locally.
3. Create a server-side snapshot session only after checking the authenticated
   owner and current production entitlement. Client RevenueCat state alone is
   insufficient.
4. Upload encrypted objects resumably with idempotent object IDs. A retry must
   verify the expected ciphertext size/hash instead of overwriting a different
   object silently.
5. Upload the encrypted manifest last, then call a server commit operation that
   verifies every declared object exists and quota/ownership still pass.
6. Mark the snapshot recoverable only after commit. Partial sessions remain
   invisible as backups and are garbage-collected after a safe interval.
7. Update `last verified recoverable snapshot` only after a read-back integrity
   check, not merely after an upload request returns.

Use TUS/resumable upload for larger or interruption-prone ciphertext. Background
work is best-effort within iOS/Android limits; foreground catch-up is required.
The UI must not promise continuous real-time backup.

## Restore protocol

Restore is staged and reversible:

1. Authenticate the account, verify server entitlement/retention access, and
   acquire the VMK through a trusted device or recovery method.
2. Download the encrypted manifest and verify its authentication before using
   any contained path, count, size, or schema value.
3. Enforce limits before allocation: archive/snapshot size, record count,
   nesting depth, string/block size, media count/size, decompression ratio, and
   supported schema/cipher versions.
4. Download/decrypt each object into an isolated staging area and verify the
   final authentication tag and declared relationships.
5. Show a preview: records to add, known IDs to reconcile, conflicts, Journal-
   only items, settings, and missing/unrecoverable media.
6. Create a local rollback point. Import records/media into a new inactive
   database generation.
7. Rebuild indexes and validate references, counts, hashes, ownership, and
   namespace. Never restore auth tokens, outboxes, cursors, device IDs,
   notifications, calendar IDs, or store state.
8. Atomically switch the active generation only when all required checks pass.
   On cancellation, crash, disk-full, wrong key, or corruption, retain the old
   generation and remove only provably isolated staging files.
9. Begin fresh server reconciliation. Existing shared-compatible record IDs are
   matched/reconciled; they are not re-uploaded as new canonical entries.

Free file restore follows the same validation and staging steps without an
account or subscription.

## Sync is not backup

Journal Cloud must expose separate states:

- saved locally;
- compatible siFia sync current/pending/error;
- encrypted cloud upload current/pending/error;
- latest verified recoverable snapshot and protected byte count;
- media excluded/missing/over limit;
- recovery method ready/not ready.

Live synchronization can propagate an accidental deletion. Immutable recovery
snapshots therefore keep versions and deletion tombstones under a published
retention policy. A green global “Backed up” state is allowed only when the
latest eligible records and media are present in a verified committed snapshot.

## Subscription and retention behavior

- Purchasing enables server acceptance of new encrypted snapshots; it does not
  reveal or create a journal key by itself.
- Cancellation at the next renewal keeps normal access through the paid-through
  timestamp.
- Billing failure/grace behavior follows verified store state; uploads may be
  paused without deleting local writing.
- After entitlement expiry, local editing and free export continue.
- The launch policy should disclose a proposed 90-day read-only retrieval
  window before cloud deletion, subject to storage-cost validation and store/
  legal review. It is not a current guarantee until published.
- Account deletion and Journal Cloud deletion require an explicit scoped flow,
  deletion ledger, object deletion verification, and clear notice that deleting
  backend data does not itself cancel a store subscription.

## Operational disaster recovery

Operational recovery restores service and ciphertext, not user plaintext.

Back up independently:

- Postgres schema and Journal Cloud metadata;
- encrypted Storage object bytes;
- wrapped-key records and device/recovery wrapper metadata;
- Edge Function source/configuration without secret values;
- infrastructure configuration, bucket policies, and migration history;
- deletion evidence needed to avoid resurrecting intentionally erased data.

A Supabase database backup does not by itself restore Storage object bytes.
Run an isolated end-to-end drill before launch and at least quarterly after
launch, plus after material storage/key changes. Proposed engineering targets
remain: database RPO no more than 15 minutes, encrypted media RPO no more than
24 hours, and full service RTO no more than 24 hours. These are targets until a
recorded drill proves them.

The operator drill must demonstrate that staff can restore encrypted objects
and manifests without possessing a global content-decryption key. It must also
prove that intentionally deleted accounts are not resurrected.

## Threat model and required controls

| Threat | Required control/evidence |
| --- | --- |
| Database/Storage exposure | Ciphertext and wrapped keys only; private bucket; owner/server authorization; no content in paths |
| Service-role or operator compromise | No global user-content key; least privilege; audited access; secret rotation; separation of production/sandbox |
| Cross-account ID substitution | Derive owner from authenticated session; never trust a target user ID from client payload |
| Malicious/corrupt archive | Authenticate before use; strict version/resource/path validation; isolated staged import |
| Replay/partial upload | Idempotency, expected ciphertext hash/size, server commit record, invisible uncommitted snapshots |
| Device theft | Platform-protected wrapping key; optional device authentication; revocation; local lock; clear limitations for already-unlocked/downloaded data |
| Lost phone/password reset | User-held recovery or trusted device; password reset alone cannot decrypt |
| Lost recovery code and all devices | Honest unrecoverable-data warning; support cannot bypass encryption |
| Plaintext leakage | No sensitive logs/analytics/crash payloads; no plaintext temp files; clipboard/screenshot review for recovery screens |
| Rollback/resurrection | Snapshot generation/version checks, tombstones, deletion ledger, explicit conflict preview |
| Dependency compromise | Pin/check provenance, review native code/update policy, software composition analysis, security test before upgrade |

Security verification maps at minimum to OWASP MASVS Storage, Cryptography,
Authentication, Network, and Privacy controls. Passing internal tests is not a
certification; an independent mobile security assessment remains a launch gate
before marketing Journal Cloud as end-to-end encrypted.

## Implementation phases and exit evidence

| Increment | Deliverable | Exit evidence | Current status |
| --- | --- | --- | ---: |
| A | Inventory correction and recovery boundary | Every authored store/settings/cache/secret classified; synthetic fixtures for every supported variant | Design documented; fixture coverage incomplete |
| B | Crypto/database spike | Cross-platform native test vectors, crash/disk-full tests, dependency review, no plaintext artifacts | In progress: isolated candidate, key tests, and native integration prepared; device runtime/crash/disk-full/plaintext-artifact evidence remains |
| C | Transactional local migration | Restartable count/hash/reference verified migration and rollback on iOS/Android | Not started |
| D | Managed media | Photo/voice bytes survive restart/export/restore; missing legacy URI is disclosed | Not started |
| E | Free encrypted export/restore | Clean-device iOS/Android restore; wrong key/corruption/interruption/disk-full leave existing data intact | Not started |
| F | Device/recovery enrollment | Trusted-device and recovery-code paths proven; password-only recovery denied | Not started |
| G | Paid encrypted upload/snapshots | Entitlement enforced server-side; resumable upload, quota, commit, versions, expiry/retrieval proven | Not started |
| H | Operational recovery/security release | Isolated DR drill, deletion non-resurrection, independent findings resolved, staged rollout/kill switch | Not started |

## Synthetic encrypted-database spike checkpoint — 2026-11-17

The first database candidate is OP-SQLite 19.0.5 compiled with SQLCipher. The
probe uses a separate `journal-cloud-storage-spike-v1.sqlite` database and a
generated 256-bit key held through the platform Keychain/Keystore boundary.
The key is device-only, cloud synchronization is disabled, malformed stored
keys fail closed, and neither the probe nor its database is connected to app
startup or any customer journal read/write path.

Prepared runtime assertions verify that SQLCipher is active, a transaction
rollback leaves no row, a committed synthetic row survives close/reopen, and a
wrong key cannot read the database. Focused key-generation/reuse/fail-closed
tests pass. Android builds with SQLCipher enabled, and CocoaPods resolves the
SQLCipher/OpenSSL native graph. These are integration checks, not device
runtime evidence and not approval to migrate live records.

The iOS development diagnostic passed all four runtime assertions on
2026-11-17 using SQLCipher 4.19.0 Community. The Android development diagnostic
passed the same assertions on 2026-11-18 using SQLCipher 4.19.0. Cross-platform
activation, rollback, reopen, and wrong-key rejection are therefore verified
for the synthetic database. Crash/disk-full behavior and plaintext-artifact
inspection remain open.

## Immediate next implementation step

The controlled development diagnostic has passed on one iOS and one Android
installation and never runs automatically. Next, inspect the app sandbox for
plaintext artifacts and exercise interruption, crash, and disk-full behavior
with synthetic fixtures. Do not design the production migration until those
checks pass and the dependency/security review is recorded.

No user action or manual SQL is required for the next local implementation
increment. No key or journal content should be shared.

## Primary references

- [Apple: restricting Keychain item accessibility](https://developer.apple.com/documentation/Security/restricting-keychain-item-accessibility)
- [Apple: `kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly`](https://developer.apple.com/documentation/security/ksecattraccessiblewhenpasscodesetthisdeviceonly)
- [Android Keystore system](https://developer.android.com/privacy-and-security/keystore)
- [libsodium encrypted streams and file encryption](https://doc.libsodium.org/secret-key_cryptography/secretstream)
- [libsodium password hashing/key derivation](https://doc.libsodium.org/password_hashing/default_phf)
- [Supabase resumable Storage uploads](https://supabase.com/docs/guides/storage/uploads/resumable-uploads)
- [Supabase database backups](https://supabase.com/docs/guides/platform/backups)
- [OWASP MASVS Storage controls](https://mas.owasp.org/MASVS/05-MASVS-STORAGE/)
