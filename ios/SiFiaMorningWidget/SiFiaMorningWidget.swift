import SwiftUI
import WidgetKit

private enum Palette {
    static let cream = Color(red: 0xF6 / 255, green: 0xF5 / 255, blue: 0xEF / 255)
    static let card = Color(red: 0xFF / 255, green: 0xFE / 255, blue: 0xFA / 255)
    static let sage = Color(red: 0x52 / 255, green: 0x6A / 255, blue: 0x5B / 255)
    static let sageMuted = Color(red: 0x71 / 255, green: 0x84 / 255, blue: 0x76 / 255)
    static let ink = Color(red: 0x29 / 255, green: 0x34 / 255, blue: 0x2E / 255)
    static let gray = Color(red: 0x7C / 255, green: 0x83 / 255, blue: 0x7D / 255)
    static let border = Color(red: 0xDF / 255, green: 0xE4 / 255, blue: 0xDD / 255)
    static let dusk = Color(red: 0x54 / 255, green: 0x59 / 255, blue: 0x70 / 255)
    static let duskMuted = Color(red: 0x7A / 255, green: 0x7D / 255, blue: 0x91 / 255)
    static let eveningWash = Color(red: 0xF3 / 255, green: 0xF1 / 255, blue: 0xEE / 255)
    static let moon = Color(red: 0xC9 / 255, green: 0xA9 / 255, blue: 0x68 / 255)
}

private struct Eyebrow: View {
    let text: String
    var color = Palette.sageMuted
    var body: some View {
        Text(text).font(.system(size: 10, weight: .semibold)).tracking(1.7)
            .foregroundColor(color).lineLimit(1)
    }
}

private struct BrandHeader: View {
    var evening = false
    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: evening ? "moon.stars" : "leaf")
                .font(.system(size: 11, weight: .semibold))
                .foregroundColor(evening ? Palette.moon : Palette.sage)
            Eyebrow(text: "JOURNAL BY SIFIA", color: evening ? Palette.duskMuted : Palette.sageMuted)
            Spacer(minLength: 0)
        }.accessibilityHidden(true)
    }
}

private struct ProgressDots: View {
    let completed: Int
    let total: Int
    var color = Palette.sage
    var body: some View {
        HStack(spacing: 4) {
            ForEach(0..<total, id: \.self) { index in
                Capsule().fill(index < completed ? color : Palette.border)
                    .frame(maxWidth: .infinity).frame(height: 3)
            }
        }.accessibilityLabel("\(completed) of \(total) steps complete")
    }
}

private struct ActionLabel: View {
    let title: String
    var color = Palette.sage
    var body: some View {
        HStack(spacing: 5) {
            Text(title).font(.system(size: 13, weight: .semibold))
            Image(systemName: "arrow.right").font(.system(size: 11, weight: .semibold))
        }
        .foregroundColor(Palette.card).padding(.horizontal, 14).padding(.vertical, 8)
        .background(color).clipShape(Capsule())
    }
}

private struct StepRow: View {
    let label: String
    let complete: Bool
    var active = false
    var color = Palette.sage
    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: complete ? "checkmark.circle.fill" : (active ? "circle.inset.filled" : "circle"))
                .font(.system(size: 12)).foregroundColor(complete || active ? color : Palette.gray.opacity(0.65))
            Text(label).font(.system(size: 12, weight: active ? .semibold : .regular))
                .foregroundColor(active ? Palette.ink : Palette.gray).lineLimit(1)
            Spacer(minLength: 0)
        }
    }
}

private extension View {
    @ViewBuilder func widgetBackground(_ color: Color) -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            self.containerBackground(for: .widget) { color }
        } else { self.background(color) }
    }
}

// MARK: Morning

private enum MorningLink {
    static func url(_ step: String? = nil) -> URL {
        URL(string: "sifia://morning/today\(step.map { "/\($0)" } ?? "")")!
    }
    static var emotion: URL { url("emotion") }
    static var underneath: URL { url("underneath") }
    static var psalm: URL { url("psalm") }
    static var carry: URL { url("carry") }
    static var focus: URL { url("focus") }
    static var todos: URL { url("todos") }
    static var closing: URL { url("closing") }
}

