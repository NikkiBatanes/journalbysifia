// Read-only inspection of the app's own image-picker files.
#pragma once
#include <algorithm>
#include <array>
#include <cerrno>
#include <cstring>
#include <fcntl.h>
#include <string>
#include <string_view>
#include <sys/stat.h>
#include <unistd.h>

namespace journal_picker {
struct FileHandle {
  int fd;
  ~FileHandle() { if (fd >= 0) close(fd); }
  FileHandle(const FileHandle &) = delete;
  explicit FileHandle(int value) : fd(value) {}
};
inline bool uuid(std::string_view name) {
  if (name.size() != 36) return false;
  for (size_t i = 0; i < name.size(); ++i) {
    char c = name[i];
    if (i == 8 || i == 13 || i == 18 || i == 23) {
      if (c != '-') return false;
    } else if (!(c >= '0' && c <= '9') && !(c >= 'a' && c <= 'f') && !(c >= 'A' && c <= 'F')) return false;
  }
  return true;
}

// Positive values are bytes read. Negative results distinguish a missing file,
// an unsupported reference/image, a read failure and a budget limit.
constexpr long long missing = -1, unsupported = -2, unreadable = -3, tooLarge = -4;
inline long long inspect(const char *directory, std::string_view name, std::string_view prefix, long long budget) {
  if (name.substr(0, prefix.size()) != prefix) return unsupported;
  auto leaf = name.substr(prefix.size());
  auto dot = leaf.find('.');
  if (dot != 36 || !uuid(leaf.substr(0, dot))) return unsupported;
  const auto ext = leaf.substr(dot + 1);
  const bool jpeg = ext == "jpg" || ext == "jpeg";
  if (!jpeg && ext != "png") return unsupported;
  FileHandle dir(open(directory, O_RDONLY | O_DIRECTORY | O_CLOEXEC));
  if (dir.fd < 0) return unreadable;
  FileHandle file(openat(dir.fd, std::string(name).c_str(), O_RDONLY | O_NOFOLLOW | O_CLOEXEC | O_NONBLOCK));
  if (file.fd < 0) return errno == ENOENT ? missing : unreadable;
  struct stat before{}, after{};
  if (fstat(file.fd, &before) || !S_ISREG(before.st_mode) || before.st_size <= 0) return unreadable;
  if (before.st_size > std::min(budget, 512LL * 1024 * 1024)) return tooLarge;
  unsigned char magic[8];
  ssize_t got;
  do { got = pread(file.fd, magic, sizeof(magic), 0); } while (got < 0 && errno == EINTR);
  if (got < 0) return unreadable;
  const unsigned char png[] = {137,80,78,71,13,10,26,10};
  const bool signature = jpeg ? got >= 3 && magic[0] == 255 && magic[1] == 216 && magic[2] == 255
                              : got == 8 && std::memcmp(magic, png, 8) == 0;
  if (!signature) return unsupported;
  std::array<unsigned char, 32768> chunk;
  long long total = 0;
  while (total < before.st_size) {
    const size_t size = static_cast<size_t>(std::min<long long>(chunk.size(), before.st_size - total));
    const auto n = read(file.fd, chunk.data(), size);
    if (n < 0 && errno == EINTR) continue;
    if (n <= 0) return unreadable;
    total += n;
  }
  if (fstat(file.fd, &after) || after.st_size != before.st_size) return unreadable;
  return total;
}
}
