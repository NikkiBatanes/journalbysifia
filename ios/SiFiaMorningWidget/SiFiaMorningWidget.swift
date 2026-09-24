import SwiftUI
import UIKit
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
        Text(text).font(.system(size: 11, weight: .semibold)).tracking(1.3)
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

private func focusSymbol(for snapshot: MorningWidgetSnapshot?) -> String {
    let key = (snapshot?.focusIcon?.isEmpty == false ? snapshot?.focusIcon : snapshot?.focusCategory)?
        .lowercased() ?? ""
    switch key {
    case "hands-pray", "prayer": return "hands.sparkles.fill"
    case "script-text", "bible-reading", "reader", "reading", "book-open-page-variant", "study": return "book.closed.fill"
    case "church": return "building.columns.fill"
    case "weather-night", "sabbath": return "moon.stars.fill"
    case "people-circle-outline", "discipleship": return "person.2.fill"
    case "home-heart", "family", "home": return "house.fill"
    case "cash", "finances": return "banknote.fill"
    case "spa", "self-care": return "leaf.fill"
    case "briefcase", "work": return "briefcase.fill"
    case "school": return "graduationcap.fill"
    case "dumbbell", "workout": return "figure.walk"
    case "bed", "rest": return "bed.double.fill"
    case "heart-pulse", "health", "heart", "relationships": return "heart.fill"
    case "hand-heart", "volunteer": return "hand.raised.fill"
    case "water", "prayer-fasting": return "drop.fill"
    case "utensils", "nutrition": return "fork.knife"
    case "building", "business": return "building.2.fill"
    case "baby", "motherhood": return "person.2.fill"
    case "palette", "creative": return "paintpalette.fill"
    case "music", "worship": return "music.note"
    case "cross", "ministry": return "cross.fill"
    case "airplane", "travel": return "airplane"
    case "calendar", "events": return "calendar"
    case "paw", "pet-care": return "pawprint.fill"
    case "help-circle", "decision": return "questionmark.circle.fill"
    case "check-circle", "follow-through": return "checkmark.circle.fill"
    case "cart", "groceries": return "cart.fill"
    case "store", "errands": return "bag.fill"
    case "plus-circle", "other": return "plus.circle.fill"
    default: return "scope"
    }
}

private struct WidgetBrandLogo: View {
    let size: CGFloat

    private static let image: UIImage? = {
        guard let url = Bundle.main.url(forResource: "journalbysifiaheartv2sage", withExtension: "png") else {
            return nil
        }
        return UIImage(contentsOfFile: url.path)
    }()

    var body: some View {
        logoImage
        .scaledToFit()
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }

    @ViewBuilder private var logoImage: some View {
        if let image = Self.image {
            if #available(iOSApplicationExtension 18.0, *) {
                Image(uiImage: image)
                    .renderingMode(.original)
                    .resizable()
                    .widgetAccentedRenderingMode(.fullColor)
                    .widgetAccentable(false)
            } else if #available(iOSApplicationExtension 16.0, *) {
                Image(uiImage: image)
                    .renderingMode(.original)
                    .resizable()
                    .widgetAccentable(false)
            } else {
                Image(uiImage: image)
                    .renderingMode(.original)
                    .resizable()
            }
        } else {
            Image(systemName: "pencil.and.scribble")
                .resizable()
                .scaledToFit()
                .foregroundColor(Palette.sage)
        }
    }
}

