#import <React/RCTViewManager.h>

@interface RCT_EXTERN_MODULE(LiquidGlassViewManager, RCTViewManager)
RCT_EXPORT_VIEW_PROPERTY(tintColor, UIColor)
RCT_EXPORT_VIEW_PROPERTY(cornerRadius, NSNumber)
RCT_EXPORT_VIEW_PROPERTY(fadesToTransparent, BOOL)
RCT_EXPORT_VIEW_PROPERTY(isInteractive, BOOL)
@end
