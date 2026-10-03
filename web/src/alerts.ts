import type { AlarmSound } from '../../src/core/postureEngine';

/**
 * Avisos en el navegador: los mismos sonidos que la app de móvil (pitido,
 * sirena y tono EAS), voz con `speechSynthesis` y notificación del sistema.
 */
export class WebAlerts {
  private readonly sounds: Record<'beep' | 'eas' | 'siren', HTMLAudioElement>;
  private playing: AlarmSound | null = null;
  private unlocked = false;
  private wakeLock: WakeLockSentinel | null = null;

  constructor(basePath = 'sounds') {
    const make = (file: string, loop: boolean) => {
      const audio = new Audio(`${basePath}/${file}`);
      audio.loop = loop;
      audio.preload = 'auto';
      return audio;
    };
    this.sounds = {
      beep: make('beep.wav', false),
      eas: make('eas.wav', true),
      siren: make('alarm.wav', true),
    };
  }

  /**
   * Los navegadores sólo dejan sonar audio después de una interacción, así que
   * esto se llama desde el clic en "Empezar": reproduce y para cada pista para
   * que más tarde la alerta pueda sonar sola.
   */
  async unlock(): Promise<void> {
    if (this.unlocked) return;
    await Promise.all(
      Object.values(this.sounds).map(async (audio) => {
        const previous = audio.volume;
        audio.volume = 0;
        try {
          await audio.play();
          audio.pause();
          audio.currentTime = 0;
        } catch {
          // Si el navegador aún no lo permite, se reintenta en la próxima alerta.
        }
        audio.volume = previous;
      })
    );
    this.unlocked = true;
  }

  setVolume(volume: number): void {
    for (const audio of Object.values(this.sounds)) {
      audio.volume = Math.min(1, Math.max(0, volume));
    }
  }

  playBeep(): void {
    const beep = this.sounds.beep;
    beep.currentTime = 0;
    void beep.play().catch(() => undefined);
  }

  startAlarm(sound: AlarmSound): void {
    if (this.playing === sound) return;
    this.stopAlarm();
    const audio = this.sounds[sound];
    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
    this.playing = sound;
  }

  stopAlarm(): void {
    for (const key of ['eas', 'siren'] as const) {
      const audio = this.sounds[key];
      audio.pause();
      audio.currentTime = 0;
    }
    this.playing = null;
  }

  stopAll(): void {
    this.stopAlarm();
    this.sounds.beep.pause();
    this.sounds.beep.currentTime = 0;
    this.stopSpeaking();
  }

  speak(text: string, enabled: boolean): void {
    if (!enabled || typeof speechSynthesis === 'undefined') return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES';
    utterance.pitch = 1.15;
    utterance.rate = 1;
    speechSynthesis.speak(utterance);
  }

  stopSpeaking(): void {
    if (typeof speechSynthesis !== 'undefined') {
      speechSynthesis.cancel();
    }
  }

  /** Pide permiso de notificaciones. Devuelve `true` si se pueden mostrar. */
  async requestNotifications(enabled: boolean): Promise<boolean> {
    if (!enabled || typeof Notification === 'undefined') return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    try {
      return (await Notification.requestPermission()) === 'granted';
    } catch {
      return false;
    }
  }

  notify(title: string, body: string, enabled: boolean): void {
    if (!enabled || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    try {
      // `silent`: el sonido lo pone la app, no el sistema.
      new Notification(title, { body, requireInteraction: true, silent: true, tag: 'posturefix' });
    } catch {
      // En algunos navegadores sólo se puede notificar desde un service worker.
    }
  }

  /** Evita que el portátil apague la pantalla mientras vigila. */
  async requestWakeLock(): Promise<void> {
    try {
      this.wakeLock = (await navigator.wakeLock?.request('screen')) ?? null;
    } catch {
      this.wakeLock = null;
    }
  }

  async releaseWakeLock(): Promise<void> {
    try {
      await this.wakeLock?.release();
    } catch {
      // Ya estaba liberado.
    }
    this.wakeLock = null;
  }

  get hasWakeLock(): boolean {
    return this.wakeLock != null && !this.wakeLock.released;
  }
}
