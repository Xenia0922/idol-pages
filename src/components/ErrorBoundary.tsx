import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="frost-card p-6 text-center max-w-md mx-auto">
          <p className="text-lg font-bold text-gray-700 dark:text-gray-200 mb-2">
            出了点问题
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-3">
            {this.state.error?.message || '未知错误'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="btn-pink text-xs !px-4 !py-1.5"
          >
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
