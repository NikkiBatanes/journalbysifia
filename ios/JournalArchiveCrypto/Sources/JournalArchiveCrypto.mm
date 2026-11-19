#include "../../../native/journal-archive/SyntheticSharedTransfer.hpp"
#if DEBUG
#include "../../../native/journal-archive/PickerPhotoDigest.hpp"
#include "../../../native/journal-archive/LocalSnapshotCheck.hpp"
#include "../../../native/journal-archive/SyntheticFilePhoto.hpp"
#endif
#import "JournalArchiveCrypto.h"
#include "JournalArchiveFileTransport.h"
#include "JournalArchiveMediaPackaging.h"

#import <React/RCTBridgeModule.h>
#import <React/RCTUtils.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>
#import <UIKit/UIKit.h>
#import <sodium.h>

#include <TargetConditionals.h>
#include <array>
#include <cstddef>
#include <cstring>
#include <memory>
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

int HexNibble(char value) {
  if (value >= '0' && value <= '9') {
    return value - '0';
  }
  if (value >= 'a' && value <= 'f') {
    return value - 'a' + 10;
  }
  return -1;
}

bool DecodeHex(std::string_view hex, Bytes& bytes) {
  if (hex.size() % 2 != 0) {
    return false;
  }
  bytes.resize(hex.size() / 2);
  for (std::size_t index = 0; index < bytes.size(); ++index) {
    const int high = HexNibble(hex[index * 2]);
    const int low = HexNibble(hex[index * 2 + 1]);
    if (high < 0 || low < 0) {
      return false;
    }
    bytes[index] = static_cast<unsigned char>((high << 4) | low);
  }
  return true;
}

template <std::size_t Size>
bool DecodeFixed(std::string_view hex, std::array<unsigned char, Size>& bytes) {
  Bytes decoded;
  if (!DecodeHex(hex, decoded) || decoded.size() != Size) {
    sodium_memzero(decoded.data(), decoded.size());
    return false;
  }
  std::memcpy(bytes.data(), decoded.data(), Size);
  sodium_memzero(decoded.data(), decoded.size());
  return true;
}

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

