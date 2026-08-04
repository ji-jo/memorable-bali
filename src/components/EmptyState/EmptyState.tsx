import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/Button';
import styles from './EmptyState.module.css';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  /** Name the cause. "No results" alone is not helpful. */
  message: string;
  action?: { label: string; to?: string; onClick?: () => void };
  compact?: boolean;
}

export function EmptyState({ icon, title, message, action, compact = false }: EmptyStateProps) {
  return (
    <div className={`${styles.empty} ${compact ? styles.compact : ''}`}>
      {icon && (
        <div className={styles.icon} aria-hidden="true">
          {icon}
        </div>
      )}
      <p className={styles.title}>{title}</p>
      <p className={styles.message}>{message}</p>
      {action &&
        (action.to ? (
          <Link to={action.to}>
            <Button variant="secondary" size="sm">
              {action.label}
            </Button>
          </Link>
        ) : (
          <Button variant="secondary" size="sm" onClick={action.onClick}>
            {action.label}
          </Button>
        ))}
    </div>
  );
}
