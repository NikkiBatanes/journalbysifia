import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import GoogleSignIn
import UserNotifications

@main
class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate {
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
    RCTSetLogFunction { level, source, fileName, lineNumber, message in
      let levelString: String
      switch level {
      case .fatal: levelString = "Fatal"
      case .error: levelString = "Error"
      case .warning: levelString = "Warning"
      case .info: levelString = "Info"
      case .trace: levelString = "Trace"
      @unknown default: levelString = "Unknown"
      }
      if let message = message {
        print("ReactNative: \(levelString) - \(message)")
      } else {
        print("ReactNative: \(levelString) - No message")
      }
    }
    #endif
    
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "siFia",
      in: window,
      launchOptions: launchOptions
    )

    // Register for push notifications
    UNUserNotificationCenter.current().delegate = self
    registerForPushNotifications(application)

    return true
  }

  // MARK: - Push Notification Registration
  func registerForPushNotifications(_ application: UIApplication) {
    UNUserNotificationCenter.current()
      .requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
        print("Push notification permission granted: \(granted)")
        
        guard granted else { 
          print("Push notification permission denied")
          return 
        }
        
        DispatchQueue.main.async {
          application.registerForRemoteNotifications()
        }
      }
  }

  // Called when APNs successfully registers the device
  func application(
    _ application: UIApplication,
    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
  ) {
    let tokenParts = deviceToken.map { data in String(format: "%02.2hhx", data) }
    let token = tokenParts.joined()
    print("✅ Device Token: \(token)")
    
    // Send token to React Native via bridge
    RCTPushNotificationBridge.shared?.didRegisterForRemoteNotifications(withDeviceToken: token)
    
    // Also post to NotificationCenter for legacy support
    NotificationCenter.default.post(
      name: NSNotification.Name("RemoteNotificationDeviceToken"),
      object: nil,
      userInfo: ["deviceToken": token]
    )
  }

  // Called when APNs fails to register the device
  func application(
    _ application: UIApplication,
    didFailToRegisterForRemoteNotificationsWithError error: Error
  ) {
    print("❌ Failed to register for remote notifications: \(error.localizedDescription)")
    
    // Send error to React Native via bridge
    RCTPushNotificationBridge.shared?.didFailToRegisterForRemoteNotifications(withError: error.localizedDescription)
  }

  // MARK: - UNUserNotificationCenterDelegate
  
  // Handle notification when app is in foreground
  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    print("📬 Received notification in foreground: \(notification.request.content.title)")
    
    // Send to React Native
    var userInfo = notification.request.content.userInfo
    userInfo["userInteraction"] = false
    userInfo["foreground"] = true
    RCTPushNotificationBridge.shared?.didReceiveRemoteNotification(userInfo)
    
    // Show notification even when app is in foreground
    if #available(iOS 14.0, *) {
      completionHandler([.banner, .sound, .badge])
    } else {
      completionHandler([.alert, .sound, .badge])
    }
  }

  // Handle notification tap
  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    let userInfo = response.notification.request.content.userInfo
    print("📱 User tapped notification: \(userInfo)")
    
    // Send to React Native via bridge
    var tappedUserInfo = userInfo
    tappedUserInfo["userInteraction"] = true
    tappedUserInfo["foreground"] = false
    RCTPushNotificationBridge.shared?.didReceiveRemoteNotification(tappedUserInfo)
    
    // Also send via NotificationCenter for legacy support
    NotificationCenter.default.post(
      name: NSNotification.Name("RemoteNotificationTapped"),
      object: nil,
      userInfo: userInfo
    )
    
    completionHandler()
  }

  // Handle Google Sign-In redirect URLs
  func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey : Any] = [:]
  ) -> Bool {
    // Let Google Sign-In handle the URL first
    if GIDSignIn.sharedInstance.handle(url) {
      return true
    }
    // Add other URL handlers here if needed
    return false
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    #if DEBUG
    // For development, use the packager server
    guard let url = RCTBundleURLProvider.sharedSettings()
      .jsBundleURL(forBundleRoot: "index", fallbackExtension: nil) else {
      fatalError("Could not find JS bundle. Is Metro running?")
    }
    print("Using bundle URL: \(url.absoluteString)")
    return url
    #else
    // For production, use the local bundle
    let url = Bundle.main.url(forResource: "main", withExtension: "jsbundle")
    print("Using local bundle URL: \(url?.absoluteString ?? "nil")")
    return url
    #endif
  }

  @objc
  override func bundleURL() -> URL? {
    #if DEBUG
    let url = RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
    print("Bundle URL: \(url?.absoluteString ?? "nil")")
    return url
    #else
    let url = Bundle.main.url(forResource: "main", withExtension: "jsbundle")
    print("Bundle URL: \(url?.absoluteString ?? "nil")")
    return url
    #endif
  }
}
