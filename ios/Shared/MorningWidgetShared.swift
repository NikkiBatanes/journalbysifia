import Foundation
#if canImport(WidgetKit)
import WidgetKit
#endif

// Shared store for the Morning Home Screen widget.
// Compiled into BOTH the app target and the SiFiaMorningWidget extension.
//
// Canonical journal data lives in React Native AsyncStorage — this file only
// manages the App Group projection (`snapshot`) plus the pending check-in that
// the widget App Intent records for the app to reconcile.

struct MorningWidgetPriority: Codable {
    var text: String
    var completed: Bool
}

struct MorningWidgetSnapshot: Codable {
    var date: String
    var routineStarted: Bool
    var routineCompleted: Bool
    var completedSteps: [String]
    var feeling: String?
    var feelingIcon: String?
    var psalmNumber: Int?
    var psalmRead: Bool?
    var selectedPsalmAttributes: [String]?
    var focus: String?
    var personalFocus: String?
    var focusCategory: String?
    var focusIcon: String?
    var focusIconType: String?
    var priorities: [MorningWidgetPriority]?
    var todoCount: Int?
    var openTodoCount: Int?
    var prayerId: String?
    var weeklyActiveDays: [Bool]?
    var weeklyActiveCount: Int?
}

struct EveningWidgetSnapshot: Codable {
    var date: String
    var routineStarted: Bool
    var routineCompleted: Bool
    var completedSteps: [String]
    var gratitude: [String]?
    var win: String?
    var winContext: String?
    var proverbNumber: Int?
    var proverbRead: Bool?
    var wisdom: [String]?
    var lookingForward: String?
    var lookingForwardEmotion: String?
    var lookingForwardIcon: String?
}

enum MorningWidgetStore {
    static let appGroupId = "group.app.journal.sifia.morning"
    static let widgetKind = "SiFiaMorningWidget"
    static let eveningWidgetKind = "SiFiaEveningWidget"
    static let snapshotKey = "morning_widget_snapshot"
    static let eveningSnapshotKey = "evening_widget_snapshot"
    static let pendingCheckInKey = "morning_widget_pending_checkin"

    static var sharedDefaults: UserDefaults? {
        UserDefaults(suiteName: appGroupId)
    }

    /// Local calendar day key (YYYY-MM-DD), matching the app's date policy.
    static func localDateString(_ date: Date = Date()) -> String {
        let calendar = Calendar.current
        let year = calendar.component(.year, from: date)
        let month = calendar.component(.month, from: date)
        let day = calendar.component(.day, from: date)
        return String(format: "%04d-%02d-%02d", year, month, day)
    }

    // MARK: - Snapshot (written by the app, read by the widget)

    static func loadSnapshot() -> MorningWidgetSnapshot? {
        guard let data = sharedDefaults?.data(forKey: snapshotKey) else { return nil }
        return try? JSONDecoder().decode(MorningWidgetSnapshot.self, from: data)
    }

