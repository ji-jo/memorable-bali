import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { EmptyState } from '@/components/EmptyState';

interface Props {
  children: ReactNode;
  /** Named in the fallback so the user knows what broke. */
  label?: string;
  /** Clear the captured error when this value changes (e.g. route pathname). */
  resetKey?: string;
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

  componentDidUpdate(prevProps: Props) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
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
            action={{
              label: 'Reload',
              onClick: () => {
                this.setState({ error: null });
                window.location.reload();
              },
            }}
          />
          {import.meta.env.DEV ? (
            <pre
              style={{
                marginTop: 'var(--space-4)',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface-sunken)',
                color: 'var(--color-text-secondary)',
                fontSize: 'var(--text-xs)',
                whiteSpace: 'pre-wrap',
                overflow: 'auto',
              }}
            >
              {this.state.error.message}
            </pre>
          ) : null}
        </div>
      );
    }

    return this.props.children;
  }
}
