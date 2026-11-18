#include <jni.h>
#include <sodium.h>

#include <array>
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <vector>

namespace {

constexpr std::size_t kAssertionCount = 8;
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

bool deriveKey(const std::array<char, 21>& password, const Salt& salt, Key& key) {
  return crypto_pwhash(
             key.data(),
             key.size(),
             password.data(),
             password.size(),
             salt.data(),
             crypto_pwhash_OPSLIMIT_INTERACTIVE,
             crypto_pwhash_MEMLIMIT_INTERACTIVE,
             crypto_pwhash_ALG_ARGON2ID13) == 0;
}

bool encryptSyntheticStream(const Key& key, EncryptedStream& encrypted) {
  crypto_secretstream_xchacha20poly1305_state state{};
  if (crypto_secretstream_xchacha20poly1305_init_push(
          &state, encrypted.header.data(), key.data()) != 0) {
    sodium_memzero(&state, sizeof state);
    return false;
  }

  bool passed = true;
  for (std::size_t index = 0; index < kChunkCount; ++index) {
    const auto& plaintext = kPlaintextChunks[index];
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
      if (comparePlaintext && recovered != kPlaintextChunks[index]) {
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

  assertions[0] = deriveKey(password, salt, key);
  const bool wrongKeyDerived = deriveKey(wrongPassword, salt, wrongKey);
  const bool encryptedSuccessfully =
      assertions[0] && encryptSyntheticStream(key, encrypted);
  assertions[1] =
      encryptedSuccessfully && decryptStream(key, encrypted, kChunkCount, true);
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
    assertions[6] = !decryptStream(key, encrypted, kChunkCount - 1, true);
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
