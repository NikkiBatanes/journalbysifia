package app.journal.sifia.archivecrypto

import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule

/**
 * Fail-closed shell for the archive-crypto TurboModule.
 *
 * This module intentionally does not link a crypto provider or accept journal
 * bytes, paths, passwords, or keys. It exists only to prove native registration
 * before the synthetic libsodium implementation is introduced.
 */
@ReactModule(name = JournalArchiveCryptoModule.NAME)
class JournalArchiveCryptoModule(reactContext: ReactApplicationContext) :
  NativeJournalArchiveCryptoSpec(reactContext) {

  override fun getName(): String = NAME

  override fun getProviderEvidence(promise: Promise) {
    val evidence = Arguments.createMap().apply {
      putString("libsodiumVersion", "not-linked")
      putString("platform", "android")
      putString("architecture", Build.SUPPORTED_ABIS.firstOrNull() ?: "unknown")
      putBoolean("runtimeOffJavaScriptThread", false)
      putBoolean("syntheticOnly", true)
      putBoolean("mobileProviderApproved", false)
    }
    promise.resolve(evidence)
  }

  override fun runSyntheticSelfTest(promise: Promise) {
    val evidence = Arguments.createMap().apply {
      putBoolean("argon2id", false)
      putBoolean("secretstream", false)
      putBoolean("wrongPasswordRejected", false)
      putBoolean("tamperRejected", false)
      putBoolean("truncationRejected", false)
      putBoolean("reorderingRejected", false)
      putBoolean("finalTagRequired", false)
      putBoolean("sensitiveBuffersCleared", false)
      putBoolean("plaintextFileWritten", false)
    }
    promise.resolve(evidence)
  }

  companion object {
    const val NAME = "JournalArchiveCrypto"
  }
}
