// The caller owns a private destination directory and supplies the ciphertext
// length and SHA-256 from a verified source. The database may refer to the
// returned basename only after this function returns. Existing files are immutable.
#pragma once
#include <sodium.h>
#include <dirent.h>
#include <array>
#include <cerrno>
#include <fcntl.h>
#include <memory>
#include <set>
#include <stdexcept>
#include <string>
#include <sys/stat.h>
#include <unistd.h>

namespace journal_attachment {
inline void check(bool ok) {
  if (!ok) throw std::runtime_error("Encrypted attachment staging failed");
}

struct Descriptor {
  int fd;
  explicit Descriptor(int value) : fd(value) { check(fd >= 0); }
  Descriptor(const Descriptor &) = delete;
  ~Descriptor() { if (fd >= 0) close(fd); }
};

template <typename Progress>
std::string stage(const std::string &source, const std::string &directory,
                  size_t length, const std::array<unsigned char, crypto_hash_sha256_BYTES> &expected,
                  Progress progress) {
  // Bound this development checkpoint to a single compressed image.
  check(length > 0 && length <= 16 * 1024 * 1024 && sodium_init() >= 0);
  Descriptor dir(open(directory.c_str(), O_RDONLY | O_DIRECTORY | O_NOFOLLOW));
  Descriptor input(open(source.c_str(), O_RDONLY | O_NOFOLLOW | O_NONBLOCK));
  struct stat info{};
  check(fstat(input.fd, &info) == 0 && S_ISREG(info.st_mode) && info.st_size == static_cast<off_t>(length));

  unsigned char random[16];
  char id[33];
  randombytes_buf(random, sizeof(random));
  sodium_bin2hex(id, sizeof(id), random, sizeof(random));
  const std::string partial = std::string("partial-") + id;
  const std::string published = std::string("photo-") + id;
  Descriptor out(openat(dir.fd, partial.c_str(), O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW, 0600));
  try {
    crypto_hash_sha256_state hash;
    crypto_hash_sha256_init(&hash);
    std::array<unsigned char, 64 * 1024> buffer;
    size_t total = 0;
    for (;;) {
      const auto n = read(input.fd, buffer.data(), buffer.size());
      if (n < 0 && errno == EINTR) continue;
      check(n >= 0);
      if (n == 0) break;
      total += static_cast<size_t>(n);
      check(total <= length);
      crypto_hash_sha256_update(&hash, buffer.data(), n);
      for (ssize_t offset = 0; offset < n;) {
        const auto written = write(out.fd, buffer.data() + offset, n - offset);
        if (written < 0 && errno == EINTR) continue;
        check(written > 0);
        offset += written;
      }
      progress(total);
    }
    std::array<unsigned char, crypto_hash_sha256_BYTES> actual;
    crypto_hash_sha256_final(&hash, actual.data());
    check(total == length && sodium_memcmp(actual.data(), expected.data(), actual.size()) == 0);
    check(fsync(out.fd) == 0);
    // linkat fails on collision. A crash can leave an unreferenced file,
    // but can never overwrite a photo still referenced by the old journal.
    check(linkat(dir.fd, partial.c_str(), dir.fd, published.c_str(), 0) == 0);
    check(unlinkat(dir.fd, partial.c_str(), 0) == 0 && fsync(dir.fd) == 0);
  } catch (...) {
    unlinkat(dir.fd, partial.c_str(), 0);
    throw;
  }
  return published;
}

inline bool generatedName(const std::string &name, const std::string &prefix) {
  return name.size() == prefix.size() + 32 && name.compare(0, prefix.size(), prefix) == 0 &&
    name.find_first_not_of("0123456789abcdef", prefix.size()) == std::string::npos;
}

// Only for a store exclusively held by the restore coordinator. Recover the
// journal first and supply all live references before discarding abandoned files.
inline void collect(const std::string &directory, const std::set<std::string> &live) {
  Descriptor dir(open(directory.c_str(), O_RDONLY | O_DIRECTORY | O_NOFOLLOW));
  std::unique_ptr<DIR, decltype(&closedir)> entries(fdopendir(dir.fd), closedir);
  check(entries != nullptr);
  dir.fd = -1; // fdopendir owns the descriptor after success.
  const int fd = dirfd(entries.get());
  for (const auto &name : live) {
    struct stat info{};
    check(generatedName(name, "photo-") && fstatat(fd, name.c_str(), &info, AT_SYMLINK_NOFOLLOW) == 0 &&
      S_ISREG(info.st_mode));
  }
  for (;;) {
    errno = 0;
    const auto entry = readdir(entries.get());
    if (!entry) {
      check(errno == 0);
      break;
    }
    const std::string name(entry->d_name);
    if (!live.count(name) && (generatedName(name, "partial-") || generatedName(name, "photo-"))) {
      check(unlinkat(fd, name.c_str(), 0) == 0);
    }
  }
  check(fsync(fd) == 0);
}
} // namespace journal_attachment
