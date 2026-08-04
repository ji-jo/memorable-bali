import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/Button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useOnboarding } from '@/state/OnboardingContext';
import { sync } from '@/data/repository';
import styles from './Landing.module.css';

export default function Landing() {
  const navigate = useNavigate();
  const { complete } = useOnboarding();
  const spotCount = sync.spots().length;

  /** Skip writes a complete default preference set — never a partial record. */
  const skip = () => {
    complete();
    navigate('/home', { replace: true });
  };

  return (
    <div className={styles.landing}>
      <div className={styles.themeSlot}>
        <ThemeToggle />
      </div>

      <div className={styles.content}>
        <p className={styles.eyebrow}>{spotCount} places, chosen carefully</p>
        <h1 className={styles.title}>
          The most enjoyable way
          <br />
          to discover Bali
        </h1>
        <p className={styles.lede}>
          Not ten thousand listings ranked by review count — a small, curated set with
          honest advice about when to go and what will go wrong.
        </p>

        <div className={styles.actions}>
          <Button size="lg" onClick={() => navigate('/onboarding/1')}>
            Start
          </Button>
          <Button size="lg" variant="ghost" onClick={skip}>
            Skip
          </Button>
        </div>

        <p className={styles.note}>Takes under a minute. No account, nothing to sign up for.</p>
      </div>
    </div>
  );
}
