import SwiftUI
import WidgetKit

// MARK: - Palette (mirrors src/theme/themes/default.ts)

private enum Palette {
    static let cream = Color(red: 0xF6 / 255, green: 0xF5 / 255, blue: 0xEF / 255)   // lightBackground
    static let card = Color(red: 0xFF / 255, green: 0xFE / 255, blue: 0xFA / 255)    // hopeWhite / cardBackground
    static let sage = Color(red: 0x52 / 255, green: 0x6A / 255, blue: 0x5B / 255)    // sage
    static let sageMuted = Color(red: 0x71 / 255, green: 0x84 / 255, blue: 0x76 / 255)
    static let ink = Color(red: 0x29 / 255, green: 0x34 / 255, blue: 0x2E / 255)     // text
    static let gray = Color(red: 0x7C / 255, green: 0x83 / 255, blue: 0x7D / 255)    // textGray
    static let border = Color(red: 0xDF / 255, green: 0xE4 / 255, blue: 0xDD / 255)  // cardBorder
}

// MARK: - Deep links (routed by notificationDeepLinkService → MorningFlow)

private enum MorningLink {
    static func url(_ step: String?) -> URL {
        URL(string: "sifia://morning/today\(step.map { "/\($0)" } ?? "")")!
    }
    static var emotion: URL { url("emotion") }
    static var underneath: URL { url("underneath") }
    static var psalm: URL { url("psalm") }
    static var focus: URL { url("focus") }
    static var todos: URL { url("todos") }
    static var carry: URL { url("carry") }
    static var closing: URL { url("closing") }
    static var today: URL { url(nil) }
}

// MARK: - Widget state machine (canonical step order from routineResume.ts)

private enum MorningStepState {
    case checkIn      // emotion incomplete → feeling selector
    case underneath   // emotion done → "You're feeling X / What's underneath that?"
    case psalm        // underneath done → Psalm
    case focus        // psalm done → Today's Focus
    case todos        // focus done → Todos
    case carry        // todos done → Pause & Praise
    case closing      // all steps done, routine not completed → MorningClosing
    case done         // routine completed → post-morning summary
}

private func widgetState(for snapshot: MorningWidgetSnapshot?, on date: Date) -> MorningStepState {
    // The widget represents TODAY only. A snapshot stamped with another day is
    // treated as a fresh, unstarted morning.
    guard let snapshot, snapshot.date == MorningWidgetStore.localDateString(date) else {
        return .checkIn
    }
    if snapshot.routineCompleted { return .done }
    let steps = Set(snapshot.completedSteps)
    if !steps.contains("emotion") { return .checkIn }
    if !steps.contains("underneath") { return .underneath }
    if !steps.contains("psalm") { return .psalm }
    if !steps.contains("todays_focus") { return .focus }
    if !steps.contains("todos") { return .todos }
    if !steps.contains("carry") { return .carry }
    return .closing
}

// MARK: - Timeline

private struct MorningEntry: TimelineEntry {
    let date: Date
    let snapshot: MorningWidgetSnapshot?
}

private struct MorningProvider: TimelineProvider {
    func placeholder(in context: Context) -> MorningEntry {
        MorningEntry(date: Date(), snapshot: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (MorningEntry) -> Void) {
        completion(MorningEntry(date: Date(), snapshot: MorningWidgetStore.loadSnapshot()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<MorningEntry>) -> Void) {
        let now = Date()
        var entries = [MorningEntry(date: now, snapshot: MorningWidgetStore.loadSnapshot())]

        // Roll the widget to a fresh day at local midnight.
        if let midnight = Calendar.current.nextDate(
            after: now,
            matching: DateComponents(hour: 0, minute: 0, second: 0),
            matchingPolicy: .nextTime
        ) {
            entries.append(MorningEntry(date: midnight, snapshot: nil))
        }

        completion(Timeline(entries: entries, policy: .atEnd))
    }
}

// MARK: - Shared subviews

private struct Eyebrow: View {
    let text: String
    var body: some View {
        Text(text)
            .font(.system(size: 11, weight: .semibold))
            .tracking(2.2)
            .foregroundColor(Palette.sageMuted)
    }
}

private struct Header: View {
    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: "leaf")
                .font(.system(size: 11, weight: .semibold))
                .foregroundColor(Palette.sage)
            Eyebrow(text: "JOURNAL BY SIFIA")
            Spacer(minLength: 0)
        }
        .accessibilityHidden(true)
    }
}

