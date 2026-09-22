package app.journal.sifia

import android.Manifest
import android.content.pm.PackageManager
import android.media.MediaRecorder
import android.net.Uri
import android.os.Build
import android.os.SystemClock
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.util.UUID

class SifiaVoiceRecorderModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {
  private var recorder: MediaRecorder? = null
  private var recordingFile: File? = null
  private var recordingStartedAt = 0L

  override fun getName(): String = "SifiaVoiceRecorder"

  @ReactMethod
  fun startRecording(promise: Promise) {
    if (ContextCompat.checkSelfPermission(reactContext, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
      promise.reject("permission_denied", "Microphone access was denied.")
      return
    }
    if (recorder != null) {
      promise.reject("recording_in_progress", "A voice recording is already in progress.")
      return
    }

    try {
      val directory = File(reactContext.filesDir, "voice-notes").apply { mkdirs() }
      val file = File(directory, "${UUID.randomUUID()}.m4a")
      val nextRecorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        MediaRecorder(reactContext)
      } else {
        @Suppress("DEPRECATION")
        MediaRecorder()
      }

      nextRecorder.apply {
        setAudioSource(MediaRecorder.AudioSource.MIC)
        setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
        setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
        setAudioSamplingRate(44_100)
        setAudioEncodingBitRate(128_000)
        setOutputFile(file.absolutePath)
        prepare()
        start()
      }

      recorder = nextRecorder
      recordingFile = file
      recordingStartedAt = SystemClock.elapsedRealtime()
      promise.resolve(Uri.fromFile(file).toString())
    } catch (error: Exception) {
      releaseRecorder(deleteFile = true)
      promise.reject("recording_failed", "The voice recording could not be started.", error)
    }
  }

  @ReactMethod
  fun stopRecording(promise: Promise) {
    val currentRecorder = recorder
    val currentFile = recordingFile
    if (currentRecorder == null || currentFile == null) {
      promise.reject("no_recording", "There is no active voice recording.")
      return
    }

    try {
      currentRecorder.stop()
      val durationMillis = SystemClock.elapsedRealtime() - recordingStartedAt
      releaseRecorder(deleteFile = false)
      promise.resolve(Arguments.createMap().apply {
        putString("uri", Uri.fromFile(currentFile).toString())
        putDouble("durationMillis", durationMillis.toDouble())
      })
    } catch (error: RuntimeException) {
      releaseRecorder(deleteFile = true)
      promise.reject("recording_failed", "The voice recording could not be saved.", error)
    }
  }

  @ReactMethod
  fun cancelRecording(promise: Promise) {
    try {
      recorder?.stop()
    } catch (_: RuntimeException) {
      // Very short recordings may not contain enough data to stop cleanly.
    }
    releaseRecorder(deleteFile = true)
    promise.resolve(null)
  }

  private fun releaseRecorder(deleteFile: Boolean) {
    recorder?.reset()
    recorder?.release()
    recorder = null
    if (deleteFile) {
      recordingFile?.delete()
    }
    recordingFile = null
    recordingStartedAt = 0L
  }
}