private enum MorningStepState: String {
    case checkIn, underneath, psalm, carry, focus, todos, closing, done
    var eyebrow: String {
        switch self {
        case .checkIn, .underneath: return "MORNING CHECK-IN"
        case .psalm: return "DAILY PSALM"
        case .carry: return "PAUSE & PRAISE"
        case .focus: return "TODAY’S FOCUS"
        case .todos: return "TO-DOs"
        case .closing: return "MORNING"
        case .done: return "MORNING SAVED"
        }
    }
    var title: String {
        switch self {
        case .checkIn: return "How are you feeling?"
        case .underneath: return "What’s underneath that?"
        case .psalm: return "Sit with today’s Psalm"
        case .carry: return "What do you see about God?"
        case .focus: return "Set today’s focus"
        case .todos: return "What needs to get done?"
        case .closing: return "Your morning is ready to save"
        case .done: return "Carry this into today"
        }
    }
    var subtitle: String {
        switch self {
        case .checkIn: return "Begin with an honest check-in."
        case .underneath: return "Make a little room for what is true."
        case .psalm: return "Take a few quiet minutes with Scripture."
        case .carry: return "Notice who God is in what you read."
        case .focus: return "Choose what matters most today."
        case .todos: return "Keep today’s next steps close."
        case .closing: return "Review, save, and step into the day."
        case .done: return "Your morning reflection is with you."
        }
    }
    var icon: String {
        switch self {
        case .checkIn: return "heart"
        case .underneath: return "text.bubble"
        case .psalm: return "book.closed"
        case .carry: return "sparkles"
        case .focus: return "scope"
        case .todos: return "checklist"
        case .closing: return "checkmark.circle"
        case .done: return "sun.max"
        }
    }
    var destination: URL {
        switch self {
        case .checkIn: return MorningLink.emotion
        case .underneath: return MorningLink.underneath
        case .psalm: return MorningLink.psalm
        case .carry: return MorningLink.carry
        case .focus: return MorningLink.focus
        case .todos: return MorningLink.todos
        case .closing, .done: return MorningLink.closing
        }
    }
}

private let morningSteps: [(id: String, label: String, state: MorningStepState)] = [
    ("emotion", "Check in", .checkIn), ("underneath", "What’s underneath", .underneath),
    ("psalm", "Daily Psalm", .psalm), ("carry", "Pause & Praise", .carry),
    ("todays_focus", "Today’s focus", .focus), ("todos", "To-dos", .todos),
]

private func morningState(_ snapshot: MorningWidgetSnapshot?, _ date: Date) -> MorningStepState {
    guard let snapshot, snapshot.date == MorningWidgetStore.localDateString(date) else { return .checkIn }
    if snapshot.routineCompleted { return .done }
    let completed = Set(snapshot.completedSteps)
    return morningSteps.first(where: { !completed.contains($0.id) })?.state ?? .closing
}

private struct MorningEntry: TimelineEntry { let date: Date; let snapshot: MorningWidgetSnapshot? }
private struct MorningProvider: TimelineProvider {
    func placeholder(in context: Context) -> MorningEntry { MorningEntry(date: Date(), snapshot: nil) }
    func getSnapshot(in context: Context, completion: @escaping (MorningEntry) -> Void) {
        completion(MorningEntry(date: Date(), snapshot: MorningWidgetStore.loadSnapshot()))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<MorningEntry>) -> Void) {
        completion(dailyTimeline(snapshot: MorningWidgetStore.loadSnapshot()))
    }
    private func dailyTimeline(snapshot: MorningWidgetSnapshot?) -> Timeline<MorningEntry> {
        let now = Date()
        var entries = [MorningEntry(date: now, snapshot: snapshot)]
        if let midnight = Calendar.current.nextDate(after: now, matching: DateComponents(hour: 0), matchingPolicy: .nextTime) {
            entries.append(MorningEntry(date: midnight, snapshot: nil))
        }
        return Timeline(entries: entries, policy: .atEnd)
    }
}

