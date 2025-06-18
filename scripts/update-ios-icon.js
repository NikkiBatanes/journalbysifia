const { setIcon } = require('@bam.tech/react-native-make');
const path = require('path');

const iosIconPath = path.resolve(__dirname, '../assets/images/siFiaAppIcon.png');

async function updateIosIcon() {
  try {
    console.log('Updating iOS app icon...');
    await setIcon({
      ios: {
        iconPath: iosIconPath,
        // Keep the same icon name to override the existing one
        iconName: 'AppIcon',
      },
    });
    console.log('✅ iOS app icon updated successfully!');
  } catch (error) {
    console.error('❌ Error updating iOS app icon:', error);
    process.exit(1);
  }
}

updateIosIcon();
