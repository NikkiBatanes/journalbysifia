package app.journal.sifia.archivecrypto

import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * Fail-closed shell for the archive-crypto TurboModule.
 *
 * This module intentionally accepts no journal bytes, paths, passwords, or
 * keys. The linked provider is reachable only through fixed synthetic evidence
 * routines until the mobile provider gate has passed on physical devices.
 */
@ReactModule(name = JournalArchiveCryptoModule.NAME)
class JournalArchiveCryptoModule(reactContext: ReactApplicationContext) :
  NativeJournalArchiveCryptoSpec(reactContext) {
  private val cryptoExecutor: ExecutorService =
    Executors.newSingleThreadExecutor { runnable ->
      Thread(runnable, "journal-archive-crypto").apply { isDaemon = true }
    }

  private external fun nativeSodiumVersion(): String

  private external fun nativeRunSyntheticSelfTest(): BooleanArray

  private external fun nativeRunPortableVectorSelfTest(): BooleanArray

  private external fun nativeRunFileTransportSelfTest(cacheDirectory: String): BooleanArray

  private external fun nativeRunMediaPackagingSelfTest(): BooleanArray

  override fun getName(): String = NAME

  override fun getProviderEvidence(promise: Promise) {
    cryptoExecutor.execute {
      try {
        val evidence = Arguments.createMap().apply {
          putString("libsodiumVersion", nativeSodiumVersion())
          putString("platform", "android")
          putString("architecture", Build.SUPPORTED_ABIS.firstOrNull() ?: "unknown")
          putBoolean("runtimeOffJavaScriptThread", true)
          putBoolean("syntheticOnly", true)
          putBoolean("mobileProviderApproved", false)
        }
        promise.resolve(evidence)
      } catch (error: Throwable) {
        promise.reject("JOURNAL_ARCHIVE_PROVIDER_EVIDENCE_FAILED", error)
      }
    }
  }

  override fun runSyntheticSelfTest(promise: Promise) {
    cryptoExecutor.execute {
      try {
        val assertions = nativeRunSyntheticSelfTest()
        require(assertions.size == NATIVE_ASSERTION_COUNT) {
          "Unexpected native assertion count"
        }
        val evidence = Arguments.createMap().apply {
          putBoolean("argon2id", assertions[0])
          putBoolean("secretstream", assertions[1])
          putBoolean("wrongPasswordRejected", assertions[2])
          putBoolean("tamperRejected", assertions[3])
          putBoolean("truncationRejected", assertions[4])
          putBoolean("reorderingRejected", assertions[5])
          putBoolean("finalTagRequired", assertions[6])
          putBoolean("sensitiveBuffersCleared", assertions[7])
          putBoolean("plaintextFileWritten", false)
        }
        promise.resolve(evidence)
      } catch (error: Throwable) {
        promise.reject("JOURNAL_ARCHIVE_SYNTHETIC_TEST_FAILED", error)
      }
    }
  }

  override fun runPortableVectorSelfTest(promise: Promise) {
    cryptoExecutor.execute {
      try {
        val assertions = nativeRunPortableVectorSelfTest()
        require(assertions.size == NATIVE_PORTABLE_ASSERTION_COUNT) {
          "Unexpected portable-vector assertion count"
        }
        val evidence = Arguments.createMap().apply {
          putString("vectorId", PORTABLE_VECTOR_ID)
          putString("vectorSha256", PORTABLE_VECTOR_SHA256)
          putBoolean("derivedKeyMatches", assertions[0])
          putBoolean("ciphertextMatches", assertions[1])
          putBoolean("decryptMatches", assertions[2])
          putBoolean("wrongPasswordRejected", assertions[3])
          putBoolean("tamperAndTruncationRejected", assertions[4])
          putBoolean("reorderingRejected", assertions[5])
          putBoolean("finalTagRequired", assertions[6])
          putBoolean("sensitiveBuffersCleared", assertions[7])
          putBoolean("plaintextFileWritten", false)
        }
        promise.resolve(evidence)
      } catch (error: Throwable) {
        promise.reject("JOURNAL_ARCHIVE_PORTABLE_VECTOR_TEST_FAILED", error)
      }
    }
  }

  override fun runFileTransportSelfTest(promise: Promise) {
    cryptoExecutor.execute {
      try {
        val assertions = nativeRunFileTransportSelfTest(
          reactApplicationContext.cacheDir.absolutePath,
        )
        require(assertions.size == NATIVE_FILE_TRANSPORT_ASSERTION_COUNT) {
          "Unexpected file-transport assertion count"
        }
        val evidence = Arguments.createMap().apply {
          putBoolean("boundedChunkWrites", assertions[0])
          putBoolean("sizeLimitRejected", assertions[1])
          putBoolean("temporaryFileUsed", assertions[2])
          putBoolean("incompletePublishHidden", assertions[3])
          putBoolean("atomicPublishSucceeded", assertions[4])
          putBoolean("fileAndDirectorySynced", assertions[5])
          putBoolean("staleTemporaryCleaned", assertions[6])
          putBoolean("publishedBytesVerified", assertions[7])
          putBoolean("artifactsCleaned", assertions[8])
          putBoolean("plaintextFileWritten", false)
        }
        promise.resolve(evidence)
      } catch (error: Throwable) {
        promise.reject("JOURNAL_ARCHIVE_FILE_TRANSPORT_TEST_FAILED", error)
      }
    }
  }

  override fun runMediaPackagingSelfTest(promise: Promise) {
    cryptoExecutor.execute {
      try {
        val assertions = nativeRunMediaPackagingSelfTest()
        require(assertions.size == NATIVE_MEDIA_PACKAGING_ASSERTION_COUNT) {
          "Unexpected media-packaging assertion count"
        }
        val evidence = Arguments.createMap().apply {
          putBoolean("allowedMediaPackaged", assertions[0])
          putBoolean("contentTypeMismatchRejected", assertions[1])
          putBoolean("perAssetLimitRejected", assertions[2])
          putBoolean("aggregateLimitsRejected", assertions[3])
          putBoolean("hashMismatchRejected", assertions[4])
          putBoolean("ownerMismatchRejected", assertions[5])
          putBoolean("unsafePathRejected", assertions[6])
          putBoolean("duplicateAssetRejected", assertions[7])
          putBoolean("metadataTamperRejected", assertions[8])
          putBoolean("chunkReorderingRejected", assertions[9])
          putBoolean("missingFinalMarkerRejected", assertions[10])
          putBoolean("plaintextFileWritten", false)
        }
        promise.resolve(evidence)
      } catch (error: Throwable) {
        promise.reject("JOURNAL_ARCHIVE_MEDIA_PACKAGING_TEST_FAILED", error)
      }
    }
  }

  override fun invalidate() {
    cryptoExecutor.shutdownNow()
    super.invalidate()
  }

  companion object {
    const val NAME = "JournalArchiveCrypto"
    private const val NATIVE_ASSERTION_COUNT = 8
    private const val NATIVE_PORTABLE_ASSERTION_COUNT = 8
    private const val NATIVE_FILE_TRANSPORT_ASSERTION_COUNT = 9
    private const val NATIVE_MEDIA_PACKAGING_ASSERTION_COUNT = 11
    private const val PORTABLE_VECTOR_ID = "journal-archive-portable-v1"
    private const val PORTABLE_VECTOR_SHA256 =
      "1c0177dbba76e3823eac4ed0e23b7cb44afcc9de8577a95e49c75e9f0ce72e14"

    init {
      System.loadLibrary("journal_archive_crypto")
    }
  }
}
