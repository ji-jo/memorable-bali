import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import styles from './Section.module.css';

export interface SectionProps {
  title: string;
  subtitle?: string;
  action?: { label: string; to: string };
  /** Horizontal snap-scrolling rail instead of a stacked block. */
  scrollable?: boolean;
  children: ReactNode;
}

export function Section({ title, subtitle, action, scrollable = false, children }: SectionProps) {
  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>{title}</h2>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        {action && (
          <Link to={action.to} className={styles.action}>
            {action.label}
          </Link>
        )}
      </div>
      <div className={scrollable ? styles.rail : styles.stack}>{children}</div>
    </section>
  );
}
