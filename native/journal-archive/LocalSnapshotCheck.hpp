// Development-only round trip. The caller supplies a validated UTF-8 manifest and
// photo sources in manifest order. Only ciphertext is written to the scratch file.
#pragma once
#include "PickerPhoto.hpp"
#include <sodium.h>
#include <cstdio>
#include <charconv>
#include <memory>
#include <stdexcept>
#include <vector>

namespace journal_snapshot {
constexpr unsigned char magic[] = {'J','S','N','A','P','0','0','1'};
constexpr size_t maxManifest = 16 * 1024 * 1024, maxChunk = 32768;
constexpr size_t overhead = crypto_secretstream_xchacha20poly1305_ABYTES;
constexpr long long maxPhotosBytes = 5000000000LL;
using Bytes = std::vector<unsigned char>;

inline void check(bool ok) {
  if (!ok) throw std::runtime_error("Local snapshot verification failed");
}
struct Source {
  std::string name, hash;
  long long length;
};

// Each line is length, hash and picker URI separated by tabs. Only the native
// app supplies the base URI and directory. Device paths never enter the file.
inline std::vector<Source> sourcesFrom(std::string_view rows, std::string_view base) {
  std::vector<Source> sources;
  while (!rows.empty()) {
    const auto end = rows.find('\n');
    const auto line = rows.substr(0, end);
    const auto first = line.find('\t');
    check(first > 0 && first <= 10 && sources.size() < 10000);
    auto tail = line.substr(first + 1);
    check(tail.size() > 65 && tail[64] == '\t');
    const auto hash = tail.substr(0, 64);
    check(hash.find_first_not_of("0123456789abcdef") == std::string_view::npos);
    const auto uri = tail.substr(65);
    check(uri.size() <= 4096 && uri.substr(0, base.size()) == base);
    long long length = 0;
    auto result = std::from_chars(line.data(), line.data() + first, length);
    check(result.ec == std::errc{} && result.ptr == line.data() + first && length > 0 && length <= 512LL * 1024 * 1024);
    sources.push_back({std::string(uri.substr(base.size())), std::string(hash), length});
    if (end == std::string_view::npos) break;
    rows.remove_prefix(end + 1);
  }
  return sources;
}

struct Stream {
  crypto_secretstream_xchacha20poly1305_state state{};
  unsigned char key[crypto_secretstream_xchacha20poly1305_KEYBYTES]{};
  Stream(const Stream &) = delete;
  Stream() = default;
  ~Stream() { sodium_memzero(this, sizeof(*this)); }
  void derive(const std::string &code, const unsigned char *salt) {
    check(code.size() == 32 && code.find_first_not_of("0123456789abcdef") == std::string::npos);
    check(crypto_pwhash(key, sizeof(key), code.data(), code.size(), salt, 2, 64 * 1024 * 1024,
                        crypto_pwhash_ALG_ARGON2ID13) == 0);
  }
};
inline void writeBytes(FILE *f, const void *p, size_t n) { check(fwrite(p, 1, n, f) == n); }
inline void readBytes(FILE *f, void *p, size_t n) { check(fread(p, 1, n, f) == n); }

struct Hash {
  crypto_hash_sha256_state state{};
  Hash() { crypto_hash_sha256_init(&state); }
  ~Hash() { sodium_memzero(&state, sizeof(state)); }
  void update(const unsigned char *p, size_t n) { crypto_hash_sha256_update(&state, p, n); }
  std::string finish() {
    unsigned char raw[crypto_hash_sha256_BYTES];
    char hex[2 * sizeof(raw) + 1];
    crypto_hash_sha256_final(&state, raw);
    return sodium_bin2hex(hex, sizeof(hex), raw, sizeof(raw));
  }
};

// Each frame has a four-byte big-endian ciphertext length. The manifest is one
// PUSH frame, followed by MESSAGE chunks and an empty PUSH for each asset.
// An empty FINAL and physical EOF are required even for a text-only snapshot.
inline void frame(FILE *f, Stream &stream, const unsigned char *p, size_t n, unsigned char tag, Bytes &cipher) {
  cipher.resize(n + overhead);
  check(crypto_secretstream_xchacha20poly1305_push(&stream.state, cipher.data(), nullptr,
    p, n, magic, sizeof(magic), tag) == 0);
  const auto size = static_cast<uint32_t>(cipher.size());
  const unsigned char prefix[] = {static_cast<unsigned char>(size >> 24), static_cast<unsigned char>(size >> 16),
                                  static_cast<unsigned char>(size >> 8), static_cast<unsigned char>(size)};
  writeBytes(f, prefix, sizeof(prefix));
  writeBytes(f, cipher.data(), size);
}
inline void write(FILE *f, const std::string &code, std::string_view manifest, const std::vector<Source> &sources,
                  const char *directory, const char *prefix) {
  check(sodium_init() >= 0 && !manifest.empty() && manifest.size() <= maxManifest && sources.size() <= 10000);
  Stream stream;
  unsigned char salt[crypto_pwhash_SALTBYTES], header[crypto_secretstream_xchacha20poly1305_HEADERBYTES];
  randombytes_buf(salt, sizeof(salt));
  stream.derive(code, salt);
  check(crypto_secretstream_xchacha20poly1305_init_push(&stream.state, header, stream.key) == 0);
  writeBytes(f, magic, sizeof(magic));
  writeBytes(f, salt, sizeof(salt));
  writeBytes(f, header, sizeof(header));
  Bytes cipher;
  frame(f, stream, reinterpret_cast<const unsigned char *>(manifest.data()), manifest.size(),
        crypto_secretstream_xchacha20poly1305_TAG_PUSH, cipher);
  long long remaining = maxPhotosBytes;
  for (const auto &source : sources) {
    check(source.length > 0 && source.length <= remaining);
    Hash hash;
    auto length = journal_picker::capture(directory, source.name, prefix, source.length,
      [&](const unsigned char *chunk, size_t n) {
        hash.update(chunk, n);
        frame(f, stream, chunk, n, crypto_secretstream_xchacha20poly1305_TAG_MESSAGE, cipher);
      });
    check(length == source.length && hash.finish() == source.hash);
    remaining -= length;
    frame(f, stream, nullptr, 0, crypto_secretstream_xchacha20poly1305_TAG_PUSH, cipher);
  }
  frame(f, stream, nullptr, 0, crypto_secretstream_xchacha20poly1305_TAG_FINAL, cipher);
  check(fflush(f) == 0);
}

struct Reader {
  FILE *file;
  Stream stream;
  Bytes cipher, plain;
  explicit Reader(FILE *f, const std::string &code) : file(f) {
    unsigned char format[sizeof(magic)], salt[crypto_pwhash_SALTBYTES], header[crypto_secretstream_xchacha20poly1305_HEADERBYTES];
    readBytes(f, format, sizeof(format));
    check(sodium_init() >= 0 && !memcmp(format, magic, sizeof(magic)));
    readBytes(f, salt, sizeof(salt));
    readBytes(f, header, sizeof(header));
    stream.derive(code, salt);
    check(crypto_secretstream_xchacha20poly1305_init_pull(&stream.state, header, stream.key) == 0);
  }
  ~Reader() { if (!plain.empty()) sodium_memzero(plain.data(), plain.size()); }
  unsigned char next(size_t limit) {
    unsigned char prefix[4], tag = 0;
    readBytes(file, prefix, sizeof(prefix));
    uint32_t size = 0;
    for (auto byte : prefix) size = (size << 8) | byte;
    check(size >= overhead && size - overhead <= limit);
    cipher.resize(size);
    readBytes(file, cipher.data(), size);
    if (!plain.empty()) sodium_memzero(plain.data(), plain.size());
    plain.resize(size - overhead);
    check(crypto_secretstream_xchacha20poly1305_pull(&stream.state, plain.data(), nullptr, &tag, cipher.data(), size,
      magic, sizeof(magic)) == 0);
    return tag;
  }
};

inline void verify(FILE *f, const std::string &code, std::string_view manifest, const std::vector<Source> &sources) {
  Reader reader(f, code);
  check(reader.next(maxManifest) == crypto_secretstream_xchacha20poly1305_TAG_PUSH &&
        reader.plain.size() == manifest.size() && !memcmp(reader.plain.data(), manifest.data(), manifest.size()));
  for (const auto &source : sources) {
    long long length = 0;
    Hash hash;
    while (true) {
      const auto tag = reader.next(maxChunk);
      if (tag == crypto_secretstream_xchacha20poly1305_TAG_PUSH) { check(reader.plain.empty()); break; }
      check(tag == crypto_secretstream_xchacha20poly1305_TAG_MESSAGE && !reader.plain.empty());
      length += static_cast<long long>(reader.plain.size());
      check(length <= source.length);
      hash.update(reader.plain.data(), reader.plain.size());
    }
    check(length == source.length && hash.finish() == source.hash);
  }
  check(reader.next(0) == crypto_secretstream_xchacha20poly1305_TAG_FINAL && fgetc(f) == EOF && !ferror(f));
}

inline void roundTrip(const char *directory, const char *prefix, std::string_view manifest, const std::vector<Source> &sources) {
  // Unlink before the first write. A process exit releases even an interrupted file.
  std::string path = std::string(directory) + "/journal-export-check-XXXXXX";
  const int fd = mkstemp(path.data());
  check(fd >= 0);
  if (unlink(path.c_str()) != 0) { close(fd); check(false); }
  std::unique_ptr<FILE, decltype(&fclose)> file(fdopen(fd, "w+b"), fclose);
  if (!file) { close(fd); check(false); }
  check(sodium_init() >= 0);
  unsigned char secret[16];
  char hex[33];
  randombytes_buf(secret, sizeof(secret));
  sodium_bin2hex(hex, sizeof(hex), secret, sizeof(secret));
  sodium_memzero(secret, sizeof(secret));
  std::string code(hex);
  sodium_memzero(hex, sizeof(hex));
  try {
    write(file.get(), code, manifest, sources, directory, prefix);
    check(fseek(file.get(), 0, SEEK_SET) == 0);
    verify(file.get(), code, manifest, sources);
  } catch (...) {
    sodium_memzero(code.data(), code.size());
    throw;
  }
  sodium_memzero(code.data(), code.size());
}
}