private struct FeelingPill: View {
    let id: String; let name: String
    var body: some View {
        if #available(iOSApplicationExtension 17.0, *) {
            Button(intent: SelectFeelingIntent(feelingId: id)) { label }.buttonStyle(.plain)
        } else { Link(destination: MorningLink.emotion) { label } }
    }
    private var label: some View {
        HStack(spacing: 5) {
            Image(systemName: MorningWidgetStore.sfSymbol(forIconName: MorningWidgetStore.feelingIcon(forId: id)))
                .font(.system(size: 12, weight: .medium)).foregroundColor(Palette.sage)
            Text(name).font(.system(size: 12, weight: .semibold)).foregroundColor(Palette.ink)
                .lineLimit(1).minimumScaleFactor(0.75)
        }.frame(maxWidth: .infinity).padding(.vertical, 8).background(Palette.card)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Palette.border, lineWidth: 0.5))
    }
}

private struct MorningSmallView: View {
    let state: MorningStepState; let snapshot: MorningWidgetSnapshot?
    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack { Image(systemName: state.icon).foregroundColor(Palette.sage); Spacer()
                if state == .done { Image(systemName: "checkmark.circle.fill").foregroundColor(Palette.sage) } }
            Spacer(minLength: 0)
            Eyebrow(text: state.eyebrow)
            Text(displayTitle).font(.system(size: 17, weight: .bold, design: .serif))
                .foregroundColor(Palette.ink).lineLimit(3).minimumScaleFactor(0.8).privacySensitive()
            if state != .done { Text("\(completedCount) of \(morningSteps.count)")
                .font(.system(size: 10, weight: .medium)).foregroundColor(Palette.gray) }
        }.widgetURL(state.destination)
    }
    private var displayTitle: String {
        if state == .done, let focus = snapshot?.focus, !focus.isEmpty { return focus }
        if state == .underneath, let feeling = snapshot?.feeling, !feeling.isEmpty { return "\(feeling). What’s underneath?" }
        return state.title
    }
    private var completedCount: Int {
        let done = Set(snapshot?.completedSteps ?? []); return morningSteps.filter { done.contains($0.id) }.count
    }
}

private struct MorningCheckInView: View {
    private let feelings = [("peaceful", "Peaceful"), ("grateful", "Grateful"), ("hopeful", "Hopeful"), ("anxious", "Anxious"), ("tired", "Tired")]
    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            BrandHeader(); Eyebrow(text: "MORNING CHECK-IN")
            Text("How are you feeling?").font(.system(size: 19, weight: .bold, design: .serif)).foregroundColor(Palette.ink)
            HStack(spacing: 6) { ForEach(feelings.prefix(3), id: \.0) { FeelingPill(id: $0.0, name: $0.1) } }
            HStack(spacing: 6) {
                ForEach(feelings.suffix(2), id: \.0) { FeelingPill(id: $0.0, name: $0.1) }
                Link(destination: MorningLink.emotion) { Text("More  ›").font(.system(size: 12, weight: .semibold))
                    .foregroundColor(Palette.sage).frame(maxWidth: .infinity).padding(.vertical, 8) }
            }
        }
    }
}

private struct MorningStepView: View {
    let state: MorningStepState; let snapshot: MorningWidgetSnapshot?
    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            BrandHeader()
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: state.icon).foregroundColor(Palette.sage).frame(width: 34, height: 34)
                    .background(Palette.sage.opacity(0.09)).clipShape(Circle())
                VStack(alignment: .leading, spacing: 3) { Eyebrow(text: state.eyebrow)
                    Text(displayTitle).font(.system(size: 19, weight: .bold, design: .serif))
                        .foregroundColor(Palette.ink).lineLimit(2).privacySensitive() }
            }
            Spacer(minLength: 0)
            HStack(alignment: .bottom) { Text(state.subtitle).font(.system(size: 11)).foregroundColor(Palette.gray).lineLimit(2)
                Spacer(minLength: 8); Link(destination: state.destination) { ActionLabel(title: state == .closing ? "Save" : "Continue") } }
        }
    }
    private var displayTitle: String {
        if state == .underneath, let feeling = snapshot?.feeling, !feeling.isEmpty { return "You’re feeling \(feeling)" }
        if state == .psalm, let number = snapshot?.psalmNumber { return "Psalm \(number)" }
        return state.title
    }
}

