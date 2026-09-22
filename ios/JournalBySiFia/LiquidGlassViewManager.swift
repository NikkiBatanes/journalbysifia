import UIKit
import React

final class LiquidGlassHostView: UIVisualEffectView {
  private let fadeMaskLayer = CAGradientLayer()

  @objc override var tintColor: UIColor! {
    didSet { configureEffect() }
  }

  @objc var cornerRadius: NSNumber = 0 {
    didSet { updateShape() }
  }

  @objc var fadesToTransparent = false {
    didSet { updateFadeMask() }
  }

  override init(effect: UIVisualEffect?) {
    super.init(effect: nil)
    configureEffect()
  }

  required init?(coder: NSCoder) {
    super.init(coder: coder)
    configureEffect()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    updateFadeMask()
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

  private func updateFadeMask() {
    guard fadesToTransparent else {
      layer.mask = nil
      return
    }

    fadeMaskLayer.frame = bounds
    fadeMaskLayer.startPoint = CGPoint(x: 0.5, y: 0)
    fadeMaskLayer.endPoint = CGPoint(x: 0.5, y: 1)
    fadeMaskLayer.colors = [
      UIColor.black.cgColor,
      UIColor.black.withAlphaComponent(0.96).cgColor,
      UIColor.black.withAlphaComponent(0.72).cgColor,
      UIColor.black.withAlphaComponent(0.30).cgColor,
      UIColor.clear.cgColor,
    ]
    fadeMaskLayer.locations = [0, 0.52, 0.72, 0.88, 1]
    layer.mask = fadeMaskLayer
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