/// One tappable feeling. On iOS 17+ it writes the check-in in place via
/// SelectFeelingIntent; on older systems it opens the app's full selector.
private struct FeelingPill: View {
    let id: String
    let name: String

    var body: some View {
        if #available(iOSApplicationExtension 17.0, *) {
            Button(intent: SelectFeelingIntent(feelingId: id)) {
                pillLabel(icon: MorningWidgetStore.feelingIcon(forId: id), name: name)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Select \(name) as today's feeling")
        } else {
            Link(destination: MorningLink.emotion) {
                pillLabel(icon: MorningWidgetStore.feelingIcon(forId: id), name: name)
            }
            .accessibilityLabel("Open Journal by siFia to choose how you're feeling")
        }
    }

    private func pillLabel(icon: String, name: String) -> some View {
        HStack(spacing: 6) {
            Image(systemName: MorningWidgetStore.sfSymbol(forIconName: icon))
                .font(.system(size: 13, weight: .medium))
                .foregroundColor(Palette.sage)
            Text(name)
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(Palette.ink)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 10)
        .background(Palette.card)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(Palette.border, lineWidth: 0.5)
        )
    }
}

private struct ContinueLink: View {
    let title: String
    let destination: URL
    var accessibilityLabel: String? = nil

    var body: some View {
        Link(destination: destination) {
            HStack(spacing: 6) {
                Text(title)
                    .font(.system(size: 14, weight: .semibold))
                Image(systemName: "arrow.right")
                    .font(.system(size: 12, weight: .semibold))
            }
            .foregroundColor(Palette.card)
            .padding(.horizontal, 16)
            .padding(.vertical, 9)
            .background(Palette.sage)
            .clipShape(Capsule())
        }
        .accessibilityLabel(accessibilityLabel ?? title)
    }
}

// MARK: - State views