private struct MorningLargeView: View {
    let state: MorningStepState; let snapshot: MorningWidgetSnapshot?
    private var completed: Set<String> { Set(snapshot?.completedSteps ?? []) }
    var body: some View {
        VStack(alignment: .leading, spacing: 13) {
            BrandHeader()
            HStack(alignment: .top) { VStack(alignment: .leading, spacing: 4) { Eyebrow(text: state.eyebrow)
                Text(title).font(.system(size: 22, weight: .bold, design: .serif)).foregroundColor(Palette.ink).lineLimit(2)
                Text(state.subtitle).font(.system(size: 12)).foregroundColor(Palette.gray) }
                Spacer(); Link(destination: state.destination) { ActionLabel(title: state == .closing ? "Save" : "Continue") } }
            ProgressDots(completed: completed.count, total: morningSteps.count)
            HStack(alignment: .top, spacing: 18) {
                VStack(alignment: .leading, spacing: 8) { Eyebrow(text: "YOUR MORNING")
                    ForEach(morningSteps, id: \.id) { step in StepRow(label: step.label, complete: completed.contains(step.id), active: step.state == state) } }
                    .frame(maxWidth: .infinity, alignment: .leading)
                VStack(alignment: .leading, spacing: 10) {
                    Eyebrow(text: snapshot?.focus?.isEmpty == false ? "TODAY’S FOCUS" : "A GENTLE START")
                    Text(snapshot?.focus?.isEmpty == false ? snapshot!.focus! : "Name what you’re carrying, sit with Scripture, and choose what deserves your attention.")
                        .font(.system(size: 13, design: .serif)).foregroundColor(Palette.ink).lineLimit(5).lineSpacing(3).privacySensitive()
                    Spacer(minLength: 0)
                    if let number = snapshot?.psalmNumber { Label("Psalm \(number)", systemImage: "book.closed")
                        .font(.system(size: 12, weight: .medium)).foregroundColor(Palette.sage) }
                }.frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }
    private var title: String {
        if state == .underneath, let feeling = snapshot?.feeling, !feeling.isEmpty { return "You’re feeling \(feeling)" }
        if state == .psalm, let number = snapshot?.psalmNumber { return "Psalm \(number)" }
        return state.title
    }
}

private struct MorningDoneView: View {
    let snapshot: MorningWidgetSnapshot; let large: Bool
    var body: some View {
        VStack(alignment: .leading, spacing: large ? 13 : 9) {
            BrandHeader(); HStack { Eyebrow(text: "TODAY’S FOCUS"); Spacer(); Image(systemName: "checkmark.circle.fill").foregroundColor(Palette.sage) }
            Text(snapshot.focus?.isEmpty == false ? snapshot.focus! : "Morning saved")
                .font(.system(size: large ? 22 : 20, weight: .bold, design: .serif)).foregroundColor(Palette.ink)
                .lineLimit(large ? 3 : 2).privacySensitive()
            if large {
                let priorities = (snapshot.priorities ?? []).filter { !$0.text.isEmpty }
                if !priorities.isEmpty { VStack(alignment: .leading, spacing: 6) { Eyebrow(text: "TOP PRIORITIES")
                    ForEach(priorities.prefix(3), id: \.text) { item in Label(item.text, systemImage: item.completed ? "checkmark.circle.fill" : "circle")
                        .font(.system(size: 13, weight: .medium)).foregroundColor(Palette.ink).lineLimit(1) } }.privacySensitive() }
            }
            Spacer(minLength: 0)
            HStack(spacing: 12) {
                if let feeling = snapshot.feeling, !feeling.isEmpty { Label(feeling, systemImage: MorningWidgetStore.sfSymbol(forIconName: snapshot.feelingIcon)).privacySensitive() }
                Label(snapshot.psalmNumber.map { "Psalm \($0)" } ?? "Psalm", systemImage: "book.closed"); Spacer(minLength: 0)
            }.font(.system(size: 12, weight: .medium)).foregroundColor(Palette.sage).lineLimit(1)
        }.widgetURL(MorningLink.closing)
    }
}

private struct SiFiaMorningWidgetEntryView: View {
    @Environment(\.widgetFamily) private var family
    let entry: MorningEntry
    var body: some View {
        let state = morningState(entry.snapshot, entry.date)
        Group {
            if family == .systemSmall { MorningSmallView(state: state, snapshot: entry.snapshot) }
            else if state == .done, let snapshot = entry.snapshot { MorningDoneView(snapshot: snapshot, large: family == .systemLarge) }
            else if family == .systemLarge { MorningLargeView(state: state, snapshot: entry.snapshot) }
            else if state == .checkIn { MorningCheckInView() }
            else { MorningStepView(state: state, snapshot: entry.snapshot) }
        }.padding(16).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading).widgetBackground(Palette.cream)
    }
}

// MARK: Evening

private enum EveningLink {
    static func url(_ step: String? = nil) -> URL { URL(string: "sifia://evening/today\(step.map { "/\($0)" } ?? "")")! }
    static var gratitude: URL { url("gratitude") }; static var win: URL { url("win") }
    static var proverbs: URL { url("proverbs") }; static var wisdom: URL { url("wisdom") }
    static var lookingForward: URL { url("looking-forward") }; static var closing: URL { url("closing") }
}

private enum EveningStepState {
    case gratitude, win, proverbs, wisdom, lookingForward, closing, done
    var eyebrow: String { switch self {
        case .gratitude: return "GRATITUDE"; case .win: return "TODAY’S WIN"; case .proverbs: return "PROVERBS"
        case .wisdom: return "CARRY WISDOM"; case .lookingForward: return "LOOKING FORWARD"
        case .closing: return "EVENING"; case .done: return "EVENING SAVED" } }
    var title: String { switch self {
        case .gratitude: return "What are you grateful for?"; case .win: return "What was today’s win?"
        case .proverbs: return "Read today’s Proverbs"; case .wisdom: return "What wisdom stands out?"
        case .lookingForward: return "What are you looking forward to?"; case .closing: return "Your evening is ready to save"
        case .done: return "Rest in what today held" } }
    var subtitle: String { switch self {
        case .gratitude: return "Notice the gifts held in today."; case .win: return "Celebrate progress, even when it felt quiet."
        case .proverbs: return "End the day grounded in wisdom."; case .wisdom: return "Keep the words you want to carry."
        case .lookingForward: return "Let tomorrow hold something hopeful."; case .closing: return "Review and gently close the day."
        case .done: return "Your reflection is saved." } }
    var icon: String { switch self {
        case .gratitude: return "heart"; case .win: return "trophy"; case .proverbs: return "book.closed"
        case .wisdom: return "sparkles"; case .lookingForward: return "sunrise"; case .closing: return "checkmark.circle"
        case .done: return "moon.stars" } }
    var destination: URL { switch self {
        case .gratitude: return EveningLink.gratitude; case .win: return EveningLink.win; case .proverbs: return EveningLink.proverbs
        case .wisdom: return EveningLink.wisdom; case .lookingForward: return EveningLink.lookingForward
        case .closing, .done: return EveningLink.closing } }
}

private let eveningSteps: [(id: String, label: String, state: EveningStepState)] = [
    ("gratitude", "Gratitude", .gratitude), ("win", "Today’s win", .win), ("proverbs", "Proverbs", .proverbs),
    ("wisdom", "Carry wisdom", .wisdom), ("looking_forward", "Looking forward", .lookingForward),
]
private func eveningState(_ snapshot: EveningWidgetSnapshot?, _ date: Date) -> EveningStepState {
    guard let snapshot, snapshot.date == MorningWidgetStore.localDateString(date) else { return .gratitude }
    if snapshot.routineCompleted { return .done }
    let done = Set(snapshot.completedSteps); return eveningSteps.first(where: { !done.contains($0.id) })?.state ?? .closing
}

private struct EveningEntry: TimelineEntry { let date: Date; let snapshot: EveningWidgetSnapshot? }
private struct EveningProvider: TimelineProvider {
    func placeholder(in context: Context) -> EveningEntry { EveningEntry(date: Date(), snapshot: nil) }
    func getSnapshot(in context: Context, completion: @escaping (EveningEntry) -> Void) {
        completion(EveningEntry(date: Date(), snapshot: MorningWidgetStore.loadEveningSnapshot()))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<EveningEntry>) -> Void) {
        let now = Date(); var entries = [EveningEntry(date: now, snapshot: MorningWidgetStore.loadEveningSnapshot())]
        if let midnight = Calendar.current.nextDate(after: now, matching: DateComponents(hour: 0), matchingPolicy: .nextTime) {
            entries.append(EveningEntry(date: midnight, snapshot: nil))
        }
        completion(Timeline(entries: entries, policy: .atEnd))
    }
}

