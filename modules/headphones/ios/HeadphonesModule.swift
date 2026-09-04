import AVFoundation
import ExpoModulesCore

/**
 Detecta si la ruta de salida de audio actual son unos auriculares (cable, USB,
 Bluetooth o Lightning). PostureFix lo usa para lanzar el tono EAS directamente
 a los oídos del usuario en lugar de por el altavoz.
 */
public class HeadphonesModule: Module {
  private var observer: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("Headphones")

    Events("onChange")

    Function("isConnected") {
      currentOutput().connected
    }

    Function("getStatus") {
      let output = currentOutput()
      return ["connected": output.connected, "kind": output.kind as Any]
    }

    OnStartObserving {
      self.observer = NotificationCenter.default.addObserver(
        forName: AVAudioSession.routeChangeNotification,
        object: AVAudioSession.sharedInstance(),
        queue: .main
      ) { [weak self] _ in
        guard let self else { return }
        let output = self.currentOutput()
        self.sendEvent("onChange", ["connected": output.connected, "kind": output.kind as Any])
      }
    }

    OnStopObserving {
      self.removeObserver()
    }

    OnDestroy {
      self.removeObserver()
    }
  }

  private func removeObserver() {
    if let observer {
      NotificationCenter.default.removeObserver(observer)
    }
    observer = nil
  }

  private func currentOutput() -> (connected: Bool, kind: String?) {
    for output in AVAudioSession.sharedInstance().currentRoute.outputs {
      switch output.portType {
      case .headphones, .headsetMic:
        return (true, "wired")
      case .usbAudio:
        return (true, "usb")
      case .bluetoothA2DP, .bluetoothHFP, .bluetoothLE:
        return (true, "bluetooth")
      default:
        continue
      }
    }
    return (false, nil)
  }
}
