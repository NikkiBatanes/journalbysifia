// Development fixture only. A fixed recovery code and payload shape make this
// unsuitable for customer archives. No caller-supplied paths or plaintext.
#pragma once
#include <sodium.h>
#include <algorithm>
#include <array>
#include <cerrno>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <fcntl.h>
#include <stdexcept>
#include <string>
#include <string_view>
#include <sys/stat.h>
#include <unistd.h>
#include <vector>

namespace journal_fixture {
using Bytes = std::vector<unsigned char>;
using Stream = crypto_secretstream_xchacha20poly1305_state;
constexpr auto fileName = "/journal-transfer-test.bin";
constexpr std::string_view magic = "JFIX0001";
constexpr auto password = "synthetic-correct-recovery-code";
constexpr size_t saltAt = magic.size();
constexpr size_t headerAt = saltAt + crypto_pwhash_SALTBYTES;
constexpr size_t cipherAt = headerAt + crypto_secretstream_xchacha20poly1305_HEADERBYTES;
constexpr size_t overhead = cipherAt + crypto_secretstream_xchacha20poly1305_ABYTES;

inline void require(bool ok) {
  if (!ok) throw std::runtime_error("Synthetic transfer fixture failed verification");
}

struct Crypto {
  std::array<unsigned char, crypto_secretstream_xchacha20poly1305_KEYBYTES> key{};
  Stream stream{};
  Crypto(const unsigned char *salt, const char *code) {
    require(crypto_pwhash(key.data(), key.size(), code, std::strlen(code), salt,
      crypto_pwhash_OPSLIMIT_INTERACTIVE, crypto_pwhash_MEMLIMIT_INTERACTIVE,
      crypto_pwhash_ALG_ARGON2ID13) == 0);
  }
  ~Crypto() {
    sodium_memzero(key.data(), key.size());
    sodium_memzero(&stream, sizeof(stream));
  }
};

// Compact JSON is used because manifest validation also verifies its byte count.
inline std::string manifest(const std::string &token) {
  const std::string integrity = R"({"counts":{},"tombstones":{"journalRecords":0,"reflectionRecords":0,"prayerRecords":0},"duplicateIds":[],"danglingReferences":[],"legacyOnlyRecords":{"reflectionLogs":0,"journalRecords":0}})";
  return std::string(R"({"format":"journal-by-sifia-portable-archive","archiveVersion":1,"appIdentifier":"app.journal.sifia","createdAt":"2026-11-19T00:00:00Z","snapshotId":"11782d26-36db-4cb1-ac77-45c3bcff9f09",)")
    + R"("backup":{"format":"journal-by-sifia-backup","appIdentifier":"app.journal.sifia","schemaVersion":1,"sensitive":true,"exportedAt":"2026-11-19T00:00:00Z",)"
    + R"("inventory":{"journalRecords":[{"id":"fixture","content_type":"todo","selected_date":"2026-11-19","created_at":"2026-11-19T00:00:00Z","updated_at":"2026-11-19T00:00:00Z","content":"synthetic-)"
    + token + R"("}],"reflectionRecords":[],"prayerRecords":[],"bibleStudySessions":[],"routineStates":[],"reviews":[],"reviewSettings":null,"prayerDrafts":[],)"
    + R"("recordLocations":{"journalRecords":[{"id":"fixture","key":"journal_local:todo:2026-11-19:fixture"}],"reflectionRecords":[],"prayerRecords":[],"bibleStudySessions":[],"routineStates":[],"reviews":[]},)"
    + R"("authoredDrafts":{"sessionNotes":[],"guidedReflections":[],"routines":[]},"gospelAuthoredContent":[],"preferences":[],"legacyAuthoredContent":{"reflectionLogs":[],"journalRecords":[]},"integrity":)"
    + integrity + R"(},"integrity":)" + integrity + R"(},"assets":[],"totals":{"records":1,"assets":0,"assetBytes":0}})";
}

