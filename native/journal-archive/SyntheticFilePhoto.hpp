// Development fixture. All file access is confined to a dedicated single-entry
// directory under the native app's private storage.
#pragma once
#include "StageEncryptedAttachment.hpp"
#include "SyntheticTransfer.hpp"
#include <zlib.h>

namespace journal_photo_fixture {
using journal_fixture::Bytes;
using journal_fixture::require;

inline void append32(std::string &out, uint32_t value) {
  for (int shift : {24, 16, 8, 0}) out.push_back(static_cast<char>(value >> shift));
}

inline void chunk(std::string &out, const char *type, const std::string &data) {
  append32(out, static_cast<uint32_t>(data.size()));
  const auto start = out.size();
  out.append(type, 4).append(data);
  append32(out, crc32(0, reinterpret_cast<const Bytef *>(out.data() + start), data.size() + 4));
}

inline std::string png(bool replacement) {
  constexpr unsigned width = 1600, height = 1200;
  std::string rows((width + 1) * height, 0);
  uint32_t state = replacement ? 321 : 123;
  for (unsigned row = 0; row < height; ++row) {
    for (unsigned x = 1; x <= width; ++x) {
      state ^= state << 13;
      state ^= state >> 17;
      state ^= state << 5;
      rows[row * (width + 1) + x] = static_cast<char>(state);
    }
  }
  uLongf size = compressBound(rows.size());
  std::string compressed(size, 0);
  require(compress2(reinterpret_cast<Bytef *>(compressed.data()), &size,
    reinterpret_cast<const Bytef *>(rows.data()), rows.size(), 1) == Z_OK);
  compressed.resize(size);
  std::string out("\x89PNG\r\n\x1a\n", 8), header;
  append32(header, width);
  append32(header, height);
  header.append("\x08\0\0\0\0", 5);
  chunk(out, "IHDR", header);
  chunk(out, "IDAT", compressed);
  chunk(out, "IEND", {});
  return out;
}

inline std::string directory(const std::string &base) {
  const auto dir = base + "/journal-development-photo-v1";
  require(mkdir(dir.c_str(), 0700) == 0 || errno == EEXIST);
  journal_attachment::Descriptor checkDir(open(dir.c_str(), O_DIRECTORY | O_RDONLY | O_NOFOLLOW));
  return dir;
}

inline std::string stage(const std::string &base, bool replacement) {
  require(sodium_init() >= 0);
  const auto dir = directory(base);
  const auto source = dir + "/fixture.sealed";
  const auto data = journal_fixture::encrypt(png(replacement));
  std::array<unsigned char, crypto_hash_sha256_BYTES> digest{};
  crypto_hash_sha256(digest.data(), data.data(), data.size());
  journal_attachment::Descriptor file(open(source.c_str(), O_WRONLY | O_TRUNC | O_CREAT | O_NOFOLLOW, 0600));
  try {
    size_t offset = 0;
    while (offset < data.size()) {
      auto n = write(file.fd, data.data() + offset, data.size() - offset);
      if (n < 0 && errno == EINTR) continue;
      require(n > 0);
      offset += static_cast<size_t>(n);
    }
    auto name = journal_attachment::stage(source, dir, data.size(), digest, [](size_t) {});
    require(unlink(source.c_str()) == 0);
    return name;
  } catch (...) {
    unlink(source.c_str());
    throw;
  }
}

// Call after opening the recovered single-record database and validating its index.
inline void verifyAndCollect(const std::string &base, const std::string &name, bool replacement) {
  require(sodium_init() >= 0 && journal_attachment::generatedName(name, "photo-"));
  const auto dir = directory(base);
  const auto expected = png(replacement);
  Bytes data(expected.size() + journal_fixture::overhead);
  journal_attachment::Descriptor file(open((dir + "/" + name).c_str(), O_RDONLY | O_NOFOLLOW | O_NONBLOCK));
  struct stat st{};
  require(fstat(file.fd, &st) == 0 && S_ISREG(st.st_mode) && st.st_size == static_cast<off_t>(data.size()));
  for (size_t offset = 0; offset < data.size();) {
    const auto n = read(file.fd, data.data() + offset, data.size() - offset);
    if (n < 0 && errno == EINTR) continue;
    require(n > 0);
    offset += static_cast<size_t>(n);
  }
  require(journal_fixture::openAuthenticatedFrame(data, journal_fixture::password) == expected);
  journal_attachment::collect(dir, {name});
}
} // namespace journal_photo_fixture
