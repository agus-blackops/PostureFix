import { useCallback, useEffect, useRef, useState } from 'react';

import type { LabsPlan } from '../core/labs';
import {
  buyLabs,
  fetchLabsActive,
  fetchLabsOffer,
  initPurchases,
  onLabsChange,
  restoreLabs,
  type LabsOffer,
} from '../services/purchases';

export type LabsStatus = 'loading' | 'unavailable' | 'ready';

export interface Labs {
  status: LabsStatus;
  /** Suscripción activa: Labs abierto. */
  active: boolean;
  offer: LabsOffer | null;
  /** Lo que se está haciendo ahora mismo, para bloquear botones. */
  busy: 'buy' | 'restore' | null;
  /** Mensaje para el usuario tras comprar o restaurar. */
  message: { tone: 'info' | 'error'; text: string } | null;
  purchase: (plan: LabsPlan) => Promise<void>;
  restore: () => Promise<void>;
  /** Vuelve a pedir los planes si la tienda no respondió. */
  retry: () => void;
  /**
   * Sólo en desarrollo y sin tienda (Expo Go, sin claves): abre Labs para
   * poder probarlo. En una build de producción siempre es `null`.
   */
  devUnlock: (() => void) | null;
}

/** Estado de la suscripción de PostureFix Labs para la interfaz. */
export function useLabs(): Labs {
  const [status, setStatus] = useState<LabsStatus>('loading');
  const [active, setActive] = useState(false);
  const [offer, setOffer] = useState<LabsOffer | null>(null);
  const [busy, setBusy] = useState<Labs['busy']>(null);
  const [message, setMessage] = useState<Labs['message']>(null);
  const [attempt, setAttempt] = useState(0);
  const busyRef = useRef(false);

  useEffect(() => {
    if (!initPurchases()) {
      setStatus('unavailable');
      return undefined;
    }
    let cancelled = false;
    const unsubscribe = onLabsChange((next) => {
      if (!cancelled) setActive(next);
    });
    (async () => {
      try {
        const [isActive, plans] = await Promise.all([fetchLabsActive(), fetchLabsOffer()]);
        if (cancelled) return;
        setActive(isActive);
        setOffer(plans);
        setStatus('ready');
      } catch {
        // Sin conexión con la tienda Labs se queda como estaba y se puede reintentar.
        if (!cancelled) {
          setOffer({ monthly: null, annual: null });
          setStatus('ready');
          setMessage({ tone: 'error', text: 'No he podido hablar con la tienda. Revisa la conexión y vuelve a probar.' });
        }
      }
    })();
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [attempt]);

  const purchase = useCallback(
    async (plan: LabsPlan) => {
      const pkg = offer?.[plan];
      if (!pkg || busyRef.current) return;
      busyRef.current = true;
      setBusy('buy');
      setMessage(null);
      try {
        const outcome = await buyLabs(pkg);
        switch (outcome.kind) {
          case 'purchased':
            setActive(outcome.active);
            setMessage(
              outcome.active
                ? { tone: 'info', text: 'Bienvenido a PostureFix Labs. Gracias por apoyar el proyecto.' }
                : { tone: 'error', text: 'La compra ha ido bien pero Labs no se ha activado. Prueba «Restaurar compras».' }
            );
            break;
          case 'pending':
            setMessage({ tone: 'info', text: 'El pago está pendiente de aprobación. Labs se abrirá en cuanto se confirme.' });
            break;
          case 'cancelled':
            break;
          case 'error':
            setMessage({ tone: 'error', text: outcome.message });
            break;
        }
      } finally {
        busyRef.current = false;
        setBusy(null);
      }
    },
    [offer]
  );

  const restore = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy('restore');
    setMessage(null);
    try {
      const restored = await restoreLabs();
      setActive(restored);
      setMessage(
        restored
          ? { tone: 'info', text: 'Suscripción recuperada. Labs vuelve a estar abierto.' }
          : { tone: 'info', text: 'No hay ninguna suscripción a Labs en esta cuenta de la tienda.' }
      );
    } catch {
      setMessage({ tone: 'error', text: 'No he podido restaurar las compras. Revisa la conexión y vuelve a probar.' });
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }, []);

  const retry = useCallback(() => {
    setMessage(null);
    setStatus('loading');
    setAttempt((n) => n + 1);
  }, []);

  const devUnlock = __DEV__ && status === 'unavailable' ? () => setActive(true) : null;

  return { status, active, offer, busy, message, purchase, restore, retry, devUnlock };
}
