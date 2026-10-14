import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

// Catches render crashes anywhere in the tree and shows the actual error
// instead of an unexplained white screen.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('UI crashed:', error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 p-4 sm:p-6 max-w-lg w-full text-center">
            <AlertTriangle className="w-12 h-12 mx-auto text-amber-500 dark:text-amber-400 mb-3" />
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-slate-100">Something went wrong</h1>
            <p className="text-sm text-gray-600 dark:text-slate-400 mt-2">
              The app hit an unexpected error. Reload to recover - if it keeps
              happening, the details below say why.
            </p>
            <pre className="mt-4 p-3 bg-gray-50 dark:bg-slate-800/60 rounded-lg text-xs text-red-600 dark:text-red-400 text-left whitespace-pre-wrap break-words">
              {String(this.state.error?.message || this.state.error)}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 w-full sm:w-auto inline-flex items-center justify-center px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors touch-manipulation min-h-[44px]"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
