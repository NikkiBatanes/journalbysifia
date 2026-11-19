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
// A generated 1x1 RGB PNG. Use a real decodable image for the transfer test.
constexpr unsigned char photo[] = {
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
  0x0c, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x08, 0xca, 0x8c, 0x04,
  0x00, 0x02, 0x25, 0x01, 0x15, 0xe5, 0xf7, 0x6f, 0xb8, 0x00, 0x00, 0x00,
  0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
};
constexpr auto photoDigest = "2761c10bfda1b80b82c2200d6791c35f6936e79bd89efa40fdddb0772af0d174";
constexpr auto assetId = "cf890a91-410a-4526-9d47-8aa7085ec351";

inline std::string manifestDocument(const std::string &records, const std::string &locations,
                                    const std::string &assets, size_t recordCount, size_t assetCount, size_t assetBytes) {
  const std::string integrity = R"({"counts":{},"tombstones":{"journalRecords":0,"reflectionRecords":0,"prayerRecords":0},"duplicateIds":[],"danglingReferences":[],"legacyOnlyRecords":{"reflectionLogs":0,"journalRecords":0}})";
  return std::string(R"({"format":"journal-by-sifia-portable-archive","archiveVersion":1,"appIdentifier":"app.journal.sifia","createdAt":"2026-11-19T00:00:00Z","snapshotId":"11782d26-36db-4cb1-ac77-45c3bcff9f09",)")
    + R"("backup":{"format":"journal-by-sifia-backup","appIdentifier":"app.journal.sifia","schemaVersion":1,"sensitive":true,"exportedAt":"2026-11-19T00:00:00Z",)"
    + R"("inventory":{"journalRecords":[)" + records + R"(],"reflectionRecords":[],"prayerRecords":[],"bibleStudySessions":[],"routineStates":[],"reviews":[],"reviewSettings":null,"prayerDrafts":[],)"
    + R"("recordLocations":{"journalRecords":[)" + locations + R"(],"reflectionRecords":[],"prayerRecords":[],"bibleStudySessions":[],"routineStates":[],"reviews":[]},)"
    + R"("authoredDrafts":{"sessionNotes":[],"guidedReflections":[],"routines":[]},"gospelAuthoredContent":[],"preferences":[],"legacyAuthoredContent":{"reflectionLogs":[],"journalRecords":[]},"integrity":)"
    + integrity + R"(},"integrity":)" + integrity + R"(},"assets":[)" + assets + R"(],"totals":{"records":)" + std::to_string(recordCount)
    + R"(,"assets":)" + std::to_string(assetCount) + R"(,"assetBytes":)" + std::to_string(assetBytes) + "}}";
}

inline std::string manifest(const std::string &token, bool hasPhoto = false) {
  const auto photoPath = std::string("objects/") + assetId;
  std::string block, assets;
  if (hasPhoto) {
    block = R"(,"metadata":{"journalBlocks":[{"id":"fixture-photo","kind":"photo","uri":")"
      + photoPath + R"("}]})";
    assets = std::string(R"({"assetId":")") + assetId + R"(","path":")" + photoPath
      + R"(","kind":"image","mediaType":"image/png","byteLength":)" + std::to_string(sizeof(photo))
      + R"(,"sha256":")" + photoDigest + R"(","ownerRecordId":"fixture"})";
  }
  const auto record = std::string(R"({"id":"fixture","content_type":"todo","selected_date":"2026-11-19","created_at":"2026-11-19T00:00:00Z","updated_at":"2026-11-19T00:00:00Z","content":"synthetic-)") + token + "\"" + block + "}";
  return manifestDocument(record, R"({"id":"fixture","key":"journal_local:todo:2026-11-19:fixture"})",
    assets, 1, hasPhoto ? 1 : 0, hasPhoto ? sizeof(photo) : 0);
}

inline Bytes encrypt(const std::string &plain, const char *code = password) {
  Bytes data(plain.size() + overhead);
  std::copy(magic.begin(), magic.end(), data.begin());
  randombytes_buf(data.data() + saltAt, crypto_pwhash_SALTBYTES);
  Crypto c(data.data() + saltAt, code);
  require(crypto_secretstream_xchacha20poly1305_init_push(&c.stream, data.data() + headerAt, c.key.data()) == 0);
  require(crypto_secretstream_xchacha20poly1305_push(&c.stream, data.data() + cipherAt, nullptr,
    reinterpret_cast<const unsigned char *>(plain.data()), plain.size(), data.data(), headerAt,
    crypto_secretstream_xchacha20poly1305_TAG_FINAL) == 0);
  return data;
}

