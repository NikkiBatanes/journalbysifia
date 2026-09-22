import AVFoundation
import Foundation

@objc(SifiaVoiceRecorder)
class SifiaVoiceRecorder: NSObject {
  private var recorder: AVAudioRecorder?
  private var recordingURL: URL?

  @objc
  static func requiresMainQueueSetup() -> Bool {
    false
  }

  @objc(startRecording:rejecter:)
  func startRecording(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let session = AVAudioSession.sharedInstance()

    switch session.recordPermission {
    case .granted:
      beginRecording(resolve, reject: reject)
    case .denied:
      reject("permission_denied", "Microphone access was denied.", nil)
    case .undetermined:
      session.requestRecordPermission { [weak self] granted in
        guard granted else {
          reject("permission_denied", "Microphone access was denied.", nil)
          return
        }
        self?.beginRecording(resolve, reject: reject)
      }
    @unknown default:
      reject("permission_unavailable", "Microphone permission is unavailable.", nil)
    }
  }

  private func beginRecording(
    _ resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    guard recorder == nil else {
      reject("recording_in_progress", "A voice recording is already in progress.", nil)
      return
    }

    do {
      let directory = try voiceNotesDirectory()
      let url = directory.appendingPathComponent("\(UUID().uuidString).m4a")
      let session = AVAudioSession.sharedInstance()
      try session.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker, .allowBluetoothHFP])
      try session.setActive(true)

      let settings: [String: Any] = [
        AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
        AVSampleRateKey: 44_100,
        AVNumberOfChannelsKey: 1,
        AVEncoderBitRateKey: 128_000,
        AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue,
      ]
      let nextRecorder = try AVAudioRecorder(url: url, settings: settings)
      nextRecorder.prepareToRecord()
      guard nextRecorder.record() else {
        reject("recording_failed", "The voice recording could not be started.", nil)
        return
      }

      recorder = nextRecorder
      recordingURL = url
      resolve(url.absoluteString)
    } catch {
      reject("recording_failed", "The voice recording could not be started.", error)
    }
  }

  @objc(stopRecording:rejecter:)
  func stopRecording(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    guard let recorder, let recordingURL else {
      reject("no_recording", "There is no active voice recording.", nil)
      return
    }

    let durationMillis = Int((recorder.currentTime * 1_000).rounded())
    recorder.stop()
    self.recorder = nil
    self.recordingURL = nil
    deactivateAudioSession()
    resolve([
      "uri": recordingURL.absoluteString,
      "durationMillis": durationMillis,
    ])
  }

  @objc(cancelRecording:rejecter:)
  func cancelRecording(
    _ resolve: RCTPromiseResolveBlock,
    rejecter _: RCTPromiseRejectBlock
  ) {
    recorder?.stop()
    recorder = nil
    if let recordingURL {
      try? FileManager.default.removeItem(at: recordingURL)
    }
    recordingURL = nil
    deactivateAudioSession()
    resolve(nil)
  }

  private func voiceNotesDirectory() throws -> URL {
    let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    let directory = documents.appendingPathComponent("VoiceNotes", isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    return directory
  }

  private func deactivateAudioSession() {
    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
  }
}
