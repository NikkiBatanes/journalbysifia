import UIKit
import React

final class LiquidGlassHostView: UIVisualEffectView {
  @objc override var tintColor: UIColor! {
    didSet { configureEffect() }
  }

  @objc var cornerRadius: NSNumber = 0 {
    didSet { updateShape() }
  }

  override init(effect: UIVisualEffect?) {
    super.init(effect: nil)
    configureEffect()
  }

  required init?(coder: NSCoder) {
    super.init(coder: coder)
    configureEffect()
  }

  private func configureEffect() {
    if #available(iOS 26.0, *) {
      let glass = UIGlassEffect()
      glass.isInteractive = true
      glass.tintColor = tintColor
      effect = glass
    } else {
      effect = UIBlurEffect(style: .systemUltraThinMaterialLight)
      contentView.backgroundColor = tintColor?.withAlphaComponent(0.18)
    }
  }

  private func updateShape() {
    layer.cornerRadius = CGFloat(truncating: cornerRadius)
    layer.cornerCurve = .continuous
    clipsToBounds = true
  }
}

@objc(LiquidGlassViewManager)
final class LiquidGlassViewManager: RCTViewManager {
  override func view() -> UIView! {
    LiquidGlassHostView(effect: nil)
  }

  override static func requiresMainQueueSetup() -> Bool {
    true
  }
}
