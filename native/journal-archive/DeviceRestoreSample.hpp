// Development picker diagnostic for the checked-in, one-reflection Files sample.
#pragma once
#include "LocalSnapshotCheck.hpp"
#include <array>

namespace journal_snapshot {
inline std::string inspectDeviceSnapshot(const char *path, const std::string &code) {
  constexpr size_t sampleBytes = 85;
  std::array<unsigned char, sampleBytes> sample{};
  size_t used = 0;
  bool eligible = true;
  size_t count = 0;
  auto result = readDocument(path, code, [&](const unsigned char *data, size_t size) {
    if (eligible && size <= sample.size() - used) {
      std::memcpy(sample.data() + used, data, size);
      used += size;
    } else {
      eligible = false;
    }
  }, [&](long long length, const std::string &digest) {
    ++count;
    eligible = eligible && length == sampleBytes &&
      digest == "20ea48e4aa5a9b6402a7f8a354b785ab9372b433951d64f637548803b6e8c9b8";
  });
  if (eligible && count == 1 && used == sampleBytes) {
    const auto end = result.find('\n');
    Hash manifest;
    manifest.update(reinterpret_cast<const unsigned char *>(result.data() + end + 1), result.size() - end - 1);
    if (manifest.finish() == "fdc0566c76303725fcd06db373e8f767e25daac2a73b6e1d4db829c2ccbb9b9d") {
      char encoded[sodium_base64_ENCODED_LEN(sampleBytes, sodium_base64_VARIANT_ORIGINAL)];
      sodium_bin2base64(encoded, sizeof(encoded), sample.data(), used, sodium_base64_VARIANT_ORIGINAL);
      result.insert(end - 1, std::string(",\"practicePhotoBase64\":\"") + encoded + "\"");
    }
  }
  sodium_memzero(sample.data(), sample.size());
  return result;
}
} // namespace journal_snapshot
