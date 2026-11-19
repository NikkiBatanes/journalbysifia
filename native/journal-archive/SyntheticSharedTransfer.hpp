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

enum class SampleVersion { legacy, original, revised, photoAdded, photoReplaced };
constexpr auto newPhotoId = "792d9c99-72e2-4054-a211-1900c54801a4";
inline bool changedPhoto(SampleVersion v) {
  return v == SampleVersion::photoAdded || v == SampleVersion::photoReplaced;
}

inline const std::string &fixturePhoto() {
  static const std::string image{reinterpret_cast<const char *>(journal_fixture::photo), sizeof(journal_fixture::photo)};
  return image;
}

struct SamplePhoto {
  const char *assetId;
  const std::string &bytes;
};

inline std::vector<SamplePhoto> samplePhotos(const Images &images, SampleVersion version) {
  std::vector<SamplePhoto> result{{sharedId, images.shared}};
  if (version != SampleVersion::photoReplaced) result.push_back({otherId, images.other});
  if (changedPhoto(version)) result.push_back({newPhotoId, fixturePhoto()});
  return result;
}

constexpr auto revisedText = "Call Mom on Sunday.";
constexpr auto revisedDate = "2026-11-20T00:00:00Z";

inline std::string entryText(const std::string &id, const std::string &token, SampleVersion version) {
  if (id == "first" && version != SampleVersion::legacy)
    return (version == SampleVersion::revised || changedPhoto(version)) ? revisedText : "Call Mom.";
  return id + "-" + token;
}

inline std::string manifest(const std::string &token, const Images &images, SampleVersion version = SampleVersion::original) {
  auto asset = [](const std::string &id, const std::string &image) {
    return R"({"assetId":")" + id + R"(","path":"objects/)" + id
      + R"(","kind":"image","mediaType":"image/png","byteLength":)" + std::to_string(image.size())
      + R"(,"sha256":")" + digest(image) + R"(","ownerRecordId":"first"})";
  };
  auto block = [](const std::string &id) {
    return R"({"id":")" + id + R"(","kind":"photo","uri":"objects/)" + id + R"("})";
  };
  auto entry = [&](const std::string &id, const std::string &blocks) {
    return R"({"id":")" + id + R"(","content_type":"todo","selected_date":"2026-11-19","created_at":"2026-11-19T00:00:00Z","updated_at":")"
      + (id == "first" && (version == SampleVersion::revised || changedPhoto(version)) ? revisedDate : "2026-11-19T00:00:00Z") + R"(","content":")"
      + entryText(id, token, version) + R"(","metadata":{"journalBlocks":[)" + blocks + "]}}";
  };
  std::string blocks, inventory;
  size_t bytes = 0;
  const auto list = samplePhotos(images, version);
  for (const auto &photo : list) {
    if (!blocks.empty()) {blocks += ","; inventory += ",";}
    blocks += block(photo.assetId);
    inventory += asset(photo.assetId, photo.bytes);
    bytes += photo.bytes.size();
  }
  return journal_fixture::manifestDocument(
    entry("first", blocks) + "," + entry("second", block(sharedId)),
    R"({"id":"first","key":"journal_local:todo:2026-11-19:first"},{"id":"second","key":"journal_local:todo:2026-11-19:second"})",
    inventory, 2, list.size(), bytes);
}

inline std::string exportToFile(const std::string &path, const char *code,
                                const std::string &token = journal_fixture::freshToken(),
                                SampleVersion version = SampleVersion::original) {
  const Images images{photos::png(false), photos::png(true)};
  const auto document = manifest(token, images, version);
  const auto magic = version == SampleVersion::photoAdded ? "JSA1" :
                     version == SampleVersion::photoReplaced ? "JSR1" : "JSH1";
  std::string payload = magic + token;
  photos::append32(payload, document.size());
  photos::append32(payload, images.shared.size());
  payload += document + images.shared + images.other;
  if (changedPhoto(version)) payload += fixturePhoto();
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
  std::string token, document, firstContent, baseDigest;
  Images images;
  SampleVersion version;
};

inline journal_fixture::Bytes readSample(const std::string &path) {
  return journal_fixture::readArchive(path, journal_fixture::overhead + 44 + maxManifest + 2 * maxImage + sizeof(journal_fixture::photo));
}

