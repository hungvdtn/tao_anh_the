import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
          <div className="max-w-md w-full bg-white rounded-[32px] shadow-2xl shadow-slate-200 p-8 border border-slate-100 text-center space-y-6">
            <div className="w-20 h-20 bg-red-50 rounded-[28px] flex items-center justify-center mx-auto">
              <AlertCircle className="w-10 h-10 text-red-500" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-extrabold text-slate-900">Đã xảy ra lỗi</h1>
              <p className="text-slate-500 font-medium">
                Ứng dụng đã gặp một lỗi không mong muốn. Đừng lo lắng, bạn có thể thử tải lại trang.
              </p>
            </div>

            {this.state.error && (
              <div className="p-4 bg-slate-50 rounded-2xl text-left overflow-auto max-h-32">
                <code className="text-xs text-slate-600 break-all">
                  {this.state.error.toString()}
                </code>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button
                onClick={this.handleReset}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-100"
              >
                <RefreshCw className="w-5 h-5" />
                Tải lại trang
              </button>
              <button
                onClick={this.handleGoHome}
                className="w-full py-4 bg-white border-2 border-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
              >
                <Home className="w-5 h-5" />
                Về trang chủ
              </button>
            </div>

            <p className="text-xs text-slate-400 font-medium">
              Nếu lỗi vẫn tiếp diễn, vui lòng liên hệ với quản trị viên.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