bool DeriveKey(
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

bool EncryptSyntheticStream(
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

bool DecryptStream(
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

  assertions[0] = DeriveKey(password.data(), password.size(), salt, key);
  const bool wrongKeyDerived =
      DeriveKey(wrongPassword.data(), wrongPassword.size(), salt, wrongKey);
  const bool encryptedSuccessfully =
      assertions[0] && EncryptSyntheticStream(key, kPlaintextChunks, encrypted);
  assertions[1] = encryptedSuccessfully &&
      DecryptStream(key, encrypted, kChunkCount, kPlaintextChunks, true);
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
    assertions[6] =
        !DecryptStream(key, encrypted, kChunkCount - 1, kPlaintextChunks, true);
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

std::array<bool, kPortableAssertionCount> RunPortableVectorAssertions() {
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

  bool decoded = DecodeFixed(kPortableSaltHex, salt) &&
      DecodeFixed(kPortableKeyHex, expectedKey) &&
      DecodeFixed(kPortableHeaderHex, header);
  for (std::size_t index = 0; index < kChunkCount; ++index) {
    decoded = decoded && DecodeHex(kPortablePlaintextHex[index], plaintext[index]) &&
        DecodeHex(kPortableCiphertextHex[index], expectedCiphertext[index]);
    expected.chunks[index] = expectedCiphertext[index];
  }
  expected.header = header;

  const bool keyDerived = decoded && DeriveKey(
      kPortablePassword.data(), kPortablePassword.size(), salt, key);
  assertions[0] = keyDerived && sodium_memcmp(
      key.data(), expectedKey.data(), key.size()) == 0;
  const bool emittedSuccessfully = assertions[0] && EncryptSyntheticStream(
      key, plaintext, emitted, &header);
  assertions[1] = emittedSuccessfully && emitted.header == header &&
      emitted.chunks == expectedCiphertext;
  assertions[2] = assertions[1] &&
      DecryptStream(key, expected, kChunkCount, plaintext, true);

  const bool wrongKeyDerived = decoded && DeriveKey(
      kPortableWrongPassword.data(), kPortableWrongPassword.size(), salt, wrongKey);
  assertions[3] = wrongKeyDerived &&
      PullMustFail(wrongKey, header, expectedCiphertext[0]);

  if (decoded) {
    Bytes tampered = expectedCiphertext[0];
    tampered[tampered.size() / 2] ^= 0x01;
    Bytes truncated = expectedCiphertext[0];
    truncated.pop_back();
    assertions[4] = PullMustFail(key, header, tampered) &&
        PullMustFail(key, header, truncated);
    assertions[5] = PullMustFail(key, header, expectedCiphertext[1]);
    assertions[6] = !DecryptStream(
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

}  // namespace

#if DEBUG
@interface JournalArchiveCrypto () <UIDocumentPickerDelegate>
@property(nonatomic, copy) void (^samplePickResult)(NSURL *url, BOOL cancelled);
@end
#endif

@implementation JournalArchiveCrypto

RCT_EXPORT_MODULE(JournalArchiveCrypto)

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

- (void)finishSampleRestorePreview:(NSString *)previewId recoveryCode:(NSString *)recoveryCode
                           confirm:(BOOL)confirm resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
#if DEBUG
  dispatch_async(JournalArchiveCryptoQueue(), ^{
    try {
      auto result = journal_shared_transfer::samplePreviews().finish(NSTemporaryDirectory().fileSystemRepresentation,
        previewId.UTF8String, recoveryCode.UTF8String, confirm);
      resolve([NSString stringWithUTF8String:result.c_str()]);
    } catch (const std::exception &) {
      reject(@"SAMPLE_PREVIEW_FAILED", @"Select the sample backup again.", nil);
    }
  });
#else
  reject(@"SAMPLE_DOCUMENT_DISABLED", @"Development build required", nil);
#endif
}

- (void)pickSampleFile:(BOOL)exporting recoveryCode:(NSString *)recoveryCode entryCount:(int)entryCount
                       resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
#if DEBUG
  dispatch_async(dispatch_get_main_queue(), ^{
    if (self.samplePickResult || recoveryCode.length != 32) {
      reject(@"SAMPLE_DOCUMENT_UNAVAILABLE", @"A valid code and an available picker are required.", nil);
      return;
    }
    NSURL *root = [NSURL fileURLWithPath:NSTemporaryDirectory() isDirectory:YES];
    NSURL *scratch = [root URLByAppendingPathComponent:[NSUUID UUID].UUIDString isDirectory:YES];
    NSURL *sample = [scratch URLByAppendingPathComponent:@"Journal Sample Backup.bin"];
    self.samplePickResult = ^(NSURL *selected, BOOL cancelled) {
      dispatch_async(JournalArchiveCryptoQueue(), ^{
        NSString *result = nil;
        if (exporting && selected) {
          result = @"saved";
        } else if (selected.isFileURL && !cancelled) {
          BOOL scoped = [selected startAccessingSecurityScopedResource];
          NSFileCoordinator *coordinator = [[NSFileCoordinator alloc] initWithFilePresenter:nil];
          __block NSString *document = nil;
          NSError *error = nil;
          [coordinator coordinateReadingItemAtURL:selected options:0 error:&error byAccessor:^(NSURL *url) {
            try {
              auto value = journal_shared_transfer::sampleDocument(url.fileSystemRepresentation, recoveryCode.UTF8String, false);
              document = [NSString stringWithUTF8String:value.c_str()];
            } catch (const std::exception &) {}
          }];
          if (scoped) [selected stopAccessingSecurityScopedResource];
          if (!error) result = document;
        }
        if (exporting) [[NSFileManager defaultManager] removeItemAtURL:scratch error:nil];
        if (cancelled) resolve(@"");
        else if (result) resolve(result);
        else reject(@"SAMPLE_DOCUMENT_FAILED", @"The sample backup could not be saved or opened.", nil);
      });
    };
    dispatch_async(JournalArchiveCryptoQueue(), ^{
      BOOL ready = YES;
      if (exporting) {
        ready = [[NSFileManager defaultManager] createDirectoryAtURL:scratch withIntermediateDirectories:NO
                                                          attributes:nil error:nil];
        if (ready) {
          try {
            journal_shared_transfer::sampleDocument(sample.fileSystemRepresentation,
              recoveryCode.UTF8String, true, entryCount);
          } catch (const std::exception &) { ready = NO; }
        }
      }
      dispatch_async(dispatch_get_main_queue(), ^{
        UIViewController *presenter = RCTPresentedViewController();
        if (!ready || !presenter.view.window) {
          [self finishSamplePick:nil cancelled:NO];
          return;
        }
        UIDocumentPickerViewController *picker = exporting
          ? [[UIDocumentPickerViewController alloc] initForExportingURLs:@[sample] asCopy:YES]
          : [[UIDocumentPickerViewController alloc] initForOpeningContentTypes:@[UTTypeData] asCopy:NO];
        picker.delegate = self;
        picker.modalPresentationStyle = UIModalPresentationFullScreen;
        [presenter presentViewController:picker animated:YES completion:nil];
      });
    });
  });
#else
  reject(@"SAMPLE_DOCUMENT_DISABLED", @"Development build required", nil);
#endif
}

- (void)chooseSampleBackupFile:(BOOL)exporting recoveryCode:(NSString *)recoveryCode
                       resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  [self pickSampleFile:exporting recoveryCode:recoveryCode entryCount:-1 resolve:resolve reject:reject];
}

- (void)verifyLocalSnapshot:(NSString *)manifest sources:(NSString *)sources
                    resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
#if DEBUG
  dispatch_async(JournalArchiveCryptoQueue(), ^{
    try {
      NSString *directory = [NSTemporaryDirectory() stringByStandardizingPath];
      NSString *base = [NSURL fileURLWithPath:directory isDirectory:YES].absoluteString;
      NSData *bytes = [manifest dataUsingEncoding:NSUTF8StringEncoding];
      journal_snapshot::check(bytes.length > 0 && bytes.length <= journal_snapshot::maxManifest);
      auto files = journal_snapshot::sourcesFrom(sources.UTF8String, base.UTF8String);
      journal_snapshot::roundTrip(directory.fileSystemRepresentation, "",
        std::string_view(static_cast<const char *>(bytes.bytes), bytes.length), files);
      resolve(@YES);
    } catch (const std::exception &) {
      reject(@"LOCAL_SNAPSHOT_FAILED", @"Could not verify the encrypted snapshot.", nil);
    }
  });
#else
  reject(@"LOCAL_CHECK_DISABLED", @"A development build is required.", nil);
#endif
}

- (void)checkPickerPhoto:(NSString *)uri remainingBytes:(double)remainingBytes describe:(BOOL)describe
                        resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
#if DEBUG
  dispatch_async(JournalArchiveCryptoQueue(), ^{
    NSString *directory = [NSTemporaryDirectory() stringByStandardizingPath];
    NSString *base = [NSURL fileURLWithPath:directory isDirectory:YES].absoluteString;
    if (![uri hasPrefix:base] || !(remainingBytes >= 0 && remainingBytes <= 5000000000.0)) {
      resolve(describe ? (id)@"-2" : @(journal_picker::unsupported));
      return;
    }
    NSString *name = [uri substringFromIndex:base.length];
    NSData *data = [name dataUsingEncoding:NSUTF8StringEncoding];
    if (!data.length || data.length > 64) { resolve(describe ? (id)@"-2" : @(journal_picker::unsupported)); return; }
    std::string_view leaf(static_cast<const char *>(data.bytes), data.length);
    if (describe) {
      auto value = journal_picker::fingerprint(directory.fileSystemRepresentation, leaf, "", static_cast<long long>(remainingBytes));
      resolve([NSString stringWithUTF8String:value.c_str()]);
    } else {
      resolve(@(journal_picker::inspect(directory.fileSystemRepresentation, leaf, "", static_cast<long long>(remainingBytes))));
    }
  });
#else
  reject(@"LOCAL_CHECK_DISABLED", @"A development build is required.", nil);
#endif
}

