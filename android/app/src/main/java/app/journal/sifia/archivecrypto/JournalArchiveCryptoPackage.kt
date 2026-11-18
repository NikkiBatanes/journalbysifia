package app.journal.sifia.archivecrypto

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class JournalArchiveCryptoPackage : BaseReactPackage() {
  override fun getModule(
    name: String,
    reactContext: ReactApplicationContext,
  ): NativeModule? =
    if (name == JournalArchiveCryptoModule.NAME) {
      JournalArchiveCryptoModule(reactContext)
    } else {
      null
    }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider =
    ReactModuleInfoProvider {
      mapOf(
        JournalArchiveCryptoModule.NAME to
          ReactModuleInfo(
            JournalArchiveCryptoModule.NAME,
            JournalArchiveCryptoModule::class.java.name,
            false,
            false,
            false,
            true,
          ),
      )
    }
}
