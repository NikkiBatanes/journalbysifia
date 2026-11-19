// Development fixtures use dedicated directories under the app's private storage.
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

enum class Interruption { none, duringCopy, afterPublication };

// Explicit development test. Terminate without stack unwinding, just as an
// external process stop would leave the staging files and database.
inline std::string stageImage(const std::string &dir, const std::string &image, Interruption interruption,
                              const std::string &immutableId = {}) {
  require(sodium_init() >= 0);
  const auto source = dir + "/fixture.sealed";
  const auto data = journal_fixture::encrypt(image);
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
    auto name = journal_attachment::stage(source, dir, data.size(), digest, [&](size_t copied) {
      if (interruption == Interruption::duringCopy && copied >= data.size() / 2 && copied < data.size())
        _exit(0);
    }, immutableId);
    require(unlink(source.c_str()) == 0);
    if (interruption == Interruption::afterPublication) _exit(0);
    return name;
  } catch (...) {
    unlink(source.c_str());
    throw;
  }
}

inline std::string stage(const std::string &base, bool replacement,
                         Interruption interruption = Interruption::none) {
  return stageImage(directory(base), png(replacement), interruption);
}

struct StagingFiles {
  size_t published = 0, partial = 0;
  off_t partialSize = 0, sourceSize = 0;
};

inline StagingFiles stagingFiles(const std::string &dir) {
  journal_attachment::Descriptor fd(open(dir.c_str(), O_RDONLY | O_DIRECTORY | O_NOFOLLOW));
  std::unique_ptr<DIR, decltype(&closedir)> entries(fdopendir(fd.fd), closedir);
  require(entries != nullptr);
  fd.fd = -1;
  StagingFiles files;
  for (;;) {
    errno = 0;
    const auto entry = readdir(entries.get());
    if (!entry) { require(errno == 0); break; }
    const std::string name(entry->d_name);
    if (journal_attachment::generatedName(name, "photo-")) {
      ++files.published;
    } else if (name == "fixture.sealed" || journal_attachment::generatedName(name, "partial-")) {
      struct stat info{};
      require(fstatat(dirfd(entries.get()), name.c_str(), &info, AT_SYMLINK_NOFOLLOW) == 0 &&
              S_ISREG(info.st_mode) && info.st_size > 0);
      if (name == "fixture.sealed") files.sourceSize = info.st_size;
      else { ++files.partial; files.partialSize = info.st_size; }
    }
  }
  return files;
}

inline void checkInterruption(const std::string &base, bool afterPublication) {
  const auto files = stagingFiles(directory(base));
  if (afterPublication) {
    require(files.published == 2 && files.partial == 0 && files.sourceSize == 0);
  } else {
    require(files.published == 1 && files.partial == 1 &&
            files.partialSize >= files.sourceSize / 2 && files.partialSize < files.sourceSize);
  }
}

inline void verifyPhoto(const std::string &dir, const std::string &name, bool replacement) {
  require(sodium_init() >= 0 && journal_attachment::generatedName(name, "photo-"));
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
}

inline void collectVerified(const std::string &dir, const std::set<std::string> &live) {
  journal_attachment::collect(dir, live);
  // This fixed ciphertext source is owned exclusively by this serial fixture.
  require(unlink((dir + "/fixture.sealed").c_str()) == 0 || errno == ENOENT);
  journal_attachment::Descriptor parent(open(dir.c_str(), O_RDONLY | O_DIRECTORY | O_NOFOLLOW));
  require(fsync(parent.fd) == 0);
  const auto files = stagingFiles(dir);
  require(files.published == live.size() && files.partial == 0 && files.sourceSize == 0);
}

inline void verifyAndCollect(const std::string &base, const std::string &name, bool replacement) {
  const auto dir = directory(base);
  verifyPhoto(dir, name, replacement);
  collectVerified(dir, {name});
}

// The two-entry test has its own private store, separate from all single-photo tests.
inline std::string sharedBase(const std::string &base) {
  const auto path = base + "/journal-development-shared-photos-v1";
  require(mkdir(path.c_str(), 0700) == 0 || errno == EEXIST);
  journal_attachment::Descriptor dir(open(path.c_str(), O_DIRECTORY | O_RDONLY | O_NOFOLLOW));
  return path;
}

inline void verifySharedPhotos(const std::string &base, const std::string &shared, const std::string &other) {
  const auto dir = directory(sharedBase(base));
  verifyPhoto(dir, other, true);
  std::set<std::string> live{other};
  if (!shared.empty()) {
    verifyPhoto(dir, shared, false);
    live.insert(shared);
  }
  collectVerified(dir, live);
}
} // namespace journal_photo_fixture
