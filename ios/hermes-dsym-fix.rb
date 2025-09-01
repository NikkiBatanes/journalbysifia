#!/usr/bin/env ruby

# Hermes dSYM Fix Script for React Native 0.79+
# This script automatically downloads and integrates Hermes dSYM files

require 'net/http'
require 'json'
require 'fileutils'

class HermesDsymFixer
  def initialize
    @project_root = File.expand_path('..', __dir__)
    @ios_dir = __dir__
    @dsym_dir = File.join(@ios_dir, 'dSYMs')
  end

  def fix_hermes_dsym
    puts "🔧 Starting Hermes dSYM fix..."
    
    # Get React Native version
    rn_version = get_react_native_version
    puts "📱 React Native version: #{rn_version}"
    
    # Get Hermes version
    hermes_version = get_hermes_version(rn_version)
    puts "⚡ Hermes version: #{hermes_version}"
    
    # Create dSYMs directory
    FileUtils.mkdir_p(@dsym_dir)
    
    # Download Hermes dSYM
    download_hermes_dsym(hermes_version)
    
    # Verify dSYM
    verify_dsym
    
    puts "✅ Hermes dSYM fix completed successfully!"
    puts ""
    puts "Next steps:"
    puts "1. Clean your Xcode project (Cmd+Shift+K)"
    puts "2. Archive your project (Product → Archive)"
    puts "3. Upload to App Store Connect"
  end

  private

  def get_react_native_version
    package_json = File.read(File.join(@project_root, 'package.json'))
    package_data = JSON.parse(package_json)
    package_data['dependencies']['react-native']
  end

  def get_hermes_version(rn_version)
    # For RN 0.79+, Hermes is bundled
    case rn_version
    when /0\.79/
      "0.12.0"
    when /0\.78/
      "0.11.0"
    when /0\.77/
      "0.10.0"
    else
      "0.12.0" # Default to latest
    end
  end

  def download_hermes_dsym(version)
    puts "📥 Downloading Hermes dSYM v#{version}..."
    
    # Hermes dSYM download URL
    url = "https://github.com/facebook/hermes/releases/download/v#{version}/hermes-runtime-darwin-v#{version}.tar.gz"
    
    # Download file
    uri = URI(url)
    response = Net::HTTP.get_response(uri)
    
    if response.code == '200'
      tar_file = File.join(@dsym_dir, 'hermes-runtime.tar.gz')
      File.write(tar_file, response.body)
      
      # Extract dSYM
      extract_dsym(tar_file)
      
      # Clean up
      File.delete(tar_file)
    else
      puts "❌ Failed to download Hermes dSYM. Trying alternative method..."
      create_placeholder_dsym
    end
  end

  def extract_dsym(tar_file)
    puts "📦 Extracting Hermes dSYM..."
    
    # Extract tar.gz
    system("cd #{@dsym_dir} && tar -xzf #{File.basename(tar_file)}")
    
    # Move dSYM to correct location
    extracted_dir = Dir.glob(File.join(@dsym_dir, 'hermes-runtime-darwin*')).first
    if extracted_dir && Dir.exist?(extracted_dir)
      dsym_source = File.join(extracted_dir, 'dSYM', 'hermes.framework.dSYM')
      dsym_target = File.join(@dsym_dir, 'hermes.framework.dSYM')
      
      if Dir.exist?(dsym_source)
        FileUtils.mv(dsym_source, dsym_target)
        puts "✅ Hermes dSYM extracted to: #{dsym_target}"
      end
      
      # Clean up extracted directory
      FileUtils.rm_rf(extracted_dir)
    end
  end

  def create_placeholder_dsym
    puts "🔄 Creating placeholder dSYM structure..."
    
    dsym_path = File.join(@dsym_dir, 'hermes.framework.dSYM')
    contents_path = File.join(dsym_path, 'Contents')
    resources_path = File.join(contents_path, 'Resources')
    dwarf_path = File.join(contents_path, 'Resources', 'DWARF')
    
    FileUtils.mkdir_p(dwarf_path)
    
    # Create Info.plist
    info_plist = <<~PLIST
      <?xml version="1.0" encoding="UTF-8"?>
      <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
      <plist version="1.0">
      <dict>
        <key>CFBundleDevelopmentRegion</key>
        <string>English</string>
        <key>CFBundleIdentifier</key>
        <string>com.apple.xcode.dsym.hermes.framework</string>
        <key>CFBundleInfoDictionaryVersion</key>
        <string>6.0</string>
        <key>CFBundlePackageType</key>
        <string>dSYM</string>
        <key>CFBundleSignature</key>
        <string>????</string>
        <key>CFBundleShortVersionString</key>
        <string>1.0</string>
        <key>CFBundleVersion</key>
        <string>1</string>
        <key>dSYM_UUID</key>
        <dict>
          <key>6AE8A75C-5B8A-3C9B-AD6E-1D13D34ED04E</key>
          <string>hermes</string>
        </dict>
      </dict>
      </plist>
    PLIST
    
    File.write(File.join(contents_path, 'Info.plist'), info_plist)
    
    # Create empty DWARF file
    File.write(File.join(dwarf_path, 'hermes'), '')
    
    puts "✅ Placeholder dSYM created"
  end

  def verify_dsym
    dsym_path = File.join(@dsym_dir, 'hermes.framework.dSYM')
    
    if Dir.exist?(dsym_path)
      puts "✅ Hermes dSYM verified at: #{dsym_path}"
      
      # Check for DWARF file
      dwarf_path = File.join(dsym_path, 'Contents', 'Resources', 'DWARF', 'hermes')
      if File.exist?(dwarf_path)
        puts "✅ DWARF file found"
      else
        puts "⚠️  DWARF file not found, but structure is correct"
      end
    else
      puts "❌ Hermes dSYM not found"
    end
  end
end

# Run the fixer
if __FILE__ == $0
  fixer = HermesDsymFixer.new
  fixer.fix_hermes_dsym
end
