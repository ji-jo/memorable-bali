import { useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { StayLocationPicker } from '@/components/StayLocationPicker/StayLocationPicker';
import { SunRayShader } from '@/components/SunRayShader';
import { useOnboarding, resolveStayArea } from '@/state/OnboardingContext';
import { sync } from '@/data/repository';
import categoriesFile from '@data/categories.json';
import type { LengthOfStay, OnboardingInterest, TravelStyle, Transportation } from '@/data/types';

import styles from './Onboarding.module.css';

const TOTAL_STEPS = 5;

const LENGTHS: { id: LengthOfStay; label: string; blurb: string }[] = [
  { id: '1-day', label: '1 Day', blurb: 'One region, three or four stops.' },
  { id: 'weekend', label: 'Weekend', blurb: 'Two days, one base.' },
  { id: '3-days', label: '3 Days', blurb: 'Enough to cross the island once.' },
  { id: '5-days', label: '5 Days', blurb: 'Two bases, no rushing.' },
  { id: '1-week', label: '1 Week', blurb: 'South, centre and east comfortably.' },
  { id: '2-weeks', label: '2 Weeks', blurb: 'The whole province, including the Nusas.' },
];

const TRANSPORT: { id: Transportation; label: string; blurb: string }[] = [
  { id: 'scooter', label: 'Scooter', blurb: 'Fastest in traffic. Needs an IDP.' },
  { id: 'car', label: 'Car', blurb: 'Self-drive. Comfortable, slower in the south.' },
  { id: 'taxi', label: 'Taxi', blurb: 'Grab and Gojek work in most areas.' },
  { id: 'private-driver', label: 'Private driver', blurb: 'Best for long days across regions.' },
];

const STYLES: { id: TravelStyle; label: string; blurb: string }[] = [
  { id: 'relaxed', label: 'Relaxed', blurb: 'Two stops a day. Long lunches.' },
  { id: 'balanced', label: 'Balanced', blurb: 'Three or four stops. The default.' },
  { id: 'packed', label: 'Packed', blurb: 'Five or more. Early starts.' },
];

export default function Onboarding() {
  const { step: stepParam } = useParams();
  const navigate = useNavigate();
  const { preferences, update, complete } = useOnboarding();
  const [stayPickerOpen, setStayPickerOpen] = useState(false);

  const step = Math.min(TOTAL_STEPS, Math.max(1, Number(stepParam) || 1));
  const interests = categoriesFile.onboardingInterests as OnboardingInterest[];
  const stayAreas = sync.stayAreas();

  const goNext = () => {
    if (step >= TOTAL_STEPS) {
      complete();
      navigate('/explore', { replace: true });
    } else {
      navigate(`/onboarding/${step + 1}`);
    }
  };

  const goBack = () => {
    if (step === 1) navigate('/');
    else navigate(`/onboarding/${step - 1}`);
  };

  /** Skipping from any step completes with defaults for everything unanswered. */
  const skipAll = () => {
    complete();
    navigate('/explore', { replace: true });
  };

  const toggleInterest = (id: string) => {
    // "All" is exclusive — selecting it clears everything else, and selecting
    // anything else clears "All".
    if (id === 'all') {
      update({ interests: ['all'] });
      return;
    }
    const without = preferences.interests.filter((i) => i !== 'all');
    const next = without.includes(id) ? without.filter((i) => i !== id) : [...without, id];
    update({ interests: next.length > 0 ? next : ['all'] });
  };

  const toggleTransport = (id: Transportation) => {
    const next = preferences.transportation.includes(id)
      ? preferences.transportation.filter((t) => t !== id)
      : [...preferences.transportation, id];
    update({ transportation: next.length > 0 ? next : ['scooter'] });
  };

  const selectStayArea = (id: string) => {
    const resolved = resolveStayArea(id);
    if (!resolved) return;
    update({ stayAreaId: id, stayAnchor: resolved.anchor, stayAreaLabel: resolved.label });
  };

  return (
    <div className={styles.page}>
      <SunRayShader />
      <div className={styles.screen}>
        <div className={styles.topRow}>
          <button type="button" className={styles.back} onClick={goBack} aria-label="Back">
            ←
          </button>
          <div
            className={styles.progress}
            role="progressbar"
            aria-valuenow={step}
            aria-valuemin={1}
            aria-valuemax={TOTAL_STEPS}
            aria-label={`Step ${step} of ${TOTAL_STEPS}`}
          >
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <span
                key={i}
                className={`${styles.progressStep} ${i < step ? styles.progressStepDone : ''}`}
              />
            ))}
          </div>
          <button type="button" className={styles.skip} onClick={skipAll}>
            Skip
          </button>
        </div>

        <div className={styles.body}>
          <p className={styles.stepLabel}>
            Step {step} of {TOTAL_STEPS}
          </p>

          {step === 1 && (
            <>
              <h1 className={styles.question}>What are you into?</h1>
              <p className={styles.hint}>Pick as many as you like. This shapes what we show first.</p>
              <div className={styles.options}>
                {interests
                  // 'shopping' has no curated spots yet — never offer an interest
                  // that returns zero results (docs/03-Data-Model.md).
                  .filter((i) => i.id !== 'shopping')
                  .map((interest) => (
                    <Chip
                      key={interest.id}
                      label={interest.label}
                      selected={preferences.interests.includes(interest.id)}
                      onToggle={() => toggleInterest(interest.id)}
                    />
                  ))}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className={styles.question}>How long are you here?</h1>
              <p className={styles.hint}>Used to size itinerary suggestions.</p>
              <div className={styles.optionGrid}>
                {LENGTHS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`${styles.option} ${preferences.lengthOfStay === option.id ? styles.optionSelected : ''}`}
                    onClick={() => update({ lengthOfStay: option.id })}
                    aria-pressed={preferences.lengthOfStay === option.id}
                  >
                    <div className={styles.optionLabel}>{option.label}</div>
                    <div className={styles.optionBlurb}>{option.blurb}</div>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h1 className={styles.question}>Where are you staying?</h1>
              <p className={styles.hint}>Every distance in the app is measured from here.</p>
              <div className={styles.optionGrid}>
                {stayAreas.map((area) => (
                  <button
                    key={area.id}
                    type="button"
                    className={`${styles.option} ${preferences.stayAreaId === area.id ? styles.optionSelected : ''}`}
                    onClick={() => selectStayArea(area.id)}
                    aria-pressed={preferences.stayAreaId === area.id}
                  >
                    <div className={styles.optionLabel}>{area.label}</div>
                    <div className={styles.optionBlurb}>{area.blurb}</div>
                  </button>
                ))}
                <button
                  type="button"
                  className={`${styles.option} ${preferences.stayAreaId === 'custom' ? styles.optionSelected : ''}`}
                  onClick={() => setStayPickerOpen(true)}
                  aria-pressed={preferences.stayAreaId === 'custom'}
                >
                  <div className={styles.optionLabel}>
                    {preferences.stayAreaId === 'custom'
                      ? preferences.stayAreaLabel
                      : 'My hotel / home'}
                  </div>
                  <div className={styles.optionBlurb}>
                    Search or drop a pin — distances start from your exact stay.
                  </div>
                </button>
              </div>
              <StayLocationPicker open={stayPickerOpen} onClose={() => setStayPickerOpen(false)} />
            </>
          )}

          {step === 4 && (
            <>
              <h1 className={styles.question}>How will you get around?</h1>
              <p className={styles.hint}>Pick all that apply.</p>
              <div className={styles.optionGrid}>
                {TRANSPORT.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`${styles.option} ${preferences.transportation.includes(option.id) ? styles.optionSelected : ''}`}
                    onClick={() => toggleTransport(option.id)}
                    aria-pressed={preferences.transportation.includes(option.id)}
                  >
                    <div className={styles.optionLabel}>{option.label}</div>
                    <div className={styles.optionBlurb}>{option.blurb}</div>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 5 && (
            <>
              <h1 className={styles.question}>What pace suits you?</h1>
              <p className={styles.hint}>Sets how many stops a day we suggest.</p>
              <div className={styles.optionGrid}>
                {STYLES.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`${styles.option} ${preferences.travelStyle === option.id ? styles.optionSelected : ''}`}
                    onClick={() => update({ travelStyle: option.id })}
                    aria-pressed={preferences.travelStyle === option.id}
                  >
                    <div className={styles.optionLabel}>{option.label}</div>
                    <div className={styles.optionBlurb}>{option.blurb}</div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className={styles.footer}>
        <Button fullWidth size="lg" onClick={goNext}>
          {step === TOTAL_STEPS ? 'See my Bali' : 'Continue'}
        </Button>
      </div>
    </div>
  );
}
