import AppIntents
import WidgetKit

/// Interactive check-in from the Home Screen widget (iOS 17+ renders this as an
/// in-place button). The intent cannot reach AsyncStorage, so it records a
/// pending check-in in the App Group; the app reconciles it through the same
/// canonical save path as EmotionCheckInScreen on next foreground/deep link.
@available(iOS 16.0, iOSApplicationExtension 16.0, *)
struct SelectFeelingIntent: AppIntent {
    static var title: LocalizedStringResource = "Select Morning Feeling"
    static var description = IntentDescription("Save today's feeling for the morning check-in.")

    @Parameter(title: "Feeling")
    var feelingId: String

    init() {
        self.feelingId = ""
    }

    init(feelingId: String) {
        self.feelingId = feelingId
    }

    func perform() async throws -> some IntentResult {
        guard !feelingId.isEmpty else { return .result() }
        MorningWidgetStore.applyFeelingSelection(feelingId: feelingId)
        return .result()
    }
}
