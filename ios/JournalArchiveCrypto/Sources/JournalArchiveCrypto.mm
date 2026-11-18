#import "JournalArchiveCrypto.h"

#import <React/RCTBridgeModule.h>
#import <sodium.h>

#include <TargetConditionals.h>
#include <array>
#include <cstddef>
#include <memory>
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

dispatch_queue_t JournalArchiveCryptoQueue() {
  static dispatch_queue_t queue;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    queue = dispatch_queue_create(
        "app.journal.sifia.archive-crypto", DISPATCH_QUEUE_SERIAL);
  });
  return queue;
}

NSString *CurrentArchitecture() {
#if defined(__arm64__)
  return @"arm64";
#elif defined(__x86_64__)
  return @"x86_64";
#else
  return @"unknown";
#endif
}

bool DeriveKey(const std::array<char, 21>& password, const Salt& salt, Key& key) {
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

bool EncryptSyntheticStream(const Key& key, EncryptedStream& encrypted) {
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

bool DecryptStream(
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

bool PullMustFail(const Key& key, const Header& header, const Bytes& ciphertext) {
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

std::array<bool, kAssertionCount> RunSyntheticAssertions() {
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

  assertions[0] = DeriveKey(password, salt, key);
  const bool wrongKeyDerived = DeriveKey(wrongPassword, salt, wrongKey);
  const bool encryptedSuccessfully =
      assertions[0] && EncryptSyntheticStream(key, encrypted);
  assertions[1] =
      encryptedSuccessfully && DecryptStream(key, encrypted, kChunkCount, true);
  assertions[2] = encryptedSuccessfully && wrongKeyDerived &&
      PullMustFail(wrongKey, encrypted.header, encrypted.chunks[0]);

  if (encryptedSuccessfully) {
    Bytes tampered = encrypted.chunks[0];
    tampered[tampered.size() / 2] ^= 0x01;
    assertions[3] = PullMustFail(key, encrypted.header, tampered);
    sodium_memzero(tampered.data(), tampered.size());

    Bytes truncated = encrypted.chunks[0];
    truncated.pop_back();
    assertions[4] = PullMustFail(key, encrypted.header, truncated);
    sodium_memzero(truncated.data(), truncated.size());

    assertions[5] = PullMustFail(key, encrypted.header, encrypted.chunks[1]);
    assertions[6] = !DecryptStream(key, encrypted, kChunkCount - 1, true);
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

}  // namespace

@implementation JournalArchiveCrypto

RCT_EXPORT_MODULE(JournalArchiveCrypto)

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

- (void)getProviderEvidence:(RCTPromiseResolveBlock)resolve
                     reject:(RCTPromiseRejectBlock)reject {
  dispatch_async(JournalArchiveCryptoQueue(), ^{
    if (sodium_init() < 0) {
      reject(
          @"JOURNAL_ARCHIVE_PROVIDER_EVIDENCE_FAILED",
          @"libsodium initialization failed",
          nil);
      return;
    }
    resolve(@{
      @"libsodiumVersion" : [NSString stringWithUTF8String:sodium_version_string()],
      @"platform" : @"ios",
      @"architecture" : CurrentArchitecture(),
      @"runtimeOffJavaScriptThread" : @YES,
      @"syntheticOnly" : @YES,
      @"mobileProviderApproved" : @NO,
    });
  });
}

- (void)runSyntheticSelfTest:(RCTPromiseResolveBlock)resolve
                      reject:(RCTPromiseRejectBlock)reject {
  dispatch_async(JournalArchiveCryptoQueue(), ^{
    const auto assertions = RunSyntheticAssertions();
    resolve(@{
      @"argon2id" : @(assertions[0]),
      @"secretstream" : @(assertions[1]),
      @"wrongPasswordRejected" : @(assertions[2]),
      @"tamperRejected" : @(assertions[3]),
      @"truncationRejected" : @(assertions[4]),
      @"reorderingRejected" : @(assertions[5]),
      @"finalTagRequired" : @(assertions[6]),
      @"sensitiveBuffersCleared" : @(assertions[7]),
      @"plaintextFileWritten" : @NO,
    });
  });
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams&)params {
  return std::make_shared<facebook::react::NativeJournalArchiveCryptoSpecJSI>(
      params);
}

@end
