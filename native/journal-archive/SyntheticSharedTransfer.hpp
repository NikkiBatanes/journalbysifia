// Bounded development fixture for transferring two entries and two unique images.
#pragma once
#include "SyntheticFilePhoto.hpp"

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

inline std::string exportArchive(const std::string &directory) {
  const auto token = journal_fixture::freshToken();
  const Images images{photos::png(false), photos::png(true)};
  const auto document = manifest(token, images);
  std::string payload = "JSH1" + token;
  photos::append32(payload, document.size());
  photos::append32(payload, images.shared.size());
  payload += document + images.shared + images.other;
  journal_fixture::writeArchive(directory + fileName, journal_fixture::encrypt(payload));
  return token;
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

inline std::string importArchive(const std::string &directory) {
  require(sodium_init() >= 0);
  constexpr size_t header = 44;
  const auto sealed = journal_fixture::readArchive(directory + fileName,
    journal_fixture::overhead + header + maxManifest + 2 * maxImage);
  const auto data = journal_fixture::openAuthenticatedFrame(sealed, journal_fixture::password);
  require(data.size() >= header && data.compare(0, 4, "JSH1") == 0);
  const auto token = data.substr(4, 32);
  require(token.find_first_not_of("0123456789abcdef") == std::string::npos);
  const auto manifestSize = sizeAt(data, 36), sharedSize = sizeAt(data, 40);
  require(manifestSize > 0 && manifestSize <= maxManifest && sharedSize > 0 && sharedSize <= maxImage);
  const auto otherAt = header + manifestSize + sharedSize;
  require(otherAt < data.size() && data.size() - otherAt <= maxImage);
  const Images images{data.substr(header + manifestSize, sharedSize), data.substr(otherAt)};
  const auto document = data.substr(header, manifestSize);
  require(document == manifest(token, images));
  require(images.shared.compare(0, 8, "\x89PNG\r\n\x1a\n", 8) == 0 &&
          images.other.compare(0, 8, "\x89PNG\r\n\x1a\n", 8) == 0 && images.shared != images.other);

  const auto dir = imageDirectory(directory);
  const auto shared = photos::stageImage(dir, images.shared, photos::Interruption::none);
  const auto other = photos::stageImage(dir, images.other, photos::Interruption::none);
  return R"({"token":")" + token + R"(","manifest":)" + document
    + R"(,"containerByteLength":)" + std::to_string(sealed.size())
    + R"(,"sharedBytes":)" + std::to_string(images.shared.size()) + R"(,"otherBytes":)" + std::to_string(images.other.size())
    + R"(,"sharedFile":")" + shared + R"(","otherFile":")" + other + R"("})";
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
