Pod::Spec.new do |spec|
  spec.name = 'JournalArchiveCrypto'
  spec.version = '0.1.0'
  spec.summary = 'Synthetic-only Journal archive crypto provider boundary'
  spec.homepage = 'https://journal.sifia.app'
  spec.license = { :type => 'Proprietary' }
  spec.author = { 'siFia' => 'support@sifia.app' }
  spec.source = { :path => '.' }
  spec.platform = :ios, '15.1'
  spec.source_files = 'Sources/**/*.{h,mm}'
  spec.public_header_files = 'Sources/**/*.h'
  spec.vendored_frameworks = 'Vendor/Clibsodium.xcframework'
  spec.preserve_paths = [
    'Vendor/INTEGRITY.json',
    'Vendor/LICENSE.libsodium',
  ]
  spec.dependency 'React-Core'
  spec.dependency 'ReactCodegen'
  spec.pod_target_xcconfig = {
    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++20',
  }
end
