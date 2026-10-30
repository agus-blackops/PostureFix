package expo.modules.headphones

import android.content.Context
import android.media.AudioDeviceCallback
import android.media.AudioDeviceInfo
import android.media.AudioManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Detecta si hay auriculares (cable, USB o Bluetooth) conectados a la salida de audio.
 * PostureFix lo usa para decidir si reproduce el tono EAS directamente en los oídos
 * del usuario en lugar de por el altavoz.
 */
class HeadphonesModule : Module() {
  private val audioManager: AudioManager
    get() {
      val context = requireNotNull(appContext.reactContext) { "React context is not available" }
      return context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    }

  private var deviceCallback: AudioDeviceCallback? = null

  override fun definition() = ModuleDefinition {
    Name("Headphones")

    Events("onChange")

    Function("isConnected") {
      currentOutput().first
    }

    Function("getStatus") {
      val (connected, kind) = currentOutput()
      mapOf("connected" to connected, "kind" to kind)
    }

    OnStartObserving {
      val callback = object : AudioDeviceCallback() {
        override fun onAudioDevicesAdded(addedDevices: Array<out AudioDeviceInfo>?) = emitStatus()
        override fun onAudioDevicesRemoved(removedDevices: Array<out AudioDeviceInfo>?) = emitStatus()
      }
      deviceCallback = callback
      audioManager.registerAudioDeviceCallback(callback, null)
    }

    OnStopObserving {
      deviceCallback?.let { audioManager.unregisterAudioDeviceCallback(it) }
      deviceCallback = null
    }

    OnDestroy {
      deviceCallback?.let { audioManager.unregisterAudioDeviceCallback(it) }
      deviceCallback = null
    }
  }

  private fun emitStatus() {
    val (connected, kind) = currentOutput()
    sendEvent("onChange", mapOf("connected" to connected, "kind" to kind))
  }

  /** @return `true` y el tipo de salida cuando el audio sale por unos auriculares. */
  private fun currentOutput(): Pair<Boolean, String?> {
    val devices = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)
    for (device in devices) {
      val kind = when (device.type) {
        AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
        AudioDeviceInfo.TYPE_WIRED_HEADSET -> "wired"
        AudioDeviceInfo.TYPE_USB_HEADSET,
        AudioDeviceInfo.TYPE_USB_DEVICE -> "usb"
        AudioDeviceInfo.TYPE_BLUETOOTH_A2DP,
        AudioDeviceInfo.TYPE_BLUETOOTH_SCO -> "bluetooth"
        AudioDeviceInfo.TYPE_HEARING_AID -> "hearing-aid"
        else -> null
      }
      if (kind != null) {
        return true to kind
      }
    }
    return false to null
  }
}