- (void)inspectLocalPickerPhoto:(NSString *)uri remainingBytes:(double)remainingBytes
                        resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  [self checkPickerPhoto:uri remainingBytes:remainingBytes describe:NO resolve:resolve reject:reject];
}

- (void)describeLocalPickerPhoto:(NSString *)uri remainingBytes:(double)remainingBytes
                         resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  [self checkPickerPhoto:uri remainingBytes:remainingBytes describe:YES resolve:resolve reject:reject];
}

- (void)saveInventorySample:(NSString *)recoveryCode entryCount:(double)entryCount
                    resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  if (!(entryCount >= 0 && entryCount <= 300) || (int)entryCount != entryCount) {
    reject(@"INVALID_SAMPLE_SIZE", @"Choose between 0 and 300 sample entries.", nil);
    return;
  }
  [self pickSampleFile:YES recoveryCode:recoveryCode entryCount:(int)entryCount resolve:resolve reject:reject];
}

#if DEBUG
- (void)finishSamplePick:(NSURL *)url cancelled:(BOOL)cancelled {
  void (^completion)(NSURL *, BOOL) = self.samplePickResult;
  self.samplePickResult = nil;
  if (completion) completion(url, cancelled);
}

- (void)documentPicker:(UIDocumentPickerViewController *)controller didPickDocumentsAtURLs:(NSArray<NSURL *> *)urls {
  [self finishSamplePick:urls.firstObject cancelled:NO];
}

