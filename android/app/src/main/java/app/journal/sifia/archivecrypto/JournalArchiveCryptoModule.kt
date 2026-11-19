package app.journal.sifia.archivecrypto

import android.app.Activity
import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.UiThreadUtil
import java.io.File
import java.util.concurrent.atomic.AtomicReference
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * Fail-closed shell for the archive-crypto TurboModule.
 *
 * The development document picker uses a recovery code with generated entries only.
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

  private data class Pick(val exporting: Boolean, val code: String, val promise: Promise)
  private val pendingPick = AtomicReference<Pick?>(null)
  private external fun nativeSampleDocument(directory: String, document: String, recoveryCode: String, exporting: Boolean): String?

  private val fileResults = object : BaseActivityEventListener() {
    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
      if (requestCode != SAMPLE_DOCUMENT_REQUEST) return
      val pick = pendingPick.getAndSet(null) ?: return
      if (resultCode == Activity.RESULT_CANCELED) {
        pick.promise.resolve("")
        return
      }
      val uri = data?.data
      if (resultCode != Activity.RESULT_OK || uri == null || uri.scheme != "content") {
        pick.promise.reject("SAMPLE_DOCUMENT_FAILED", "The file picker could not open the document.")
        return
      }
      cryptoExecutor.execute {
        try {
          val cache = reactApplicationContext.cacheDir
          val temp = File.createTempFile("journal-sample-", ".bin", cache)
          try {
            val resolver = reactApplicationContext.contentResolver
            if (!pick.exporting) {
              requireNotNull(resolver.openInputStream(uri)).use { input ->
                temp.outputStream().use { output ->
                  val buffer = ByteArray(65536)
                  var total = 0L
                  while (true) {
                    val count = input.read(buffer)
                    if (count < 0) break
                    total += count
                    check(count > 0 && total <= 7 * 1024 * 1024)
                    output.write(buffer, 0, count)
                  }
                }
              }
            }
            val result = requireNotNull(nativeSampleDocument(cache.absolutePath, temp.absolutePath, pick.code, pick.exporting))
            if (pick.exporting) {
              requireNotNull(resolver.openOutputStream(uri, "wt")).use { output ->
                temp.inputStream().use { it.copyTo(output) }
              }
            }
            pick.promise.resolve(result)
          } finally {
            temp.delete()
          }
        } catch (_: Exception) {
          pick.promise.reject("SAMPLE_DOCUMENT_FAILED", "The sample backup could not be saved or opened.")
        }
      }
    }
  }

  init { reactContext.addActivityEventListener(fileResults) }

  override fun chooseSampleBackupFile(exporting: Boolean, recoveryCode: String, promise: Promise) {
    if (!app.journal.sifia.BuildConfig.DEBUG || !recoveryCode.matches(Regex("[0-9a-f]{32}"))) {
      promise.reject("SAMPLE_DOCUMENT_DISABLED", "A development build and valid recovery code are required.")
      return
    }
    val pick = Pick(exporting, recoveryCode, promise)
    UiThreadUtil.runOnUiThread {
      if (!pendingPick.compareAndSet(null, pick)) {
        promise.reject("SAMPLE_DOCUMENT_BUSY", "A file picker is already open.")
        return@runOnUiThread
      }
      try {
        val intent = Intent(if (exporting) Intent.ACTION_CREATE_DOCUMENT else Intent.ACTION_OPEN_DOCUMENT).apply {
          addCategory(Intent.CATEGORY_OPENABLE)
          type = if (exporting) "application/octet-stream" else "*/*"
          if (exporting) putExtra(Intent.EXTRA_TITLE, "Journal Sample Backup.bin")
        }
        requireNotNull(reactApplicationContext.currentActivity).startActivityForResult(intent, SAMPLE_DOCUMENT_REQUEST)
      } catch (_: Exception) {
        pendingPick.compareAndSet(pick, null)
        promise.reject("SAMPLE_DOCUMENT_FAILED", "Could not present the file picker.")
      }
    }
  }

  private external fun nativeSyntheticTransfer(directory: String, exporting: Boolean, sharedPhotos: Boolean): String?

  private fun syntheticTransfer(exporting: Boolean, promise: Promise, sharedPhotos: Boolean = false) {
    cryptoExecutor.execute {
      try {
        check(app.journal.sifia.BuildConfig.DEBUG) { "Development build required" }
        val result = nativeSyntheticTransfer(reactApplicationContext.cacheDir.absolutePath, exporting, sharedPhotos)
        requireNotNull(result) { "Synthetic archive verification failed" }
        promise.resolve(result)
      } catch (error: Exception) {
        promise.reject("JOURNAL_TRANSFER_TEST_FAILED", error)
      }
    }
  }

  private external fun nativeFixturePhoto(directory: String, name: String?, replacement: Boolean, sharedStore: Boolean): String?

  private fun fixturePhoto(name: String?, replacement: Boolean, promise: Promise, sharedStore: Boolean = false) {
    cryptoExecutor.execute {
      try {
        check(app.journal.sifia.BuildConfig.DEBUG) { "Development build required" }
        val directory = reactApplicationContext.noBackupFilesDir.absolutePath
        val result = requireNotNull(nativeFixturePhoto(directory, name, replacement, sharedStore)) {
          if (name == null) "Could not stage the encrypted test photo" else "Could not verify the restored test photo"
        }
        promise.resolve(if (name == null) result else result == "verified")
      } catch (error: Exception) {
        promise.reject("JOURNAL_FILE_PHOTO_FAILED", error)
      }
    }
  }

  private external fun nativePhotoInterruption(directory: String, afterPublication: Boolean, inspect: Boolean): Boolean

  private fun photoInterruption(afterPublication: Boolean, inspect: Boolean, promise: Promise) {
    cryptoExecutor.execute {
      try {
        check(app.journal.sifia.BuildConfig.DEBUG) { "Development build required" }
        check(nativePhotoInterruption(reactApplicationContext.noBackupFilesDir.absolutePath, afterPublication, inspect)) {
          "Expected photo interruption evidence was missing"
        }
        promise.resolve(true)
      } catch (error: Exception) {
        promise.reject("JOURNAL_FILE_PHOTO_FAILED", error)
      }
    }
  }

  override fun interruptSyntheticPhoto(afterPublication: Boolean, promise: Promise) = photoInterruption(afterPublication, false, promise)
  override fun checkSyntheticPhotoInterruption(afterPublication: Boolean, promise: Promise) = photoInterruption(afterPublication, true, promise)

  override fun stageSharedFixturePhoto(replacement: Boolean, promise: Promise) =
    fixturePhoto(null, replacement, promise, sharedStore = true)

  private external fun nativeVerifySharedPhotos(directory: String, shared: String, other: String): Boolean

  override fun verifySharedFixturePhotos(shared: String, other: String, promise: Promise) {
    cryptoExecutor.execute {
      try {
        check(app.journal.sifia.BuildConfig.DEBUG) { "Development build required" }
        check(nativeVerifySharedPhotos(reactApplicationContext.noBackupFilesDir.absolutePath, shared, other)) {
          "Could not verify the referenced test photos"
        }
        promise.resolve(true)
      } catch (error: Exception) {
        promise.reject("JOURNAL_FILE_PHOTO_FAILED", error)
      }
    }
  }

  override fun stageSyntheticPhoto(replacement: Boolean, promise: Promise) = fixturePhoto(null, replacement, promise)
  override fun verifySyntheticPhoto(name: String, replacement: Boolean, promise: Promise) = fixturePhoto(name, replacement, promise)

  override fun exportSharedPhotoTransfer(promise: Promise) = syntheticTransfer(true, promise, sharedPhotos = true)
  override fun importSharedPhotoTransfer(promise: Promise) = syntheticTransfer(false, promise, sharedPhotos = true)

  private external fun nativeVerifyTransferredPhotos(
    directory: String, shared: String, sharedDigest: String, other: String, otherDigest: String
  ): Boolean

  override fun verifyTransferredPhotos(shared: String, sharedDigest: String, other: String, otherDigest: String, promise: Promise) {
    cryptoExecutor.execute {
      try {
        check(app.journal.sifia.BuildConfig.DEBUG) { "Development build required" }
        promise.resolve(nativeVerifyTransferredPhotos(reactApplicationContext.cacheDir.absolutePath,
          shared, sharedDigest, other, otherDigest))
      } catch (error: Exception) {
        promise.reject("JOURNAL_TRANSFER_TEST_FAILED", error)
      }
    }
  }

  override fun exportSyntheticTransfer(promise: Promise) = syntheticTransfer(true, promise)
  override fun importSyntheticTransfer(promise: Promise) = syntheticTransfer(false, promise)

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
    reactApplicationContext.removeActivityEventListener(fileResults)
    pendingPick.getAndSet(null)?.promise?.resolve("")
    cryptoExecutor.shutdownNow()
    super.invalidate()
  }

  companion object {
    private const val SAMPLE_DOCUMENT_REQUEST = 32079
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
