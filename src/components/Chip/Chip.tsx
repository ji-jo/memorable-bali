import type { CSSProperties, ReactNode } from 'react';
import styles from './Chip.module.css';

export interface ChipProps {
  label: string;
  selected?: boolean;
  /** Category colour — tints the dot and the selected border. */
  color?: string;
  icon?: ReactNode;
  showDot?: boolean;
  onToggle?: () => void;
  /** Renders an ×. Used for active filter chips. */
  onRemove?: () => void;
}

export function Chip({
  label,
  selected = false,
  color,
  icon,
  showDot = false,
  onToggle,
  onRemove,
}: ChipProps) {
  const classes = [styles.chip, selected ? styles.selected : ''].filter(Boolean).join(' ');
  const style = color ? ({ ['--chip-color']: color } as CSSProperties) : undefined;

  const content = (
    <>
      {showDot && color && <span className={styles.dot} aria-hidden="true" />}
      {icon && <span className={styles.icon}>{icon}</span>}
      {label}
      {onRemove && (
        <span
          className={styles.remove}
          role="button"
          tabIndex={0}
          aria-label={`Remove ${label} filter`}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              onRemove();
            }
          }}
        >
          ×
        </span>
      )}
    </>
  );

  // Interactive chips are buttons; static ones are spans.
  if (!onToggle && !onRemove) {
    return (
      <span className={classes} style={style}>
        {content}
      </span>
    );
  }

  return (
    <button type="button" className={classes} style={style} onClick={onToggle} aria-pressed={selected}>
      {content}
    </button>
  );
}
