#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(MorningWidgetBridge, NSObject)

RCT_EXTERN_METHOD(updateSnapshot:(NSDictionary *)snapshot
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(updateEveningSnapshot:(NSDictionary *)snapshot
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(consumePendingCheckIn:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(reloadTimelines)

@end
