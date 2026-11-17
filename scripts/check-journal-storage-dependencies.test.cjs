const assert = require('node:assert/strict');
const test = require('node:test');

const {
  assessJournalStorageGraph,
  compareVersions,
  openSslBranch,
} = require('./check-journal-storage-dependencies.cjs');

const approvedGraph = {
  sqlcipherEnabled: true,
  opSqliteVersion: '19.0.5',
  opSqliteIntegrity: 'sha512-synthetic-test-integrity',
  iosOpenSslVersion: '3.5.5000',
  androidOpenSslVersion: '3.5.5-1',
};

test('compares semantic versions and identifies OpenSSL branches', () => {
  assert.equal(compareVersions('18.2.3', '18.2.4'), -1);
  assert.equal(compareVersions('18.2.4', '18.2.4'), 0);
  assert.equal(compareVersions('19.0.5', '18.2.4'), 1);
  assert.equal(openSslBranch('3.5.5000'), '3.5');
  assert.equal(openSslBranch('invalid'), null);
});

test('approves only an explicitly reviewed dependency graph', () => {
  const result = assessJournalStorageGraph(approvedGraph);
  assert.equal(result.approved, true);
  assert.deepEqual(result.failures, []);
});

test('rejects the current end-of-life OpenSSL branch', () => {
  const result = assessJournalStorageGraph({
    ...approvedGraph,
    iosOpenSslVersion: '3.6.2000',
    androidOpenSslVersion: '3.6.2-3',
  });
  assert.equal(result.approved, false);
  assert.equal(result.failures.length, 2);
  assert.match(result.failures[0], /iOS OpenSSL 3\.6\.2000/);
  assert.match(result.failures[1], /Android OpenSSL 3\.6\.2-3/);
});

test('rejects an unpinned or vulnerable OP-SQLite dependency', () => {
  const result = assessJournalStorageGraph({
    ...approvedGraph,
    opSqliteVersion: '^18.2.3',
    opSqliteIntegrity: '',
  });
  assert.equal(result.approved, false);
  assert.equal(result.failures.length, 2);
  assert.match(result.failures[0], /exact semantic version/);
  assert.match(result.failures[1], /sha512 integrity/);
});