inline std::string openAuthenticatedFrame(const Bytes &data, const char *code) {
  require(data.size() >= overhead);
  const auto expected = data.size() - overhead;
  require(std::equal(magic.begin(), magic.end(), data.begin()));
  Crypto c(data.data() + saltAt, code);
  require(crypto_secretstream_xchacha20poly1305_init_pull(&c.stream, data.data() + headerAt, c.key.data()) == 0);
  std::string plain(expected, '\0');
  unsigned char tag = 0;
  unsigned long long length = 0;
  require(crypto_secretstream_xchacha20poly1305_pull(&c.stream,
    reinterpret_cast<unsigned char *>(plain.data()), &length, &tag, data.data() + cipherAt,
    data.size() - cipherAt, data.data(), headerAt) == 0);
  require(length == expected && tag == crypto_secretstream_xchacha20poly1305_TAG_FINAL);
  return plain;
}

inline std::string decrypt(const Bytes &data, const char *code) {
  const std::string placeholder(32, '0');
  const auto textSize = manifest(placeholder).size();
  const auto photoManifestSize = manifest(placeholder, true).size();
  const auto hasPhoto = data.size() == overhead + photoManifestSize + sizeof(photo);
  require(hasPhoto || data.size() == overhead + textSize);
  auto plain = openAuthenticatedFrame(data, code);
  const auto start = manifest("").find("synthetic-") + std::strlen("synthetic-");
  auto token = plain.substr(start, 32);
  require(token.find_first_not_of("0123456789abcdef") == std::string::npos);
  const auto manifestSize = hasPhoto ? photoManifestSize : textSize;
  require(plain.compare(0, manifestSize, manifest(token, hasPhoto)) == 0);
  if (hasPhoto) {
    const unsigned char *received = reinterpret_cast<const unsigned char *>(plain.data() + photoManifestSize);
    unsigned char digest[crypto_hash_sha256_BYTES];
    char hexDigest[2 * sizeof(digest) + 1];
    crypto_hash_sha256(digest, received, sizeof(photo));
    sodium_bin2hex(hexDigest, sizeof(hexDigest), digest, sizeof(digest));
    require(std::strcmp(hexDigest, photoDigest) == 0);
  }
  return plain;
}

inline void writeArchive(const std::string &target, const Bytes &data) {
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
}

inline std::string freshToken() {
  require(sodium_init() >= 0);
  unsigned char random[16];
  char token[33];
  randombytes_buf(random, sizeof(random));
  sodium_bin2hex(token, sizeof(token), random, sizeof(random));
  return token;
}

inline std::string exportFixture(const std::string &directory) {
  const auto token = freshToken();
  writeArchive(directory + fileName, encrypt(manifest(token, true) +
    std::string(reinterpret_cast<const char *>(photo), sizeof(photo))));
  return token;
}

inline Bytes readArchive(const std::string &path, size_t size) {
  Bytes bytes(size + 1); // Extra byte also catches trailing data.
  const int fd = open(path.c_str(), O_RDONLY | O_NOFOLLOW | O_NONBLOCK);
  require(fd >= 0);
  struct stat st{};
  bool ok = fstat(fd, &st) == 0 && S_ISREG(st.st_mode) && st.st_size >= 0 && st.st_size <= static_cast<off_t>(size);
  size_t offset = 0;
  while (ok && offset < bytes.size()) {
    const auto n = read(fd, bytes.data() + offset, bytes.size() - offset);
    if (n < 0 && errno == EINTR) continue;
    if (n <= 0) { ok = n == 0; break; }
    offset += static_cast<size_t>(n);
  }
  close(fd);
  require(ok && offset == static_cast<size_t>(st.st_size));
  bytes.resize(offset);
  return bytes;
}

inline std::string importFixture(const std::string &directory) {
  require(sodium_init() >= 0);
  const size_t size = overhead + manifest(std::string(32, '0'), true).size() + sizeof(photo);
  const auto bytes = readArchive(directory + fileName, size);
  const auto offset = bytes.size();
  auto plain = decrypt(bytes, password);
  std::string result = R"({"containerByteLength":)" + std::to_string(offset);
  if (offset == size) {
    const size_t manifestSize = plain.size() - sizeof(photo);
    char base64[sodium_base64_ENCODED_LEN(sizeof(photo), sodium_base64_VARIANT_ORIGINAL)];
    sodium_bin2base64(base64, sizeof(base64),
      reinterpret_cast<const unsigned char *>(plain.data() + manifestSize), sizeof(photo),
      sodium_base64_VARIANT_ORIGINAL);
    result += std::string(R"(,"photo":{"assetId":")") + assetId + R"(","byteLength":)" +
      std::to_string(sizeof(photo)) + R"(,"base64":")" + base64 + R"("})";
    plain.resize(manifestSize);
  }
  return result + R"(,"manifest":)" + plain + "}";
}
} // namespace journal_fixture