- (void)documentPickerWasCancelled:(UIDocumentPickerViewController *)controller {
  [self finishSamplePick:nil cancelled:YES];
}
#endif

- (void)interruptSyntheticPhoto:(BOOL)afterPublication resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
#if DEBUG
  dispatch_async(JournalArchiveCryptoQueue(), ^{
    try {
      using journal_photo_fixture::Interruption;
      NSURL *base = [NSFileManager.defaultManager URLForDirectory:NSApplicationSupportDirectory inDomain:NSUserDomainMask appropriateForURL:nil create:NO error:nil];
      journal_fixture::require(base != nil);
      journal_photo_fixture::stage(base.fileSystemRepresentation, true,
        afterPublication ? Interruption::afterPublication : Interruption::duringCopy);
    } catch (const std::exception &) {}
    reject(@"JOURNAL_PHOTO_INTERRUPTION_FAILED", @"Did not reach the interruption point", nil);
  });
#else
  reject(@"JOURNAL_TRANSFER_DISABLED", @"Development build required", nil);
#endif
}

- (void)checkSyntheticPhotoInterruption:(BOOL)afterPublication resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
#if DEBUG
  dispatch_async(JournalArchiveCryptoQueue(), ^{
    try {
      NSURL *base = [NSFileManager.defaultManager URLForDirectory:NSApplicationSupportDirectory inDomain:NSUserDomainMask appropriateForURL:nil create:NO error:nil];
      journal_fixture::require(base != nil);
      journal_photo_fixture::checkInterruption(base.fileSystemRepresentation, afterPublication);
      resolve(@YES);
    } catch (const std::exception &) {
      reject(@"JOURNAL_PHOTO_VERIFY_FAILED", @"Expected photo interruption evidence was missing", nil);
    }
  });
#else
  reject(@"JOURNAL_TRANSFER_DISABLED", @"Development build required", nil);
#endif
}

- (void)stageSyntheticPhoto:(BOOL)replacement resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  [self stageFixturePhoto:replacement sharedStore:NO resolve:resolve reject:reject];
}

- (void)stageSharedFixturePhoto:(BOOL)replacement resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  [self stageFixturePhoto:replacement sharedStore:YES resolve:resolve reject:reject];
}

- (void)stageFixturePhoto:(BOOL)replacement sharedStore:(BOOL)sharedStore resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
#if DEBUG
  dispatch_async(JournalArchiveCryptoQueue(), ^{
    try {
      NSURL *base = [NSFileManager.defaultManager URLForDirectory:NSApplicationSupportDirectory inDomain:NSUserDomainMask appropriateForURL:nil create:YES error:nil];
      journal_fixture::require(base != nil);
      const std::string path = base.fileSystemRepresentation;
      auto name = journal_photo_fixture::stage(sharedStore ? journal_photo_fixture::sharedBase(path) : path, replacement);
      resolve([NSString stringWithUTF8String:name.c_str()]);
    } catch (const std::exception &) {
      reject(@"JOURNAL_PHOTO_STAGE_FAILED", @"Could not stage test photo", nil);
    }
  });
#else
  reject(@"JOURNAL_TRANSFER_DISABLED", @"Development build required", nil);
#endif
}

