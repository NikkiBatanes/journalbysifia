#include <jni.h>
#include <sodium.h>

#include <algorithm>
#include <array>
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <string>
#include <unordered_set>
#include <vector>

namespace {

constexpr std::size_t kAssertionCount = 11;
constexpr std::size_t kMaximumAssetCount = 2;
constexpr std::size_t kMaximumAssetBytes = 1024;
constexpr std::size_t kMaximumTotalAssetBytes = 1536;
constexpr std::size_t kChunkBytes = 32;

using Bytes = std::vector<unsigned char>;
using Digest = std::array<unsigned char, crypto_hash_sha256_BYTES>;
using Key =
    std::array<unsigned char, crypto_secretstream_xchacha20poly1305_KEYBYTES>;
using Header =
    std::array<unsigned char, crypto_secretstream_xchacha20poly1305_HEADERBYTES>;

constexpr const char* kOwnerRecordId = "synthetic-journal-record-1";

struct Asset {
  std::string assetId;
  std::string path;
  std::string kind;
  std::string mediaType;
  std::string ownerRecordId;
  Bytes bytes;
  Digest sha256{};
};

struct Frame {
  std::size_t assetIndex = 0;
  std::size_t chunkIndex = 0;
  Bytes associatedData;
  Bytes ciphertext;
};

struct Package {
  Header header{};
  std::vector<Frame> frames;
};

bool isSafeAssetId(const std::string& assetId) {
  if (assetId.size() != 36 || assetId[8] != '-' || assetId[13] != '-' ||
      assetId[18] != '-' || assetId[23] != '-') {
    return false;
  }
  for (std::size_t index = 0; index < assetId.size(); ++index) {
    if (index == 8 || index == 13 || index == 18 || index == 23) {
      continue;
    }
    const char value = assetId[index];
    if (!((value >= '0' && value <= '9') ||
          (value >= 'a' && value <= 'f'))) {
      return false;
    }
  }
  return assetId[14] >= '1' && assetId[14] <= '8' &&
      (assetId[19] == '8' || assetId[19] == '9' ||
       assetId[19] == 'a' || assetId[19] == 'b');
}

bool sniffMatches(const Asset& asset) {
  if (asset.mediaType == "image/jpeg") {
    return asset.kind == "image" && asset.bytes.size() >= 3 &&
        asset.bytes[0] == 0xff && asset.bytes[1] == 0xd8 &&
        asset.bytes[2] == 0xff;
  }
  if (asset.mediaType == "audio/mp4") {
    return asset.kind == "audio" && asset.bytes.size() >= 12 &&
        std::memcmp(asset.bytes.data() + 4, "ftyp", 4) == 0 &&
        std::memcmp(asset.bytes.data() + 8, "M4A ", 4) == 0;
  }
  return false;
}

Digest hashBytes(const Bytes& bytes) {
  Digest digest{};
  crypto_hash_sha256(digest.data(), bytes.data(), bytes.size());
  return digest;
}

std::string hexDigest(const Digest& digest) {
  std::array<char, crypto_hash_sha256_BYTES * 2 + 1> encoded{};
  sodium_bin2hex(encoded.data(), encoded.size(), digest.data(), digest.size());
  return std::string(encoded.data());
}

bool validateAssets(const std::vector<Asset>& assets) {
  if (assets.empty() || assets.size() > kMaximumAssetCount) {
    return false;
  }
  std::unordered_set<std::string> ids;
  std::unordered_set<std::string> paths;
  std::size_t total = 0;
  for (const auto& asset : assets) {
    if (!isSafeAssetId(asset.assetId) ||
        asset.path != "objects/" + asset.assetId ||
        asset.ownerRecordId != kOwnerRecordId || !sniffMatches(asset) ||
        asset.bytes.empty() || asset.bytes.size() > kMaximumAssetBytes ||
        total > kMaximumTotalAssetBytes - asset.bytes.size() ||
        !ids.insert(asset.assetId).second || !paths.insert(asset.path).second) {
      return false;
    }
    const Digest observed = hashBytes(asset.bytes);
    if (sodium_memcmp(
            observed.data(), asset.sha256.data(), observed.size()) != 0) {
      return false;
    }
    total += asset.bytes.size();
  }
  return true;
}

Bytes associatedDataFor(
    const Asset& asset,
    std::size_t chunkIndex,
    std::size_t chunkCount) {
  const std::string canonical =
      "journal-media-v1\n" + asset.assetId + "\n" + asset.path + "\n" +
      asset.kind + "\n" + asset.mediaType + "\n" + asset.ownerRecordId +
      "\n" + std::to_string(asset.bytes.size()) + "\n" +
      hexDigest(asset.sha256) + "\n" + std::to_string(chunkIndex) + "\n" +
      std::to_string(chunkCount);
  return Bytes(canonical.begin(), canonical.end());
}

bool packageAssets(
    const std::vector<Asset>& assets,
    const Key& key,
    Package& package) {
  if (!validateAssets(assets)) {
    return false;
  }
  crypto_secretstream_xchacha20poly1305_state state{};
  if (crypto_secretstream_xchacha20poly1305_init_push(
          &state, package.header.data(), key.data()) != 0) {
    sodium_memzero(&state, sizeof state);
    return false;
  }
  bool passed = true;
  for (std::size_t assetIndex = 0;
       passed && assetIndex < assets.size();
       ++assetIndex) {
    const auto& asset = assets[assetIndex];
    const std::size_t chunkCount =
        (asset.bytes.size() + kChunkBytes - 1) / kChunkBytes;
    for (std::size_t chunkIndex = 0;
         passed && chunkIndex < chunkCount;
         ++chunkIndex) {
      const std::size_t offset = chunkIndex * kChunkBytes;
      const std::size_t length =
          std::min(kChunkBytes, asset.bytes.size() - offset);
      Frame frame{};
      frame.assetIndex = assetIndex;
      frame.chunkIndex = chunkIndex;
      frame.associatedData = associatedDataFor(asset, chunkIndex, chunkCount);
      frame.ciphertext.resize(
          length + crypto_secretstream_xchacha20poly1305_ABYTES);
      unsigned long long ciphertextLength = 0;
      const bool isFinal = assetIndex + 1 == assets.size() &&
          chunkIndex + 1 == chunkCount;
      const unsigned char tag = isFinal
          ? crypto_secretstream_xchacha20poly1305_TAG_FINAL
          : crypto_secretstream_xchacha20poly1305_TAG_MESSAGE;
      passed = crypto_secretstream_xchacha20poly1305_push(
                   &state,
                   frame.ciphertext.data(),
                   &ciphertextLength,
                   asset.bytes.data() + offset,
                   length,
                   frame.associatedData.data(),
                   frame.associatedData.size(),
                   tag) == 0;
      frame.ciphertext.resize(static_cast<std::size_t>(ciphertextLength));
      package.frames.push_back(std::move(frame));
    }
  }
  sodium_memzero(&state, sizeof state);
  return passed && !package.frames.empty();
}

bool unpackAndVerify(
    const std::vector<Asset>& assets,
    const Key& key,
    const Package& package) {
  if (!validateAssets(assets) || package.frames.empty()) {
    return false;
  }
  crypto_secretstream_xchacha20poly1305_state state{};
  if (crypto_secretstream_xchacha20poly1305_init_pull(
          &state, package.header.data(), key.data()) != 0) {
    sodium_memzero(&state, sizeof state);
    return false;
  }
  std::vector<Bytes> recovered(assets.size());
  bool passed = true;
  bool sawFinal = false;
  for (std::size_t frameIndex = 0;
       passed && frameIndex < package.frames.size();
       ++frameIndex) {
    const auto& frame = package.frames[frameIndex];
    if (frame.assetIndex >= assets.size()) {
      passed = false;
      break;
    }
    const auto& asset = assets[frame.assetIndex];
    const std::size_t chunkCount =
        (asset.bytes.size() + kChunkBytes - 1) / kChunkBytes;
    if (frame.chunkIndex >= chunkCount || frame.associatedData !=
        associatedDataFor(asset, frame.chunkIndex, chunkCount)) {
      passed = false;
      break;
    }
    Bytes plaintext(frame.ciphertext.size());
    unsigned long long plaintextLength = 0;
    unsigned char tag = 0;
    passed = crypto_secretstream_xchacha20poly1305_pull(
                 &state,
                 plaintext.data(),
                 &plaintextLength,
                 &tag,
                 frame.ciphertext.data(),
                 frame.ciphertext.size(),
                 frame.associatedData.data(),
                 frame.associatedData.size()) == 0;
    if (passed) {
      plaintext.resize(static_cast<std::size_t>(plaintextLength));
      auto& output = recovered[frame.assetIndex];
      if (output.size() > kMaximumAssetBytes - plaintext.size()) {
        passed = false;
      } else {
        output.insert(output.end(), plaintext.begin(), plaintext.end());
      }
      sawFinal = tag == crypto_secretstream_xchacha20poly1305_TAG_FINAL;
      if (sawFinal != (frameIndex + 1 == package.frames.size())) {
        passed = false;
      }
    }
    sodium_memzero(plaintext.data(), plaintext.size());
  }
  if (passed && sawFinal) {
    for (std::size_t index = 0; index < assets.size(); ++index) {
      const Digest observed = hashBytes(recovered[index]);
      passed = recovered[index] == assets[index].bytes &&
          sodium_memcmp(
              observed.data(), assets[index].sha256.data(), observed.size()) ==
              0;
      if (!passed) {
        break;
      }
    }
  } else {
    passed = false;
  }
  sodium_memzero(&state, sizeof state);
  for (auto& bytes : recovered) {
    sodium_memzero(bytes.data(), bytes.size());
  }
  return passed;
}

Asset makeJpegAsset() {
  Asset asset{
      "11111111-1111-4111-8111-111111111111",
      "objects/11111111-1111-4111-8111-111111111111",
      "image",
      "image/jpeg",
      kOwnerRecordId,
      Bytes{0xff, 0xd8, 0xff, 0xe0, 'J', 'F', 'I', 'F', 0x00, 0xff, 0xd9},
      {}};
  asset.sha256 = hashBytes(asset.bytes);
  return asset;
}

Asset makeAudioAsset() {
  Asset asset{
      "22222222-2222-4222-8222-222222222222",
      "objects/22222222-2222-4222-8222-222222222222",
      "audio",
      "audio/mp4",
      kOwnerRecordId,
      Bytes{0x00, 0x00, 0x00, 0x18, 'f', 't', 'y', 'p', 'M', '4', 'A', ' ',
            0x00, 0x00, 0x00, 0x00, 'M', '4', 'A', ' ', 'm', 'p', '4', '2'},
      {}};
  asset.sha256 = hashBytes(asset.bytes);
  return asset;
}

std::array<bool, kAssertionCount> runMediaPackagingAssertions() {
  std::array<bool, kAssertionCount> assertions{};
  if (sodium_init() < 0) {
    return assertions;
  }
  Key key{};
  for (std::size_t index = 0; index < key.size(); ++index) {
    key[index] = static_cast<unsigned char>(index + 1);
  }
  std::vector<Asset> assets{makeJpegAsset(), makeAudioAsset()};
  Package package{};
  const bool packaged = packageAssets(assets, key, package);
  assertions[0] = packaged && unpackAndVerify(assets, key, package);

  auto wrongType = assets;
  wrongType[0].mediaType = "audio/mp4";
  assertions[1] = !validateAssets(wrongType);

  auto oversized = assets;
  oversized[0].bytes.assign(kMaximumAssetBytes + 1, 0xa5);
  oversized[0].sha256 = hashBytes(oversized[0].bytes);
  assertions[2] = !validateAssets(oversized);

  auto tooMany = assets;
  Asset third = makeJpegAsset();
  third.assetId = "33333333-3333-4333-8333-333333333333";
  third.path = "objects/" + third.assetId;
  tooMany.push_back(std::move(third));
  auto aggregateOversized = assets;
  aggregateOversized[0].bytes.resize(800, 0xa5);
  aggregateOversized[1].bytes.resize(800, 0xa5);
  aggregateOversized[0].sha256 = hashBytes(aggregateOversized[0].bytes);
  aggregateOversized[1].sha256 = hashBytes(aggregateOversized[1].bytes);
  assertions[3] =
      !validateAssets(tooMany) && !validateAssets(aggregateOversized);

  auto wrongHash = assets;
  wrongHash[0].sha256[0] ^= 0x01;
  assertions[4] = !validateAssets(wrongHash);

  auto wrongOwner = assets;
  wrongOwner[0].ownerRecordId = "synthetic-journal-record-2";
  assertions[5] = !validateAssets(wrongOwner);

  auto unsafePath = assets;
  unsafePath[0].path = "../outside";
  assertions[6] = !validateAssets(unsafePath);

  auto duplicate = assets;
  duplicate[1].assetId = duplicate[0].assetId;
  duplicate[1].path = duplicate[0].path;
  assertions[7] = !validateAssets(duplicate);

  if (packaged) {
    auto metadataTampered = package;
    metadataTampered.frames[0].associatedData[0] ^= 0x01;
    assertions[8] = !unpackAndVerify(assets, key, metadataTampered);

    auto reordered = package;
    if (reordered.frames.size() > 1) {
      std::swap(reordered.frames[0], reordered.frames[1]);
      assertions[9] = !unpackAndVerify(assets, key, reordered);
    }

    auto truncated = package;
    truncated.frames.pop_back();
    assertions[10] = !unpackAndVerify(assets, key, truncated);
  }

  sodium_memzero(key.data(), key.size());
  for (auto& asset : assets) {
    sodium_memzero(asset.bytes.data(), asset.bytes.size());
    sodium_memzero(asset.sha256.data(), asset.sha256.size());
  }
  for (auto& frame : package.frames) {
    sodium_memzero(frame.associatedData.data(), frame.associatedData.size());
    sodium_memzero(frame.ciphertext.data(), frame.ciphertext.size());
  }
  sodium_memzero(package.header.data(), package.header.size());
  return assertions;
}

jbooleanArray falseEvidence(JNIEnv* env) {
  jbooleanArray result = env->NewBooleanArray(kAssertionCount);
  if (result == nullptr) {
    return nullptr;
  }
  std::array<jboolean, kAssertionCount> values{};
  env->SetBooleanArrayRegion(result, 0, values.size(), values.data());
  return result;
}

}  // namespace

extern "C" JNIEXPORT jbooleanArray JNICALL
Java_app_journal_sifia_archivecrypto_JournalArchiveCryptoModule_nativeRunMediaPackagingSelfTest(
    JNIEnv* env,
    jobject) {
  try {
    const auto assertions = runMediaPackagingAssertions();
    jbooleanArray result = env->NewBooleanArray(kAssertionCount);
    if (result == nullptr) {
      return nullptr;
    }
    std::array<jboolean, kAssertionCount> values{};
    for (std::size_t index = 0; index < assertions.size(); ++index) {
      values[index] = assertions[index] ? JNI_TRUE : JNI_FALSE;
    }
    env->SetBooleanArrayRegion(result, 0, values.size(), values.data());
    return result;
  } catch (...) {
    return falseEvidence(env);
  }
}
