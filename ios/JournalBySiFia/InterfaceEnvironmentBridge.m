#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(InterfaceEnvironmentBridge, NSObject)

RCT_EXTERN_METHOD(currentSizeClasses:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