private struct EveningSmallView: View {
    let state: EveningStepState; let snapshot: EveningWidgetSnapshot?
    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack { Image(systemName: state.icon).foregroundColor(state == .done ? Palette.moon : Palette.dusk); Spacer()
                if state == .done { Image(systemName: "checkmark.circle.fill").foregroundColor(Palette.dusk) } }
            Spacer(minLength: 0); Eyebrow(text: state.eyebrow, color: Palette.duskMuted)
            Text(displayTitle).font(.system(size: 17, weight: .bold, design: .serif)).foregroundColor(Palette.ink)
                .lineLimit(3).minimumScaleFactor(0.8).privacySensitive()
            if state != .done { Text("\(completedCount) of \(eveningSteps.count)").font(.system(size: 10, weight: .medium)).foregroundColor(Palette.gray) }
        }.widgetURL(state.destination)
    }
    private var displayTitle: String {
        if state == .done { if let text = snapshot?.lookingForward, !text.isEmpty { return text }; if let win = snapshot?.win, !win.isEmpty { return win } }
        if state == .proverbs, let number = snapshot?.proverbNumber { return "Proverbs \(number)" }; return state.title
    }
    private var completedCount: Int { let done = Set(snapshot?.completedSteps ?? []); return eveningSteps.filter { done.contains($0.id) }.count }
}

