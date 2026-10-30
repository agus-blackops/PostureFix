import { useCallback, useEffect, useRef, useState } from 'react';

import type { LabsPlan } from '../core/labs';
import { loadTrialStart } from '../core/settings';
import { trialStatus, type TrialStatus } from '../core/trial';
import {
  buyLabs,
  fetchLabsActive,
  fetchLabsOffer,
  initPurchases,
  onLabsChange,
  restoreLabs,
  type LabsOffer,
} from '../services/purchases';

export interface LabsAccess {
  /** Estado de la tienda: cargando, sin tienda (Expo Go, web, sin claves) o lista. */
  store: 'loading' | 'unavailable' | 'ready';
  /** Suscripción pagada activa. */
  subscribed: boolean;
  /** Prueba gratis de 90 días; `null` mientras se lee. */
  trial: TrialStatus | null;
  /** Labs abierto: suscripción o prueba en curso. */
  active: boolean;
  offer: LabsOffer | null;
  busy: 'buy' | 'restore' | null;
  message: { tone: 'info' | 'error'; text: string } | null;
  purchase: (plan: LabsPlan) => Promise<void>;
  restore: () => Promise<void>;
  retry: () => void;
}

/**
 * Acceso a PostureFix Labs en la 2.0: los 90 días gratis desde la primera
 * apertura y, después, la suscripción de la tienda a través de RevenueCat.
 */
export function useLabsAccess(): LabsAccess {
  const [store, setStore] = useState<LabsAccess['store']>('loading');
  const [subscribed, setSubscribed] = useState(false);
  const [trialStart, setTrialStart] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [offer, setOffer] = useState<LabsOffer | null>(null);
  const [busy, setBusy] = useState<LabsAccess['busy']>(null);
  const [message, setMessage] = useState<LabsAccess['message']>(null);
  const [attempt, setAttempt] = useState(0);
  const busyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void loadTrialStart().then((start) => !cancelled && setTrialStart(start));
    // La cuenta de días se repasa cada hora por si la app se queda abierta.
    const timer = setInterval(() => setNow(Date.now()), 3_600_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!initPurchases()) {
      setStore('unavailable');
      return undefined;
    }
    let cancelled = false;
    const unsubscribe = onLabsChange((next) => !cancelled && setSubscribed(next));
    (async () => {
      try {
        const [isActive, plans] = await Promise.all([fetchLabsActive(), fetchLabsOffer()]);
        if (cancelled) return;
        setSubscribed(isActive);
        setOffer(plans);
        setStore('ready');
      } catch {
        if (cancelled) return;
        setOffer({ monthly: null, annual: null });
        setStore('ready');
        setMessage({ tone: 'error', text: 'No he podido hablar con la tienda. Revisa la conexión y vuelve a probar.' });
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
        if (outcome.kind === 'purchased') {
          setSubscribed(outcome.active);
          setMessage(
            outcome.active
              ? { tone: 'info', text: 'Suscripción activa. Gracias por apoyar PostureFix.' }
              : { tone: 'error', text: 'La compra ha ido bien pero Labs no se ha activado. Prueba «Restaurar compras».' }
          );
        } else if (outcome.kind === 'pending') {
          setMessage({ tone: 'info', text: 'El pago está pendiente de aprobación. Labs se abrirá en cuanto se confirme.' });
        } else if (outcome.kind === 'error') {
          setMessage({ tone: 'error', text: outcome.message });
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
      setSubscribed(restored);
      setMessage(
        restored
          ? { tone: 'info', text: 'Suscripción recuperada.' }
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
    setStore('loading');
    setAttempt((n) => n + 1);
  }, []);

  const trial = trialStart == null ? null : trialStatus(trialStart, now);
  return {
    store,
    subscribed,
    trial,
    active: subscribed || !!trial?.active,
    offer,
    busy,
    message,
    purchase,
    restore,
    retry,
  };
}