private struct SmallEditorialCard: View {
    let symbol: String
    let eyebrow: String
    let title: String
    let action: String
    let actionColor: Color
    let destination: URL

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 6) {
                WidgetBrandLogo(size: 26)
                Spacer(minLength: 4)
                Image(systemName: symbol)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundColor(actionColor)
                    .frame(width: 24, height: 24)
                    .background(actionColor.opacity(0.09))
                    .clipShape(Circle())
            }
            Spacer(minLength: 6)
            Text(eyebrow)
                .font(.system(size: 9, weight: .bold))
                .tracking(1.1)
                .foregroundColor(Palette.sageMuted)
                .lineLimit(1)
                .minimumScaleFactor(0.85)
                .padding(.bottom, 3)
            Text(title)
                .font(.system(size: 19, weight: .semibold, design: .serif))
                .foregroundColor(Palette.ink)
                .lineLimit(2)
                .minimumScaleFactor(0.76)
                .privacySensitive()
            Spacer(minLength: 5)
            HStack {
                Spacer(minLength: 0)
                Link(destination: destination) {
                    HStack(spacing: 6) {
                        Text(action)
                            .font(.system(size: 10, weight: .semibold))
                            .lineLimit(1)
                        Image(systemName: "arrow.right")
                            .font(.system(size: 9, weight: .bold))
                    }
                    .foregroundColor(Palette.card)
                    .padding(.horizontal, 12)
                    .frame(height: 31)
                    .background(actionColor)
                    .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }
        }
        .widgetURL(destination)
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

// MARK: Evening

private enum EveningLink {
    static func url(_ step: String? = nil) -> URL { URL(string: "sifia://evening/today\(step.map { "/\($0)" } ?? "")")! }
    static var gratitude: URL { url("gratitude") }; static var win: URL { url("win") }
    static var proverbs: URL { url("proverbs") }; static var wisdom: URL { url("wisdom") }
    static var lookingForward: URL { url("looking-forward") }; static var closing: URL { url("closing") }
}

private enum PrayerLink {
    static func url(_ prayerId: String) -> URL {
        URL(string: "sifia://prayer/\(prayerId)")!
    }
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

private struct PrayerStepView: View {
    let prayerId: String
    let large: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: large ? 13 : 9) {
            BrandHeader()
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Eyebrow(text: "PRAY AGAIN")
                    Text("A prayer worth returning to.")
                        .font(.system(size: large ? 22 : 19, weight: .bold, design: .serif))
                        .foregroundColor(Palette.ink)
                        .lineLimit(2)
                    Text("Visit it again and bring it back to God today.")
                        .font(.system(size: 12))
                        .foregroundColor(Palette.gray)
                        .lineLimit(2)
                }
                Spacer(minLength: 8)
                Link(destination: PrayerLink.url(prayerId)) {
                    ActionLabel(title: "Visit Prayer")
                }
            }
            if large {
                Spacer(minLength: 0)
                Text("Return without pressure. Let the prayer meet you where today finds you.")
                    .font(.system(size: 14, design: .serif))
                    .foregroundColor(Palette.ink)
                    .lineSpacing(3)
            }
        }
        .widgetURL(PrayerLink.url(prayerId))
    }
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

// MARK: Daily Flow

private let prayerStartHour = 14
private let eveningStartHour = 18

private struct DailyFlowEntry: TimelineEntry {
    let date: Date
    let morning: MorningWidgetSnapshot?
    let evening: EveningWidgetSnapshot?
}

private enum DailyFlowMode {
    case morning(MorningStepState)
    case daytime
    case prayer(String)
    case evening(EveningStepState)
}

private func validMorningSnapshot(_ snapshot: MorningWidgetSnapshot?, on date: Date) -> MorningWidgetSnapshot? {
    guard snapshot?.date == MorningWidgetStore.localDateString(date) else { return nil }
    return snapshot
}

private func validEveningSnapshot(_ snapshot: EveningWidgetSnapshot?, on date: Date) -> EveningWidgetSnapshot? {
    guard snapshot?.date == MorningWidgetStore.localDateString(date) else { return nil }
    return snapshot
}

