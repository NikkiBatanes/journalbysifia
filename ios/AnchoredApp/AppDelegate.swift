import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // Enable console logging in debug builds
    #if DEBUG
    RCTSetLogThreshold(.info)
    RCTSetLogFunction { level, source, lineNumber, message in
      let levelString: String
      switch level {
      case .fatal: levelString = "Fatal"
      case .error: levelString = "Error"
      case .warning: levelString = "Warning"
      case .info: levelString = "Info"
      case .trace: levelString = "Trace"
      @unknown default: levelString = "Unknown"
      }
      print("ReactNative: \(levelString) - \(message() ?? "")")
    }
    #endif
    
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "AnchoredApp",
      in: window,
      launchOptions: launchOptions
    )

    return true
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    #if DEBUG
    // For development, use the packager server
    let url = RCTBundleURLProvider.sharedSettings()
      .jsBundleURL(forBundleRoot: "index", fallbackExtension: nil)
    print("Using bundle URL: \(url?.absoluteString ?? "nil")")
    return url
    #else
    // For production, use the local bundle
    let url = Bundle.main.url(forResource: "main", withExtension: "jsbundle")
    print("Using local bundle URL: \(url?.absoluteString ?? "nil")")
    return url
    #endif
  }

  override func bundleURL() -> URL? {
    return sourceURL(for: nil)
  }
}