- (void)verifySharedFixturePhotos:(NSString *)shared other:(NSString *)other resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
#if DEBUG
  dispatch_async(JournalArchiveCryptoQueue(), ^{
    try {
      NSURL *base = [NSFileManager.defaultManager URLForDirectory:NSApplicationSupportDirectory inDomain:NSUserDomainMask appropriateForURL:nil create:NO error:nil];
      journal_fixture::require(base != nil && (shared.length == 0 || shared.length == 38) && other.length == 38);
      journal_photo_fixture::verifySharedPhotos(base.fileSystemRepresentation, shared.UTF8String, other.UTF8String);
      resolve(@YES);
    } catch (const std::exception &) {
      reject(@"JOURNAL_PHOTO_VERIFY_FAILED", @"Could not verify the referenced test photos", nil);
    }
  });
#else
  reject(@"JOURNAL_TRANSFER_DISABLED", @"Development build required", nil);
#endif
}

- (void)verifySyntheticPhoto:(NSString *)name replacement:(BOOL)replacement resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
#if DEBUG
  dispatch_async(JournalArchiveCryptoQueue(), ^{
    try {
      NSURL *base = [NSFileManager.defaultManager URLForDirectory:NSApplicationSupportDirectory inDomain:NSUserDomainMask appropriateForURL:nil create:NO error:nil];
      journal_fixture::require(base != nil && name.length == 38);
      journal_photo_fixture::verifyAndCollect(base.fileSystemRepresentation, name.UTF8String, replacement);
      resolve(@YES);
    } catch (const std::exception &) {
      reject(@"JOURNAL_PHOTO_VERIFY_FAILED", @"Could not verify test photo", nil);
    }
  });
#else
  reject(@"JOURNAL_TRANSFER_DISABLED", @"Development build required", nil);
#endif
}

- (void)exportSyntheticTransfer:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
#if DEBUG
  dispatch_async(JournalArchiveCryptoQueue(), ^{
    try {
      auto result = journal_fixture::exportFixture([NSTemporaryDirectory() fileSystemRepresentation]);
      resolve([NSString stringWithUTF8String:result.c_str()]);
    } catch (const std::exception &) {
      reject(@"JOURNAL_TRANSFER_TEST_FAILED", @"Synthetic archive export failed", nil);
    }
  });
#else
  reject(@"JOURNAL_TRANSFER_DISABLED", @"Development build required", nil);
#endif
}

- (void)importSyntheticTransfer:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
#if DEBUG
  dispatch_async(JournalArchiveCryptoQueue(), ^{
    try {
      auto result = journal_fixture::importFixture([NSTemporaryDirectory() fileSystemRepresentation]);
      resolve([NSString stringWithUTF8String:result.c_str()]);
    } catch (const std::exception &) {
      reject(@"JOURNAL_TRANSFER_TEST_FAILED", @"Synthetic archive import failed", nil);
    }
  });
#else
  reject(@"JOURNAL_TRANSFER_DISABLED", @"Development build required", nil);
#endif
}

- (void)exportSharedPhotoTransfer:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
#if DEBUG
  dispatch_async(JournalArchiveCryptoQueue(), ^{
    try {
      auto result = journal_shared_transfer::exportArchive([NSTemporaryDirectory() fileSystemRepresentation]);
      resolve([NSString stringWithUTF8String:result.c_str()]);
    } catch (const std::exception &) {
      reject(@"JOURNAL_TRANSFER_TEST_FAILED", @"Synthetic archive export failed", nil);
    }
  });
#else
  reject(@"JOURNAL_TRANSFER_DISABLED", @"Development build required", nil);
#endif
}

- (void)importSharedPhotoTransfer:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
#if DEBUG
  dispatch_async(JournalArchiveCryptoQueue(), ^{
    try {
      auto result = journal_shared_transfer::importArchive([NSTemporaryDirectory() fileSystemRepresentation]);
      resolve([NSString stringWithUTF8String:result.c_str()]);
    } catch (const std::exception &) {
      reject(@"JOURNAL_TRANSFER_TEST_FAILED", @"Synthetic archive import failed", nil);
    }
  });
#else
  reject(@"JOURNAL_TRANSFER_DISABLED", @"Development build required", nil);
#endif
}

- (void)verifyTransferredPhotos:(NSString *)shared sharedDigest:(NSString *)sharedDigest other:(NSString *)other
                    otherDigest:(NSString *)otherDigest resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  [self checkPhotoPair:shared sharedDigest:sharedDigest other:other otherDigest:otherDigest collectUnused:YES resolve:resolve reject:reject];
}

