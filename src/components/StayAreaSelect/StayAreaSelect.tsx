import { useState } from 'react';

import { sync } from '@/data/repository';
import { resolveStayArea, useOnboarding } from '@/state/OnboardingContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/motion/select';
import { StayLocationPicker } from '@/components/StayLocationPicker/StayLocationPicker';
import { shortStayLabel } from '@/lib/stay-location';
import { cn } from '@/lib/utils';

import styles from './StayAreaSelect.module.css';

export interface StayAreaSelectProps {
  className?: string;
  triggerClassName?: string;
}

const CUSTOM_VALUE = 'custom';

/** Inline stay-area picker — presets or a custom hotel/home pin. */
export function StayAreaSelect({ className, triggerClassName }: StayAreaSelectProps) {
  const { preferences, update } = useOnboarding();
  const stayAreas = sync.stayAreas();
  const [pickerOpen, setPickerOpen] = useState(false);

  const selectValue =
    preferences.stayAreaId === CUSTOM_VALUE ? CUSTOM_VALUE : preferences.stayAreaId;

  const handleChange = (id: string) => {
    if (id === CUSTOM_VALUE) {
      setPickerOpen(true);
      return;
    }
    const resolved = resolveStayArea(id);
    if (!resolved) return;
    update({
      stayAreaId: id,
      stayAnchor: resolved.anchor,
      stayAreaLabel: resolved.label,
    });
  };

  return (
    <>
      <Select
        value={selectValue}
        onValueChange={handleChange}
        className={cn(styles.root, className)}
      >
        <SelectTrigger
          className={cn(
            styles.trigger,
            'w-auto min-h-0 border-0 bg-transparent px-0 py-0 shadow-none hover:border-0',
            triggerClassName,
          )}
          aria-label="Change stay area"
        >
          <SelectValue placeholder="Choose area" />
        </SelectTrigger>
        <SelectContent className={styles.panel}>
          {stayAreas.map((area) => (
            <SelectItem key={area.id} value={area.id}>
              {area.label}
            </SelectItem>
          ))}
          <SelectItem value={CUSTOM_VALUE}>
            {preferences.stayAreaId === CUSTOM_VALUE
              ? `Custom · ${shortStayLabel(preferences.stayAreaLabel)}`
              : 'Set hotel / home…'}
          </SelectItem>
        </SelectContent>
      </Select>

      <StayLocationPicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
    </>
  );
}
