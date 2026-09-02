import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: React.ReactNode;
  /** Small inline variant for widgets/cards instead of a full-page screen. */
  variant?: 'page' | 'inline';
  /** Optional label shown in the inline variant (e.g. "Widget Rezervări"). */
  label?: string;
  /** Custom fallback overriding the default UI. */
  fallback?: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Prinde erorile de randare pentru a evita ecranul alb.
 * - variant="page": ecran complet cu opțiuni de recuperare
 * - variant="inline": mesaj compact, restul paginii rămâne funcțional
 */
class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log local pentru diagnostic (nu blochează UI-ul)
    console.error('[ErrorBoundary]', this.props.label || 'app', error, info?.componentStack);
  }

  private reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    const { children, variant = 'page', label, fallback } = this.props;

    if (!error) return children;
    if (fallback) return fallback;

    if (variant === 'inline') {
      return (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground">
                {label ? `${label} nu a putut fi încărcat` : 'Această secțiune nu a putut fi încărcată'}
              </p>
              <p className="text-muted-foreground mt-1 break-words">
                {error.message || 'Eroare neașteptată.'}
              </p>
              <Button size="sm" variant="outline" className="mt-3" onClick={this.reset}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Reîncearcă
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-5">
            <AlertTriangle className="w-7 h-7 text-destructive" />
          </div>
          <h1 className="text-xl font-semibold text-foreground mb-2">A apărut o eroare neașteptată</h1>
          <p className="text-sm text-muted-foreground mb-1">
            Pagina nu a putut fi afișată. Datele tale nu au fost afectate.
          </p>
          <p className="text-xs text-muted-foreground/80 font-mono break-words mb-6">
            {error.message}
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Button onClick={() => window.location.reload()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Reîncarcă pagina
            </Button>
            <Button variant="outline" onClick={() => { window.location.href = '/'; }}>
              <Home className="w-4 h-4 mr-2" />
              Înapoi la Dashboard
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-6">
            Dacă problema persistă, raportează-o prin HelpDesk din secțiunea Setări.
          </p>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
