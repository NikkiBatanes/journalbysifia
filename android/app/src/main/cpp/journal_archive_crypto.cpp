#include "../../../../../native/journal-archive/LocalRestoreCursor.hpp"
#include "../../../../../native/journal-archive/PickerPhotoDigest.hpp"
#include "../../../../../native/journal-archive/SyntheticSharedTransfer.hpp"
#include "../../../../../native/journal-archive/SyntheticFilePhoto.hpp"
#include <jni.h>
#include <sodium.h>

#include <array>
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <string_view>
#include <vector>

namespace {

constexpr std::size_t kAssertionCount = 8;
constexpr std::size_t kPortableAssertionCount = 8;
constexpr std::size_t kChunkCount = 3;

using Key = std::array<unsigned char, crypto_secretstream_xchacha20poly1305_KEYBYTES>;
using Salt = std::array<unsigned char, crypto_pwhash_SALTBYTES>;
using Header =
    std::array<unsigned char, crypto_secretstream_xchacha20poly1305_HEADERBYTES>;
using Bytes = std::vector<unsigned char>;

struct EncryptedStream {
  Header header{};
  std::array<Bytes, kChunkCount> chunks{};
};

const std::array<Bytes, kChunkCount> kPlaintextChunks = {
    Bytes{'s', 'y', 'n', 't', 'h', 'e', 't', 'i', 'c'},
    Bytes{'a', 'r', 'c', 'h', 'i', 'v', 'e'},
    Bytes{'f', 'i', 'n', 'a', 'l'},
};

constexpr std::string_view kPortablePassword =
    "synthetic-correct-recovery-code";
constexpr std::string_view kPortableWrongPassword =
    "synthetic-wrong-recovery-code";
constexpr std::string_view kPortableSaltHex =
    "000102030405060708090a0b0c0d0e0f";
constexpr std::string_view kPortableKeyHex =
    "71ca27880bd58fc77fec42bbbaba42258ab3fd5c9367c490c15050380a8a397b";
constexpr std::string_view kPortableHeaderHex =
    "a0a1a2a3a4a5a6a7a8a9aaabacadaeafb0b1b2b3b4b5b6b7";
const std::array<std::string_view, kChunkCount> kPortablePlaintextHex = {
    "73796e746865746963206a6f75726e616c206172636869766520686561646572",
    "73796e74686574696320656e74727920616e64206d65646961206279746573",
    "73796e7468657469632066696e616c2061726368697665207265636f7264",
};
const std::array<std::string_view, kChunkCount> kPortableCiphertextHex = {
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

template <std::size_t Size>
bool decodeFixed(std::string_view hex, std::array<unsigned char, Size>& bytes) {
  Bytes decoded;
  if (!decodeHex(hex, decoded) || decoded.size() != Size) {
    sodium_memzero(decoded.data(), decoded.size());
    return false;
  }
  std::memcpy(bytes.data(), decoded.data(), Size);
  sodium_memzero(decoded.data(), decoded.size());
  return true;
}

bool deriveKey(
    const char* password,
    std::size_t passwordSize,
    const Salt& salt,
    Key& key) {
  return crypto_pwhash(
             key.data(),
             key.size(),
             password,
             passwordSize,
             salt.data(),
             crypto_pwhash_OPSLIMIT_INTERACTIVE,
             crypto_pwhash_MEMLIMIT_INTERACTIVE,
             crypto_pwhash_ALG_ARGON2ID13) == 0;
}

bool encryptSyntheticStream(
    const Key& key,
    const std::array<Bytes, kChunkCount>& plaintextChunks,
    EncryptedStream& encrypted,
    const Header* fixedSyntheticHeader = nullptr) {
  crypto_secretstream_xchacha20poly1305_state state{};
  const int initResult = fixedSyntheticHeader == nullptr
      ? crypto_secretstream_xchacha20poly1305_init_push(
            &state, encrypted.header.data(), key.data())
      : ([&]() {
          encrypted.header = *fixedSyntheticHeader;
          return crypto_secretstream_xchacha20poly1305_init_pull(
              &state, encrypted.header.data(), key.data());
        })();
  if (initResult != 0) {
    sodium_memzero(&state, sizeof state);
    return false;
  }

  bool passed = true;
  for (std::size_t index = 0; index < kChunkCount; ++index) {
    const auto& plaintext = plaintextChunks[index];
    auto& ciphertext = encrypted.chunks[index];
    ciphertext.resize(
        plaintext.size() + crypto_secretstream_xchacha20poly1305_ABYTES);
    unsigned long long ciphertextLength = 0;
    const auto tag = index + 1 == kChunkCount
        ? crypto_secretstream_xchacha20poly1305_TAG_FINAL
        : crypto_secretstream_xchacha20poly1305_TAG_MESSAGE;
    if (crypto_secretstream_xchacha20poly1305_push(
            &state,
            ciphertext.data(),
            &ciphertextLength,
            plaintext.data(),
            plaintext.size(),
            nullptr,
            0,
            tag) != 0) {
      passed = false;
      break;
    }
    ciphertext.resize(static_cast<std::size_t>(ciphertextLength));
  }
  sodium_memzero(&state, sizeof state);
  return passed;
}

bool decryptStream(
    const Key& key,
    const EncryptedStream& encrypted,
    std::size_t chunkCount,
    const std::array<Bytes, kChunkCount>& expectedPlaintext,
    bool comparePlaintext) {
  crypto_secretstream_xchacha20poly1305_state state{};
  if (crypto_secretstream_xchacha20poly1305_init_pull(
          &state, encrypted.header.data(), key.data()) != 0) {
    sodium_memzero(&state, sizeof state);
    return false;
  }

  bool sawFinal = false;
  bool passed = true;
  for (std::size_t index = 0; index < chunkCount; ++index) {
    const auto& ciphertext = encrypted.chunks[index];
    Bytes recovered(ciphertext.size());
    unsigned long long recoveredLength = 0;
    unsigned char tag = 0;
    const int result = crypto_secretstream_xchacha20poly1305_pull(
        &state,
        recovered.data(),
        &recoveredLength,
        &tag,
        ciphertext.data(),
        ciphertext.size(),
        nullptr,
        0);
    if (result != 0) {
      passed = false;
    } else {
      recovered.resize(static_cast<std::size_t>(recoveredLength));
      sawFinal = tag == crypto_secretstream_xchacha20poly1305_TAG_FINAL;
      if (comparePlaintext && recovered != expectedPlaintext[index]) {
        passed = false;
      }
      if (index + 1 < kChunkCount && sawFinal) {
        passed = false;
      }
    }
    sodium_memzero(recovered.data(), recovered.size());
    if (!passed) {
      break;
    }
  }
  sodium_memzero(&state, sizeof state);
  return passed && sawFinal;
}

bool pullMustFail(
    const Key& key,
    const Header& header,
    const Bytes& ciphertext) {
  crypto_secretstream_xchacha20poly1305_state state{};
  if (crypto_secretstream_xchacha20poly1305_init_pull(
          &state, header.data(), key.data()) != 0) {
    sodium_memzero(&state, sizeof state);
    return true;
  }
  Bytes recovered(ciphertext.size());
  unsigned long long recoveredLength = 0;
  unsigned char tag = 0;
  const int result = crypto_secretstream_xchacha20poly1305_pull(
      &state,
      recovered.data(),
      &recoveredLength,
      &tag,
      ciphertext.data(),
      ciphertext.size(),
      nullptr,
      0);
  sodium_memzero(recovered.data(), recovered.size());
  sodium_memzero(&state, sizeof state);
  return result != 0;
}

std::array<bool, kAssertionCount> runSyntheticAssertions() {
  std::array<bool, kAssertionCount> assertions{};
  if (sodium_init() < 0) {
    return assertions;
  }

  Salt salt{};
  randombytes_buf(salt.data(), salt.size());
  std::array<char, 21> password = {
      'j', 'o', 'u', 'r', 'n', 'a', 'l', '-', 's', 'y', 'n', 't', 'h', 'e',
      't', 'i', 'c', '-', 'o', 'n', 'e'};
  std::array<char, 21> wrongPassword = {
      'j', 'o', 'u', 'r', 'n', 'a', 'l', '-', 's', 'y', 'n', 't', 'h', 'e',
      't', 'i', 'c', '-', 't', 'w', 'o'};
  Key key{};
  Key wrongKey{};
  EncryptedStream encrypted{};

  assertions[0] = deriveKey(password.data(), password.size(), salt, key);
  const bool wrongKeyDerived =
      deriveKey(wrongPassword.data(), wrongPassword.size(), salt, wrongKey);
  const bool encryptedSuccessfully =
      assertions[0] && encryptSyntheticStream(key, kPlaintextChunks, encrypted);
  assertions[1] = encryptedSuccessfully &&
      decryptStream(key, encrypted, kChunkCount, kPlaintextChunks, true);
  assertions[2] = encryptedSuccessfully && wrongKeyDerived &&
      pullMustFail(wrongKey, encrypted.header, encrypted.chunks[0]);

  if (encryptedSuccessfully) {
    Bytes tampered = encrypted.chunks[0];
    tampered[tampered.size() / 2] ^= 0x01;
    assertions[3] = pullMustFail(key, encrypted.header, tampered);
    sodium_memzero(tampered.data(), tampered.size());

    Bytes truncated = encrypted.chunks[0];
    truncated.pop_back();
    assertions[4] = pullMustFail(key, encrypted.header, truncated);
    sodium_memzero(truncated.data(), truncated.size());

    assertions[5] =
        pullMustFail(key, encrypted.header, encrypted.chunks[1]);
    assertions[6] =
        !decryptStream(key, encrypted, kChunkCount - 1, kPlaintextChunks, true);
  }

  sodium_memzero(key.data(), key.size());
  sodium_memzero(wrongKey.data(), wrongKey.size());
  sodium_memzero(password.data(), password.size());
  sodium_memzero(wrongPassword.data(), wrongPassword.size());
  sodium_memzero(salt.data(), salt.size());
  for (auto& ciphertext : encrypted.chunks) {
    sodium_memzero(ciphertext.data(), ciphertext.size());
  }
  sodium_memzero(encrypted.header.data(), encrypted.header.size());

  const auto allZero = [](const auto& buffer) {
    for (const auto value : buffer) {
      if (value != 0) {
        return false;
      }
    }
    return true;
  };
  assertions[7] = allZero(key) && allZero(wrongKey) && allZero(password) &&
      allZero(wrongPassword) && allZero(salt) && allZero(encrypted.header);
  return assertions;
}

std::array<bool, kPortableAssertionCount> runPortableVectorAssertions() {
  std::array<bool, kPortableAssertionCount> assertions{};
  if (sodium_init() < 0 || crypto_pwhash_OPSLIMIT_INTERACTIVE != 2 ||
      crypto_pwhash_MEMLIMIT_INTERACTIVE != 67108864) {
    return assertions;
  }

  Salt salt{};
  Key key{};
  Key expectedKey{};
  Key wrongKey{};
  Header header{};
  std::array<Bytes, kChunkCount> plaintext{};
  std::array<Bytes, kChunkCount> expectedCiphertext{};
  EncryptedStream emitted{};
  EncryptedStream expected{};

  bool decoded = decodeFixed(kPortableSaltHex, salt) &&
      decodeFixed(kPortableKeyHex, expectedKey) &&
      decodeFixed(kPortableHeaderHex, header);
  for (std::size_t index = 0; index < kChunkCount; ++index) {
    decoded = decoded && decodeHex(kPortablePlaintextHex[index], plaintext[index]) &&
        decodeHex(kPortableCiphertextHex[index], expectedCiphertext[index]);
    expected.chunks[index] = expectedCiphertext[index];
  }
  expected.header = header;

  const bool keyDerived = decoded && deriveKey(
      kPortablePassword.data(), kPortablePassword.size(), salt, key);
  assertions[0] = keyDerived && sodium_memcmp(
      key.data(), expectedKey.data(), key.size()) == 0;
  const bool emittedSuccessfully = assertions[0] && encryptSyntheticStream(
      key, plaintext, emitted, &header);
  assertions[1] = emittedSuccessfully && emitted.header == header &&
      emitted.chunks == expectedCiphertext;
  assertions[2] = assertions[1] &&
      decryptStream(key, expected, kChunkCount, plaintext, true);

  const bool wrongKeyDerived = decoded && deriveKey(
      kPortableWrongPassword.data(), kPortableWrongPassword.size(), salt, wrongKey);
  assertions[3] = wrongKeyDerived &&
      pullMustFail(wrongKey, header, expectedCiphertext[0]);

  if (decoded) {
    Bytes tampered = expectedCiphertext[0];
    tampered[tampered.size() / 2] ^= 0x01;
    Bytes truncated = expectedCiphertext[0];
    truncated.pop_back();
    assertions[4] = pullMustFail(key, header, tampered) &&
        pullMustFail(key, header, truncated);
    assertions[5] = pullMustFail(key, header, expectedCiphertext[1]);
    assertions[6] = !decryptStream(
        key, expected, kChunkCount - 1, plaintext, true);
    sodium_memzero(tampered.data(), tampered.size());
    sodium_memzero(truncated.data(), truncated.size());
  }

  sodium_memzero(key.data(), key.size());
  sodium_memzero(expectedKey.data(), expectedKey.size());
  sodium_memzero(wrongKey.data(), wrongKey.size());
  sodium_memzero(salt.data(), salt.size());
  sodium_memzero(header.data(), header.size());
  sodium_memzero(emitted.header.data(), emitted.header.size());
  sodium_memzero(expected.header.data(), expected.header.size());
  for (std::size_t index = 0; index < kChunkCount; ++index) {
    sodium_memzero(plaintext[index].data(), plaintext[index].size());
    sodium_memzero(expectedCiphertext[index].data(), expectedCiphertext[index].size());
    sodium_memzero(emitted.chunks[index].data(), emitted.chunks[index].size());
    sodium_memzero(expected.chunks[index].data(), expected.chunks[index].size());
  }
  const auto allZero = [](const auto& buffer) {
    for (const auto value : buffer) {
      if (value != 0) {
        return false;
      }
    }
    return true;
  };
  assertions[7] = allZero(key) && allZero(expectedKey) && allZero(wrongKey) &&
      allZero(salt) && allZero(header) && allZero(emitted.header) &&
      allZero(expected.header);
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

extern "C" JNIEXPORT jstring JNICALL
Java_app_journal_sifia_archivecrypto_JournalArchiveCryptoModule_nativeSodiumVersion(
    JNIEnv* env,
    jobject) {
  if (sodium_init() < 0) {
    return env->NewStringUTF("unavailable");
  }
  return env->NewStringUTF(sodium_version_string());
}

extern "C" JNIEXPORT jbooleanArray JNICALL
Java_app_journal_sifia_archivecrypto_JournalArchiveCryptoModule_nativeRunSyntheticSelfTest(
    JNIEnv* env,
    jobject) {
  try {
    const auto assertions = runSyntheticAssertions();
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

extern "C" JNIEXPORT jbooleanArray JNICALL
Java_app_journal_sifia_archivecrypto_JournalArchiveCryptoModule_nativeRunPortableVectorSelfTest(
    JNIEnv* env,
    jobject) {
  try {
    const auto assertions = runPortableVectorAssertions();
    jbooleanArray result = env->NewBooleanArray(kPortableAssertionCount);
    if (result == nullptr) {
      return nullptr;
    }
    std::array<jboolean, kPortableAssertionCount> values{};
    for (std::size_t index = 0; index < assertions.size(); ++index) {
      values[index] = assertions[index] ? JNI_TRUE : JNI_FALSE;
    }
    env->SetBooleanArrayRegion(result, 0, values.size(), values.data());
    return result;
  } catch (...) {
    return falseEvidence(env);
  }
}

extern "C" JNIEXPORT jstring JNICALL
Java_app_journal_sifia_archivecrypto_JournalArchiveCryptoModule_nativeSampleDocument(
    JNIEnv *env, jobject, jstring document, jstring recoveryCode, jboolean exporting, jint entryCount) {
  const char *path = env->GetStringUTFChars(document, nullptr);
  const char *code = path ? env->GetStringUTFChars(recoveryCode, nullptr) : nullptr;
  jstring result = nullptr;
  if (code) {
    try {
      const auto value = journal_shared_transfer::sampleDocument(path, code, exporting, entryCount);
      result = env->NewStringUTF(value.c_str());
    } catch (const std::exception &) {}
    env->ReleaseStringUTFChars(recoveryCode, code);
  }
  if (path) env->ReleaseStringUTFChars(document, path);
  return result;
}

extern "C" JNIEXPORT jstring JNICALL
Java_app_journal_sifia_archivecrypto_JournalArchiveCryptoModule_nativeFinishSamplePreview(
    JNIEnv *env, jobject, jstring directory, jstring previewId, jstring recoveryCode, jboolean confirm) {
  const char *dir = env->GetStringUTFChars(directory, nullptr);
  if (!dir) return nullptr;
  const char *id = env->GetStringUTFChars(previewId, nullptr);
  const char *code = id ? env->GetStringUTFChars(recoveryCode, nullptr) : nullptr;
  jstring result = nullptr;
  if (code) {
    try {
      auto value = journal_shared_transfer::samplePreviews().finish(dir, id, code, confirm);
      result = env->NewStringUTF(value.c_str());
    } catch (const std::exception &) {
      // Kotlin reports a generic failure without exposing the selected file or code.
    }
    env->ReleaseStringUTFChars(recoveryCode, code);
  }
  if (id) env->ReleaseStringUTFChars(previewId, id);
  env->ReleaseStringUTFChars(directory, dir);
  return result;
}

extern "C" JNIEXPORT jstring JNICALL
Java_app_journal_sifia_archivecrypto_JournalArchiveCryptoModule_nativeSyntheticTransfer(
    JNIEnv *env, jobject, jstring directory, jboolean exporting, jboolean sharedPhotos) {
  const char *path = env->GetStringUTFChars(directory, nullptr);
  if (!path) return nullptr;
  try {
    std::string result;
    if (sharedPhotos) {
      result = exporting ? journal_shared_transfer::exportArchive(path) : journal_shared_transfer::importArchive(path);
    } else {
      result = exporting ? journal_fixture::exportFixture(path) : journal_fixture::importFixture(path);
    }
    env->ReleaseStringUTFChars(directory, path);
    return env->NewStringUTF(result.c_str());
  } catch (const std::exception &) {
    env->ReleaseStringUTFChars(directory, path);
    return nullptr;
  }
}

extern "C" JNIEXPORT jstring JNICALL
Java_app_journal_sifia_archivecrypto_JournalArchiveCryptoModule_nativeFixturePhoto(
    JNIEnv *env, jobject, jstring directory, jstring name, jboolean replacement, jboolean sharedStore) {
  const char *path = env->GetStringUTFChars(directory, nullptr);
  if (!path) return nullptr;
  const char *filename = name ? env->GetStringUTFChars(name, nullptr) : nullptr;
  jstring result = nullptr;
  try {
    if (!name) {
      auto staged = journal_photo_fixture::stage(sharedStore ? journal_photo_fixture::sharedBase(path) : std::string(path), replacement);
      result = env->NewStringUTF(staged.c_str());
    } else if (filename) {
      journal_photo_fixture::verifyAndCollect(path, filename, replacement);
      result = env->NewStringUTF("verified");
    }
  } catch (const std::exception &) {
    // Kotlin rejects the promise on null.
  }
  if (filename) env->ReleaseStringUTFChars(name, filename);
  env->ReleaseStringUTFChars(directory, path);
  return result;
}

extern "C" JNIEXPORT jboolean JNICALL
Java_app_journal_sifia_archivecrypto_JournalArchiveCryptoModule_nativePhotoInterruption(
    JNIEnv *env, jobject, jstring directory, jboolean afterPublication, jboolean inspect) {
  const char *path = env->GetStringUTFChars(directory, nullptr);
  if (!path) return JNI_FALSE;
  bool verified = false;
  try {
    if (inspect) {
      journal_photo_fixture::checkInterruption(path, afterPublication);
      verified = true;
    } else {
      using journal_photo_fixture::Interruption;
      journal_photo_fixture::stage(path, true, afterPublication
        ? Interruption::afterPublication : Interruption::duringCopy);
    }
  } catch (const std::exception &) {
    // Fail closed on an unexpected return or invalid fixture evidence.
  }
  env->ReleaseStringUTFChars(directory, path);
  return verified;
}

extern "C" JNIEXPORT jboolean JNICALL
Java_app_journal_sifia_archivecrypto_JournalArchiveCryptoModule_nativeVerifySharedPhotos(
    JNIEnv *env, jobject, jstring directory, jstring shared, jstring other) {
  const char *path = env->GetStringUTFChars(directory, nullptr);
  if (!path) return JNI_FALSE;
  const char *first = env->GetStringUTFChars(shared, nullptr);
  const char *second = first ? env->GetStringUTFChars(other, nullptr) : nullptr;
  bool verified = false;
  if (second) {
    try {
      journal_photo_fixture::verifySharedPhotos(path, first, second);
      verified = true;
    } catch (const std::exception &) {}
    env->ReleaseStringUTFChars(other, second);
  }
  if (first) env->ReleaseStringUTFChars(shared, first);
  env->ReleaseStringUTFChars(directory, path);
  return verified;
}

extern "C" JNIEXPORT jboolean JNICALL
Java_app_journal_sifia_archivecrypto_JournalArchiveCryptoModule_nativeVerifyTransferredPhotos(
    JNIEnv *env, jobject, jstring directory, jstring shared, jstring sharedHash, jstring other, jstring otherHash, jboolean collectUnused) {
  const std::array<jstring, 5> args{directory, shared, sharedHash, other, otherHash};
  std::array<std::string, 5> values;
  for (size_t i = 0; i < args.size(); ++i) {
    const char *value = env->GetStringUTFChars(args[i], nullptr);
    if (!value) return JNI_FALSE;
    values[i] = value;
    env->ReleaseStringUTFChars(args[i], value);
  }
  try {
    journal_shared_transfer::verifyPair(values[0], values[1], values[2], values[3], values[4], collectUnused == JNI_TRUE);
    return JNI_TRUE;
  } catch (const std::exception &) {
    return JNI_FALSE;
  }
}

extern "C" JNIEXPORT jstring JNICALL
Java_app_journal_sifia_archivecrypto_JournalArchiveCryptoModule_nativeInspectPickerPhoto(
    JNIEnv *env, jobject, jstring directory, jstring name, jlong remaining, jboolean describe) {
  const char *dir = env->GetStringUTFChars(directory, nullptr);
  if (!dir) return nullptr;
  const char *leaf = env->GetStringUTFChars(name, nullptr);
  std::string result = "-3";
  if (leaf) {
    result = describe ? journal_picker::fingerprint(dir, leaf, "rn_image_picker_lib_temp_", remaining)
                      : std::to_string(journal_picker::inspect(dir, leaf, "rn_image_picker_lib_temp_", remaining));
    env->ReleaseStringUTFChars(name, leaf);
  }
  env->ReleaseStringUTFChars(directory, dir);
  return env->ExceptionCheck() ? nullptr : env->NewStringUTF(result.c_str());
}

extern "C" JNIEXPORT jboolean JNICALL
Java_app_journal_sifia_archivecrypto_JournalArchiveCryptoModule_nativeVerifyLocalSnapshot(
    JNIEnv *env, jobject, jstring directory, jstring base, jbyteArray manifest, jstring sources,
    jstring stagingFile, jstring recoveryCode) {
  const auto size = env->GetArrayLength(manifest);
  if (size <= 0 || static_cast<size_t>(size) > journal_snapshot::maxManifest) return JNI_FALSE;
  const char *dir = env->GetStringUTFChars(directory, nullptr);
  const char *root = dir ? env->GetStringUTFChars(base, nullptr) : nullptr;
  const char *rows = root ? env->GetStringUTFChars(sources, nullptr) : nullptr;
  const char *path = rows && stagingFile ? env->GetStringUTFChars(stagingFile, nullptr) : nullptr;
  const char *code = path && recoveryCode ? env->GetStringUTFChars(recoveryCode, nullptr) : nullptr;
  bool verified = false;
  if (rows && (!stagingFile || code)) {
    try {
      auto files = journal_snapshot::sourcesFrom(rows, root);
      std::string bytes(size, '\0');
      env->GetByteArrayRegion(manifest, 0, size, reinterpret_cast<jbyte *>(bytes.data()));
      try {
        if (!env->ExceptionCheck()) {
          if (path) journal_snapshot::saveDocument(path, code, bytes, files, dir, "rn_image_picker_lib_temp_");
          else journal_snapshot::roundTrip(dir, "rn_image_picker_lib_temp_", bytes, files);
          verified = true;
        }
      } catch (const std::exception &) { /* Return failure without exposing user data. */ }
      sodium_memzero(bytes.data(), bytes.size());
    } catch (const std::exception &) { /* Invalid descriptors or insufficient memory. */ }
  }
  if (code) env->ReleaseStringUTFChars(recoveryCode, code);
  if (path) env->ReleaseStringUTFChars(stagingFile, path);
  if (rows) env->ReleaseStringUTFChars(sources, rows);
  if (root) env->ReleaseStringUTFChars(base, root);
  if (dir) env->ReleaseStringUTFChars(directory, dir);
  return verified ? JNI_TRUE : JNI_FALSE;
}

extern "C" JNIEXPORT jbyteArray JNICALL
Java_app_journal_sifia_archivecrypto_JournalArchiveCryptoModule_nativeOpenLocalSnapshot(
    JNIEnv *env, jobject, jstring stagingFile, jstring recoveryCode) {
  const char *path = env->GetStringUTFChars(stagingFile, nullptr);
  const char *code = path ? env->GetStringUTFChars(recoveryCode, nullptr) : nullptr;
  jbyteArray result = nullptr;
  if (code) {
    try {
      auto preview = journal_snapshot::localRestoreCursor().preview(path, code);
      result = env->NewByteArray(static_cast<jsize>(preview.size()));
      if (result) env->SetByteArrayRegion(result, 0, static_cast<jsize>(preview.size()),
                                          reinterpret_cast<const jbyte *>(preview.data()));
      sodium_memzero(preview.data(), preview.size());
    } catch (const std::exception &) {}
    env->ReleaseStringUTFChars(recoveryCode, code);
  }
  if (path) env->ReleaseStringUTFChars(stagingFile, path);
  return result;
}

extern "C" JNIEXPORT jstring JNICALL
Java_app_journal_sifia_archivecrypto_JournalArchiveCryptoModule_nativeReadLocalRestoreFrame(
    JNIEnv *env, jobject, jstring token, jboolean discard) {
  const char *id = env->GetStringUTFChars(token, nullptr);
  if (!id) return nullptr;
  jstring result = nullptr;
  try {
    const auto frame = journal_snapshot::localRestoreCursor().next(id, discard);
    result = env->NewStringUTF(frame.c_str());
  } catch (const std::exception &) {}
  env->ReleaseStringUTFChars(token, id);
  return result;
}
