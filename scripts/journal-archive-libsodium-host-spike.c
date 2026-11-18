#include <sodium.h>

#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define CHUNK_COUNT 3U
#define MAX_PLAINTEXT_CHUNK_BYTES 4096U

static void fail(const char *message) {
  fprintf(stderr, "journal archive crypto host spike failed: %s\n", message);
  exit(EXIT_FAILURE);
}

static void derive_key(unsigned char key[crypto_secretstream_xchacha20poly1305_KEYBYTES],
                       const char *password,
                       const unsigned char salt[crypto_pwhash_SALTBYTES]) {
  if (crypto_pwhash(key,
                    crypto_secretstream_xchacha20poly1305_KEYBYTES,
                    password,
                    (unsigned long long)strlen(password),
                    salt,
                    crypto_pwhash_OPSLIMIT_INTERACTIVE,
                    crypto_pwhash_MEMLIMIT_INTERACTIVE,
                    crypto_pwhash_ALG_ARGON2ID13) != 0) {
    fail("Argon2id key derivation could not allocate memory");
  }
}

int main(void) {
  static const unsigned char *plaintext_chunks[CHUNK_COUNT] = {
      (const unsigned char *)"synthetic journal archive header",
      (const unsigned char *)"synthetic entry and media bytes",
      (const unsigned char *)"synthetic final archive record",
  };
  static const char password[] = "synthetic-correct-recovery-code";
  static const char wrong_password[] = "synthetic-wrong-recovery-code";

  unsigned long long plaintext_lengths[CHUNK_COUNT];
  unsigned long long ciphertext_lengths[CHUNK_COUNT];
  unsigned char *ciphertext_chunks[CHUNK_COUNT] = {NULL, NULL, NULL};
  unsigned char salt[crypto_pwhash_SALTBYTES];
  unsigned char key[crypto_secretstream_xchacha20poly1305_KEYBYTES];
  unsigned char repeated_key[crypto_secretstream_xchacha20poly1305_KEYBYTES];
  unsigned char wrong_key[crypto_secretstream_xchacha20poly1305_KEYBYTES];
  unsigned char header[crypto_secretstream_xchacha20poly1305_HEADERBYTES];
  crypto_secretstream_xchacha20poly1305_state push_state;
  bool round_trip = true;
  bool final_tag_verified = false;
  bool wrong_password_rejected = false;
  bool tamper_rejected = false;
  bool truncation_rejected = false;
  bool reordering_rejected = false;
  bool missing_final_rejected = false;

  if (sodium_init() < 0) {
    fail("libsodium initialization failed");
  }
  if (strcmp(sodium_version_string(), "1.0.22") != 0) {
    fail("unexpected libsodium version");
  }

  randombytes_buf(salt, sizeof salt);
  derive_key(key, password, salt);
  derive_key(repeated_key, password, salt);
  derive_key(wrong_key, wrong_password, salt);

  if (sodium_memcmp(key, repeated_key, sizeof key) != 0) {
    fail("repeat Argon2id derivation was not deterministic");
  }
  if (sodium_memcmp(key, wrong_key, sizeof key) == 0) {
    fail("different passwords derived the same key");
  }

  if (crypto_secretstream_xchacha20poly1305_init_push(&push_state, header, key) != 0) {
    fail("secretstream push initialization failed");
  }

  for (size_t index = 0; index < CHUNK_COUNT; index += 1U) {
    const unsigned char tag = index == CHUNK_COUNT - 1U
                                  ? crypto_secretstream_xchacha20poly1305_TAG_FINAL
                                  : crypto_secretstream_xchacha20poly1305_TAG_MESSAGE;
    plaintext_lengths[index] = (unsigned long long)strlen((const char *)plaintext_chunks[index]);
    if (plaintext_lengths[index] > MAX_PLAINTEXT_CHUNK_BYTES) {
      fail("plaintext chunk exceeded the native streaming bound");
    }
    ciphertext_chunks[index] =
        malloc((size_t)plaintext_lengths[index] + crypto_secretstream_xchacha20poly1305_ABYTES);
    if (ciphertext_chunks[index] == NULL) {
      fail("ciphertext allocation failed");
    }
    if (crypto_secretstream_xchacha20poly1305_push(
            &push_state,
            ciphertext_chunks[index],
            &ciphertext_lengths[index],
            plaintext_chunks[index],
            plaintext_lengths[index],
            NULL,
            0,
            tag) != 0) {
      fail("secretstream encryption failed");
    }
  }

  crypto_secretstream_xchacha20poly1305_state pull_state;
  if (crypto_secretstream_xchacha20poly1305_init_pull(&pull_state, header, key) != 0) {
    fail("secretstream pull initialization failed");
  }
  for (size_t index = 0; index < CHUNK_COUNT; index += 1U) {
    unsigned char recovered[MAX_PLAINTEXT_CHUNK_BYTES];
    unsigned long long recovered_length = 0;
    unsigned char tag = 0;
    if (crypto_secretstream_xchacha20poly1305_pull(&pull_state,
                                                   recovered,
                                                   &recovered_length,
                                                   &tag,
                                                   ciphertext_chunks[index],
                                                   ciphertext_lengths[index],
                                                   NULL,
                                                   0) != 0) {
      fail("secretstream round-trip decryption failed");
    }
    round_trip = round_trip && recovered_length == plaintext_lengths[index] &&
                 sodium_memcmp(recovered, plaintext_chunks[index], (size_t)recovered_length) == 0;
    if (index == CHUNK_COUNT - 1U) {
      final_tag_verified = tag == crypto_secretstream_xchacha20poly1305_TAG_FINAL;
    } else if (tag != crypto_secretstream_xchacha20poly1305_TAG_MESSAGE) {
      fail("non-final chunk returned an unexpected tag");
    }
    sodium_memzero(recovered, sizeof recovered);
  }

  unsigned char probe_plaintext[MAX_PLAINTEXT_CHUNK_BYTES];
  unsigned long long probe_length = 0;
  unsigned char probe_tag = 0;

  crypto_secretstream_xchacha20poly1305_state wrong_state;
  if (crypto_secretstream_xchacha20poly1305_init_pull(&wrong_state, header, wrong_key) != 0) {
    fail("wrong-password pull initialization failed unexpectedly");
  }
  wrong_password_rejected =
      crypto_secretstream_xchacha20poly1305_pull(&wrong_state,
                                                 probe_plaintext,
                                                 &probe_length,
                                                 &probe_tag,
                                                 ciphertext_chunks[0],
                                                 ciphertext_lengths[0],
                                                 NULL,
                                                 0) != 0;

  unsigned char *tampered = malloc((size_t)ciphertext_lengths[0]);
  if (tampered == NULL) {
    fail("tamper-test allocation failed");
  }
  memcpy(tampered, ciphertext_chunks[0], (size_t)ciphertext_lengths[0]);
  tampered[ciphertext_lengths[0] - 1U] ^= 0x01U;
  crypto_secretstream_xchacha20poly1305_state tamper_state;
  if (crypto_secretstream_xchacha20poly1305_init_pull(&tamper_state, header, key) != 0) {
    fail("tamper-test pull initialization failed");
  }
  tamper_rejected = crypto_secretstream_xchacha20poly1305_pull(&tamper_state,
                                                               probe_plaintext,
                                                               &probe_length,
                                                               &probe_tag,
                                                               tampered,
                                                               ciphertext_lengths[0],
                                                               NULL,
                                                               0) != 0;
  sodium_memzero(tampered, (size_t)ciphertext_lengths[0]);
  free(tampered);

  crypto_secretstream_xchacha20poly1305_state truncate_state;
  if (crypto_secretstream_xchacha20poly1305_init_pull(&truncate_state, header, key) != 0) {
    fail("truncation-test pull initialization failed");
  }
  truncation_rejected =
      crypto_secretstream_xchacha20poly1305_pull(&truncate_state,
                                                 probe_plaintext,
                                                 &probe_length,
                                                 &probe_tag,
                                                 ciphertext_chunks[0],
                                                 ciphertext_lengths[0] - 1U,
                                                 NULL,
                                                 0) != 0;

  crypto_secretstream_xchacha20poly1305_state reorder_state;
  if (crypto_secretstream_xchacha20poly1305_init_pull(&reorder_state, header, key) != 0) {
    fail("reordering-test pull initialization failed");
  }
  reordering_rejected =
      crypto_secretstream_xchacha20poly1305_pull(&reorder_state,
                                                 probe_plaintext,
                                                 &probe_length,
                                                 &probe_tag,
                                                 ciphertext_chunks[1],
                                                 ciphertext_lengths[1],
                                                 NULL,
                                                 0) != 0;

  crypto_secretstream_xchacha20poly1305_state missing_final_state;
  if (crypto_secretstream_xchacha20poly1305_init_pull(&missing_final_state, header, key) != 0) {
    fail("missing-final-test pull initialization failed");
  }
  if (crypto_secretstream_xchacha20poly1305_pull(&missing_final_state,
                                                 probe_plaintext,
                                                 &probe_length,
                                                 &probe_tag,
                                                 ciphertext_chunks[0],
                                                 ciphertext_lengths[0],
                                                 NULL,
                                                 0) != 0) {
    fail("missing-final-test first chunk did not decrypt");
  }
  missing_final_rejected = probe_tag != crypto_secretstream_xchacha20poly1305_TAG_FINAL;

  if (!round_trip || !final_tag_verified || !wrong_password_rejected || !tamper_rejected ||
      !truncation_rejected || !reordering_rejected || !missing_final_rejected) {
    fail("one or more cryptographic assertions failed");
  }

  sodium_memzero(&push_state, sizeof push_state);
  sodium_memzero(&pull_state, sizeof pull_state);
  sodium_memzero(&wrong_state, sizeof wrong_state);
  sodium_memzero(&tamper_state, sizeof tamper_state);
  sodium_memzero(&truncate_state, sizeof truncate_state);
  sodium_memzero(&reorder_state, sizeof reorder_state);
  sodium_memzero(&missing_final_state, sizeof missing_final_state);
  sodium_memzero(key, sizeof key);
  sodium_memzero(repeated_key, sizeof repeated_key);
  sodium_memzero(wrong_key, sizeof wrong_key);
  sodium_memzero(salt, sizeof salt);
  sodium_memzero(probe_plaintext, sizeof probe_plaintext);
  for (size_t index = 0; index < CHUNK_COUNT; index += 1U) {
    sodium_memzero(ciphertext_chunks[index], (size_t)ciphertext_lengths[index]);
    free(ciphertext_chunks[index]);
  }

  printf("{\"sodiumVersion\":\"%s\","
         "\"algorithm\":\"secretstream-xchacha20poly1305\","
         "\"kdf\":\"argon2id13\","
         "\"roundTrip\":true,"
         "\"wrongPasswordRejected\":true,"
         "\"tamperRejected\":true,"
         "\"truncationRejected\":true,"
         "\"reorderingRejected\":true,"
         "\"finalTagVerified\":true,"
         "\"missingFinalRejected\":true,"
         "\"maxPlaintextChunkBytes\":%u,"
         "\"plaintextWrittenToDisk\":false,"
         "\"keysClearedBeforeExit\":true}\n",
         sodium_version_string(),
         MAX_PLAINTEXT_CHUNK_BYTES);
  return EXIT_SUCCESS;
}
