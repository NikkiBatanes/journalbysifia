package app.sifia.com

import android.content.pm.ActivityInfo
import android.content.res.Configuration
import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    setTheme(R.style.AppTheme)
    applyDeviceOrientationPolicy()
    super.onCreate(savedInstanceState)
  }

  private fun applyDeviceOrientationPolicy() {
    val configuration = resources.configuration
    val screenLayoutSize =
        configuration.screenLayout and Configuration.SCREENLAYOUT_SIZE_MASK
    val isTablet =
        configuration.smallestScreenWidthDp >= 600 ||
            screenLayoutSize == Configuration.SCREENLAYOUT_SIZE_LARGE ||
            screenLayoutSize == Configuration.SCREENLAYOUT_SIZE_XLARGE

    requestedOrientation =
        if (isTablet) {
          ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        } else {
          ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
        }
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "siFia"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
