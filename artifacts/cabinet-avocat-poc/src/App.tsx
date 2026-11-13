import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Router, Switch } from 'wouter';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SessionProvider, useSession } from '@/hooks/use-session';
import { AppShell } from '@/components/app/AppShell';
import { LoadingState } from '@/components/app/common';
import { isUnauthorized } from '@/lib/api';
import LoginPage from '@/pages/login';
import NotFound from '@/pages/not-found';

const Dashboard = lazy(() => import('@/pages/dashboard'));
const Clients = lazy(() => import('@/pages/clients'));
const ClientDetail = lazy(() => import('@/pages/client-detail'));
const Dossiers = lazy(() => import('@/pages/dossiers'));
const DossierDetail = lazy(() => import('@/pages/dossier-detail'));
const Demarches = lazy(() => import('@/pages/demarches'));
const Agenda = lazy(() => import('@/pages/agenda'));
const Taches = lazy(() => import('@/pages/taches'));
const Documents = lazy(() => import('@/pages/documents'));
const Requetes = lazy(() => import('@/pages/requetes'));
const RequeteEditor = lazy(() => import('@/pages/requete-editor'));
const Modeles = lazy(() => import('@/pages/modeles'));
const Facturation = lazy(() => import('@/pages/facturation'));
const Utilisateurs = lazy(() => import('@/pages/utilisateurs'));
const Journal = lazy(() => import('@/pages/journal'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
      retry: (count, err) => !isUnauthorized(err) && count < 1,
    },
  },
});

// Session expirée pendant l'utilisation : retour à l'écran de connexion.
queryClient.getQueryCache().subscribe((event) => {
  if (event.type === 'updated' && event.query.state.status === 'error' && isUnauthorized(event.query.state.error)) {
    if (event.query.queryKey[0] !== 'session') queryClient.setQueryData(['session'], null);
  }
});

function ProtectedApp() {
  const { session, loading } = useSession();
  if (loading) return <LoadingState label="Ouverture de la session…" className="min-h-screen" />;
  if (!session) return <LoginPage />;
  return (
    <AppShell>
      <Suspense fallback={<LoadingState />}>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/clients" component={Clients} />
          <Route path="/clients/:id" component={ClientDetail} />
          <Route path="/dossiers" component={Dossiers} />
          <Route path="/dossiers/:id" component={DossierDetail} />
          <Route path="/demarches" component={Demarches} />
          <Route path="/agenda" component={Agenda} />
          <Route path="/taches" component={Taches} />
          <Route path="/documents" component={Documents} />
          <Route path="/requetes" component={Requetes} />
          <Route path="/requetes/:id" component={RequeteEditor} />
          <Route path="/modeles" component={Modeles} />
          <Route path="/facturation" component={Facturation} />
          <Route path="/utilisateurs" component={Utilisateurs} />
          <Route path="/journal" component={Journal} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </AppShell>
  );
}

const base = import.meta.env.BASE_URL.replace(/\/$/, '');

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SessionProvider>
          <Router base={base}>
            <ProtectedApp />
          </Router>
        </SessionProvider>
        <Toaster theme="light" position="top-right" richColors closeButton />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
