// Bounded development fixture for transferring two entries and two unique images.
#pragma once
#include "SyntheticFilePhoto.hpp"
#include <mutex>

namespace journal_shared_transfer {
using journal_fixture::require;
namespace photos = journal_photo_fixture;
constexpr auto fileName = "/journal-shared-transfer-test.bin";
constexpr size_t maxImage = 3 * 1024 * 1024;
constexpr size_t maxManifest = 16 * 1024;
constexpr auto sharedId = "cf890a91-410a-4526-9d47-8aa7085ec351";
constexpr auto otherId = "91470c9f-7d1d-49aa-9644-8961d590b5ab";

inline std::string digest(const std::string &data) {
  std::array<unsigned char, crypto_hash_sha256_BYTES> hash{};
  char hex[crypto_hash_sha256_BYTES * 2 + 1];
  crypto_hash_sha256(hash.data(), reinterpret_cast<const unsigned char *>(data.data()), data.size());
  return sodium_bin2hex(hex, sizeof(hex), hash.data(), hash.size());
}

struct Images {
  std::string shared, other;
};

inline std::string manifest(const std::string &token, const Images &images) {
  auto asset = [](const std::string &id, const std::string &image) {
    return R"({"assetId":")" + id + R"(","path":"objects/)" + id
      + R"(","kind":"image","mediaType":"image/png","byteLength":)" + std::to_string(image.size())
      + R"(,"sha256":")" + digest(image) + R"(","ownerRecordId":"first"})";
  };
  auto block = [](const std::string &id) {
    return R"({"id":")" + id + R"(","kind":"photo","uri":"objects/)" + id + R"("})";
  };
  auto entry = [&](const std::string &id, const std::string &blocks) {
    return R"({"id":")" + id + R"(","content_type":"todo","selected_date":"2026-11-19","created_at":"2026-11-19T00:00:00Z","updated_at":"2026-11-19T00:00:00Z","content":")"
      + id + "-" + token + R"(","metadata":{"journalBlocks":[)" + blocks + "]}}";
  };
  return journal_fixture::manifestDocument(
    entry("first", block(sharedId) + "," + block(otherId)) + "," + entry("second", block(sharedId)),
    R"({"id":"first","key":"journal_local:todo:2026-11-19:first"},{"id":"second","key":"journal_local:todo:2026-11-19:second"})",
    asset(sharedId, images.shared) + "," + asset(otherId, images.other), 2, 2, images.shared.size() + images.other.size());
}

inline std::string exportToFile(const std::string &path, const char *code) {
  const auto token = journal_fixture::freshToken();
  const Images images{photos::png(false), photos::png(true)};
  const auto document = manifest(token, images);
  std::string payload = "JSH1" + token;
  photos::append32(payload, document.size());
  photos::append32(payload, images.shared.size());
  payload += document + images.shared + images.other;
  journal_fixture::writeArchive(path, journal_fixture::encrypt(payload, code));
  return token;
}

inline std::string exportArchive(const std::string &directory) {
  return exportToFile(directory + fileName, journal_fixture::password);
}

inline size_t sizeAt(const std::string &data, size_t offset) {
  size_t n = 0;
  for (size_t i = 0; i < 4; ++i) n = (n << 8) | static_cast<unsigned char>(data.at(offset + i));
  return n;
}

// Only this test owns this staging directory. Native paths never come from an archive.
inline std::string imageDirectory(const std::string &directory) {
  const auto dir = directory + "/journal-shared-transfer-images";
  require(mkdir(dir.c_str(), 0700) == 0 || errno == EEXIST);
  journal_attachment::Descriptor checked(open(dir.c_str(), O_RDONLY | O_NOFOLLOW | O_DIRECTORY));
  return dir;
}

struct VerifiedSample {
  std::string token, document;
  Images images;
};

inline journal_fixture::Bytes readSample(const std::string &path) {
  return journal_fixture::readArchive(path, journal_fixture::overhead + 44 + maxManifest + 2 * maxImage);
}

