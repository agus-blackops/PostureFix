import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

import type { AlarmSound } from '../core/postureEngine';

const SOURCES = {
  beep: require('../../assets/sounds/beep.wav'),
  eas: require('../../assets/sounds/eas.wav'),
  siren: require('../../assets/sounds/alarm.wav'),
};

/**
 * Reproductor de las alertas sonoras.
 *
 * - `beep`: pitido corto de susto.
 * - `eas`: tono de atención de emergencia (853 Hz + 960 Hz), el mismo par de
 *   frecuencias que precede a los avisos de tornado. Se reproduce en bucle y
 *   se reserva para cuando hay auriculares puestos.
 * - `siren`: sirena de dos tonos para la alarma por altavoz.
 */
export class AlertAudio {
  private players = new Map<keyof typeof SOURCES, AudioPlayer>();
  private playing: AlarmSound | null = null;

  /**
   * Configura la sesión de audio y precarga los sonidos. Hay que llamarlo antes
   * de la primera alerta para que el pitido salga instantáneo y suene aunque el
   * móvil esté en silencio.
   */
  async prepare(): Promise<void> {
    await setAudioModeAsync({
      playsInSilentMode: true, // el modo silencio no debe anular una alerta
      shouldPlayInBackground: true,
      shouldRouteThroughEarpiece: false,
      interruptionMode: 'doNotMix',
      allowsRecording: false,
    });

    for (const key of Object.keys(SOURCES) as (keyof typeof SOURCES)[]) {
      if (!this.players.has(key)) {
        const player = createAudioPlayer(SOURCES[key]);
        player.loop = key !== 'beep';
        this.players.set(key, player);
      }
    }
  }

  setVolume(volume: number): void {
    for (const player of this.players.values()) {
      player.volume = volume;
    }
  }

  /** Pitido de susto. Se rebobina para poder repetirlo sin esperas. */
  async playBeep(volume: number): Promise<void> {
    const player = this.players.get('beep');
    if (!player) return;
    player.volume = volume;
    try {
      await player.seekTo(0);
    } catch {
      // Si aún no está cargado, `play()` empieza igualmente desde el principio.
    }
    player.play();
  }

  /** Arranca el tono continuo de alarma. Ignora la llamada si ya sonaba. */
  async startAlarm(sound: AlarmSound, volume: number): Promise<void> {
    if (this.playing === sound) return;
    this.stopAlarm();
    const player = this.players.get(sound);
    if (!player) return;
    player.volume = volume;
    player.loop = true;
    try {
      await player.seekTo(0);
    } catch {
      // Idem: no impide reproducir.
    }
    player.play();
    this.playing = sound;
  }

  stopAlarm(): void {
    for (const key of ['eas', 'siren'] as const) {
      const player = this.players.get(key);
      if (player?.playing) {
        player.pause();
      }
    }
    this.playing = null;
  }

  stopAll(): void {
    this.stopAlarm();
    this.players.get('beep')?.pause();
  }

  get currentAlarm(): AlarmSound | null {
    return this.playing;
  }

  release(): void {
    this.stopAll();
    for (const player of this.players.values()) {
      player.remove();
    }
    this.players.clear();
  }
}
