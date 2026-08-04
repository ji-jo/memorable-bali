import { useMemo } from 'react';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { PlaceCard } from '@/components/PlaceCard';
import { computeTotals } from '@/lib/itinerary';
import { formatCost, formatDuration } from '@/lib/format';
import { useSpots } from '@/hooks/useSpots';
import { useItinerary } from '@/state/ItineraryContext';
import { useOnboarding } from '@/state/OnboardingContext';

import styles from './Itinerary.module.css';

export default function Itinerary() {
  const { active, moveStop, removeStop, setDwell, optimise } = useItinerary();
  const { anchor, preferences } = useOnboarding();
  const spots = useSpots();

  const byId = useMemo(() => new Map(spots.map((s) => [s.id, s])), [spots]);
  const totals = useMemo(
    () => computeTotals(active, preferences.travelStyle),
    [active, preferences.travelStyle],
  );

  if (!active || active.stops.length === 0) {
    return (
      <div className={styles.emptyWrap}>
        <EmptyState
          icon="⋮⋮"
          title="No stops yet"
          message="Add places from Explore or any place page and they'll appear here, in the order you plan to visit them."
          action={{ label: 'Find places', to: '/explore' }}
        />
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.title}>{active.title}</h1>
        <p className={styles.subtitle}>
          {totals.stopCount} stop{totals.stopCount === 1 ? '' : 's'} from{' '}
          {preferences.stayAreaLabel}
        </p>
      </header>

      <section className={styles.summary} aria-label="Trip totals">
        <div className={styles.summaryGrid}>
          <div>
            <div className={styles.summaryValue}>{formatDuration(totals.totalMinutes)}</div>
            <div className={styles.summaryLabel}>Total</div>
          </div>
          <div>
            <div className={styles.summaryValue}>{formatDuration(totals.visitMinutes)}</div>
            <div className={styles.summaryLabel}>At places</div>
          </div>
          <div>
            <div className={styles.summaryValue}>{formatDuration(totals.travelMinutes)}</div>
            <div className={styles.summaryLabel}>Travelling</div>
          </div>
          <div>
            <div className={styles.summaryValue}>{formatCost(totals.cost)}</div>
            <div className={styles.summaryLabel}>Entry costs</div>
          </div>
        </div>

        {totals.warnings.length > 0 && (
          <ul className={styles.warnings}>
            {totals.warnings.map((w) => (
              <li key={w} className={styles.warning}>
                {w}
              </li>
            ))}
          </ul>
        )}

        <div className={styles.summaryActions}>
          <Button variant="secondary" size="sm" onClick={() => optimise(anchor)}>
            Optimise order
          </Button>
          <span className={styles.summaryNote}>
            Travel times are estimates from straight-line distance, not live traffic.
          </span>
        </div>
      </section>

      <ol className={styles.stops}>
        {active.stops.map((stop, index) => {
          const spot = byId.get(stop.spotId);
          if (!spot) return null;
          const isFirst = index === 0;
          const isLast = index === active.stops.length - 1;

          return (
            <li key={stop.spotId} className={styles.stop}>
              {stop.travelMinutesFromPrevious > 0 && (
                <p className={styles.travel}>
                  ↓ about {formatDuration(stop.travelMinutesFromPrevious)} to get here
                </p>
              )}

              <div className={styles.stopRow}>
                <span className={styles.order} aria-hidden="true">
                  {stop.order}
                </span>

                <div className={styles.stopCard}>
                  <PlaceCard spot={spot} variant="compact" showVisited={false} />
                </div>

                {/* Move buttons, not drag-only — dragging is unreachable by
                    keyboard and screen reader. */}
                <div className={styles.controls}>
                  <button
                    type="button"
                    className={styles.control}
                    onClick={() => moveStop(index, index - 1)}
                    disabled={isFirst}
                    aria-label={`Move ${spot.name} earlier`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className={styles.control}
                    onClick={() => moveStop(index, index + 1)}
                    disabled={isLast}
                    aria-label={`Move ${spot.name} later`}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className={styles.control}
                    onClick={() => removeStop(stop.spotId)}
                    aria-label={`Remove ${spot.name} from trip`}
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className={styles.dwell}>
                <label htmlFor={`dwell-${stop.spotId}`} className={styles.dwellLabel}>
                  Time here
                </label>
                <input
                  id={`dwell-${stop.spotId}`}
                  className={styles.dwellInput}
                  type="number"
                  min={15}
                  step={15}
                  value={stop.dwellMinutes}
                  onChange={(e) => setDwell(stop.spotId, Number(e.target.value))}
                />
                <span className={styles.dwellUnit}>minutes</span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
