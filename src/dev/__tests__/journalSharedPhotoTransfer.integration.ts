import {createHash, randomUUID} from 'node:crypto';
import {planInventorySample} from '../journalStagedBackup';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, copyFileSync, readFileSync, rmSync, writeFileSync, readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import archive from '../../native/NativeJournalArchiveCrypto';
import {applySharedPhotoTransfer, prepareSampleComparison, previewSampleRevision, restoreComparedSampleOnce, verifySharedPhotoTransfer} from '../journalSharedPhotoTransferProbe';
import {openRestoreSession} from '../journalRestoreDatabase';
import {connect} from './restoreTestDatabase';

jest.mock('../../native/NativeJournalArchiveCrypto', () => ({
  importSharedPhotoTransfer: jest.fn(), verifyTransferredPhotos: jest.fn(), checkRestoredPhotos: jest.fn(),
}));
jest.mock('../../services/journalEncryptedStorageSpike', () => ({}));
jest.mock('uuid', () => ({v4: jest.requireActual('node:crypto').randomUUID}));
jest.mock('@op-engineering/op-sqlite', () => ({}));

it('restores both entries from one encrypted file and rejects a damaged second photo before changing the journal', async () => {
  const {JOURNAL_TRANSFER_HOST: host} = process.env;
  if (!host) {throw new Error('Set JOURNAL_TRANSFER_HOST to the compiled transfer diagnostic');}
  const root = mkdtempSync(join(tmpdir(), 'journal-shared-transfer-'));
  const source = join(root, 'source'), target = join(root, 'target');
  mkdirSync(source);
  mkdirSync(target);
  const file = 'journal-shared-transfer-test.bin';
  const dbFile = join(target, 'journal.sqlite');
  const run = (args: string[], input?: Buffer) => execFileSync(host, args, {
    input, maxBuffer: 8 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'],
  });
  jest.mocked(archive.importSharedPhotoTransfer).mockImplementation(async () => run(['--read-shared', target]).toString());
  jest.mocked(archive.verifyTransferredPhotos).mockImplementation(async (...args) => {
    run(['--verify-pair', target, ...args]);
    return true;
  });
  let db = connect(dbFile);
  try {
    const token = run(['--export-shared', source]).toString().trim();
    expect(readdirSync(source)).toEqual([file]);
    copyFileSync(join(source, file), join(target, file));
    rmSync(source, {recursive: true});
    const destination = join(target, file);
    const ciphertext = readFileSync(destination);
    expect(ciphertext.includes(token)).toBe(false);
    let session = await openRestoreSession(db);
    const expected = await applySharedPhotoTransfer(session);
    const compareTarget = join(root, 'compare');
    mkdirSync(compareTarget);
    copyFileSync(destination, join(compareTarget, file));
    let existing = connect(join(compareTarget, 'existing.sqlite'));
    try {
      const comparison = await prepareSampleComparison(existing, 'Call Mom.');
      const existingSession = await openRestoreSession(existing);
      const snapshot = () => existing.execute('SELECT k,v FROM restore_kv ORDER BY k');
      const original = await snapshot();
      const transfer = JSON.parse(run(['--read-shared', compareTarget]).toString());
      const [one, two] = transfer.stagedPhotos;
      expect(transfer.stagedPhotos).toHaveLength(2);
      for (const invalid of [[one], [one, one], [one, {...two, file: one.file}],
        [one, {...two, byteLength: 0}], [one, {...two, sha256: '0'.repeat(64)}]]) {
        await expect(applySharedPhotoTransfer(existingSession,
          JSON.stringify({...transfer, stagedPhotos: invalid}), comparison)).rejects.toThrow();
        expect(await snapshot()).toEqual(original);
      }
      const document = JSON.stringify({...transfer, stagedPhotos: [two, one]});
      await expect(applySharedPhotoTransfer(existingSession, document, {...comparison, backupText: 'Older preview'}))
        .rejects.toThrow('no longer matches');
      expect(await snapshot()).toEqual(original);
      const indexKey = 'journal_local_index:todo:2026-11-19';
      const originalIndex = await existingSession.read(indexKey);
      if (originalIndex === null) {throw new Error('Expected the seeded sample index');}
      await existing.execute('UPDATE restore_kv SET v=? WHERE k=?', ['["device-only","first","unexpected"]', indexKey]);
      const changedIndex = await snapshot();
      await expect(applySharedPhotoTransfer(existingSession, document, comparison)).rejects.toThrow('changed during preview');
      expect(await snapshot()).toEqual(changedIndex);
      await existing.execute('UPDATE restore_kv SET v=? WHERE k=?', [originalIndex, indexKey]);
      await existing.execute('INSERT INTO restore_kv (k,v) VALUES (?,?)', ['journal:local-profile', '{}']);
      const withProfile = await snapshot();
      await expect(applySharedPhotoTransfer(existingSession, document, comparison)).rejects.toThrow('Unexpected sample journal');
      expect(await snapshot()).toEqual(withProfile);
      await existing.execute('DELETE FROM restore_kv WHERE k=?', ['journal:local-profile']);
      const {archiveDigest} = JSON.parse(document);
      await existing.execute('CREATE TABLE sample_restore_receipts (digest TEXT PRIMARY KEY NOT NULL)');
      await existing.execute("CREATE TEMP TRIGGER fail_receipt BEFORE INSERT ON sample_restore_receipts BEGIN SELECT RAISE(ABORT, 'simulated write failure'); END");
      await expect(restoreComparedSampleOnce(existing, document, comparison, archiveDigest)).rejects.toThrow('simulated write failure');
      expect(await snapshot()).toEqual(original);
      expect((await existing.execute('SELECT * FROM sample_restore_receipts')).rows).toHaveLength(0);
      await existing.execute('DROP TRIGGER fail_receipt');
      const kept = await restoreComparedSampleOnce(existing, document, comparison, archiveDigest);
      if (!kept) {throw new Error('Expected a first import');}
      expect(kept.entries[0].id).not.toBe('first');
      existing.close();
      existing = connect(join(compareTarget, 'existing.sqlite'));
      jest.mocked(archive.verifyTransferredPhotos).mockImplementationOnce(async (...args) => {
        run(['--verify-pair', compareTarget, ...args]);
        return true;
      });
      expect(await verifySharedPhotoTransfer(await openRestoreSession(existing), kept)).toBe(token);
      const restoredCopy = kept.entries[0];
      await existing.execute('UPDATE restore_kv SET v=? WHERE k=?', [
        JSON.stringify({...restoredCopy, content: 'Edited after the restore.'}),
        'journal_local:todo:2026-11-19:' + restoredCopy.id,
      ]);
      const edited = await snapshot();
      await expect(restoreComparedSampleOnce(existing, document, comparison, archiveDigest)).resolves.toBeNull();
      expect(await snapshot()).toEqual(edited);
      expect((await existing.execute('SELECT digest FROM sample_restore_receipts')).rows).toEqual([{digest: archiveDigest}]);
      const revision = JSON.parse(run(['--export-revision', destination, join(compareTarget, 'newer.bin')]).toString());
      expect(revision.baseDigest).toBe(archiveDigest);
      expect(revision.archiveDigest).not.toBe(archiveDigest);
      expect(revision.firstContent).toBe('Call Mom on Sunday.');
      const imageDir = join(compareTarget, 'journal-shared-transfer-images');
      const savedPhotos = readdirSync(imageDir).sort();
      const files = kept.entries[0].metadata!.journalBlocks!.map((block: {kind: string; uri: string}) => block.kind === 'photo' && block.uri.slice(8));
      jest.mocked(archive.checkRestoredPhotos).mockImplementation(async (...args) => {
        run(['--check-pair', compareTarget, ...args]);
        return true;
      });
      await expect(previewSampleRevision(existing, {...revision, baseDigest: '0'.repeat(64)}, kept)).rejects.toThrow('matching original');
      const review = await previewSampleRevision(existing, revision, kept);
      expect(review.deviceText).toBe('Call Mom after dinner.');
      expect(await snapshot()).toEqual(edited);
      const deviceKey = 'journal_local:todo:2026-11-19:first';
      const device = JSON.parse((await (await openRestoreSession(existing)).read(deviceKey))!);
      const newDevice = JSON.stringify({...device, content: 'I called Mom today.'});
      await existing.execute('UPDATE restore_kv SET v=? WHERE k=?', [newDevice, deviceKey]);
      const afterEdit = await snapshot();
      await expect(review.keepBoth()).rejects.toThrow('changed during preview');
      expect(await snapshot()).toEqual(afterEdit);
      const fresh = await previewSampleRevision(existing, revision, kept);
      expect(fresh.deviceText).toBe('I called Mom today.');
      const unrelatedPhoto = join(imageDir, 'photo-' + 'a'.repeat(32));
      writeFileSync(unrelatedPhoto, 'another practice session', {flag: 'wx'});
      await existing.execute("CREATE TEMP TRIGGER fail_revision BEFORE INSERT ON sample_restore_receipts BEGIN SELECT RAISE(ABORT, 'simulated revision failure'); END");
      await expect(fresh.keepBoth()).rejects.toThrow('simulated revision failure');
      expect(await snapshot()).toEqual(afterEdit);
      await existing.execute('DROP TRIGGER fail_revision');
      await fresh.keepBoth();
      await fresh.keepBoth();
      expect(readFileSync(unrelatedPhoto, 'utf8')).toBe('another practice session');
      rmSync(unrelatedPhoto);
      existing.close();
      existing = connect(join(compareTarget, 'existing.sqlite'));
      const final = await snapshot();
      for (const row of afterEdit.rows.filter(r => r.k !== indexKey)) {expect(final.rows).toContainEqual(row);}
      const ids: string[] = JSON.parse(final.rows.find(r => r.k === indexKey)!.v as string);
      expect(ids).toHaveLength(5);
      const copy = final.rows.map(r => JSON.parse(r.v as string)).find(e => e.content === revision.firstContent);
      expect(ids).toContain(copy.id);
      expect(copy.updated_at).toBe(revision.updatedAt);
      expect(copy.metadata.journalBlocks.map((b: {uri: string}) => b.uri.slice(8))).toEqual(files);
      expect(readdirSync(imageDir).sort()).toEqual(savedPhotos);
      expect((await existing.execute('SELECT digest FROM sample_restore_receipts')).rows).toHaveLength(2);
      let revisedFile: string | undefined;
      for (const change of ['added', 'replaced'] as const) {
        const path = join(compareTarget, change + '.bin');
        const photoRevision = JSON.parse(run(['--export-revision', destination, path, change]).toString());
        expect(photoRevision).toMatchObject({baseDigest: archiveDigest, photoChange: change, photos: change === 'added' ? 3 : 2});
        const previous = await snapshot();
        const previousFiles = readdirSync(imageDir).sort();
        const reviewPhoto = await previewSampleRevision(existing, photoRevision, kept);
        expect(readdirSync(imageDir).sort()).toEqual(previousFiles);
        expect(await snapshot()).toEqual(previous);
        const stage = jest.fn(async () => {
          const staged = JSON.parse(run(['--confirm-photo-revision', compareTarget, path]).toString());
          expect(staged.stagedPhotos).toHaveLength(change === 'added' ? 3 : 2);
          expect(staged.stagedPhotos).toContainEqual(one);
          if (change === 'added') {expect(staged.stagedPhotos).toContainEqual(two);}
          else {expect(staged.stagedPhotos).not.toContainEqual(two);}
          return JSON.stringify({...staged, stagedPhotos: staged.stagedPhotos.reverse()});
        });
        await existing.execute("CREATE TEMP TRIGGER fail_photo BEFORE INSERT ON sample_restore_receipts BEGIN SELECT RAISE(ABORT, 'interrupted photo restore'); END");
        await expect(reviewPhoto.keepBoth(stage)).rejects.toThrow('interrupted photo restore');
        expect(await snapshot()).toEqual(previous);
        await existing.execute('DROP TRIGGER fail_photo');
        const stagedFiles = readdirSync(imageDir).sort();
        expect(stagedFiles).toHaveLength(3);
        const newFile = stagedFiles.find(name => !savedPhotos.includes(name))!;
        const sealedPhoto = readFileSync(join(imageDir, newFile));
        if (change === 'added') {
          const damaged = Buffer.from(sealedPhoto);
          damaged[damaged.length - 1] ^= 1;
          writeFileSync(join(imageDir, newFile), damaged);
          await expect(reviewPhoto.keepBoth(stage)).rejects.toThrow();
          expect(await snapshot()).toEqual(previous);
          expect(readFileSync(join(imageDir, newFile)).equals(damaged)).toBe(true);
          writeFileSync(join(imageDir, newFile), sealedPhoto);
        }
        if (revisedFile) {expect(newFile).toBe(revisedFile);}
        revisedFile = newFile;
        await reviewPhoto.keepBoth(stage);
        stage.mockClear();
        await reviewPhoto.keepBoth(stage);
        expect(stage).not.toHaveBeenCalled();
        existing.close();
        existing = connect(join(compareTarget, 'existing.sqlite'));
        const after = await snapshot();
        for (const row of previous.rows.filter(r => r.k !== indexKey)) {expect(after.rows).toContainEqual(row);}
        const added = after.rows.filter(row => !previous.rows.some(old => row.k === old.k));
        expect(added).toHaveLength(1);
        const entry = JSON.parse(added[0].v as string);
        const index = JSON.parse(after.rows.find(row => row.k === indexKey)!.v as string);
        expect(index).toContain(entry.id);
        expect(entry.metadata.journalBlocks.map((b: {uri: string}) => b.uri.slice(8))).toEqual(
          change === 'added' ? [...files, newFile] : [files[0], newFile]);
        expect(readdirSync(imageDir).sort()).toEqual(stagedFiles);
        expect(readFileSync(join(imageDir, newFile)).equals(sealedPhoto)).toBe(true);
      }
    } finally {
      existing.close();
    }
    jest.mocked(archive.verifyTransferredPhotos).mockImplementation(async (...args) => {
      run(['--verify-pair', target, ...args]);
      return true;
    });
    rmSync(destination);
    db.close();
    db = connect(dbFile);
    session = await openRestoreSession(db);
    expect(await verifySharedPhotoTransfer(session, expected)).toBe(token);
    const before = await db.execute('SELECT k,v FROM restore_kv ORDER BY k');
    const imageDir = join(target, 'journal-shared-transfer-images');
    const originalFiles = readdirSync(imageDir).sort();
    expect(originalFiles.length).toBe(2);
    const payload = run(['--open-photo'], ciphertext);
    const last = payload.length - 1;
    payload[last] = (payload[last] + 1) % 256;
    for (const damaged of [ciphertext.subarray(0, -64), run(['--seal-photo'], payload)]) {
      writeFileSync(destination, damaged);
      await expect(applySharedPhotoTransfer(session)).rejects.toThrow();
      expect(await db.execute('SELECT k,v FROM restore_kv ORDER BY k')).toEqual(before);
      expect(readdirSync(imageDir).sort()).toEqual(originalFiles);
      expect(await verifySharedPhotoTransfer(session, expected)).toBe(token);
    }
  } finally {
    db.close();
    rmSync(root, {recursive: true, force: true});
  }
}, 90000);