inline VerifiedSample inspect(const journal_fixture::Bytes &sealed, const char *code) {
  require(sodium_init() >= 0);
  constexpr size_t header = 44;
  const auto data = journal_fixture::openAuthenticatedFrame(sealed, code);
  require(data.size() >= header);
  const auto magic = data.substr(0, 4);
  auto version = SampleVersion::original;
  if (magic == "JSA1") version = SampleVersion::photoAdded;
  else if (magic == "JSR1") version = SampleVersion::photoReplaced;
  else require(magic == "JSH1");
  const auto token = data.substr(4, 32);
  require(token.find_first_not_of("0123456789abcdef") == std::string::npos);
  const auto manifestSize = sizeAt(data, 36), sharedSize = sizeAt(data, 40);
  require(manifestSize > 0 && manifestSize <= maxManifest && sharedSize > 0 && sharedSize <= maxImage);
  const auto otherAt = header + manifestSize + sharedSize;
  const size_t tail = changedPhoto(version) ? sizeof(journal_fixture::photo) : 0;
  require(data.size() > otherAt + tail && data.size() - otherAt - tail <= maxImage);
  if (tail) require(data.compare(data.size() - tail, tail, fixturePhoto()) == 0);
  Images images{data.substr(header + manifestSize, sharedSize), data.substr(otherAt, data.size() - otherAt - tail)};
  const auto document = data.substr(header, manifestSize);
  const auto original = manifest(token, images);
  if (changedPhoto(version)) require(document == manifest(token, images, version));
  else if (document != original) {
    if (document == manifest(token, images, SampleVersion::revised)) version = SampleVersion::revised;
    else {
      require(document == manifest(token, images, SampleVersion::legacy));
      version = SampleVersion::legacy;
    }
  }
  require(images.shared.compare(0, 8, "\x89PNG\r\n\x1a\n", 8) == 0 &&
          images.other.compare(0, 8, "\x89PNG\r\n\x1a\n", 8) == 0 && images.shared != images.other);

  return {token, document, entryText("first", token, version),
          version == SampleVersion::revised || changedPhoto(version) ? digest(original) : "", std::move(images), version};
}

inline std::string stageVerified(const std::string &directory, const VerifiedSample &sample, size_t sealedSize) {
  // stageImage uses a shared scratch filename within this practice directory.
  static std::mutex stagingMutex;
  const std::lock_guard<std::mutex> lock(stagingMutex);
  const auto dir = imageDirectory(directory);
  std::string list;
  for (const auto &photo : samplePhotos(sample.images, sample.version)) {
    const auto hash = digest(photo.bytes);
    const auto id = digest(sample.token + photo.assetId + hash).substr(0, 32);
    const auto name = "photo-" + id;
    struct stat info{};
    if (lstat((dir + "/" + name).c_str(), &info) != 0) {
      require(errno == ENOENT);
      require(photos::stageImage(dir, photo.bytes, photos::Interruption::none, id) == name);
    }
    const auto sealed = journal_fixture::readArchive(dir + "/" + name, photo.bytes.size() + journal_fixture::overhead);
    require(journal_fixture::openAuthenticatedFrame(sealed, journal_fixture::password) == photo.bytes);
    if (!list.empty()) list += ",";
    list += R"({"assetId":")" + std::string(photo.assetId) + R"(","file":")" + name
      + R"(","sha256":")" + hash + R"(","byteLength":)" + std::to_string(photo.bytes.size()) + "}";
  }
  return R"({"token":")" + sample.token + R"(","manifest":)" + sample.document
    + R"(,"containerByteLength":)" + std::to_string(sealedSize)
    + R"(,"stagedPhotos":[)" + list + R"(],"archiveDigest":")" + digest(sample.document) + R"("})";
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
    // inspect() authenticates the exact two-entry sample manifest before returning.
    const bool added = sample.version == SampleVersion::photoAdded;
    const bool replaced = sample.version == SampleVersion::photoReplaced;
    const auto list = samplePhotos(sample.images, sample.version);
    size_t bytes = 0;
    for (const auto &photo : list) bytes += photo.bytes.size();
    const auto json = R"({"previewId":")" + id
      + (added ? R"(","photoChange":"added)" : replaced ? R"(","photoChange":"replaced)" : "")
      + R"(","entries":2,"photos":)" + std::to_string(list.size()) + R"(,"photoBytes":)" + std::to_string(bytes)
      + R"(,"firstContent":")" + sample.firstContent
      + (sample.baseDigest.empty() ? "" : R"(","updatedAt":")" + std::string(revisedDate) + R"(","baseDigest":")" + sample.baseDigest)
      + R"(","archiveDigest":")" + digest(sample.document) + R"("})";
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
                       const std::string &other, const std::string &otherDigest, bool collectUnused = true) {
  require(shared != other && sharedDigest != otherDigest);
  verifyFile(directory, shared, sharedDigest);
  verifyFile(directory, other, otherDigest);
  if (collectUnused) photos::collectVerified(imageDirectory(directory), {shared, other});
}
} // namespace journal_shared_transfer
