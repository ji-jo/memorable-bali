import { ListIcon } from '@phosphor-icons/react/dist/csr/List';
import { SquaresFourIcon } from '@phosphor-icons/react/dist/csr/SquaresFour';

import { Tabs, TabsList, TabItem } from '@/components/ui/tabs';
import type { IconComponent } from '@/lib/icon-context';

import styles from './Explore.module.css';

export type ExploreViewMode = 'list' | 'grid';

const MAP_CONTROL_ICON_SIZE = 20;

const ListTabIcon: IconComponent = ({ className }) => (
  <ListIcon size={MAP_CONTROL_ICON_SIZE} weight="bold" className={className} aria-hidden />
);

const GridTabIcon: IconComponent = ({ className }) => (
  <SquaresFourIcon size={MAP_CONTROL_ICON_SIZE} weight="bold" className={className} aria-hidden />
);

export interface ExploreResultsHeaderProps {
  count: number;
  view: ExploreViewMode;
  onViewChange: (view: ExploreViewMode) => void;
}

export function ExploreResultsHeader({ count, view, onViewChange }: ExploreResultsHeaderProps) {
  const label = `${count} place${count === 1 ? '' : 's'}`;

  return (
    <div className={styles.resultsHeader}>
      <p className={styles.resultsCount}>{label}</p>
      <Tabs
        value={view}
        onValueChange={(next) => onViewChange(next as ExploreViewMode)}
        className={styles.viewTabs}
      >
        <TabsList className={styles.viewTabsList} aria-label="Results layout">
          <TabItem
            value="list"
            icon={ListTabIcon}
            label="List view"
            className={styles.viewTab}
            aria-label="List view"
          />
          <TabItem
            value="grid"
            icon={GridTabIcon}
            label="Grid view"
            className={styles.viewTab}
            aria-label="Grid view"
          />
        </TabsList>
      </Tabs>
    </div>
  );
}
