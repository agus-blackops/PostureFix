import { Platform } from 'react-native';
import type { CustomerInfo, PurchasesError, PurchasesPackage } from 'react-native-purchases';

import { LABS_ENTITLEMENT, LABS_PRODUCTS } from '../core/labs';

/**
 * Suscripción de PostureFix Labs a través de RevenueCat, que habla con la App
 * Store y con Google Play y dice si el usuario tiene acceso a Labs.
 *
 * Las claves públicas del SDK van en `.env.local` (ver `.env.example`):
 * EXPO_PUBLIC_REVENUECAT_IOS_KEY y EXPO_PUBLIC_REVENUECAT_ANDROID_KEY. Sin
 * clave, en la web o en una build sin el módulo nativo, las compras se dan por
 * no disponibles y Labs se queda cerrado; la vigilancia no depende de nada de
 * esto.
 */

type PurchasesModule = typeof import('react-native-purchases');

const API_KEY =
  (Platform.OS === 'ios'
    ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
    : Platform.OS === 'android'
      ? process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY
      : undefined) ?? '';

let sdk: PurchasesModule | null | undefined;
let configured = false;

/** El SDK se carga al usarlo, para que la web y los tests no lo arrastren. */
function load(): PurchasesModule | null {
  if (sdk !== undefined) return sdk;
  if (Platform.OS === 'web' || API_KEY.length === 0) {
    sdk = null;
    return sdk;
  }
  try {
    sdk = require('react-native-purchases') as PurchasesModule;
  } catch {
    sdk = null;
  }
  return sdk;
}

/** Configura RevenueCat una sola vez. `false` si las compras no están disponibles. */
export function initPurchases(): boolean {
  const module = load();
  if (!module) return false;
  if (!configured) {
    try {
      module.default.configure({ apiKey: API_KEY });
      configured = true;
    } catch {
      sdk = null;
      return false;
    }
  }
  return true;
}

export function hasLabs(info: CustomerInfo): boolean {
  return info.entitlements.active[LABS_ENTITLEMENT] != null;
}

export async function fetchLabsActive(): Promise<boolean> {
  const module = load();
  if (!module || !configured) return false;
  return hasLabs(await module.default.getCustomerInfo());
}

export interface LabsOffer {
  monthly: PurchasesPackage | null;
  annual: PurchasesPackage | null;
}

/**
 * Los dos planes de la oferta actual. Se buscan por tipo de paquete y, si en
 * el panel de RevenueCat se crearon como paquetes personalizados, por el
 * identificador del producto.
 */
export async function fetchLabsOffer(): Promise<LabsOffer> {
  const module = load();
  if (!module || !configured) return { monthly: null, annual: null };
  const offering = (await module.default.getOfferings()).current;
  if (!offering) return { monthly: null, annual: null };
  const byProduct = (id: string) =>
    offering.availablePackages.find((pkg) => pkg.product.identifier === id || pkg.product.identifier.startsWith(`${id}:`)) ??
    null;
  return {
    monthly: offering.monthly ?? byProduct(LABS_PRODUCTS.monthly),
    annual: offering.annual ?? byProduct(LABS_PRODUCTS.annual),
  };
}

export type PurchaseOutcome =
  | { kind: 'purchased'; active: boolean }
  | { kind: 'cancelled' }
  | { kind: 'pending' }
  | { kind: 'error'; message: string };

const isPurchasesError = (error: unknown): error is PurchasesError =>
  typeof error === 'object' && error != null && 'code' in error;

export async function buyLabs(pkg: PurchasesPackage): Promise<PurchaseOutcome> {
  const module = load();
  if (!module || !configured) return { kind: 'error', message: 'Las compras no están disponibles en esta versión de la app.' };
  try {
    const { customerInfo } = await module.default.purchasePackage(pkg);
    return { kind: 'purchased', active: hasLabs(customerInfo) };
  } catch (error) {
    if (isPurchasesError(error)) {
      if (error.userCancelled || error.code === module.default.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
        return { kind: 'cancelled' };
      }
      if (error.code === module.default.PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) {
        return { kind: 'pending' };
      }
      if (error.code === module.default.PURCHASES_ERROR_CODE.NETWORK_ERROR) {
        return { kind: 'error', message: 'No hay conexión con la tienda. Revisa internet y vuelve a probar.' };
      }
      if (error.code === module.default.PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR) {
        return { kind: 'error', message: 'Este dispositivo o esta cuenta no tiene permitidas las compras.' };
      }
    }
    return { kind: 'error', message: 'No se ha podido completar la compra. No se te ha cobrado nada; inténtalo de nuevo.' };
  }
}

/** Recupera una suscripción comprada en otro móvil o tras reinstalar. */
export async function restoreLabs(): Promise<boolean> {
  const module = load();
  if (!module || !configured) return false;
  return hasLabs(await module.default.restorePurchases());
}

/** Avisa cuando la suscripción cambia (renovación, caducidad, compra en otro sitio). */
export function onLabsChange(listener: (active: boolean) => void): () => void {
  const module = load();
  if (!module || !configured) return () => undefined;
  const handler = (info: CustomerInfo) => listener(hasLabs(info));
  module.default.addCustomerInfoUpdateListener(handler);
  return () => {
    module.default.removeCustomerInfoUpdateListener(handler);
  };
}

/** Página de la tienda donde se gestiona o se cancela la suscripción. */
export const MANAGE_SUBSCRIPTION_URL =
  Platform.OS === 'ios'
    ? 'https://apps.apple.com/account/subscriptions'
    : 'https://play.google.com/store/account/subscriptions';
