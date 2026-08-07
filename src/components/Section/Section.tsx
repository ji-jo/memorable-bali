import { useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { CaretLeftIcon } from '@phosphor-icons/react/dist/csr/CaretLeft';
import { CaretRightIcon } from '@phosphor-icons/react/dist/csr/CaretRight';

import { useHorizontalScrollOverflow } from '@/hooks/useHorizontalScrollOverflow';

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
  const railRef = useRef<HTMLDivElement>(null);
  const { overflows, canScrollLeft, canScrollRight } = useHorizontalScrollOverflow(
    railRef,
    [scrollable, children],
  );

  const scrollRail = (direction: number) => {
    railRef.current?.scrollBy({ left: direction * 320, behavior: 'smooth' });
  };

  return (
    <motion.section
      className={styles.section}
      initial={{ opacity: 0, transform: 'translateY(12px)' }}
      whileInView={{ opacity: 1, transform: 'translateY(0)' }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
    >
      <motion.div
        className={styles.header}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.25, delay: 0.04 }}
      >
        <div>
          <h2 className={styles.title}>{title}</h2>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        {action && (
          <Link to={action.to} className={styles.action}>
            {action.label}
            <CaretRightIcon aria-hidden="true" weight="bold" />
          </Link>
        )}
      </motion.div>
      {scrollable ? (
        <div className={styles.railWrap}>
          {canScrollLeft ? (
            <button
              type="button"
              className={`${styles.railChevron} ${styles.railChevronLeft}`}
              aria-label={`Previous ${title.toLowerCase()} places`}
              onClick={() => scrollRail(-1)}
            >
              <CaretLeftIcon aria-hidden="true" weight="bold" />
            </button>
          ) : null}
          <div
            ref={railRef}
            className={`${styles.rail}${overflows ? ' scroll-mask-x' : ''}`}
          >
            {children}
          </div>
          {canScrollRight ? (
            <button
              type="button"
              className={`${styles.railChevron} ${styles.railChevronRight}`}
              aria-label={`More ${title.toLowerCase()} places`}
              onClick={() => scrollRail(1)}
            >
              <CaretRightIcon aria-hidden="true" weight="bold" />
            </button>
          ) : null}
        </div>
      ) : (
        <div className={styles.stack}>{children}</div>
      )}
    </motion.section>
  );
}