- (void)checkRestoredPhotos:(NSString *)shared sharedDigest:(NSString *)sharedDigest other:(NSString *)other
                    otherDigest:(NSString *)otherDigest resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  [self checkPhotoPair:shared sharedDigest:sharedDigest other:other otherDigest:otherDigest collectUnused:NO resolve:resolve reject:reject];
}

- (void)checkPhotoPair:(NSString *)shared sharedDigest:(NSString *)sharedDigest other:(NSString *)other
                    otherDigest:(NSString *)otherDigest collectUnused:(BOOL)collectUnused resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
#if DEBUG
  dispatch_async(JournalArchiveCryptoQueue(), ^{
    try {
      journal_shared_transfer::verifyPair([NSTemporaryDirectory() fileSystemRepresentation],
        shared.UTF8String, sharedDigest.UTF8String, other.UTF8String, otherDigest.UTF8String, collectUnused);
      resolve(@YES);
    } catch (const std::exception &) {
      resolve(@NO);
    }
  });
#else
  reject(@"JOURNAL_TRANSFER_DISABLED", @"Development build required", nil);
#endif
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

- (void)runPortableVectorSelfTest:(RCTPromiseResolveBlock)resolve
                             reject:(RCTPromiseRejectBlock)reject {
  dispatch_async(JournalArchiveCryptoQueue(), ^{
    const auto assertions = RunPortableVectorAssertions();
    resolve(@{
      @"vectorId" : @"journal-archive-portable-v1",
      @"vectorSha256" : @"1c0177dbba76e3823eac4ed0e23b7cb44afcc9de8577a95e49c75e9f0ce72e14",
      @"derivedKeyMatches" : @(assertions[0]),
      @"ciphertextMatches" : @(assertions[1]),
      @"decryptMatches" : @(assertions[2]),
      @"wrongPasswordRejected" : @(assertions[3]),
      @"tamperAndTruncationRejected" : @(assertions[4]),
      @"reorderingRejected" : @(assertions[5]),
      @"finalTagRequired" : @(assertions[6]),
      @"sensitiveBuffersCleared" : @(assertions[7]),
      @"plaintextFileWritten" : @NO,
    });
  });
}

- (void)runFileTransportSelfTest:(RCTPromiseResolveBlock)resolve
                           reject:(RCTPromiseRejectBlock)reject {
  dispatch_async(JournalArchiveCryptoQueue(), ^{
    const char *temporaryDirectory =
        [NSTemporaryDirectory() fileSystemRepresentation];
    const auto assertions =
        RunJournalArchiveFileTransportAssertions(temporaryDirectory);
    resolve(@{
      @"boundedChunkWrites" : @(assertions[0]),
      @"sizeLimitRejected" : @(assertions[1]),
      @"temporaryFileUsed" : @(assertions[2]),
      @"incompletePublishHidden" : @(assertions[3]),
      @"atomicPublishSucceeded" : @(assertions[4]),
      @"fileAndDirectorySynced" : @(assertions[5]),
      @"staleTemporaryCleaned" : @(assertions[6]),
      @"publishedBytesVerified" : @(assertions[7]),
      @"artifactsCleaned" : @(assertions[8]),
      @"plaintextFileWritten" : @NO,
    });
  });
}

- (void)runMediaPackagingSelfTest:(RCTPromiseResolveBlock)resolve
                             reject:(RCTPromiseRejectBlock)reject {
  dispatch_async(JournalArchiveCryptoQueue(), ^{
    const auto assertions = RunJournalArchiveMediaPackagingAssertions();
    resolve(@{
      @"allowedMediaPackaged" : @(assertions[0]),
      @"contentTypeMismatchRejected" : @(assertions[1]),
      @"perAssetLimitRejected" : @(assertions[2]),
      @"aggregateLimitsRejected" : @(assertions[3]),
      @"hashMismatchRejected" : @(assertions[4]),
      @"ownerMismatchRejected" : @(assertions[5]),
      @"unsafePathRejected" : @(assertions[6]),
      @"duplicateAssetRejected" : @(assertions[7]),
      @"metadataTamperRejected" : @(assertions[8]),
      @"chunkReorderingRejected" : @(assertions[9]),
      @"missingFinalMarkerRejected" : @(assertions[10]),
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
