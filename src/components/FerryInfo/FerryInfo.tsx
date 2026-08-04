import { formatCost, formatDuration } from '@/lib/format';
import type { FerryRoute } from '@/data/types';
import styles from './FerryInfo.module.css';

export interface FerryInfoProps {
  route: FerryRoute;
  compact?: boolean;
}

export function FerryInfo({ route, compact = false }: FerryInfoProps) {
  return (
    <div className={styles.ferry}>
      <div className={styles.head}>
        <h3 className={styles.title}>{route.label}</h3>
        <span className={styles.crossing}>
          {formatDuration(route.crossingMinutes.min)}–{formatDuration(route.crossingMinutes.max)}
        </span>
      </div>

      {/* Not optional copy — this is the difference between helpful and harmful. */}
      <p className={styles.warning}>
        Schedules are indicative and change often. Crossings are cancelled for weather,
        especially December–February. Always confirm with the operator before you plan
        around a departure.
      </p>

      <div className={styles.block}>
        <p className={styles.blockTitle}>Departs from</p>
        {route.departurePorts.map((port) => (
          <div key={port.id} className={styles.port}>
            <strong>{port.name}</strong> → {port.arrivesAt}
            <span className={styles.portNote}>{port.note}</span>
          </div>
        ))}
      </div>

      {!compact && (
        <>
          <div className={styles.block}>
            <p className={styles.blockTitle}>Indicative departures</p>
            <p className={styles.times}>
              <strong>Out:</strong> {route.indicativeSchedule.outbound.join(' · ')}
            </p>
            <p className={styles.times}>
              <strong>Back:</strong> {route.indicativeSchedule.return.join(' · ')}
            </p>
            <p className={styles.portNote}>{route.indicativeSchedule.note}</p>
          </div>

          <div className={styles.block}>
            <p className={styles.blockTitle}>Typical fare</p>
            <p>{formatCost(route.indicativePrice)} one way per person</p>
          </div>

          {route.tips.length > 0 && (
            <ul className={styles.tips}>
              {route.tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          )}
        </>
      )}

      <div className={styles.block}>
        <p className={styles.blockTitle}>Book with the operator</p>
        <div className={styles.links}>
          {[...route.operators, ...route.aggregators].map((op) => (
            <a
              key={op.name}
              href={op.bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.link}
            >
              {op.name} ↗
            </a>
          ))}
        </div>
        <p className={styles.portNote}>
          We take no payments and hold no bookings — every link goes to the operator.
        </p>
      </div>
    </div>
  );
}
