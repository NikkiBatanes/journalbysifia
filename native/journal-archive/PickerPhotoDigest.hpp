#pragma once
#include "PickerPhoto.hpp"
#include <sodium.h>

namespace journal_picker {
// A size and digest are safe to return to the local manifest builder. Errors
// use the same negative statuses as inspect(); image bytes stay native.
inline std::string fingerprint(const char *dir, std::string_view name, std::string_view prefix, long long budget) {
  if (sodium_init() < 0) return std::to_string(unreadable);
  crypto_hash_sha256_state hash;
  crypto_hash_sha256_init(&hash);
  const auto length = capture(dir, name, prefix, budget, [&](const unsigned char *bytes, size_t count) {
    crypto_hash_sha256_update(&hash, bytes, count);
  });
  unsigned char digest[crypto_hash_sha256_BYTES];
  crypto_hash_sha256_final(&hash, digest);
  sodium_memzero(&hash, sizeof(hash));
  if (length <= 0) return std::to_string(length);
  char hex[2 * sizeof(digest) + 1];
  return std::to_string(length) + ":" + sodium_bin2hex(hex, sizeof(hex), digest, sizeof(digest));
}
}
