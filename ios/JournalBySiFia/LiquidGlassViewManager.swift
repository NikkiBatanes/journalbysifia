import UIKit
import React

final class LiquidGlassHostView: UIVisualEffectView {
  private let fadeMaskLayer = CAGradientLayer()
  private let fallbackHighlightLayer = CAGradientLayer()
  private let fallbackRimLayer = CAShapeLayer()

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
    installFallbackLayers()
    configureEffect()
  }

  required init?(coder: NSCoder) {
    super.init(coder: coder)
    installFallbackLayers()
    configureEffect()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    updateFallbackLayers()
    updateFadeMask()
  }

  private func installFallbackLayers() {
    fallbackHighlightLayer.startPoint = CGPoint(x: 0.18, y: 0)
    fallbackHighlightLayer.endPoint = CGPoint(x: 0.82, y: 1)
    fallbackHighlightLayer.locations = [0, 0.42, 1]
    contentView.layer.addSublayer(fallbackHighlightLayer)

    fallbackRimLayer.fillColor = UIColor.clear.cgColor
    fallbackRimLayer.lineWidth = 0.75
    contentView.layer.addSublayer(fallbackRimLayer)
  }

  private func configureEffect() {
    if #available(iOS 26.0, *) {
      let glass = UIGlassEffect()
      glass.isInteractive = true
      glass.tintColor = tintColor
      effect = glass
      contentView.backgroundColor = .clear
      fallbackHighlightLayer.isHidden = true
      fallbackRimLayer.isHidden = true
    } else {
      // UIGlassEffect is unavailable before iOS 26. A stronger system material
      // plus a soft specular highlight and rim gives older simulator runtimes
      // the same translucent depth instead of a flat, tinted blur.
      effect = UIBlurEffect(style: .systemThinMaterialLight)
      contentView.backgroundColor = tintColor?.withAlphaComponent(0.20)
      fallbackHighlightLayer.colors = [
        UIColor.white.withAlphaComponent(0.38).cgColor,
        UIColor.white.withAlphaComponent(0.10).cgColor,
        UIColor.white.withAlphaComponent(0.015).cgColor,
      ]
      fallbackRimLayer.strokeColor = UIColor.white.withAlphaComponent(0.48).cgColor
      fallbackHighlightLayer.isHidden = false
      fallbackRimLayer.isHidden = false
    }
    setNeedsLayout()
  }

  private func updateShape() {
    layer.cornerRadius = CGFloat(truncating: cornerRadius)
    layer.cornerCurve = .continuous
    clipsToBounds = true
    updateFallbackLayers()
  }

  private func updateFallbackLayers() {
    fallbackHighlightLayer.frame = contentView.bounds
    fallbackHighlightLayer.cornerRadius = CGFloat(truncating: cornerRadius)
    fallbackRimLayer.frame = contentView.bounds
    fallbackRimLayer.path = UIBezierPath(
      roundedRect: contentView.bounds.insetBy(dx: 0.5, dy: 0.5),
      cornerRadius: max(0, CGFloat(truncating: cornerRadius) - 0.5)
    ).cgPath
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
