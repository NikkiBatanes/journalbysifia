import Foundation
import React
import UserNotifications
import UIKit

@objc(RCTPushNotificationBridge)
class RCTPushNotificationBridge: RCTEventEmitter {
  
  public static var shared: RCTPushNotificationBridge?
  
  override init() {
    super.init()
    RCTPushNotificationBridge.shared = self
  }
  
  override static func requiresMainQueueSetup() -> Bool {
    return true
  }
  
  override func supportedEvents() -> [String]! {
    return [
      "RemoteNotificationRegistered",
      "RemoteNotificationRegistrationFailed",
      "RemoteNotificationReceived",
      "LocalNotificationReceived"
    ]
  }
  
  // Called from AppDelegate when device token is received
  @objc public func didRegisterForRemoteNotifications(withDeviceToken deviceToken: String) {
    sendEvent(withName: "RemoteNotificationRegistered", body: ["deviceToken": deviceToken])
  }
  
  // Called from AppDelegate when registration fails
  @objc public func didFailToRegisterForRemoteNotifications(withError error: String) {
    sendEvent(withName: "RemoteNotificationRegistrationFailed", body: ["error": error])
  }
  
  // Called from AppDelegate when notification is received
  @objc public func didReceiveRemoteNotification(_ notification: [AnyHashable: Any]) {
    sendEvent(withName: "RemoteNotificationReceived", body: notification)
  }
  
  // Called from AppDelegate when local notification is received
  @objc public func didReceiveLocalNotification(_ notification: [AnyHashable: Any]) {
    sendEvent(withName: "LocalNotificationReceived", body: notification)
  }
  
  // Request permissions from JavaScript
  @objc public func requestPermissions(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
      if let error = error {
        reject("PERMISSION_ERROR", error.localizedDescription, error)
      } else {
        if granted {
          DispatchQueue.main.async {
            UIApplication.shared.registerForRemoteNotifications()
          }
        }
        resolve(granted)
      }
    }
  }

  // Force re-registration for remote notifications (to re-emit token event)
  @objc public func registerForRemoteNotifications(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      UIApplication.shared.registerForRemoteNotifications()
      resolve(true)
    }
  }

  // Check current permissions from JavaScript
  @objc func checkPermissions(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    UNUserNotificationCenter.current().getNotificationSettings { settings in
      let permissions: [String: Any] = [
        "alert": settings.alertSetting == .enabled,
        "badge": settings.badgeSetting == .enabled,
        "sound": settings.soundSetting == .enabled,
        "authorizationStatus": settings.authorizationStatus.rawValue
      ]
      resolve(permissions)
    }
  }
  
  // Set badge number from JavaScript
  @objc func setBadgeNumber(_ number: NSNumber) {
    DispatchQueue.main.async {
      UIApplication.shared.applicationIconBadgeNumber = number.intValue
    }
  }
  
  // Get badge number from JavaScript
  @objc func getBadgeNumber(_ resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    let badgeNumber = UIApplication.shared.applicationIconBadgeNumber
    resolve(badgeNumber)
  }
  
  // Cancel all local notifications
  @objc func cancelAllLocalNotifications() {
    UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
  }
  
  // Cancel all delivered notifications
  @objc func removeAllDeliveredNotifications() {
    UNUserNotificationCenter.current().removeAllDeliveredNotifications()
  }
  
  // Schedule a local notification
  @objc func scheduleLocalNotification(_ notification: [String: Any], resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let title = notification["title"] as? String,
          let body = notification["body"] as? String else {
      reject("INVALID_NOTIFICATION", "Title and body are required", nil)
      return
    }
    
    let content = UNMutableNotificationContent()
    content.title = title
    content.body = body
    
    if let badge = notification["badge"] as? NSNumber {
      content.badge = badge
    }
    
    if let sound = notification["sound"] as? String {
      content.sound = sound == "default" ? .default : UNNotificationSound(named: UNNotificationSoundName(rawValue: sound))
    }
    
    if let userInfo = notification["userInfo"] as? [String: Any] {
      content.userInfo = userInfo
    }
    
    // Schedule trigger
    var trigger: UNNotificationTrigger?
    if let fireDate = notification["fireDate"] as? Double {
      let date = Date(timeIntervalSince1970: fireDate / 1000.0)
      let components = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute, .second], from: date)
      trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
    } else {
      // Fire immediately
      trigger = UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)
    }
    
    let identifier = notification["id"] as? String ?? UUID().uuidString
    let request = UNNotificationRequest(identifier: identifier, content: content, trigger: trigger)
    
    UNUserNotificationCenter.current().add(request) { error in
      if let error = error {
        reject("SCHEDULE_ERROR", error.localizedDescription, error)
      } else {
        resolve(identifier)
      }
    }
  }
}
