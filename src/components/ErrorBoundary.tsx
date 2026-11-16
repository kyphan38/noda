'use client';

import React from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary min-h-screen flex items-center justify-center bg-gray-950 text-gray-100 p-6">
          <div className="error-content max-w-md text-center space-y-4">
            <h2 className="text-xl font-bold text-white">Something went wrong</h2>
            <p className="error-message text-sm text-gray-400">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <Button type="button" onClick={() => window.location.reload()}>
              Reload App
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