private func dailyFlowMode(for entry: DailyFlowEntry) -> DailyFlowMode {
    let calendar = Calendar.current
    let morning = validMorningSnapshot(entry.morning, on: entry.date)
    let evening = validEveningSnapshot(entry.evening, on: entry.date)
    let eveningWasStarted = evening.map {
        $0.routineStarted || $0.routineCompleted || !$0.completedSteps.isEmpty
    } ?? false

    if calendar.component(.hour, from: entry.date) >= eveningStartHour || eveningWasStarted {
        return .evening(eveningState(evening, entry.date))
    }

    let state = morningState(morning, entry.date)
    guard state == .done else { return .morning(state) }

    if calendar.component(.hour, from: entry.date) >= prayerStartHour,
       let prayerId = morning?.prayerId,
       !prayerId.isEmpty {
        return .prayer(prayerId)
    }
    return .daytime
}

private struct DailyFlowProvider: TimelineProvider {
    func placeholder(in context: Context) -> DailyFlowEntry {
        DailyFlowEntry(date: Date(), morning: nil, evening: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (DailyFlowEntry) -> Void) {
        completion(currentEntry(at: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<DailyFlowEntry>) -> Void) {
        let now = Date()
        let calendar = Calendar.current
        let morning = MorningWidgetStore.loadSnapshot()
        let evening = MorningWidgetStore.loadEveningSnapshot()
        var entries = [DailyFlowEntry(date: now, morning: morning, evening: evening)]

        if let prayerBoundary = calendar.date(
            bySettingHour: prayerStartHour,
            minute: 0,
            second: 0,
            of: now
        ), prayerBoundary > now {
            entries.append(DailyFlowEntry(date: prayerBoundary, morning: morning, evening: evening))
        }

        if let eveningBoundary = calendar.date(
            bySettingHour: eveningStartHour,
            minute: 0,
            second: 0,
            of: now
        ), eveningBoundary > now {
            entries.append(DailyFlowEntry(date: eveningBoundary, morning: morning, evening: evening))
        }

        if let midnight = calendar.nextDate(
            after: now,
            matching: DateComponents(hour: 0, minute: 0, second: 0),
            matchingPolicy: .nextTime
        ) {
            entries.append(DailyFlowEntry(date: midnight, morning: nil, evening: nil))
        }

        completion(Timeline(entries: entries, policy: .atEnd))
    }

    private func currentEntry(at date: Date) -> DailyFlowEntry {
        DailyFlowEntry(
            date: date,
            morning: MorningWidgetStore.loadSnapshot(),
            evening: MorningWidgetStore.loadEveningSnapshot()
        )
    }
}

private struct DailyFlowSmallView: View {
    let mode: DailyFlowMode
    let morning: MorningWidgetSnapshot?
    let evening: EveningWidgetSnapshot?

    var body: some View {
        switch mode {
        case .morning(let state):
            SmallEditorialCard(
                symbol: "sun.max.fill",
                eyebrow: morningEyebrow(state),
                title: morningTitle(state),
                action: morningAction(state),
                actionColor: Palette.sage,
                destination: state.destination
            )

        case .daytime:
            SmallEditorialCard(
                symbol: focusSymbol(for: morning),
                eyebrow: "UP NEXT · FOCUS",
                title: morning?.focus?.isEmpty == false ? morning!.focus! : "Carry this into today.",
                action: "Open",
                actionColor: Palette.sage,
                destination: MorningLink.focus
            )

        case .prayer(let prayerId):
            SmallEditorialCard(
                symbol: "heart.fill",
                eyebrow: "UP NEXT · PRAYER",
                title: "Pray again.",
                action: "Revisit",
                actionColor: Palette.sage,
                destination: PrayerLink.url(prayerId)
            )

        case .evening(let state):
            SmallEditorialCard(
                symbol: "moon.stars.fill",
                eyebrow: eveningEyebrow(state),
                title: eveningTitle(state),
                action: eveningAction(state),
                actionColor: Palette.dusk,
                destination: state.destination
            )
        }
    }

    private func morningEyebrow(_ state: MorningStepState) -> String {
        if state == .checkIn && morning?.routineStarted != true { return "MORNING" }
        return "UP NEXT"
    }

    private func morningTitle(_ state: MorningStepState) -> String {
        if state == .checkIn && morning?.routineStarted != true { return "Begin with God." }
        switch state {
        case .checkIn: return "How do you feel?"
        case .underneath: return "What’s beneath it?"
        case .psalm: return morning?.psalmNumber.map { "Read Psalm \($0)." } ?? "Read today’s Psalm."
        case .carry: return "Notice God here."
        case .focus: return "Choose your focus."
        case .todos: return "Plan what matters."
        case .closing: return "Ready to begin."
        case .done: return "Carry this today."
        }
    }

    private func morningAction(_ state: MorningStepState) -> String {
        if state == .checkIn && morning?.routineStarted != true { return "Start" }
        if state == .closing { return "Save" }
        return "Continue"
    }

    private func eveningEyebrow(_ state: EveningStepState) -> String {
        if state == .gratitude && evening?.routineStarted != true { return "UP NEXT · EVENING" }
        return "UP NEXT"
    }

    private func eveningTitle(_ state: EveningStepState) -> String {
        if state == .gratitude && evening?.routineStarted != true { return "End with God." }
        switch state {
        case .gratitude: return "Name one gift."
        case .win: return "What went well?"
        case .proverbs: return evening?.proverbNumber.map { "Read Proverbs \($0)." } ?? "Read today’s Proverbs."
        case .wisdom: return "Carry one truth."
        case .lookingForward: return "Hope for tomorrow?"
        case .closing: return "Ready to rest."
        case .done: return "Rest well."
        }
    }

    private func eveningAction(_ state: EveningStepState) -> String {
        if state == .gratitude && evening?.routineStarted != true { return "Reflect" }
        if state == .closing { return "Save" }
        if state == .done { return "View" }
        return "Continue"
    }
}

private struct ExpandedPresentation {
    let symbol: String
    let eyebrow: String
    let title: String
    let summary: String
    let action: String
    let color: Color
    let destination: URL
}

private func expandedPresentation(
    for mode: DailyFlowMode,
    morning: MorningWidgetSnapshot?,
    evening: EveningWidgetSnapshot?
) -> ExpandedPresentation {
    switch mode {
    case .morning(let state):
        let hasStarted = morning?.routineStarted == true
        let title: String
        if !hasStarted && state == .checkIn {
            title = "Begin with God."
        } else if state == .underneath, let feeling = morning?.feeling, !feeling.isEmpty {
            title = "\(feeling). What’s underneath?"
        } else if state == .psalm, let number = morning?.psalmNumber {
            title = "Sit with Psalm \(number)."
        } else {
            title = state.title
        }
        return ExpandedPresentation(
            symbol: "sun.max.fill",
            eyebrow: hasStarted ? "UP NEXT" : "TODAY WITH GOD",
            title: title,
            summary: hasStarted ? state.subtitle : "Take a quiet moment to notice what you’re carrying and set your heart for the day.",
            action: !hasStarted ? "Begin Morning" : (state == .closing ? "Save Morning" : "Continue"),
            color: Palette.sage,
            destination: state.destination
        )

    case .daytime:
        return ExpandedPresentation(
            symbol: focusSymbol(for: morning),
            eyebrow: "UP NEXT · TODAY’S FOCUS",
            title: morning?.focus?.isEmpty == false ? morning!.focus! : "Carry this into today.",
            summary: "Return to the focus you chose this morning and carry it into the rest of your day.",
            action: "View Focus",
            color: Palette.sage,
            destination: MorningLink.focus
        )

    case .prayer(let prayerId):
        return ExpandedPresentation(
            symbol: "heart.fill",
            eyebrow: "UP NEXT · PRAY AGAIN",
            title: "A prayer worth returning to.",
            summary: "A prayer you wrote before is ready to revisit today.",
            action: "Visit Prayer",
            color: Palette.sage,
            destination: PrayerLink.url(prayerId)
        )

    case .evening(let state):
        if state == .done, morning?.routineCompleted == true {
            return ExpandedPresentation(
                symbol: "checkmark",
                eyebrow: "TODAY WITH GOD",
                title: "You showed up today.",
                summary: "Morning and evening are complete. Your journal is here whenever you want to return to what God showed you today.",
                action: "Open Today",
                color: Palette.sage,
                destination: URL(string: "sifia://dashboard")!
            )
        }
        if state == .done {
            return ExpandedPresentation(
                symbol: "moon.stars.fill",
                eyebrow: "EVENING SAVED",
                title: "Rest well.",
                summary: "Your evening reflection is saved. Return whenever you want to revisit what today held.",
                action: "View Evening",
                color: Palette.dusk,
                destination: state.destination
            )
        }
        let hasStarted = evening?.routineStarted == true
        let title: String
        if !hasStarted && state == .gratitude {
            title = "End with God."
        } else if state == .proverbs, let number = evening?.proverbNumber {
            title = "Read Proverbs \(number)."
        } else {
            title = state.title
        }
        return ExpandedPresentation(
            symbol: "moon.stars.fill",
            eyebrow: hasStarted ? "UP NEXT" : "UP NEXT · EVENING",
            title: title,
            summary: hasStarted ? state.subtitle : "Reflect on what mattered, what you’re grateful for, and what you can leave with Him.",
            action: !hasStarted ? "Begin Reflection" : (state == .closing ? "Save Evening" : "Continue"),
            color: Palette.dusk,
            destination: state.destination
        )
    }
}

private enum JourneyStageStatus {
    case complete, active, upcoming
}

private struct JourneyStageRow: View {
    let number: Int
    let label: String
    let status: JourneyStageStatus
    let large: Bool

    var body: some View {
        HStack(spacing: large ? 10 : 6) {
            ZStack {
                Circle()
                    .fill(status == .complete ? Palette.sage.opacity(0.11) : Color.clear)
                Circle()
                    .stroke(status == .active ? Palette.sage : Palette.border, lineWidth: status == .active ? 1.5 : 1)
                if status == .complete {
                    Image(systemName: "checkmark")
                        .font(.system(size: large ? 11 : 8, weight: .bold))
                } else {
                    Text("\(number)")
                        .font(.system(size: large ? 11 : 8, weight: .semibold))
                }
            }
            .foregroundColor(status == .upcoming ? Palette.gray.opacity(0.7) : Palette.sage)
            .frame(width: large ? 25 : 18, height: large ? 25 : 18)

            Text(label)
                .font(.system(size: large ? 13 : 10, weight: status == .active ? .semibold : .medium))
                .foregroundColor(status == .upcoming ? Palette.ink.opacity(0.78) : Palette.ink)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            Spacer(minLength: 0)
            if status == .active {
                Text("UP NEXT")
                    .font(.system(size: large ? 8 : 6, weight: .bold))
                    .tracking(0.5)
                    .foregroundColor(Palette.sage)
                    .padding(.horizontal, large ? 6 : 4)
                    .frame(height: large ? 18 : 13)
                    .background(Palette.sage.opacity(0.09))
                    .clipShape(Capsule())
            }
        }
    }
}

private struct WeeklyDots: View {
    let days: [Bool]
    let large: Bool

    var body: some View {
        HStack(spacing: large ? 6 : 4) {
            ForEach(0..<7, id: \.self) { index in
                Circle()
                    .fill(index < days.count && days[index] ? Palette.sageMuted : Palette.border)
                    .frame(width: large ? 9 : 6, height: large ? 9 : 6)
            }
        }
        .accessibilityLabel("\(days.filter { $0 }.count) active days this week")
    }
}

private struct TodayJourneyPanel: View {
    let mode: DailyFlowMode
    let morning: MorningWidgetSnapshot?
    let evening: EveningWidgetSnapshot?
    let weeklyDays: [Bool]
    let weeklyCount: Int
    let large: Bool

    private let labels = ["Morning", "Today’s Focus", "Pray Again", "Evening"]

    var body: some View {
        VStack(alignment: .leading, spacing: large ? 8 : 3) {
            Text("TODAY")
                .font(.system(size: large ? 11 : 9, weight: .semibold))
                .foregroundColor(Palette.gray)
            ForEach(Array(labels.enumerated()), id: \.offset) { index, label in
                JourneyStageRow(
                    number: index + 1,
                    label: label,
                    status: status(for: index + 1),
                    large: large
                )
            }
            Divider().overlay(Palette.border)
            HStack(spacing: 6) {
                Text("THIS WEEK")
                    .font(.system(size: large ? 10 : 8, weight: .medium))
                    .foregroundColor(Palette.gray)
                WeeklyDots(days: weeklyDays, large: large)
                Spacer(minLength: 2)
                Text("\(weeklyCount) \(weeklyCount == 1 ? "day" : "days")")
                    .font(.system(size: large ? 10 : 8, weight: .medium))
                    .foregroundColor(Palette.gray)
            }
        }
    }

    private func status(for stage: Int) -> JourneyStageStatus {
        switch stage {
        case 1:
            if morning?.routineCompleted == true { return .complete }
            if case .morning = mode { return .active }
        case 2:
            if case .daytime = mode { return .active }
            if morning?.routineCompleted == true {
                if case .prayer = mode { return .complete }
                if case .evening = mode { return .complete }
            }
        case 3:
            if case .prayer = mode { return .active }
            if case .evening = mode { return .complete }
        case 4:
            if evening?.routineCompleted == true { return .complete }
            if case .evening = mode { return .active }
        default:
            break
        }
        return .upcoming
    }
}

private struct WeeklySummaryPanel: View {
    let days: [Bool]
    let count: Int
    let large: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: large ? 10 : 5) {
            Text("THIS WEEK")
                .font(.system(size: large ? 11 : 9, weight: .medium))
                .foregroundColor(Palette.gray)
            Text("\(count) \(count == 1 ? "day" : "days")")
                .font(.system(size: large ? 30 : 23, weight: .medium, design: .serif))
                .foregroundColor(Palette.ink)
            if large {
                Text("You’ve made space with God this week.")
                    .font(.system(size: 12))
                    .foregroundColor(Palette.gray)
                    .lineLimit(2)
            }
            Spacer(minLength: 0)
            WeeklyDots(days: days, large: large)
        }
        .padding(large ? 16 : 11)
        .background(Palette.card.opacity(0.74))
        .clipShape(RoundedRectangle(cornerRadius: large ? 20 : 15, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: large ? 20 : 15, style: .continuous)
                .stroke(Palette.border, lineWidth: 0.7)
        )
    }
}

