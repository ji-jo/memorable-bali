import { EmptyState } from '@/components/EmptyState';

export default function NotFound() {
  return (
    <div style={{ padding: 'var(--space-8) var(--gutter)', maxWidth: '40rem', margin: '0 auto' }}>
      <EmptyState
        icon="◌"
        title="Nothing here"
        message="That page doesn't exist. The curated places all live under Explore."
        action={{ label: 'Go to Home', to: '/home' }}
      />
    </div>
  );
}
