import UIKit

@objc(InterfaceEnvironmentBridge)
class InterfaceEnvironmentBridge: NSObject {
  @objc
  static func requiresMainQueueSetup() -> Bool {
    true
  }

  private func sizeClassName(_ sizeClass: UIUserInterfaceSizeClass) -> String {
    switch sizeClass {
    case .compact:
      return "compact"
    case .regular:
      return "regular"
    default:
      return "unspecified"
    }
  }

  @objc(currentSizeClasses:rejecter:)
  func currentSizeClasses(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      let window = UIApplication.shared.connectedScenes
        .compactMap { $0 as? UIWindowScene }
        .filter { $0.activationState == .foregroundActive }
        .flatMap(\.windows)
        .first(where: \.isKeyWindow)

      guard let traits = window?.traitCollection else {
        resolve([
          "horizontal": "unspecified",
          "vertical": "unspecified",
        ])
        return
      }

      resolve([
        "horizontal": self.sizeClassName(traits.horizontalSizeClass),
        "vertical": self.sizeClassName(traits.verticalSizeClass),
      ])
    }
  }
}
