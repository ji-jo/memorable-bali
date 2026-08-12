import styles from './MakerCredit.module.css';

export interface MakerCreditProps {
  className?: string;
}

/** Bottom-right maker credit — same treatment on AppShell, Landing, Onboarding. */
export function MakerCredit({ className }: MakerCreditProps) {
  return (
    <a
      className={[styles.credit, className].filter(Boolean).join(' ')}
      href="https://jijo.fyi/work"
      target="_blank"
      rel="noopener noreferrer"
    >
      made with ♡ by jijo.fyi
    </a>
  );
}
