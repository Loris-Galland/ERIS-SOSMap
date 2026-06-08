import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ERIS] Unhandled error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen w-full bg-gray-950 text-white px-6 text-center gap-4">
          <span className="material-symbols-outlined text-5xl text-red-500">error</span>
          <h1 className="text-xl font-bold">Une erreur inattendue s'est produite</h1>
          <p className="text-gray-400 text-sm">Redémarre l'application pour continuer.</p>
          <button
            className="mt-4 px-6 py-2 bg-red-600 rounded-full text-sm font-semibold"
            onClick={() => this.setState({ hasError: false })}
          >
            Réessayer
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
