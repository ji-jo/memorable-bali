import { useVisited } from '@/state/VisitedContext';
import styles from './VisitedToggle.module.css';

export interface VisitedToggleProps {
  spotId: string;
  variant?: 'icon' | 'button';
}

/**
 * The user's visited checkbox. Optimistic, no confirmation, persists
 * immediately — and never writes back to the JSON.
 */
export function VisitedToggle({ spotId, variant = 'icon' }: VisitedToggleProps) {
  const { isVisited, toggle } = useVisited();
  const visited = isVisited(spotId);

  if (variant === 'button') {
    return (
      <button
        type="button"
        className={`${styles.button} ${visited ? styles.active : ''}`}
        onClick={() => toggle(spotId)}
        aria-pressed={visited}
      >
        <span aria-hidden="true">{visited ? '✓' : '○'}</span>
        {visited ? 'Visited' : 'Mark visited'}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`${styles.icon} ${visited ? styles.active : ''}`}
      onClick={(e) => {
        // Cards are wrapped in links — do not navigate when toggling.
        e.preventDefault();
        e.stopPropagation();
        toggle(spotId);
      }}
      aria-pressed={visited}
      aria-label={visited ? 'Marked as visited' : 'Mark as visited'}
    >
      <span aria-hidden="true">✓</span>
    </button>
  );
}