private struct EveningStepView: View {
    let state: EveningStepState; let snapshot: EveningWidgetSnapshot?
    private var completed: Set<String> { Set(snapshot?.completedSteps ?? []) }
    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            BrandHeader(evening: true); ProgressDots(completed: completed.count, total: eveningSteps.count, color: Palette.dusk)
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: state.icon).foregroundColor(Palette.dusk).frame(width: 34, height: 34)
                    .background(Palette.dusk.opacity(0.08)).clipShape(Circle())
                VStack(alignment: .leading, spacing: 3) { Eyebrow(text: state.eyebrow, color: Palette.duskMuted)
                    Text(title).font(.system(size: 19, weight: .bold, design: .serif)).foregroundColor(Palette.ink).lineLimit(2) }
            }
            Spacer(minLength: 0)
            HStack(alignment: .bottom) { Text(state.subtitle).font(.system(size: 11)).foregroundColor(Palette.gray).lineLimit(2)
                Spacer(minLength: 8); Link(destination: state.destination) { ActionLabel(title: state == .closing ? "Save" : "Continue", color: Palette.dusk) } }
        }
    }
    private var title: String { state == .proverbs && snapshot?.proverbNumber != nil ? "Proverbs \(snapshot!.proverbNumber!)" : state.title }
}