inline VerifiedSample inspect(const journal_fixture::Bytes &sealed, const char *code) {
  require(sodium_init() >= 0);
  constexpr size_t header = 44;
  const auto data = journal_fixture::openAuthenticatedFrame(sealed, code);
  require(data.size() >= header && data.compare(0, 4, "JSH1") == 0);
  const auto token = data.substr(4, 32);
  require(token.find_first_not_of("0123456789abcdef") == std::string::npos);
  const auto manifestSize = sizeAt(data, 36), sharedSize = sizeAt(data, 40);
  require(manifestSize > 0 && manifestSize <= maxManifest && sharedSize > 0 && sharedSize <= maxImage);
  const auto otherAt = header + manifestSize + sharedSize;
  require(otherAt < data.size() && data.size() - otherAt <= maxImage);
  Images images{data.substr(header + manifestSize, sharedSize), data.substr(otherAt)};
  const auto document = data.substr(header, manifestSize);
  require(document == manifest(token, images));
  require(images.shared.compare(0, 8, "\x89PNG\r\n\x1a\n", 8) == 0 &&
          images.other.compare(0, 8, "\x89PNG\r\n\x1a\n", 8) == 0 && images.shared != images.other);

  return {token, document, std::move(images)};
}

inline std::string stageVerified(const std::string &directory, const VerifiedSample &sample, size_t sealedSize) {
  const auto &[token, document, images] = sample;
  const auto dir = imageDirectory(directory);
  const auto shared = photos::stageImage(dir, images.shared, photos::Interruption::none);
  const auto other = photos::stageImage(dir, images.other, photos::Interruption::none);
  return R"({"token":")" + token + R"(","manifest":)" + document
    + R"(,"containerByteLength":)" + std::to_string(sealedSize)
    + R"(,"sharedBytes":)" + std::to_string(images.shared.size()) + R"(,"otherBytes":)" + std::to_string(images.other.size())
    + R"(,"sharedFile":")" + shared + R"(","otherFile":")" + other + R"("})";
}

inline std::string importFromFile(const std::string &directory, const std::string &path, const char *code) {
  const auto sealed = readSample(path);
  return stageVerified(directory, inspect(sealed, code), sealed.size());
}

inline std::string importArchive(const std::string &directory) {
  return importFromFile(directory, directory + fileName, journal_fixture::password);
}

// Keep one bounded ciphertext snapshot in memory while the user reviews it.
class SampleRestorePreviews {
  std::mutex mutex;
  std::string currentId;
  journal_fixture::Bytes snapshot;
public:
  std::string prepare(const std::string &path, const char *code) {
    auto sealed = readSample(path);
    const auto sample = inspect(sealed, code);
    const auto id = journal_fixture::freshToken();
    // inspect() authenticates the exact two-entry, two-photo manifest before returning.
    const auto json = R"({"previewId":")" + id + R"(","entries":2,"photos":2,"photoBytes":)"
      + std::to_string(sample.images.shared.size() + sample.images.other.size()) + "}";
    std::lock_guard<std::mutex> lock(mutex);
    currentId = id;
    snapshot = std::move(sealed);
    return json;
  }

  std::string finish(const std::string &directory, const std::string &id, const char *code, bool confirm) {
    journal_fixture::Bytes sealed;
    {
      std::lock_guard<std::mutex> lock(mutex);
      if (!confirm && id != currentId) return "";
      require(!id.empty() && id == currentId);
      currentId.clear();
      sealed.swap(snapshot);
    }
    if (!confirm) return "";
    return stageVerified(directory, inspect(sealed, code), sealed.size());
  }
};

inline SampleRestorePreviews &samplePreviews() {
  static SampleRestorePreviews previews;
  return previews;
}

inline std::string sampleDocument(const std::string &path, const char *code, bool exporting) {
  const std::string_view key(code);
  require(key.size() == 32 && key.find_first_not_of("0123456789abcdef") == std::string_view::npos);
  return exporting ? exportToFile(path, code) : samplePreviews().prepare(path, code);
}

inline void verifyFile(const std::string &directory, const std::string &name, const std::string &expectedDigest) {
  require(sodium_init() >= 0 && journal_attachment::generatedName(name, "photo-") &&
          expectedDigest.size() == 64 && expectedDigest.find_first_not_of("0123456789abcdef") == std::string::npos);
  const auto sealed = journal_fixture::readArchive(imageDirectory(directory) + "/" + name, maxImage + journal_fixture::overhead);
  require(digest(journal_fixture::openAuthenticatedFrame(sealed, journal_fixture::password)) == expectedDigest);
}
inline void verifyPair(const std::string &directory, const std::string &shared, const std::string &sharedDigest,
                       const std::string &other, const std::string &otherDigest) {
  require(shared != other && sharedDigest != otherDigest);
  verifyFile(directory, shared, sharedDigest);
  verifyFile(directory, other, otherDigest);
  photos::collectVerified(imageDirectory(directory), {shared, other});
}
} // namespace journal_shared_transfer
