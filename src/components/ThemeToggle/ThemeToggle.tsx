import { useTheme, useThemeCycle } from '@/state/ThemeContext';
import styles from './ThemeToggle.module.css';

const LABEL = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
} as const;

const GLYPH = {
  light: '☀',
  dark: '☾',
  system: '◐',
} as const;

export function ThemeToggle() {
  const { preference, resolved } = useTheme();
  const cycle = useThemeCycle();

  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={cycle}
      aria-label={`Theme: ${LABEL[preference]}${preference === 'system' ? ` (currently ${resolved})` : ''}. Activate to change.`}
    >
      <span aria-hidden="true">{GLYPH[preference]}</span>
    </button>
  );
}
