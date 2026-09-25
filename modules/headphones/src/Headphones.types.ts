/** Tipo de salida de audio detectada. `null` cuando no hay auriculares. */
export type HeadphoneKind = 'wired' | 'usb' | 'bluetooth' | 'hearing-aid' | null;

export type HeadphonesStatus = {
  /** `true` cuando el audio se está enrutando a unos auriculares. */
  connected: boolean;
  kind: HeadphoneKind;
};

export type HeadphonesModuleEvents = {
  onChange: (status: HeadphonesStatus) => void;
};