private struct DailyFlowExpandedView: View {
    let mode: DailyFlowMode
    let morning: MorningWidgetSnapshot?
    let evening: EveningWidgetSnapshot?
    let large: Bool

    private var presentation: ExpandedPresentation {
        expandedPresentation(for: mode, morning: morning, evening: evening)
    }

    private var weeklyDays: [Bool] {
        let days = morning?.weeklyActiveDays ?? []
        return days.count == 7 ? days : Array(repeating: false, count: 7)
    }

    private var weeklyCount: Int {
        morning?.weeklyActiveCount ?? weeklyDays.filter { $0 }.count
    }

    private var everythingDone: Bool {
        morning?.routineCompleted == true && evening?.routineCompleted == true
    }

    var body: some View {
        VStack(alignment: .leading, spacing: large ? 18 : 8) {
            HStack(spacing: large ? 9 : 6) {
                WidgetBrandLogo(size: large ? 34 : 28)
                Spacer(minLength: 4)
                Image(systemName: presentation.symbol)
                    .font(.system(size: large ? 12 : 10, weight: .semibold))
                    .foregroundColor(presentation.color)
                    .frame(width: large ? 30 : 24, height: large ? 30 : 24)
                    .background(presentation.color.opacity(0.09))
                    .clipShape(Circle())
            }

            HStack(alignment: .top, spacing: large ? 20 : 12) {
                VStack(alignment: .leading, spacing: large ? 8 : 4) {
                    Text(presentation.eyebrow)
                        .font(.system(size: large ? 12 : 9, weight: .bold))
                        .tracking(large ? 1.5 : 1.1)
                        .foregroundColor(Palette.sageMuted)
                        .lineLimit(1)
                    Text(presentation.title)
                        .font(.system(size: large ? 33 : 23, weight: .semibold, design: .serif))
                        .foregroundColor(Palette.ink)
                        .lineLimit(large ? 3 : 2)
                        .minimumScaleFactor(0.72)
                        .privacySensitive()
                    if large {
                        Text(presentation.summary)
                            .font(.system(size: 13))
                            .foregroundColor(Palette.gray)
                            .lineLimit(3)
                            .lineSpacing(2)
                    }
                    Spacer(minLength: large ? 8 : 2)
                    Link(destination: presentation.destination) {
                        HStack(spacing: 8) {
                            Text(presentation.action)
                                .font(.system(size: large ? 13 : 10, weight: .semibold))
                                .lineLimit(1)
                                .minimumScaleFactor(0.8)
                            Spacer(minLength: 4)
                            Image(systemName: "arrow.right")
                                .font(.system(size: large ? 11 : 9, weight: .bold))
                        }
                        .foregroundColor(Palette.card)
                        .padding(.horizontal, large ? 15 : 11)
                        .frame(maxWidth: large ? 190 : 140, minHeight: large ? 42 : 31)
                        .background(presentation.color)
                        .clipShape(RoundedRectangle(cornerRadius: large ? 14 : 11, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)

                Rectangle()
                    .fill(Palette.border)
                    .frame(width: 1)

                Group {
                    if everythingDone {
                        WeeklySummaryPanel(days: weeklyDays, count: weeklyCount, large: large)
                    } else {
                        TodayJourneyPanel(
                            mode: mode,
                            morning: morning,
                            evening: evening,
                            weeklyDays: weeklyDays,
                            weeklyCount: weeklyCount,
                            large: large
                        )
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            }
        }
        .widgetURL(presentation.destination)
    }
}

private struct DailyFlowEntryView: View {
    @Environment(\.widgetFamily) private var family
    let entry: DailyFlowEntry

    var body: some View {
        let mode = dailyFlowMode(for: entry)
        Group {
            if family == .systemSmall {
                DailyFlowSmallView(
                    mode: mode,
                    morning: validMorningSnapshot(entry.morning, on: entry.date),
                    evening: validEveningSnapshot(entry.evening, on: entry.date)
                )
            } else {
                DailyFlowExpandedView(
                    mode: mode,
                    morning: validMorningSnapshot(entry.morning, on: entry.date),
                    evening: validEveningSnapshot(entry.evening, on: entry.date),
                    large: family == .systemLarge
                )
            }
        }
        .padding(family == .systemSmall ? 12 : (family == .systemLarge ? 20 : 12))
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .widgetBackground(backgroundColor(for: mode))
    }

    private func backgroundColor(for mode: DailyFlowMode) -> Color {
        if case .evening = mode { return Palette.eveningWash }
        return Palette.cream
    }
}

struct SiFiaMorningWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: MorningWidgetStore.widgetKind, provider: DailyFlowProvider()) { DailyFlowEntryView(entry: $0) }
            .configurationDisplayName("Daily Flow")
            .description("Move naturally from your morning check-in to today’s focus, prayer, and evening reflection.")
            .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
            .contentMarginsDisabled()
    }
}

@main struct SiFiaWidgetBundle: WidgetBundle {
    var body: some Widget { SiFiaMorningWidget() }
}
