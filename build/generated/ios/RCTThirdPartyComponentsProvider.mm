/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */


#import <Foundation/Foundation.h>

#import "RCTThirdPartyComponentsProvider.h"
#import <React/RCTComponentViewProtocol.h>

@implementation RCTThirdPartyComponentsProvider

+ (NSDictionary<NSString *, Class<RCTComponentViewProtocol>> *)thirdPartyFabricComponents
{
  static NSDictionary<NSString *, Class<RCTComponentViewProtocol>> *thirdPartyComponents = nil;
  static dispatch_once_t nativeComponentsToken;

  dispatch_once(&nativeComponentsToken, ^{
    NSMutableDictionary<NSString *, Class<RCTComponentViewProtocol>> *components = [[NSMutableDictionary alloc] init];
    
    // Helper function to safely add components
    void (^addComponent)(NSString *, NSString *) = ^(NSString *key, NSString *className) {
      Class componentClass = NSClassFromString(className);
      if (componentClass != nil) {
        components[key] = componentClass;
      }
    };
    
    // Add components with nil safety
    addComponent(@"MarkdownTextInputDecoratorView", @"MarkdownTextInputDecoratorComponentView"); // @expensify/react-native-live-markdown
    addComponent(@"BlurView", @"BlurView"); // @react-native-community/blur
    addComponent(@"VibrancyView", @"VibrancyView"); // @react-native-community/blur
    addComponent(@"RNDateTimePicker", @"RNDateTimePickerComponentView"); // @react-native-community/datetimepicker
    addComponent(@"RNGoogleSignInButton", @"RNGoogleSignInButtonComponentView"); // @react-native-google-signin/google-signin
    addComponent(@"LottieAnimationView", @"LottieAnimationViewComponentView"); // lottie-react-native
    addComponent(@"RNGestureHandlerButton", @"RNGestureHandlerButtonComponentView"); // react-native-gesture-handler
    addComponent(@"RNCSafeAreaProvider", @"RNCSafeAreaProviderComponentView"); // react-native-safe-area-context
    addComponent(@"RNCSafeAreaView", @"RNCSafeAreaViewComponentView"); // react-native-safe-area-context
    addComponent(@"RNSFullWindowOverlay", @"RNSFullWindowOverlay"); // react-native-screens
    addComponent(@"RNSModalScreen", @"RNSModalScreen"); // react-native-screens
    addComponent(@"RNSScreenContainer", @"RNSScreenContainerView"); // react-native-screens
    addComponent(@"RNSScreenContentWrapper", @"RNSScreenContentWrapper"); // react-native-screens
    addComponent(@"RNSScreenFooter", @"RNSScreenFooter"); // react-native-screens
    addComponent(@"RNSScreen", @"RNSScreenView"); // react-native-screens
    addComponent(@"RNSScreenNavigationContainer", @"RNSScreenNavigationContainerView"); // react-native-screens
    addComponent(@"RNSScreenStackHeaderConfig", @"RNSScreenStackHeaderConfig"); // react-native-screens
    addComponent(@"RNSScreenStackHeaderSubview", @"RNSScreenStackHeaderSubview"); // react-native-screens
    addComponent(@"RNSScreenStack", @"RNSScreenStackView"); // react-native-screens
    addComponent(@"RNSSearchBar", @"RNSSearchBar"); // react-native-screens
    addComponent(@"RNSVGCircle", @"RNSVGCircle"); // react-native-svg
    addComponent(@"RNSVGClipPath", @"RNSVGClipPath"); // react-native-svg
    addComponent(@"RNSVGDefs", @"RNSVGDefs"); // react-native-svg
    addComponent(@"RNSVGEllipse", @"RNSVGEllipse"); // react-native-svg
    addComponent(@"RNSVGFeBlend", @"RNSVGFeBlend"); // react-native-svg
    addComponent(@"RNSVGFeColorMatrix", @"RNSVGFeColorMatrix"); // react-native-svg
    addComponent(@"RNSVGFeComposite", @"RNSVGFeComposite"); // react-native-svg
    addComponent(@"RNSVGFeFlood", @"RNSVGFeFlood"); // react-native-svg
    addComponent(@"RNSVGFeGaussianBlur", @"RNSVGFeGaussianBlur"); // react-native-svg
    addComponent(@"RNSVGFeMerge", @"RNSVGFeMerge"); // react-native-svg
    addComponent(@"RNSVGFeOffset", @"RNSVGFeOffset"); // react-native-svg
    addComponent(@"RNSVGFilter", @"RNSVGFilter"); // react-native-svg
    addComponent(@"RNSVGForeignObject", @"RNSVGForeignObject"); // react-native-svg
    addComponent(@"RNSVGGroup", @"RNSVGGroup"); // react-native-svg
    addComponent(@"RNSVGImage", @"RNSVGImage"); // react-native-svg
    addComponent(@"RNSVGLine", @"RNSVGLine"); // react-native-svg
    addComponent(@"RNSVGLinearGradient", @"RNSVGLinearGradient"); // react-native-svg
    addComponent(@"RNSVGMarker", @"RNSVGMarker"); // react-native-svg
    addComponent(@"RNSVGMask", @"RNSVGMask"); // react-native-svg
    addComponent(@"RNSVGPath", @"RNSVGPath"); // react-native-svg
    addComponent(@"RNSVGPattern", @"RNSVGPattern"); // react-native-svg
    addComponent(@"RNSVGRadialGradient", @"RNSVGRadialGradient"); // react-native-svg
    addComponent(@"RNSVGRect", @"RNSVGRect"); // react-native-svg
    addComponent(@"RNSVGSvgView", @"RNSVGSvgView"); // react-native-svg
    addComponent(@"RNSVGSymbol", @"RNSVGSymbol"); // react-native-svg
    addComponent(@"RNSVGTSpan", @"RNSVGTSpan"); // react-native-svg
    addComponent(@"RNSVGText", @"RNSVGText"); // react-native-svg
    addComponent(@"RNSVGTextPath", @"RNSVGTextPath"); // react-native-svg
    addComponent(@"RNSVGUse", @"RNSVGUse"); // react-native-svg
    
    thirdPartyComponents = [components copy];
  });

  return thirdPartyComponents;
}

@end
