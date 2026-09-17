import Foundation
#if canImport(WidgetKit)
import WidgetKit
#endif

/// Bridge between React Native and the App Group container used by the
/// SiFiaMorningWidget extension. AsyncStorage stays canonical; this module only
/// pushes a minimal widget snapshot and returns pending widget check-ins.
@objc(MorningWidgetBridge)
class MorningWidgetBridge: NSObject {

    @objc
    static func requiresMainQueueSetup() -> Bool {
        return false
    }

    /// Store the widget snapshot (JSON-compatible dictionary from RN).
    @objc(updateSnapshot:resolver:rejecter:)
    func updateSnapshot(
        _ snapshot: NSDictionary,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        guard let dictionary = snapshot as? [String: Any] else {
            reject("ERR_SNAPSHOT", "Snapshot is not a dictionary", nil)
            return
        }
        MorningWidgetStore.saveSnapshot(dictionary)
        MorningWidgetStore.reloadTimelines()
        resolve(nil)
    }

    /// Return (and clear) a feeling selected from the widget so the app can
    /// write it through the canonical check-in path. nil when nothing pending.
    @objc(consumePendingCheckIn:rejecter:)
    func consumePendingCheckIn(
        _ resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        resolve(MorningWidgetStore.consumePendingCheckIn())
    }

    @objc(reloadTimelines)
    func reloadTimelines() {
        MorningWidgetStore.reloadTimelines()
    }
}
