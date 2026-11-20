# Journal Cloud encrypted storage and recovery plan

Status: implementation design; not yet a shipped backup, sync, or recovery feature
Last reviewed: 2026-11-18
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

OP-SQLite with SQLCipher is the first React Native database candidate, not an
approved production dependency. The implementation spike must prove that a
maintained, auditable native binding and its complete cryptographic dependency
graph work on the repository's exact iOS and Android targets before customer
data is committed to its format. The 2026-11-18 review keeps this candidate
synthetic-only because its current OpenSSL dependency does not pass the
production support gate described below.

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

The 2026-11-18 restore-planning increment also preserves each canonical
record's exact original storage key. This is necessary because journal
singletons and ordinary collection records cannot be distinguished safely from
their bodies alone. `journalBackupRestorePlan.ts` is a pure, no-storage-import
planner: it fails closed on missing/mismatched locations, duplicate output
keys, serialization failures, and keyed values outside exact owned namespaces.
For a valid backup it reconstructs active indexes, derives the latest Bible
Study pointer deterministically, and explicitly excludes unmapped legacy data.
It still performs no mutation. A later executor must stage a rollback snapshot
and recovery marker, enforce resource limits, and survive interruption before
this can be called a restore feature.

The 2026-11-18 transactional executor checkpoint now implements that mutation
boundary in `journalBackupRestoreExecutor.ts`. It remains storage-agnostic and
is not wired to AsyncStorage or a customer-facing restore control. It accepts
only the canonical reviewed ownership policy and runs through an exclusive
mutation coordinator that future journal writers must share. Before replacing
owned keys, it persists a bounded rollback snapshot and recovery marker; it
then applies the reviewed plan, verifies every restored value and the complete
owned key set, and removes recovery evidence only after verification succeeds.
Failures restore the exact prior owned state. If rollback itself cannot finish,
the evidence remains for explicit startup recovery. A reviewed production
storage adapter, startup recovery wiring, and clean-device app testing remain
required before restore can be enabled for users.

`journalBackupArchiveContract.ts` now defines the next pure boundary: a
versioned portable manifest that is valid only as authenticated plaintext
inside the future encrypted stream. It caps manifest/container/asset bytes,
record and asset counts, nesting depth, structural nodes, string size, and key
size before restore allocation. Asset paths must be exact opaque
`objects/<UUID>` paths; only allowlisted image/audio MIME types are accepted;
IDs and paths must be unique; hashes, sizes, totals, and owning record IDs must
match. Restore preflight also requires native evidence that the authenticated
final marker and every observed object length were verified. These checks do
not replace AEAD authentication and do not create a plaintext archive.

The current app primarily stores journal state in AsyncStorage. That means a
multi-key save or restore is not a database transaction. The current restore
executor correctly stages a rollback snapshot and recovery marker around this
compatibility boundary, but the launch implementation should move durable
records to an encrypted transactional store rather than treating that
compatibility mechanism as the final design.

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

### Native provider review, 2026-11-18

No reviewed React Native package currently satisfies the complete gate, so no
archive-encryption dependency has been added to the app:

| Candidate | Useful evidence | Blocking gap |
| --- | --- | --- |
| `react-native-quick-crypto` 1.1.9 | Maintained native implementation with current React Native support and XChaCha20-Poly1305 support | Exposes one-shot AEAD rather than libsodium `secretstream`; it does not provide the required Argon2id archive KDF |
| `react-native-libsodium` 1.7.0 | Maintained Serenity binding with iOS, Android, and new-architecture support | Its exposed native API does not include `secretstream`; password hashing is not available through the required native mobile surface |
| `sodium-react-native-direct` 0.4.4 | Thin native binding exposes libsodium `secretstream` and password hashing | Bundles libsodium 1.0.19 while the reviewed upstream release is 1.0.22; no React Native 0.88/new-architecture or off-JS-thread Argon2id proof |
| `@ammarahmed/react-native-sodium` 2.0.0-alpha.3 | Advertises file streaming and Argon2 support | Alpha release without the production maturity and cross-platform evidence required for private customer journals |

