import { Chip } from './material';
import { colors } from './theme';

interface Props {
  label: string;
  tone?: 'neutral' | 'good' | 'warn' | 'danger';
}

const toneColor = {
  neutral: colors.onSurfaceVariant,
  good: colors.success,
  warn: colors.warning,
  danger: colors.error,
};

/**
 * Estado compacto (auriculares, sensor, tipo de alarma) como chip de asistencia
 * de Material 3. Los estados que no son «neutral» van rellenos para que salten
 * a la vista sin recurrir a más color del necesario.
 */
export function StatusChip({ label, tone = 'neutral' }: Props) {
  return <Chip label={label} tone={toneColor[tone]} selected={tone !== 'neutral'} />;
}