it('previews and restores the contents declared by variable-size practice archives', async () => {
  const host = process.env.JOURNAL_TRANSFER_HOST;
  if (!host) {throw new Error('Set JOURNAL_TRANSFER_HOST to the compiled transfer diagnostic');}
  const root = mkdtempSync(join(tmpdir(), 'journal-variable-inventory-'));
  const run = (args: string[], input?: Buffer) => execFileSync(host, args, {
    input, maxBuffer: 8 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'],
  });
  const word = (value: number) => {
    const bytes = Buffer.alloc(4);
    bytes.writeUInt32BE(value);
    return bytes;
  };
  try {
    const token = run(['--export-shared', root]).toString().trim();
    const {manifest: template} = JSON.parse(run(['--read-shared', root]).toString());
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6ZLkAAAAASUVORK5CYII=', 'base64');
    for (const [entries, photos] of [[0, 0], [1, 0], [300, 3]]) {
      const dir = join(root, String(entries));
      mkdirSync(dir);
      const path = join(dir, 'encrypted.bin');
      const manifest = JSON.parse(JSON.stringify(template));
      const ids = Array.from({length: photos}, () => randomUUID());
      manifest.assets = ids.map(assetId => ({
        assetId, path: 'objects/' + assetId, kind: 'image', mediaType: 'image/png',
        byteLength: png.length, sha256: createHash('sha256').update(png).digest('hex'), ownerRecordId: 'r0',
      }));
      const inventory = manifest.backup.inventory;
      const original = inventory.journalRecords[0];
      inventory.journalRecords = Array.from({length: entries}, (_, i) => ({
        ...original, id: 'r' + i, content: 'Reflection 🪴 ' + i,
        metadata: {journalBlocks: (i === 0 ? ids : ids.slice(0, 1)).map(id => ({id, kind: 'photo', uri: 'objects/' + id}))},
      }));
      inventory.recordLocations.journalRecords = Array.from({length: entries}, (_, i) =>
        ({id: 'r' + i, key: 'journal_local:todo:2026-11-19:r' + i}));
      manifest.totals = {records: entries, assets: photos, assetBytes: photos * png.length};
      const json = Buffer.from(JSON.stringify(manifest));
      const frame = Buffer.concat([Buffer.from('JSV1' + token), word(json.length), word(photos), json,
        ...ids.flatMap(id => [Buffer.from(id), word(png.length), png])]);
      writeFileSync(path, run(['--seal-photo'], frame));
      const {inventory: evidence} = JSON.parse(run(['--preview-inventory', path]).toString());
      const preview = planInventorySample(JSON.stringify(evidence));
      expect(preview).toMatchObject({entries, photos, photoBytes: photos * png.length});
      expect(readdirSync(dir)).toEqual(['encrypted.bin']);
      if (!entries) {continue;}
      expect(() => planInventorySample(JSON.stringify({...evidence, inventoryManifestHex: 'ff'}))).toThrow();
      const restored = planInventorySample(run(['--confirm-inventory', dir, path]).toString());
      expect(restored).toEqual(preview);
      const dbPath = join(dir, 'restored.sqlite');
      let db = connect(dbPath);
      try {
        await (await openRestoreSession(db)).restore(restored.plan, randomUUID());
        db.close();
        db = connect(dbPath);
        const reopened = await openRestoreSession(db);
        expect(await reopened.preview(restored.plan)).toMatchObject({
          matchingKeys: restored.plan.operations.length, newKeys: 0, changedKeys: 0, localOnlyKeys: 0,
        });
        const last = JSON.parse((await reopened.read('journal_local:todo:2026-11-19:r' + (entries - 1)))!);
        expect(last.content).toBe('Reflection 🪴 ' + (entries - 1));
        if (photos) {
          expect(last.metadata.journalBlocks[0].uri).toBe('objects/' + evidence.stagedPhotos[0].file);
          expect(readdirSync(join(dir, 'journal-shared-transfer-images'))).toHaveLength(photos);
          const wrong = {...evidence.stagedPhotos[0], sha256: '0'.repeat(64)};
          expect(() => planInventorySample(JSON.stringify({...evidence, stagedPhotos: [wrong, ...evidence.stagedPhotos.slice(1)]}))).toThrow();
          for (const invalid of [frame.subarray(0, -1), Buffer.concat([frame, Buffer.alloc(1)])]) {
            writeFileSync(path, run(['--seal-photo'], invalid));
            expect(() => run(['--preview-inventory', path])).toThrow();
          }
        }
      } finally {db.close();}
    }
  } finally {rmSync(root, {recursive: true, force: true});}
}, 90000);

it('round-trips the variable-size export used by the mobile Files pickers', () => {
  const host = process.env.JOURNAL_TRANSFER_HOST;
  if (!host) {throw new Error('Set JOURNAL_TRANSFER_HOST to the compiled transfer diagnostic');}
  const root = mkdtempSync(join(tmpdir(), 'journal-picker-export-'));
  try {
    for (const entries of [0, 1, 2, 37, 300]) {
      const path = join(root, String(entries) + '.bin');
      const result = execFileSync(host, ['--export-inventory', path, String(entries)], {maxBuffer: 2 * 1024 * 1024});
      const restored = planInventorySample(result.toString());
      expect(restored.entries).toBe(entries);
      expect(restored.photos).toBe(entries >= 2 ? 3 : 0);
      expect(readFileSync(path).includes(Buffer.from('journalRecords'))).toBe(false);
    }
  } finally {rmSync(root, {recursive: true, force: true});}
}, 90000);