    /// The app pushes the snapshot as a plain dictionary (JSON-compatible).
    static func saveSnapshot(_ dictionary: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: dictionary) else { return }
        sharedDefaults?.set(data, forKey: snapshotKey)
    }

    static func saveSnapshot(_ snapshot: MorningWidgetSnapshot) {
        guard let data = try? JSONEncoder().encode(snapshot) else { return }
        sharedDefaults?.set(data, forKey: snapshotKey)
    }

    static func loadEveningSnapshot() -> EveningWidgetSnapshot? {
        guard let data = sharedDefaults?.data(forKey: eveningSnapshotKey) else { return nil }
        return try? JSONDecoder().decode(EveningWidgetSnapshot.self, from: data)
    }

    static func saveEveningSnapshot(_ dictionary: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: dictionary) else { return }
        sharedDefaults?.set(data, forKey: eveningSnapshotKey)
    }

    // MARK: - Pending check-in (written by the widget intent, consumed by the app)

    static func recordPendingCheckIn(feelingId: String, date: String) {
        sharedDefaults?.set(["feelingId": feelingId, "date": date], forKey: pendingCheckInKey)
    }

    /// Returns and clears the pending check-in, if any.
    static func consumePendingCheckIn() -> [String: Any]? {
        guard let pending = sharedDefaults?.dictionary(forKey: pendingCheckInKey) else { return nil }
        sharedDefaults?.removeObject(forKey: pendingCheckInKey)
        return pending
    }

    /// Widget-side optimistic update: record the pending write AND update the
    /// projection so the widget transforms immediately. The app rewrites the
    /// canonical record (and this snapshot) on next foreground.
    static func applyFeelingSelection(feelingId: String) {
        let today = localDateString()
        recordPendingCheckIn(feelingId: feelingId, date: today)

        var snapshot = loadSnapshot() ?? MorningWidgetSnapshot(
            date: today,
            routineStarted: false,
            routineCompleted: false,
            completedSteps: [],
            feeling: nil,
            feelingIcon: nil,
            psalmNumber: nil,
            psalmRead: nil,
            selectedPsalmAttributes: nil,
            focus: nil,
            personalFocus: nil,
            focusCategory: nil,
            focusIcon: nil,
            focusIconType: nil,
            priorities: nil,
            todoCount: nil,
            openTodoCount: nil,
            prayerId: nil,
            weeklyActiveDays: nil,
            weeklyActiveCount: nil
        )
        snapshot.date = today
        snapshot.routineStarted = true
        snapshot.feeling = feelingName(forId: feelingId)
        snapshot.feelingIcon = feelingIcon(forId: feelingId)
        if !snapshot.completedSteps.contains("emotion") {
            snapshot.completedSteps.append("emotion")
        }
        saveSnapshot(snapshot)
        reloadTimelines()
    }

    static func reloadTimelines() {
        #if canImport(WidgetKit)
        WidgetCenter.shared.reloadTimelines(ofKind: widgetKind)
        WidgetCenter.shared.reloadTimelines(ofKind: eveningWidgetKind)
        #endif
    }

    // MARK: - Canonical feeling metadata (mirror of MORNING_*_FEELINGS in the app)

    static func feelingName(forId id: String) -> String {
        feelingMap[id]?.name ?? id.capitalized
    }

    static func feelingIcon(forId id: String) -> String {
        feelingMap[id]?.icon ?? "leaf-outline"
    }

    /// RN icon name → SF Symbol used inside the widget.
    static func sfSymbol(forIconName icon: String?) -> String {
        switch icon {
        case "leaf-outline": return "leaf"
        case "hand-heart": return "heart"
        case "sunny-outline": return "sun.max"
        case "happy-outline": return "face.smiling"
        case "cloudy-outline": return "cloud"
        case "sleep": return "moon.zzz"
        case "waves": return "water.waves"
        case "emoticon-sad-outline": return "cloud.rain"
        case "emoticon-angry-outline": return "bolt"
        case "sparkles-outline": return "sparkles"
        case "water-outline": return "drop"
        case "cafe-outline": return "cup.and.saucer"
        case "alert-circle-outline": return "exclamationmark.circle"
        case "person-outline": return "person"
        case "trophy-outline": return "trophy"
        case "cloudy-night-outline": return "cloud.moon"
        case "flash-outline": return "bolt"
        case "bulb-outline": return "lightbulb"
        case "time-outline": return "clock"
        case "flame-outline": return "flame"
        case "rainy-outline": return "cloud.rain"
        case "shield-outline": return "shield"
        case "thunderstorm-outline": return "cloud.bolt"
        case "help-circle-outline": return "questionmark.circle"
        case "heart-outline": return "heart"
        case "plus-circle": return "plus.circle"
        default: return "leaf"
        }
    }

    private static let feelingMap: [String: (name: String, icon: String)] = [
        "peaceful": ("Peaceful", "leaf-outline"),
        "grateful": ("Grateful", "hand-heart"),
        "hopeful": ("Hopeful", "sunny-outline"),
        "joyful": ("Joyful", "happy-outline"),
        "anxious": ("Anxious", "cloudy-outline"),
        "tired": ("Tired", "sleep"),
        "overwhelmed": ("Overwhelmed", "waves"),
        "sad": ("Sad", "emoticon-sad-outline"),
        "frustrated": ("Frustrated", "emoticon-angry-outline"),
        "excited": ("Excited", "sparkles-outline"),
        "calm": ("Calm", "water-outline"),
        "content": ("Content", "cafe-outline"),
        "stressed": ("Stressed", "alert-circle-outline"),
        "lonely": ("Lonely", "person-outline"),
        "confident": ("Confident", "trophy-outline"),
        "worried": ("Worried", "cloudy-night-outline"),
        "restless": ("Restless", "flash-outline"),
        "inspired": ("Inspired", "bulb-outline"),
        "bored": ("Bored", "time-outline"),
        "angry": ("Angry", "flame-outline"),
        "discouraged": ("Discouraged", "rainy-outline"),
        "brave": ("Brave", "shield-outline"),
        "hopeless": ("Hopeless", "cloudy-outline"),
        "grumpy": ("Grumpy", "thunderstorm-outline"),
        "stuck": ("Stuck", "help-circle-outline"),
        "loved": ("Loved", "heart-outline"),
    ]
}
