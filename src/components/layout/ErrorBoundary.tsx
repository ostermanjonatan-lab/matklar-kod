import React from 'react';

interface State {
  failed: boolean;
}

/**
 * If something in the app breaks, this page is shown instead of a blank white screen.
 * Everything saved is still there; loading the app again usually helps.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    console.error('MatKlar stopped with an error:', error, info.componentStack);
  }

  render(): React.ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="min-h-[100dvh] bg-[#FCFAF5] font-sans px-6 pt-16 max-w-md mx-auto">
        <h1 className="font-serif font-bold text-2xl text-stone-900">Något gick fel</h1>
        <p className="mt-2 text-base text-stone-600">
          Appen stötte på ett fel. Dina recept, planeraren och inköpslistan finns kvar.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 min-h-[50px] px-6 rounded-2xl bg-[#284235] text-white text-sm font-semibold touch-manipulation"
        >
          Ladda om
        </button>
      </div>
    );
  }
}
