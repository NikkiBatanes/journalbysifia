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

  override fun invalidate() {
    cryptoExecutor.shutdownNow()
    super.invalidate()
  }

  companion object {
    const val NAME = "JournalArchiveCrypto"
    private const val NATIVE_ASSERTION_COUNT = 8

    init {
      System.loadLibrary("journal_archive_crypto")
    }
  }
}
