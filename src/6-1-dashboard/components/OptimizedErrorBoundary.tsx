
import React, { Component, ReactNode } from 'react';
import { ERROR_BOUNDARIES } from '@/utils/optimizedConstants';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  errorType?: keyof typeof ERROR_BOUNDARIES;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class OptimizedErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const { errorType = 'API_CALLS' } = this.props;
    
    console.error(`🚨 ${String(errorType)} Error Boundary:`, error, errorInfo);
    
    // Don't let third-party errors block the entire app
    if (errorType === 'THIRD_PARTY_SCRIPTS' || errorType === 'REDDIT_PIXEL') {
      console.warn('⚠️ Third-party script error caught and isolated');
      return;
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex items-center justify-center p-4 text-red-600">
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-2">Something went wrong</h3>
            <p className="text-sm text-gray-600">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default OptimizedErrorBoundary;
