#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(RCTPushNotificationBridge, RCTEventEmitter)

RCT_EXTERN_METHOD(requestPermissions:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(checkPermissions:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(setBadgeNumber:(nonnull NSNumber *)number)

RCT_EXTERN_METHOD(getBadgeNumber:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(cancelAllLocalNotifications)

RCT_EXTERN_METHOD(removeAllDeliveredNotifications)

RCT_EXTERN_METHOD(scheduleLocalNotification:(NSDictionary *)notification
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