private struct EveningLargeView: View {
    let state: EveningStepState; let snapshot: EveningWidgetSnapshot?
    private var completed: Set<String> { Set(snapshot?.completedSteps ?? []) }
    var body: some View {
        VStack(alignment: .leading, spacing: 13) {
            BrandHeader(evening: true)
            HStack(alignment: .top) { VStack(alignment: .leading, spacing: 4) { Eyebrow(text: state.eyebrow, color: Palette.duskMuted)
                Text(title).font(.system(size: 22, weight: .bold, design: .serif)).foregroundColor(Palette.ink).lineLimit(2)
                Text(state.subtitle).font(.system(size: 12)).foregroundColor(Palette.gray) }
                Spacer(); Link(destination: state.destination) { ActionLabel(title: state == .closing ? "Save" : "Continue", color: Palette.dusk) } }
            ProgressDots(completed: completed.count, total: eveningSteps.count, color: Palette.dusk)
            HStack(alignment: .top, spacing: 18) {
                VStack(alignment: .leading, spacing: 9) { Eyebrow(text: "YOUR EVENING", color: Palette.duskMuted)
                    ForEach(eveningSteps, id: \.id) { step in StepRow(label: step.label, complete: completed.contains(step.id), active: step.state == state, color: Palette.dusk) } }
                    .frame(maxWidth: .infinity, alignment: .leading)
                VStack(alignment: .leading, spacing: 10) {
                    Eyebrow(text: snapshot?.win?.isEmpty == false ? "TODAY’S WIN" : "A GENTLE CLOSE", color: Palette.duskMuted)
                    Text(snapshot?.win?.isEmpty == false ? snapshot!.win! : "Notice what mattered, receive wisdom, and leave a little hope for tomorrow.")
                        .font(.system(size: 13, design: .serif)).foregroundColor(Palette.ink).lineLimit(5).lineSpacing(3).privacySensitive()
                    Spacer(minLength: 0)
                    if let number = snapshot?.proverbNumber { Label("Proverbs \(number)", systemImage: "book.closed")
                        .font(.system(size: 12, weight: .medium)).foregroundColor(Palette.dusk) }
                }.frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }
    private var title: String { state == .proverbs && snapshot?.proverbNumber != nil ? "Proverbs \(snapshot!.proverbNumber!)" : state.title }
}

private struct EveningDoneView: View {
    let snapshot: EveningWidgetSnapshot; let large: Bool
    var body: some View {
        VStack(alignment: .leading, spacing: large ? 12 : 8) {
            BrandHeader(evening: true); HStack { Eyebrow(text: "EVENING SAVED", color: Palette.duskMuted); Spacer()
                Image(systemName: "checkmark.circle.fill").foregroundColor(Palette.dusk) }
            if large {
                section("GRATEFUL FOR", "heart", snapshot.gratitude?.first); section("TODAY’S WIN", "trophy", snapshot.win)
                section("WISDOM TO CARRY", "sparkles", snapshot.wisdom?.first); section("LOOKING FORWARD", "sunrise", snapshot.lookingForward)
            } else {
                Text(snapshot.win?.isEmpty == false ? snapshot.win! : snapshot.gratitude?.first ?? "Your evening reflection is saved.")
                    .font(.system(size: 19, weight: .bold, design: .serif)).foregroundColor(Palette.ink).lineLimit(2).privacySensitive()
                Spacer(minLength: 0)
                Label(snapshot.lookingForward?.isEmpty == false ? snapshot.lookingForward! : "Rest well. Begin again tomorrow.", systemImage: "sunrise")
                    .font(.system(size: 12, weight: .medium)).foregroundColor(Palette.dusk).lineLimit(1).privacySensitive()
            }
        }.widgetURL(EveningLink.closing)
    }
    @ViewBuilder private func section(_ heading: String, _ icon: String, _ text: String?) -> some View {
        if let text, !text.isEmpty { VStack(alignment: .leading, spacing: 3) { HStack(spacing: 5) { Image(systemName: icon).font(.system(size: 10)); Eyebrow(text: heading, color: Palette.duskMuted) }
            Text(text).font(.system(size: 13, weight: .medium, design: .serif)).foregroundColor(Palette.ink).lineLimit(2).privacySensitive() } }
    }
}

private struct SiFiaEveningWidgetEntryView: View {
    @Environment(\.widgetFamily) private var family
    let entry: EveningEntry
    var body: some View {
        let state = eveningState(entry.snapshot, entry.date)
        Group {
            if family == .systemSmall { EveningSmallView(state: state, snapshot: entry.snapshot) }
            else if state == .done, let snapshot = entry.snapshot { EveningDoneView(snapshot: snapshot, large: family == .systemLarge) }
            else if family == .systemLarge { EveningLargeView(state: state, snapshot: entry.snapshot) }
            else { EveningStepView(state: state, snapshot: entry.snapshot) }
        }.padding(16).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading).widgetBackground(Palette.eveningWash)
    }
}

struct SiFiaMorningWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: MorningWidgetStore.widgetKind, provider: MorningProvider()) { SiFiaMorningWidgetEntryView(entry: $0) }
            .configurationDisplayName("Morning Flow")
            .description("Begin gently, continue your morning flow, and keep today’s focus close.")
            .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

struct SiFiaEveningWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: MorningWidgetStore.eveningWidgetKind, provider: EveningProvider()) { SiFiaEveningWidgetEntryView(entry: $0) }
            .configurationDisplayName("Evening Flow")
            .description("Reflect on today, continue your evening flow, and carry hope into tomorrow.")
            .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

@main struct SiFiaWidgetBundle: WidgetBundle {
    var body: some Widget { SiFiaMorningWidget(); SiFiaEveningWidget() }
}
