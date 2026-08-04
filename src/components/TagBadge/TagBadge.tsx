import type { SpotTag } from '@/data/types';
import styles from './TagBadge.module.css';

export interface TagBadgeProps {
  tag: SpotTag;
  size?: 'sm' | 'md';
}

const TAG_CLASS: Record<SpotTag, string> = {
  Memorable: styles.memorable ?? '',
  'Must Visit': styles.mustVisit ?? '',
  Cultural: styles.cultural ?? '',
  Outworldly: styles.outworldly ?? '',
};

export function TagBadge({ tag, size = 'sm' }: TagBadgeProps) {
  return <span className={`${styles.badge} ${styles[size]} ${TAG_CLASS[tag]}`}>{tag}</span>;
}
