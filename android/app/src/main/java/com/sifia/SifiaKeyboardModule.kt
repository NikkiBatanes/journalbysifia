package app.sifia.com

import android.content.Context
import android.view.inputmethod.InputMethodManager
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil

class SifiaKeyboardModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "SifiaKeyboard"

  @ReactMethod
  fun showSoftKeyboard() {
    UiThreadUtil.runOnUiThread {
      val activity = currentActivity ?: return@runOnUiThread
      val focusedView = activity.currentFocus ?: activity.window?.decorView ?: return@runOnUiThread
      val inputMethodManager =
        reactContext.getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager
          ?: return@runOnUiThread

      focusedView.requestFocus()
      focusedView.postDelayed({
        inputMethodManager.showSoftInput(focusedView, InputMethodManager.SHOW_FORCED)
      }, 40)
    }
  }
}
