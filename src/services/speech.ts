import * as Speech from 'expo-speech';

/** Voz en español, un punto más aguda y rápida para que suene urgente. */
const VOICE_OPTIONS: Speech.SpeechOptions = {
  language: 'es-ES',
  pitch: 1.15,
  rate: 1.0,
};

export function speak(text: string, enabled: boolean): void {
  if (!enabled) return;
  try {
    Speech.speak(text, VOICE_OPTIONS);
  } catch {
    // Sin motor TTS instalado seguimos teniendo pitido, vibración y sirena.
  }
}

export function stopSpeaking(): void {
  Speech.stop().catch(() => undefined);
}
