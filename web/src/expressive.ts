import { LOADING_SEQUENCE, SHAPES, morphPath, wavyArcPath, type PolarShape } from '../../src/core/shapes';
import { MOTION, cssSpring, isSettled, stepSpring, type SpringState } from '../../src/core/spring';

/**
 * Material 3 Expressive en la versión de portátil, con la misma física y la
 * misma geometría que el móvil (src/core/spring.ts y src/core/shapes.ts).
 */

/** `true` si el sistema pide reducir el movimiento. */
export function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/**
 * Publica los muelles de la especificación como variables CSS: una curva
 * `linear()` y su duración por token (`--spatial-fast`, `--spatial-fast-ms`…).
 * Si el navegador no entiende `linear()`, se quedan las curvas de respaldo de
 * la hoja de estilos.
 */
export function installMotionTokens(root: HTMLElement = document.documentElement): void {
  if (!CSS.supports?.('transition-timing-function', 'linear(0, 1)')) return;
  for (const [name, spec] of Object.entries(MOTION)) {
    const { easing, durationMs } = cssSpring(spec);
    const token = name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    root.style.setProperty(`--${token}`, easing);
    root.style.setProperty(`--${token}-ms`, `${durationMs}ms`);
  }
}

const settle = (state: SpringState, target: number): SpringState =>
  isSettled(state, target) ? { value: target, velocity: 0 } : state;

/**
 * Anillo ondulado del medidor: el tramo recorrido persigue la inclinación con
 * un muelle espacial y su onda crece y corre más deprisa con la urgencia.
 * Solo pide fotogramas mientras algo se mueve.
 */
export class WavyRing {
  private progress: SpringState = { value: 0, velocity: 0 };
  private amplitude: SpringState = { value: 0, velocity: 0 };
  private targetProgress = 0;
  private targetAmplitude = 0;
  private speed = 3;
  private phase = 0;
  private frame = 0;
  private last: number | null = null;

  constructor(
    private readonly path: SVGPathElement,
    private readonly geometry: { cx: number; cy: number; radius: number; maxAmplitude: number; wavelength: number }
  ) {}

  set(progress: number, urgency: number): void {
    this.targetProgress = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
    const level = Math.min(1, Math.max(0, urgency));
    this.targetAmplitude = level * this.geometry.maxAmplitude;
    this.speed = 3 + level * 7;
    this.kick();
  }

  private kick(): void {
    if (!this.frame) this.frame = requestAnimationFrame(this.tick);
  }

  private tick = (now: number): void => {
    this.frame = 0;
    const dt = this.last == null ? 0 : (now - this.last) / 1000;
    this.last = now;

    if (prefersReducedMotion()) {
      this.progress = { value: this.targetProgress, velocity: 0 };
      this.amplitude = { value: this.targetAmplitude, velocity: 0 };
      this.draw();
      this.last = null;
      return;
    }

    this.progress = settle(stepSpring(this.progress, this.targetProgress, MOTION.spatialDefault, dt), this.targetProgress);
    this.amplitude = settle(stepSpring(this.amplitude, this.targetAmplitude, MOTION.effectsSlow, dt), this.targetAmplitude);
    const waving = this.amplitude.value > 0.2;
    if (waving) this.phase = (this.phase + this.speed * dt) % (Math.PI * 2000);
    this.draw();

    const moving =
      waving ||
      !isSettled(this.progress, this.targetProgress) ||
      !isSettled(this.amplitude, this.targetAmplitude);
    if (moving) {
      this.kick();
    } else {
      this.last = null;
    }
  };

  private draw(): void {
    const { cx, cy, radius, wavelength } = this.geometry;
    const shown = this.progress.value > 0.004;
    this.path.setAttribute(
      'd',
      shown
        ? wavyArcPath({ cx, cy, radius, progress: Math.min(1, this.progress.value), amplitude: this.amplitude.value, wavelength, phase: this.phase })
        : ''
    );
  }
}

/**
 * Forma que se transforma en otra con un muelle espacial (se pasa un poco y
 * vuelve) y, si se pide, gira despacio.
 */
export class MorphingShape {
  private from: PolarShape;
  private to: PolarShape;
  private mix: SpringState = { value: 1, velocity: 0 };
  private rotation = 0;
  private spin = 0;
  private frame = 0;
  private last: number | null = null;

  constructor(
    private readonly path: SVGPathElement,
    private readonly geometry: { cx: number; cy: number; radius: number },
    initial: PolarShape = SHAPES.circle
  ) {
    this.from = initial;
    this.to = initial;
    this.draw();
  }

  /** Nueva forma de destino y vueltas por segundo (0 = quieta). */
  set(shape: PolarShape, spin = 0): void {
    this.spin = spin;
    if (shape.lobes !== this.to.lobes || shape.depth !== this.to.depth) {
      this.from = this.to;
      this.to = shape;
      this.mix = { value: 0, velocity: 0 };
    }
    this.kick();
  }

  private kick(): void {
    if (!this.frame) this.frame = requestAnimationFrame(this.tick);
  }

  private tick = (now: number): void => {
    this.frame = 0;
    const dt = this.last == null ? 0 : (now - this.last) / 1000;
    this.last = now;

    if (prefersReducedMotion()) {
      this.mix = { value: 1, velocity: 0 };
      this.draw();
      this.last = null;
      return;
    }

    this.mix = settle(stepSpring(this.mix, 1, MOTION.spatialDefault, dt), 1);
    if (this.spin > 0) this.rotation = (this.rotation + this.spin * Math.PI * 2 * dt) % (Math.PI * 2);
    this.draw();

    if (this.spin > 0 || !isSettled(this.mix, 1)) {
      this.kick();
    } else {
      this.last = null;
    }
  };

  private draw(): void {
    const { cx, cy, radius } = this.geometry;
    this.path.setAttribute('d', morphPath(this.from, this.to, this.mix.value, cx, cy, radius, this.rotation));
  }
}

/**
 * Indicador de carga de Material 3 Expressive: una forma que se transforma en
 * la siguiente de la secuencia mientras gira.
 */
export class LoadingIndicator {
  private shape: MorphingShape;
  private timer: number | null = null;
  private index = 0;

  constructor(path: SVGPathElement, geometry: { cx: number; cy: number; radius: number }) {
    this.shape = new MorphingShape(path, geometry, SHAPES[LOADING_SEQUENCE[0]]);
  }

  start(): void {
    if (this.timer != null) return;
    this.shape.set(SHAPES[LOADING_SEQUENCE[this.index]], 0.6);
    this.timer = window.setInterval(() => {
      this.index = (this.index + 1) % LOADING_SEQUENCE.length;
      this.shape.set(SHAPES[LOADING_SEQUENCE[this.index]], 0.6);
    }, 650);
  }

  stop(): void {
    if (this.timer != null) window.clearInterval(this.timer);
    this.timer = null;
    this.shape.set(SHAPES[LOADING_SEQUENCE[this.index]], 0);
  }
}