inline Bytes encrypt(const std::string &plain) {
  Bytes data(plain.size() + overhead);
  std::copy(magic.begin(), magic.end(), data.begin());
  randombytes_buf(data.data() + saltAt, crypto_pwhash_SALTBYTES);
  Crypto c(data.data() + saltAt, password);
  require(crypto_secretstream_xchacha20poly1305_init_push(&c.stream, data.data() + headerAt, c.key.data()) == 0);
  require(crypto_secretstream_xchacha20poly1305_push(&c.stream, data.data() + cipherAt, nullptr,
    reinterpret_cast<const unsigned char *>(plain.data()), plain.size(), data.data(), headerAt,
    crypto_secretstream_xchacha20poly1305_TAG_FINAL) == 0);
  return data;
}

inline std::string decrypt(const Bytes &data, const char *code) {
  const size_t expected = manifest(std::string(32, '0')).size();
  require(data.size() == expected + overhead && std::equal(magic.begin(), magic.end(), data.begin()));
  Crypto c(data.data() + saltAt, code);
  require(crypto_secretstream_xchacha20poly1305_init_pull(&c.stream, data.data() + headerAt, c.key.data()) == 0);
  std::string plain(expected, '\0');
  unsigned char tag = 0;
  unsigned long long length = 0;
  require(crypto_secretstream_xchacha20poly1305_pull(&c.stream,
    reinterpret_cast<unsigned char *>(plain.data()), &length, &tag, data.data() + cipherAt,
    data.size() - cipherAt, data.data(), headerAt) == 0);
  require(length == expected && tag == crypto_secretstream_xchacha20poly1305_TAG_FINAL);
  const auto start = manifest("").find("synthetic-") + std::strlen("synthetic-");
  auto token = plain.substr(start, 32);
  require(token.find_first_not_of("0123456789abcdef") == std::string::npos && plain == manifest(token));
  return plain;
}

inline std::string exportFixture(const std::string &directory) {
  require(sodium_init() >= 0);
  unsigned char random[16];
  char token[33];
  randombytes_buf(random, sizeof(random));
  sodium_bin2hex(token, sizeof(token), random, sizeof(random));
  const auto data = encrypt(manifest(token));
  const auto target = directory + fileName;
  auto temp = target + ".XXXXXX";
  const int fd = mkstemp(temp.data());
  require(fd >= 0);
  size_t offset = 0;
  while (offset < data.size()) {
    const auto n = write(fd, data.data() + offset, data.size() - offset);
    if (n < 0 && errno == EINTR) continue;
    if (n <= 0) break;
    offset += static_cast<size_t>(n);
  }
  bool ok = offset == data.size() && fsync(fd) == 0;
  ok = close(fd) == 0 && ok;
  if (!ok || rename(temp.c_str(), target.c_str()) != 0) {
    unlink(temp.c_str());
    require(false);
  }
  return token;
}

inline std::string importFixture(const std::string &directory) {
  require(sodium_init() >= 0);
  const size_t size = overhead + manifest(std::string(32, '0')).size();
  Bytes bytes(size + 1); // Extra byte also catches trailing data.
  const int fd = open((directory + fileName).c_str(), O_RDONLY | O_NOFOLLOW | O_NONBLOCK);
  require(fd >= 0);
  struct stat st{};
  bool ok = fstat(fd, &st) == 0 && S_ISREG(st.st_mode) && st.st_size == static_cast<off_t>(size);
  size_t offset = 0;
  while (ok && offset < bytes.size()) {
    const auto n = read(fd, bytes.data() + offset, bytes.size() - offset);
    if (n < 0 && errno == EINTR) continue;
    if (n <= 0) { ok = n == 0; break; }
    offset += static_cast<size_t>(n);
  }
  close(fd);
  require(ok && offset == size);
  bytes.resize(size);
  return R"({"containerByteLength":)" + std::to_string(offset) + R"(,"manifest":)" + decrypt(bytes, password) + "}";
}
} // namespace journal_fixture