`scripts/check-journal-archive-crypto-provider.cjs` is the executable
acceptance boundary. It fails closed until an exact lockfile dependency with
verified upstream libsodium 1.0.22 or newer supplies native iOS/Android
`secretstream`, final-tag detection, Argon2id off the JavaScript thread, secure
randomness and memory clearing, and bounded native streaming. Separate
clean-build evidence on React Native 0.88.1 must prove known-answer and
cross-platform round trips plus wrong-key, corruption, truncation, reordering,
missing-final-tag, memory, interruption, and logging assertions. A package
passing static review is approved only for a spike; it still cannot receive
customer data until device evidence passes.

Primary evidence:

- [libsodium 1.0.22 release](https://github.com/jedisct1/libsodium/releases/tag/1.0.22-RELEASE)
- [libsodium encrypted streams and file encryption](https://doc.libsodium.org/secret-key_cryptography/secretstream)
- [libsodium Argon2id password hashing](https://doc.libsodium.org/password_hashing/default_phf)
- [react-native-quick-crypto](https://github.com/margelo/react-native-quick-crypto)
- [Serenity react-native-libsodium](https://github.com/serenity-kit/react-native-libsodium)
- [sodium-react-native-direct](https://github.com/synonymdev/sodium-react-native)

The main gate command intentionally exits nonzero today. Its focused unit test
proves both the complete synthetic acceptance case and rejection of missing,
outdated, blocking, or incomplete evidence.

The first provider spike now pins the official libsodium 1.0.22 source archive
and its published SHA-256 digest. A native host harness builds the minimal
static library from that verified source and proves Argon2id13 plus bounded
XChaCha20-Poly1305 secretstream round-trip behavior, final-tag enforcement, and
wrong-password, corruption, truncation, and reordering rejection. It uses only
synthetic bytes, clears sensitive native buffers before exit, writes no
plaintext file, and emits only non-secret assertion metadata. This narrows the
algorithm and supply-chain risk; it does not approve the provider for customer
data because equivalent isolated iOS and Android new-architecture modules and
device evidence are still required.

The Android artifact checkpoint now also rebuilds the pinned source with the
project NDK and `minSdk` 24 by using libsodium's official AAR build. The
fail-closed verifier requires all four supported ABIs (`arm64-v8a`,
`armeabi-v7a`, `x86`, and `x86_64`), all four Prefab modules, and exported
Argon2id, secretstream, secure-random, and secure-memory-clear symbols in every
full shared library. The clean run used NDK 27.1.12297006, verified 1,330 AAR
entries and a 2,654,317-byte artifact, then deleted the temporary source and
artifact. This proves Android packaging feasibility only; it does not add the
AAR to the app or approve customer-data use before the TurboModule and device
failure suites pass.

The matching iOS checkpoint rebuilds the pinned source as a minimal static
library for iOS arm64 devices and arm64/x86_64 simulators, then packages those
slices with headers and a module map in a temporary XCFramework. Xcode 26.4.1
produced both required platform entries at the app's iOS 15.1 deployment floor,
and every slice exported the same four selected primitives. The verifier
deletes the XCFramework and extracted source after inspection. This proves
Apple packaging feasibility only; no framework is linked into Journal by siFia
and no customer data can reach it.

The next boundary is now codegen-verified without expanding data access. A
React Native 0.88.1 TurboModule contract named `JournalArchiveCrypto` exposes
only provider evidence and a synthetic self-test. Automated checks forbid
encrypt/decrypt file methods and customer path/data identifiers, require the
reviewed Android/iOS codegen mapping, and validate the generated Android
Java/JNI and iOS Objective-C++/JSI surfaces in a disposable directory. The app
does not import or register an implementation yet. Native implementations,
off-JavaScript-thread execution, device failure tests, and cross-platform
vectors remain mandatory before the provider gate can open.

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
| B | Crypto/database spike | Cross-platform native test vectors, crash/disk-full tests, dependency review, no plaintext artifacts | Conditional: runtime, forced-interruption recovery, disk-full rollback, and raw-file checks passed; production adoption is blocked by the current native dependency graph |
| C | Transactional local migration | Restartable count/hash/reference verified migration and rollback on iOS/Android | Not started |
| D | Managed media | Photo/voice bytes survive restart/export/restore; missing legacy URI is disclosed | Not started |
| E | Free encrypted export/restore | Clean-device iOS/Android restore; wrong key/corruption/interruption/disk-full leave existing data intact | Not started |
| F | Device/recovery enrollment | Trusted-device and recovery-code paths proven; password-only recovery denied | Not started |
| G | Paid encrypted upload/snapshots | Entitlement enforced server-side; resumable upload, quota, commit, versions, expiry/retrieval proven | Not started |
| H | Operational recovery/security release | Isolated DR drill, deletion non-resurrection, independent findings resolved, staged rollout/kill switch | Not started |

## Synthetic encrypted-database spike checkpoint — 2026-11-17

The first database candidate is OP-SQLite 19.0.5 compiled with SQLCipher. The
probe uses a separate `journal-cloud-storage-spike-v1.sqlite` database and 32
random bytes encoded as a 64-character secret, held through the platform
Keychain/Keystore boundary.
The key is device-only, cloud synchronization is disabled, malformed stored
keys fail closed, and neither the probe nor its database is connected to app
startup or any customer journal read/write path.

Prepared runtime assertions verify that SQLCipher is active, a transaction
rollback leaves no row, a committed synthetic row survives close/reopen, and a
wrong key cannot read the database. Focused key-generation/reuse/fail-closed
tests pass. Android builds with SQLCipher enabled, and CocoaPods resolves the
SQLCipher/OpenSSL native graph. These are integration checks, not device
runtime evidence and not approval to migrate live records.

The iOS development diagnostic passed the initial four runtime assertions on
2026-11-17 using SQLCipher 4.19.0 Community. The Android development diagnostic
passed the same assertions on 2026-11-18 using SQLCipher 4.19.0. Both platforms
then passed a deterministic simulated-disk-full transaction: the constrained
write failed, the committed baseline remained readable, and no partial row was
left behind.

The raw 12,288-byte synthetic database from each app sandbox was copied to a
temporary audit directory on 2026-11-18. Binary inspection found neither the
known `synthetic-only-no-customer-data` probe text nor the standard
`SQLite format 3` header in either platform file. Their first 16 bytes and
SHA-256 hashes also differed, as expected for separately encrypted files. This
is evidence for this controlled fixture only; it is not yet evidence that every
future journal field, attachment, log, cache, or export is plaintext-free.

On 2026-11-18, each development app committed a synthetic baseline, opened a
second transaction, inserted a different synthetic row, and intentionally left
that transaction unresolved. Android was force-stopped and iOS was terminated
through the simulator while the transaction remained open. After a cold
relaunch, `PRAGMA integrity_check` returned `ok` on both platforms, the
committed baseline remained intact, and the interrupted row was absent. This
proves recovery for the controlled process-termination fixture; abrupt device
power loss and filesystem/hardware faults remain platform risks rather than a
claim this app can eliminate. The dependency/security review and its blocking
production decision follow.

## Dependency and supply-chain review — 2026-11-18

Decision: **retain OP-SQLite/SQLCipher only as a synthetic development
candidate; do not migrate or open customer journal data with this dependency
graph.** A production migration prototype may begin only after the blocking
native dependency is upgraded or a replacement candidate passes the same
cross-platform tests.

Evidence and findings:

- `@op-engineering/op-sqlite` is exactly pinned to `19.0.5`, and
  `react-native-keychain` is exactly pinned to `11.0.0`. Their npm tarball
  integrity hashes are committed in `package-lock.json`; both packages declare
  the MIT license. OP-SQLite 19.0.5 is the current npm release as of this
  review.
- The installed OP-SQLite version is newer than its published moderate
  commit/rollback-hook use-after-free advisory's patched version, 18.2.4. The
  spike does not register those hooks, but the patched version remains a hard
  minimum.
- The binding supplies the secret through `sqlite3_key_v2` with an explicit
  length, not through `PRAGMA key` SQL. The spike generates 32 random bytes and
  stores their 64-character lowercase hexadecimal representation in the
  device-only Keychain/Keystore boundary. SQLCipher receives those 64 ASCII
  characters as high-entropy passphrase material and applies its KDF; this is
  not SQLCipher's raw-key `x'...'` form. No code or documentation should call
  it a raw 32-byte database key.
- Both native runtimes report SQLCipher 4.19.0 Community. SQLCipher 4.20.0 is
  available, so 4.19.0 is recent but not current. Major-version upgrades and
  any change to cipher defaults require explicit database-compatibility and
  migration tests before rollout.
- The decisive blocker is the cryptographic provider: Android declares
  `io.github.ronickg:openssl:3.6.2-3`, while the iOS lockfile resolves
  `OpenSSL-Universal 3.6.2000`. OpenSSL 3.6 has reached end of life, 3.6.5 was
  its later security patch, and additional advisories were published after
  3.6.2. This does not prove every advisory is reachable through SQLCipher on
  these mobile targets, but an unsupported provider is not acceptable for a
  new encrypted customer-data store.
- OP-SQLite has a published advisory but no repository `SECURITY.md`. That is a
  governance risk rather than proof of an active defect in 19.0.5. Production
  approval requires a documented monitoring and response owner, not reliance
  on package popularity alone.
- The initial `npm audit --omit=dev` pass reported 21 production dependency
  findings: 1 low, 8 moderate, and 12 high. Two deliberately narrow updates
  now pin `uuid` 11.1.1 and `expensify-common` 2.0.207. The latter also fixes
  the installed peer mismatch with `@expensify/react-native-live-markdown` and
  moves its Lodash dependency beyond the reported vulnerable range. The
  repeat audit reports 18 findings: 1 low, 7 moderate, and 10 high, with no
  critical findings. None is attributed directly to OP-SQLite or
  react-native-keychain.
- The remaining audit set includes user-content Markdown parsing, navigation
  query parsing, Sentry/build tooling, APNs token-generation tooling, and
  other transitive dependencies. Markdown and navigation are app-reachable
  and require isolated compatibility upgrades and regression tests. The
  `jsonwebtoken` finding is currently reached only by local APNs token scripts,
  not by the shipped React Native application, but it still remains a release
  tooling fix. No automatic `npm audit fix` was run because its proposed
  changes include unrelated or backward dependency moves.

Production re-entry gate:

1. OP-SQLite must package a supported OpenSSL release, or a replacement
   encrypted database binding must be selected.
2. Re-run iOS and Android activation, rollback, reopen, wrong-key, disk-full,
   forced-interruption, raw-file, and release-build tests on the exact upgraded
   graph.
3. Wire the automated dependency advisory check into release CI when an
   approved graph exists, and establish a scheduled review of OP-SQLite,
   SQLCipher, OpenSSL, and react-native-keychain. The current command is
   expected to fail closed while OpenSSL 3.6 remains installed.
4. Triage the repository-wide production audit findings; resolve or document
   non-reachability and compensating controls before release approval.
5. Require an independent mobile security review before marketing the vault as
   end-to-end encrypted.

### Production candidate decision matrix

| Candidate | Current evidence | Main risk | Decision |
| --- | --- | --- | --- |
| OP-SQLite 19.0.5 with its packaged SQLCipher graph | Exact app integration and all synthetic runtime tests passed on iOS and Android | Its resolved OpenSSL 3.6 provider is end-of-life | Keep only as the development control; do not open customer data |
| A future OP-SQLite release with a supported cryptographic provider | Lowest migration and API-change cost if upstream publishes one | Availability and security-response timing are outside siFia's control | Preferred re-test path when an eligible release exists |
| A maintained internal OP-SQLite/OpenSSL fork | Could preserve the tested API while selecting a supported provider | siFia would own native crypto patching, reproducible builds, advisories, and ABI testing | Do not choose unless upstream cannot provide a supported build and an independent reviewer approves the maintenance plan |
| Expo SQLite with SQLCipher | Official Expo documentation supports SQLCipher configuration | This is a bare React Native 0.88 app with no Expo runtime; adoption would add Expo Modules and a second native database graph that still needs a provider audit | Deferred unless OP-SQLite cannot supply an eligible build; no production approval |
| Realm community database | Encrypted local database capability exists independently of Atlas Device Sync | The former Atlas Device SDKs reached end-of-life and the database now depends on community branches/governance | Not preferred for this launch |

The current recommendation is to keep the proven OP-SQLite test harness as a
behavioral control and prototype the least disruptive eligible provider in an
isolated build. No dependency swap may be merged merely because it compiles:
it must identify the packaged native provider and pass every production
re-entry check above.

The repository now includes `npm run security:journal-storage`, a fail-closed
static gate that checks exact OP-SQLite pinning, package-lock integrity, the
patched advisory floor, SQLCipher configuration, and the resolved iOS and
Android OpenSSL branches. Its four unit tests pass. Against the current graph,
the command exits non-zero and identifies iOS `3.6.2000` and Android
`3.6.2-3` as unapproved. The approved branch allowlist currently contains only
OpenSSL 3.5 LTS; any future branch must be deliberately reviewed before it is
added. This static gate complements rather than replaces device runtime,
release-build, binary, and migration testing.

The npm registry was rechecked on 2026-11-18. OP-SQLite 19.0.5 remains the
latest published release, so there is no newer upstream candidate to install
or re-test yet.

## Native provider compatibility check on 2026-11-20

SQLCipher 4.19.0 community from OP-SQLite 19.0.5 successfully read and updated encrypted fixtures on the arm64 iPhone simulator and Pixel 8 emulator using OpenSSL 3.5.9 LTS. The original provider also read the updated files. This establishes file compatibility for the tested configuration. Customer migration still requires evidence from release builds.

### Reproduce the native test

1. Use the locked OP-SQLite source at `node_modules/@op-engineering/op-sqlite/cpp/sqlcipher`. For the candidate, verify the OpenSSL 3.5.9 source tarball against SHA-256 `603f5602e2eef00d77fbd429d34dcd5822bb301757a1bc9cdb24c670f1eb859a`. [Official OpenSSL source releases](https://www.openssl-library.org/source/)
2. Configure OpenSSL in a separate build directory per target. Use `iossimulator-arm64-xcrun -mios-simulator-version-min=15.1` or `android-arm64 -D__ANDROID_API__=24` with NDK 27.1.12297006. Use `no-shared no-tests no-module` for both. Build generated headers with `make build_generated`, then build `libcrypto.a`.
3. Compile [the fixture program](../scripts/journal-storage-provider-compatibility.c) together with the pinned `sqlite3.c` for each target and provider. Define `SQLITE_HAS_CODEC`, `SQLITE_TEMP_STORE=3`, `SQLITE_EXTRA_INIT=sqlcipher_extra_init` and `SQLITE_EXTRA_SHUTDOWN=sqlcipher_extra_shutdown`. Also define `HAVE_FULLFSYNC=1` on iOS. Link the baseline against the installed OpenSSL-Universal 3.6.2000 simulator framework or the arm64 crypto library in the Android 3.6.2-3 AAR. For the candidate, include the generated and source OpenSSL headers and link its static crypto library, plus Security.framework on iOS or `-lm -ldl -llog` on Android.
4. On each device, use a fresh test directory. Each invocation takes a mode, the expected runtime provider string and that directory. Run the four invocations below in sequence, launching a fresh process each time.

| Executable | Mode | Expected runtime provider | Evidence |
| --- | --- | --- | --- |
| Baseline | `create` | `OpenSSL 3.6.2 7 Apr 2026` | New encrypted database with one synthetic caption |
| Candidate | `update` | `OpenSSL 3.5.9 29 Sep 2026` | Original caption readable, rollback preserved it, committed edit saved |
| Candidate | `reopen` | `OpenSSL 3.5.9 29 Sep 2026` | Saved edit survived process exit |
| Baseline | `reopen` | `OpenSSL 3.6.2 7 Apr 2026` | Previous provider read the candidate’s edit |

Both platforms passed all four checks, including the runtime SQLCipher/provider versions and database integrity. Every update and reopen first rejected the wrong key. After both files closed, each platform’s candidate reopened the other’s file. Neither raw fixture showed the SQLite header or the known caption string. The five separate backup/restore integration tests and four dependency-gate unit tests passed.

### Test the provider inside the Journal release package

Use a disposable checkout and a clean simulator or emulator with the normal application ID, `app.journal.sifia`. In the checkout, copy [the release test entry](../scripts/fixtures/journalStorageReleaseProbe.js) to `index.js`. It registers the Journal React Native component, creates a synthetic encrypted database through OP-SQLite, and shows the observed versions and result on screen. Keep this entry out of store builds. The fixture uses a public test key.

| Target | Isolated build configuration | Packaged evidence to inspect |
| --- | --- | --- |
| Android arm64 | In OP-SQLite’s temporary Gradle project remove the OpenSSL Maven dependency. In its CMake file replace the OpenSSL package lookup with an imported static `openssl::crypto` pointing to the tested arm64 archive and its generated and source headers. Link with `-Wl,--exclude-libs,libcrypto.a`. Build `:app:assemblePlayRelease` with both the ABI filter and `reactNativeArchitectures` set to `arm64-v8a`. Sign the test APK with the local debug key. | Extract `lib/arm64-v8a/libop-sqlite.so` from the APK. Use the NDK’s `llvm-readelf --needed-libs` to check its dynamic dependencies and check the binary for the candidate version. |
| iOS arm64 simulator | In the temporary CocoaPods sandbox, link the tested simulator `libcrypto.a` into the simulator slice of `OpenSSL.framework/OpenSSL` using `xcrun --sdk iphonesimulator clang -target arm64-apple-ios15.1-simulator -dynamiclib -Wl,-install_name,@rpath/OpenSSL.framework/OpenSSL -Wl,-force_load,<archive> -framework Security`. Overlay the candidate’s public and generated headers. Build the Journal workspace and scheme in Release for the arm64 simulator. | Use `otool -L` on the packaged Journal executable and inspect the embedded framework. This simulator-only framework exercises SQLCipher’s crypto calls. The other XCFramework slices still need independent builds. |

Install the package on an empty test device. On first launch, expect `created`, SQLCipher `4.19.0 community` and `OpenSSL 3.5.9 29 Sep 2026`. Terminate the app process and launch again. Expect `reopened` with the same versions. The second pass reads the value written on the first launch. An unexpected provider version or missing value fails the test.

Both arm64 packages passed on 2026-11-20. A fresh iOS 26.3 simulator and Android API 35 emulator each returned `created` and then `reopened` with the pinned versions. The iOS app bundle linked its embedded OpenSSL framework. The Android APK carried the candidate version in `libop-sqlite.so` and its dependency list had no dynamic OpenSSL dependency. The normal app entry point and dependency locks still use the shipping configuration.

## Immediate next implementation step

Prepare reproducible provider artifacts for iOS devices and the remaining Android architectures. Inspect the distribution binaries and repeat the save/reopen test on physical hardware before adopting the dependency or migrating customer photos. The current shipping configuration still links the 3.6 provider and the production dependency check rejects it. No user action or manual Supabase SQL is required to prepare the artifacts.

## Primary references

- [Apple: restricting Keychain item accessibility](https://developer.apple.com/documentation/Security/restricting-keychain-item-accessibility)
- [Apple: `kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly`](https://developer.apple.com/documentation/security/ksecattraccessiblewhenpasscodesetthisdeviceonly)
- [Android Keystore system](https://developer.android.com/privacy-and-security/keystore)
- [OP-SQLite npm versions](https://www.npmjs.com/package/%40op-engineering/op-sqlite?activeTab=versions)
- [OP-SQLite security advisory GHSA-jmwq-c3hg-34pw](https://github.com/OP-Engineering/op-sqlite/security/advisories/GHSA-jmwq-c3hg-34pw)
- [OP-SQLite security policy status](https://github.com/OP-Engineering/op-sqlite/security)
- [OP-SQLite SQLCipher installation configuration](https://op-engineering.github.io/op-sqlite/docs/installation/)
- [SQLCipher changelog](https://github.com/sqlcipher/sqlcipher/blob/master/CHANGELOG.md)
- [Expo SQLite SQLCipher configuration](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- [MongoDB Atlas Device SDK deprecation](https://www.mongodb.com/docs/device-sdks-deprecation/)
- [OpenSSL 3.6 release notes](https://openssl-library.org/news/openssl-3.6-notes/)
- [OpenSSL 3.4 and 3.6 end-of-life notice](https://openssl-library.org/post/2026-11-01-eol34-36/)
- [OpenSSL security advisory timeline](https://openssl-library.org/news/timeline/)
- [libsodium encrypted streams and file encryption](https://doc.libsodium.org/secret-key_cryptography/secretstream)
- [libsodium password hashing/key derivation](https://doc.libsodium.org/password_hashing/default_phf)
- [Supabase resumable Storage uploads](https://supabase.com/docs/guides/storage/uploads/resumable-uploads)
- [Supabase database backups](https://supabase.com/docs/guides/platform/backups)
- [OWASP MASVS Storage controls](https://mas.owasp.org/MASVS/05-MASVS-STORAGE/)
