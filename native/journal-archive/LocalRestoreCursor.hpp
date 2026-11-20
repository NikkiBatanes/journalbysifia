// Development-only. Keep one authenticated picker stream available until the
// user confirms or dismisses the preview. Never put a whole photo on the bridge.
#pragma once
#include "DeviceRestoreSample.hpp"
#include <mutex>

namespace journal_snapshot {
class LocalRestoreCursor {
  std::mutex mutex;
  std::unique_ptr<FILE, decltype(&fclose)> file{nullptr, fclose};
  std::unique_ptr<Reader> reader;
  std::string token;
  Hash photoHash;
  long long photoBytes = 0;
  long long totalBytes = 0;
  size_t photoCount = 0;

  void clear() {
    reader.reset();
    file.reset();
    token.clear();
    photoBytes = totalBytes = 0;
    photoCount = 0;
    crypto_hash_sha256_init(&photoHash.state);
  }

public:
  std::string preview(const char *path, const std::string &code) {
    std::lock_guard<std::mutex> lock(mutex);
    clear();
    auto document = inspectDeviceSnapshot(path, code);
    const auto end = document.find('\n');
    check(end != std::string::npos);
    const std::string_view manifest(document.data() + end + 1, document.size() - end - 1);
    Hash hash;
    hash.update(reinterpret_cast<const unsigned char *>(manifest.data()), manifest.size());
    const auto digest = hash.finish();
    // SQLCipher candidate is approved only for synthetic data. Only these two
    // generated manifests can opt in. The existing Files preview still accepts all.
    if (digest != "2ad3dea728c75f2ce393fb34803d80b4e349e01c0b0c49a275460d0b80762e57" &&
        digest != "fa9e27deee1db795cf7de13c0364183c5f489273e9711a9141894fdd18660dca") return document;
    try {
      file.reset(fopen(path, "rb"));
      check(bool(file));
      reader = std::make_unique<Reader>(file.get(), code);
      check(reader->next(maxManifest) == crypto_secretstream_xchacha20poly1305_TAG_PUSH &&
            reader->plain.size() == manifest.size() && !memcmp(reader->plain.data(), manifest.data(), manifest.size()));
      unsigned char random[16];
      char hex[33];
      randombytes_buf(random, sizeof(random));
      token = sodium_bin2hex(hex, sizeof(hex), random, sizeof(random));
      document.insert(end - 1, ",\"restoreToken\":\"" + token + "\"");
      return document;
    } catch (...) { clear(); throw; }
  }

  std::string next(const std::string &id, bool discard) {
    std::lock_guard<std::mutex> lock(mutex);
    if (discard) {
      if (id == token) clear();
      return {};
    }
    check(reader && id == token);
    try {
      auto tag = reader->next(maxChunk);
      const auto &bytes = reader->plain;
      if (tag == crypto_secretstream_xchacha20poly1305_TAG_FINAL) {
        check(bytes.empty() && !photoBytes && fgetc(file.get()) == EOF && !ferror(file.get()));
        clear();
        return "final";
      }
      if (tag == crypto_secretstream_xchacha20poly1305_TAG_PUSH) {
        check(bytes.empty() && photoBytes > 0 && ++photoCount <= 10000);
        auto result = "end:" + std::to_string(photoBytes) + ":" + photoHash.finish();
        photoBytes = 0;
        crypto_hash_sha256_init(&photoHash.state);
        return result;
      }
      check(tag == crypto_secretstream_xchacha20poly1305_TAG_MESSAGE && !bytes.empty());
      photoBytes += bytes.size();
      totalBytes += bytes.size();
      check(photoBytes <= 512LL * 1024 * 1024 && totalBytes <= maxPhotosBytes);
      photoHash.update(bytes.data(), bytes.size());
      std::string encoded(sodium_base64_ENCODED_LEN(bytes.size(), sodium_base64_VARIANT_ORIGINAL), '\0');
      sodium_bin2base64(encoded.data(), encoded.size(), bytes.data(), bytes.size(), sodium_base64_VARIANT_ORIGINAL);
      encoded.pop_back();
      return encoded;
    } catch (...) { clear(); throw; }
  }
};

inline LocalRestoreCursor &localRestoreCursor() {
  static LocalRestoreCursor cursor;
  return cursor;
}
} // namespace journal_snapshot
