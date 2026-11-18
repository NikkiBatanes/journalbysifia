#include <jni.h>

#include <algorithm>
#include <array>
#include <cerrno>
#include <cstddef>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <fcntl.h>
#include <string>
#include <string_view>
#include <sys/stat.h>
#include <sys/types.h>
#include <unistd.h>
#include <vector>

namespace {

constexpr std::size_t kAssertionCount = 9;
constexpr std::size_t kMaximumSyntheticArchiveBytes = 4096;
constexpr std::size_t kCiphertextChunkCount = 3;
constexpr mode_t kPrivateFileMode = S_IRUSR | S_IWUSR;

using Bytes = std::vector<unsigned char>;

constexpr std::array<unsigned char, 8> kMagic = {
    'S', 'I', 'F', 'I', 'A', 'J', '0', '1'};
constexpr std::string_view kSaltHex = "000102030405060708090a0b0c0d0e0f";
constexpr std::string_view kHeaderHex =
    "a0a1a2a3a4a5a6a7a8a9aaabacadaeafb0b1b2b3b4b5b6b7";
const std::array<std::string_view, kCiphertextChunkCount> kCiphertextHex = {
    "08e0cff804b63ad37feadc35d44b4c9aa8fe43cf1d3b36862285a1cf0b2e2345c7585cada67e3cbc0d2a592087ed0bb99d",
    "a21181073b795c1a67ed1ec661f57f3e43e8a8c3352d9835dd1a007b38eb956387489e9b760f3ac09e25cf29e1de92ae",
    "6cbe242c8df631374a27c4f32f60dcd873971fed1a674e869d2c3be45ddc19e32f8a3a7e766c9492367c6df585cdd4",
};

int hexNibble(char value) {
  if (value >= '0' && value <= '9') {
    return value - '0';
  }
  if (value >= 'a' && value <= 'f') {
    return value - 'a' + 10;
  }
  return -1;
}

bool decodeHex(std::string_view hex, Bytes& bytes) {
  if (hex.size() % 2 != 0) {
    return false;
  }
  bytes.resize(hex.size() / 2);
  for (std::size_t index = 0; index < bytes.size(); ++index) {
    const int high = hexNibble(hex[index * 2]);
    const int low = hexNibble(hex[index * 2 + 1]);
    if (high < 0 || low < 0) {
      return false;
    }
    bytes[index] = static_cast<unsigned char>((high << 4) | low);
  }
  return true;
}

bool writeAll(int descriptor, const unsigned char* bytes, std::size_t size) {
  std::size_t written = 0;
  while (written < size) {
    const ssize_t result = ::write(descriptor, bytes + written, size - written);
    if (result < 0 && errno == EINTR) {
      continue;
    }
    if (result <= 0) {
      return false;
    }
    written += static_cast<std::size_t>(result);
  }
  return true;
}

bool writeBounded(
    int descriptor,
    const unsigned char* bytes,
    std::size_t size,
    std::size_t maximum,
    std::size_t& total) {
  if (total > maximum || size > maximum - total) {
    return false;
  }
  if (!writeAll(descriptor, bytes, size)) {
    return false;
  }
  total += size;
  return true;
}

bool appendBounded(
    Bytes& destination,
    const unsigned char* bytes,
    std::size_t size,
    std::size_t maximum) {
  if (destination.size() > maximum || size > maximum - destination.size()) {
    return false;
  }
  destination.insert(destination.end(), bytes, bytes + size);
  return true;
}

std::array<unsigned char, 4> encodeLength(std::size_t size) {
  const auto value = static_cast<std::uint32_t>(size);
  return {
      static_cast<unsigned char>((value >> 24) & 0xff),
      static_cast<unsigned char>((value >> 16) & 0xff),
      static_cast<unsigned char>((value >> 8) & 0xff),
      static_cast<unsigned char>(value & 0xff),
  };
}

bool isPrivateRegularFile(const std::string& path) {
  struct stat status {};
  return ::lstat(path.c_str(), &status) == 0 && S_ISREG(status.st_mode) &&
      (status.st_mode & 0777) == kPrivateFileMode;
}

bool pathMissing(const std::string& path) {
  struct stat status {};
  errno = 0;
  return ::lstat(path.c_str(), &status) != 0 && errno == ENOENT;
}

bool createDurableFile(const std::string& path, const Bytes& bytes) {
  const int descriptor = ::open(
      path.c_str(), O_WRONLY | O_CREAT | O_EXCL | O_CLOEXEC | O_NOFOLLOW,
      kPrivateFileMode);
  if (descriptor < 0) {
    return false;
  }
  const bool wroteAndSynced =
      writeAll(descriptor, bytes.data(), bytes.size()) &&
      ::fsync(descriptor) == 0;
  const bool closed = ::close(descriptor) == 0;
  return wroteAndSynced && closed;
}

bool readExactFile(const std::string& path, Bytes& bytes) {
  const int descriptor = ::open(path.c_str(), O_RDONLY | O_CLOEXEC | O_NOFOLLOW);
  if (descriptor < 0) {
    return false;
  }
  struct stat status {};
  if (::fstat(descriptor, &status) != 0 || !S_ISREG(status.st_mode) ||
      status.st_size < 0 ||
      static_cast<std::uint64_t>(status.st_size) > kMaximumSyntheticArchiveBytes) {
    ::close(descriptor);
    return false;
  }
  bytes.resize(static_cast<std::size_t>(status.st_size));
  std::size_t readBytes = 0;
  while (readBytes < bytes.size()) {
    const ssize_t result =
        ::read(descriptor, bytes.data() + readBytes, bytes.size() - readBytes);
    if (result < 0 && errno == EINTR) {
      continue;
    }
    if (result <= 0) {
      ::close(descriptor);
      return false;
    }
    readBytes += static_cast<std::size_t>(result);
  }
  return ::close(descriptor) == 0;
}

bool unlinkIfPresent(const std::string& path) {
  return ::unlink(path.c_str()) == 0 || (errno == ENOENT && pathMissing(path));
}

std::array<bool, kAssertionCount> runFileTransportAssertions(
    const std::string& baseDirectory) {
  std::array<bool, kAssertionCount> assertions{};
  if (baseDirectory.empty() || baseDirectory.size() > 3000) {
    return assertions;
  }

  Bytes salt;
  Bytes header;
  std::array<Bytes, kCiphertextChunkCount> ciphertext{};
  bool decoded = decodeHex(kSaltHex, salt) && decodeHex(kHeaderHex, header);
  for (std::size_t index = 0; index < ciphertext.size(); ++index) {
    decoded = decoded && decodeHex(kCiphertextHex[index], ciphertext[index]);
  }
  if (!decoded) {
    return assertions;
  }

  std::string directoryTemplate =
      baseDirectory + "/journal-archive-transport-XXXXXX";
  std::vector<char> mutableTemplate(
      directoryTemplate.begin(), directoryTemplate.end());
  mutableTemplate.push_back('\0');
  char* createdDirectory = ::mkdtemp(mutableTemplate.data());
  if (createdDirectory == nullptr) {
    return assertions;
  }

  const std::string directory(createdDirectory);
  const std::string partial = directory + "/archive.sifia.part";
  const std::string published = directory + "/archive.sifia";
  const std::string stale = directory + "/stale.sifia.part";
  const std::string oversized = directory + "/oversized.sifia.part";
  const int directoryDescriptor =
      ::open(directory.c_str(), O_RDONLY | O_DIRECTORY | O_CLOEXEC | O_NOFOLLOW);

  const Bytes marker(kMagic.begin(), kMagic.end());
  const bool staleCreated = createDurableFile(stale, marker);
  assertions[6] = staleCreated && unlinkIfPresent(stale) && pathMissing(stale);

  const bool partialCreated = createDurableFile(partial, marker);
  assertions[3] = partialCreated && isPrivateRegularFile(partial) &&
      pathMissing(published) && unlinkIfPresent(partial) && pathMissing(partial) &&
      pathMissing(published);

  std::size_t oversizedTotal = 0;
  Bytes limitBlock(kMaximumSyntheticArchiveBytes, 0xa5);
  const int oversizedDescriptor = ::open(
      oversized.c_str(),
      O_WRONLY | O_CREAT | O_EXCL | O_CLOEXEC | O_NOFOLLOW,
      kPrivateFileMode);
  if (oversizedDescriptor >= 0) {
    const unsigned char extra = 0x5a;
    const bool filled = writeBounded(
        oversizedDescriptor,
        limitBlock.data(),
        limitBlock.size(),
        kMaximumSyntheticArchiveBytes,
        oversizedTotal);
    const bool rejected = !writeBounded(
        oversizedDescriptor,
        &extra,
        1,
        kMaximumSyntheticArchiveBytes,
        oversizedTotal);
    struct stat oversizedStatus {};
    const bool exactSize = ::fstat(oversizedDescriptor, &oversizedStatus) == 0 &&
        oversizedStatus.st_size ==
            static_cast<off_t>(kMaximumSyntheticArchiveBytes);
    const bool synced = ::fsync(oversizedDescriptor) == 0;
    const bool closed = ::close(oversizedDescriptor) == 0;
    assertions[1] = filled && rejected && exactSize && synced && closed &&
        unlinkIfPresent(oversized) && pathMissing(oversized) &&
        pathMissing(published);
  }

  Bytes expected;
  bool expectedBuilt = appendBounded(
      expected, kMagic.data(), kMagic.size(), kMaximumSyntheticArchiveBytes);
  expectedBuilt = expectedBuilt && appendBounded(
      expected, salt.data(), salt.size(), kMaximumSyntheticArchiveBytes);
  expectedBuilt = expectedBuilt && appendBounded(
      expected, header.data(), header.size(), kMaximumSyntheticArchiveBytes);
  for (const auto& chunk : ciphertext) {
    const auto frameLength = encodeLength(chunk.size());
    expectedBuilt = expectedBuilt && appendBounded(
        expected,
        frameLength.data(),
        frameLength.size(),
        kMaximumSyntheticArchiveBytes);
    expectedBuilt = expectedBuilt && appendBounded(
        expected, chunk.data(), chunk.size(), kMaximumSyntheticArchiveBytes);
  }

  const int partialDescriptor = ::open(
      partial.c_str(), O_WRONLY | O_CREAT | O_EXCL | O_CLOEXEC | O_NOFOLLOW,
      kPrivateFileMode);
  bool fileSynced = false;
  std::size_t total = 0;
  std::size_t writeCount = 0;
  bool writesPassed = expectedBuilt && partialDescriptor >= 0;
  const auto writeSegment = [&](const unsigned char* bytes, std::size_t size) {
    if (!writesPassed) {
      return;
    }
    writesPassed = writeBounded(
        partialDescriptor,
        bytes,
        size,
        kMaximumSyntheticArchiveBytes,
        total);
    if (writesPassed) {
      ++writeCount;
    }
  };
  writeSegment(kMagic.data(), kMagic.size());
  writeSegment(salt.data(), salt.size());
  writeSegment(header.data(), header.size());
  for (const auto& chunk : ciphertext) {
    const auto frameLength = encodeLength(chunk.size());
    writeSegment(frameLength.data(), frameLength.size());
    writeSegment(chunk.data(), chunk.size());
  }
  if (partialDescriptor >= 0) {
    fileSynced = writesPassed && ::fsync(partialDescriptor) == 0;
    writesPassed = ::close(partialDescriptor) == 0 && writesPassed;
  }

  assertions[0] = writesPassed && writeCount == 9 && total == expected.size() &&
      total < kMaximumSyntheticArchiveBytes;
  assertions[2] = assertions[0] && isPrivateRegularFile(partial) &&
      pathMissing(published);

  const bool renamed = assertions[2] &&
      ::rename(partial.c_str(), published.c_str()) == 0;
  const bool directorySynced = renamed && directoryDescriptor >= 0 &&
      ::fsync(directoryDescriptor) == 0;
  assertions[4] = renamed && pathMissing(partial) &&
      isPrivateRegularFile(published);
  assertions[5] = fileSynced && directorySynced;

  Bytes recovered;
  assertions[7] = assertions[4] && readExactFile(published, recovered) &&
      recovered == expected && isPrivateRegularFile(published);

  unlinkIfPresent(partial);
  unlinkIfPresent(published);
  unlinkIfPresent(stale);
  unlinkIfPresent(oversized);
  const bool directoryClosed = directoryDescriptor < 0 ||
      ::close(directoryDescriptor) == 0;
  const bool directoryRemoved = ::rmdir(directory.c_str()) == 0;
  assertions[8] = directoryClosed && directoryRemoved && pathMissing(directory);

  std::fill(limitBlock.begin(), limitBlock.end(), 0);
  std::fill(expected.begin(), expected.end(), 0);
  std::fill(recovered.begin(), recovered.end(), 0);
  std::fill(salt.begin(), salt.end(), 0);
  std::fill(header.begin(), header.end(), 0);
  for (auto& chunk : ciphertext) {
    std::fill(chunk.begin(), chunk.end(), 0);
  }
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
Java_app_journal_sifia_archivecrypto_JournalArchiveCryptoModule_nativeRunFileTransportSelfTest(
    JNIEnv* env,
    jobject,
    jstring cacheDirectory) {
  if (cacheDirectory == nullptr) {
    return falseEvidence(env);
  }
  const char* cacheDirectoryChars =
      env->GetStringUTFChars(cacheDirectory, nullptr);
  if (cacheDirectoryChars == nullptr) {
    return falseEvidence(env);
  }
  try {
    const auto assertions =
        runFileTransportAssertions(std::string(cacheDirectoryChars));
    env->ReleaseStringUTFChars(cacheDirectory, cacheDirectoryChars);
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
    env->ReleaseStringUTFChars(cacheDirectory, cacheDirectoryChars);
    return falseEvidence(env);
  }
}
