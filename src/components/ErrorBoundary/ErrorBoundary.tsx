import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { EmptyState } from '@/components/EmptyState';

interface Props {
  children: ReactNode;
  /** Named in the fallback so the user knows what broke. */
  label?: string;
}

interface State {
  error: Error | null;
}

/** A real message and a retry — never a white screen. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', this.props.label ?? '', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 'var(--gutter)' }}>
          <EmptyState
            icon="⚠"
            title="Something broke"
            message={
              this.props.label
                ? `The ${this.props.label} screen hit an error. Reloading usually clears it.`
                : 'This screen hit an error. Reloading usually clears it.'
            }
            action={{ label: 'Reload', onClick: () => window.location.reload() }}
          />
        </div>
      );
    }

    return this.props.children;
  }
}
