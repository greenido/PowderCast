'use client';

import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  /** Shown in the fallback so the user knows which part failed. */
  label?: string;
  /** Custom fallback; overrides the default card. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Contains a render error to one subtree.
 *
 * Without this, a single bad value anywhere in the tree unmounts the whole
 * app and leaves a white page — which is exactly what a missing `country`
 * field did in production, and what a provider-shaped mismatch in Pro View
 * would do again. A card that says it broke is always better than an app
 * that vanishes.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      `[ErrorBoundary${this.props.label ? `: ${this.props.label}` : ''}]`,
      error,
      info.componentStack
    );
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div className="glass-card border border-red-400/25 text-center">
        <div className="mb-2 text-2xl">⚠️</div>
        <h3 className="text-sm font-bold text-white">
          {this.props.label ? `${this.props.label} failed to render` : 'Something went wrong'}
        </h3>
        <p className="mx-auto mt-1 max-w-md text-xs text-gray-400">
          The rest of the page is unaffected. If this keeps happening, the
          forecast data for this resort may be in an unexpected shape.
        </p>
        <button
          onClick={this.reset}
          className="mt-4 rounded-lg border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/20"
        >
          Try again
        </button>
      </div>
    );
  }
}
