import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public declare props: Readonly<Props>;
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error?.message || 'Terjadi kesalahan sistem.',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('App ErrorBoundary caught:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F4F7FB] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-3xl border border-red-200 shadow-lg p-6 text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Terjadi Kendala Aplikasi</h2>
              <p className="text-xs text-slate-500 mt-1 break-words">
                {this.state.errorMessage}
              </p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Muat Ulang Halaman
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