private struct CheckInView: View {
    private let quickFeelings: [(id: String, name: String)] = [
        ("peaceful", "Peaceful"),
        ("grateful", "Grateful"),
        ("hopeful", "Hopeful"),
        ("anxious", "Anxious"),
        ("tired", "Tired"),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Header()
            VStack(alignment: .leading, spacing: 2) {
                Eyebrow(text: "MORNING CHECK-IN")
                Text("How are you feeling?")
                    .font(.system(size: 17, weight: .bold, design: .serif))
                    .foregroundColor(Palette.ink)
            }

            VStack(spacing: 8) {
                HStack(spacing: 8) {
                    ForEach(quickFeelings.prefix(3), id: \.id) { FeelingPill(id: $0.id, name: $0.name) }
                }
                HStack(spacing: 8) {
                    ForEach(quickFeelings.suffix(2), id: \.id) { FeelingPill(id: $0.id, name: $0.name) }
                    Link(destination: MorningLink.emotion) {
                        HStack(spacing: 4) {
                            Text("More")
                                .font(.system(size: 13, weight: .semibold))
                            Image(systemName: "chevron.right")
                                .font(.system(size: 11, weight: .semibold))
                        }
                        .foregroundColor(Palette.sage)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                    }
                    .accessibilityLabel("Show all feelings in Journal by siFia")
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

private struct UnderneathView: View {
    let feeling: String

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Header()
            Eyebrow(text: "MORNING CHECK-IN")
            Text("You’re feeling")
                .font(.system(size: 13))
                .foregroundColor(Palette.gray)
            Text(feeling)
                .font(.system(size: 22, weight: .bold, design: .serif))
                .foregroundColor(Palette.ink)
                .privacySensitive()
            Text("What’s underneath that?")
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(Palette.ink)
            Spacer(minLength: 0)
            HStack {
                Text("Continue with Scripture and what is on your heart.")
                    .font(.system(size: 12))
                    .foregroundColor(Palette.gray)
                Spacer(minLength: 8)
                ContinueLink(
                    title: "Continue",
                    destination: MorningLink.underneath,
                    accessibilityLabel: "Continue to what's underneath that"
                )
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

private struct StepLinkView: View {
    let eyebrow: String
    let title: String
    var subtitle: String? = nil
    let linkTitle: String
    let destination: URL
    let icon: String

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Header()
            Eyebrow(text: eyebrow)
            Text(title)
                .font(.system(size: 20, weight: .bold, design: .serif))
                .foregroundColor(Palette.ink)
                .privacySensitive()
            if let subtitle = subtitle {
                Text(subtitle)
                    .font(.system(size: 13))
                    .foregroundColor(Palette.gray)
            }
            Spacer(minLength: 0)
            HStack {
                Image(systemName: icon)
                    .font(.system(size: 14))
                    .foregroundColor(Palette.sage)
                Spacer(minLength: 0)
                ContinueLink(title: linkTitle, destination: destination)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

// MARK: - Post-morning summary

private struct DoneMediumView: View {
    let snapshot: MorningWidgetSnapshot

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Header()
            Eyebrow(text: "TODAY’S FOCUS")
            Text(snapshot.focus?.isEmpty == false ? snapshot.focus! : "Morning saved")
                .font(.system(size: 20, weight: .bold, design: .serif))
                .foregroundColor(Palette.ink)
                .lineLimit(2)
                .privacySensitive()
            Spacer(minLength: 0)
            HStack(spacing: 6) {
                Image(systemName: "book")
                    .font(.system(size: 12))
                    .foregroundColor(Palette.sage)
                Text(psalmLine)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(Palette.gray)
                    .lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .widgetURL(MorningLink.closing)
    }

    private var psalmLine: String {
        let number = snapshot.psalmNumber.map { "Psalm \($0)" } ?? "Psalm"
        let attribute = snapshot.selectedPsalmAttributes?.first
        if let attribute, !attribute.isEmpty {
            return "\(number) · \(attribute)"
        }
        return "\(number) · Morning saved"
    }
}

private struct DoneLargeView: View {
    let snapshot: MorningWidgetSnapshot

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Header()

            VStack(alignment: .leading, spacing: 4) {
                Eyebrow(text: "TODAY’S FOCUS")
                Text(snapshot.focus?.isEmpty == false ? snapshot.focus! : "Morning saved")
                    .font(.system(size: 20, weight: .bold, design: .serif))
                    .foregroundColor(Palette.ink)
                    .lineLimit(2)
                    .privacySensitive()
            }

            let priorities = (snapshot.priorities ?? []).filter { !$0.text.isEmpty }
            if !priorities.isEmpty {
                VStack(alignment: .leading, spacing: 5) {
                    Eyebrow(text: "TOP PRIORITIES")
                    ForEach(priorities.prefix(3), id: \.text) { priority in
                        HStack(spacing: 8) {
                            Image(systemName: priority.completed ? "checkmark.circle.fill" : "circle")
                                .font(.system(size: 13))
                                .foregroundColor(priority.completed ? Palette.sage : Palette.gray)
                            Text(priority.text)
                                .font(.system(size: 14, weight: .medium))
                                .foregroundColor(Palette.ink)
                                .lineLimit(1)
                        }
                    }
                }
                .privacySensitive()
            }

            if let feeling = snapshot.feeling, !feeling.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Eyebrow(text: "HOW YOU BEGAN")
                    HStack(spacing: 6) {
                        Image(systemName: MorningWidgetStore.sfSymbol(forIconName: snapshot.feelingIcon))
                            .font(.system(size: 13))
                            .foregroundColor(Palette.sage)
                        Text(feeling)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(Palette.ink)
                    }
                }
                .privacySensitive()
            }

            VStack(alignment: .leading, spacing: 4) {
                let number = snapshot.psalmNumber.map { "PSALM \($0)" } ?? "PSALM"
                Eyebrow(text: "\(number) · PAUSE & PRAISE")
                let attributes = (snapshot.selectedPsalmAttributes ?? []).filter { !$0.isEmpty }
                Text(attributes.isEmpty ? "Morning saved" : attributes.joined(separator: " · "))
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(Palette.ink)
                    .lineLimit(2)
                    .privacySensitive()
            }

            Spacer(minLength: 0)
            Text("Remember who God is as you step into today.")
                .font(.system(size: 12, design: .serif))
                .italic()
                .foregroundColor(Palette.gray)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .widgetURL(MorningLink.closing)
    }
}

// MARK: - Entry view

private struct SiFiaMorningWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    let entry: MorningEntry

    var body: some View {
        let state = widgetState(for: entry.snapshot, on: entry.date)
        let snapshot = entry.snapshot

        Group {
            switch state {
            case .checkIn:
                CheckInView()
            case .underneath:
                UnderneathView(feeling: snapshot?.feeling?.isEmpty == false ? snapshot!.feeling! : "checked in")
            case .psalm:
                StepLinkView(
                    eyebrow: "DAILY PSALM",
                    title: snapshot?.psalmNumber.map { "Psalm \($0)" } ?? "Today’s Psalm",
                    subtitle: "Take a few quiet minutes with today’s Psalm.",
                    linkTitle: "Read today’s Psalm",
                    destination: MorningLink.psalm,
                    icon: "book"
                )
            case .focus:
                StepLinkView(
                    eyebrow: "TODAY’S FOCUS",
                    title: "Set today’s focus",
                    subtitle: "Choose what matters most today.",
                    linkTitle: "Set focus",
                    destination: MorningLink.focus,
                    icon: "scope"
                )
            case .todos:
                StepLinkView(
                    eyebrow: "TO-DOS",
                    title: "What needs to get done today?",
                    subtitle: "Add the tasks you do not want to forget.",
                    linkTitle: "Add to-dos",
                    destination: MorningLink.todos,
                    icon: "checklist"
                )
            case .carry:
                StepLinkView(
                    eyebrow: "PAUSE & PRAISE",
                    title: "What do you see about God?",
                    subtitle: "Remember who God is as you step into today.",
                    linkTitle: "Pause & Praise",
                    destination: MorningLink.carry,
                    icon: "music.note"
                )
            case .closing:
                StepLinkView(
                    eyebrow: "MORNING",
                    title: "Your morning is ready to save.",
                    linkTitle: "Save & finish",
                    destination: MorningLink.closing,
                    icon: "checkmark.circle"
                )
            case .done:
                if family == .systemLarge {
                    DoneLargeView(snapshot: snapshot!)
                } else {
                    DoneMediumView(snapshot: snapshot!)
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .widgetBackground()
    }
}

private extension View {
    /// iOS 17+ uses containerBackground; earlier versions paint the canvas
    /// behind the content so both look identical.
    @ViewBuilder
    func widgetBackground() -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            self.containerBackground(for: .widget) { Palette.cream }
        } else {
            self.background(Palette.cream)
        }
    }
}

// MARK: - Widget definition

struct SiFiaMorningWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: MorningWidgetStore.widgetKind, provider: MorningProvider()) { entry in
            SiFiaMorningWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Morning")
        .description("Begin your day with a gentle check-in, and carry your focus with you.")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}

@main
struct SiFiaMorningWidgetBundle: WidgetBundle {
    var body: some Widget {
        SiFiaMorningWidget()
    }
}
