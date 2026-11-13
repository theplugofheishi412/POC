import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  BookText,
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  FileStack,
  FileText,
  FolderOpen,
  Gavel,
  KanbanSquare,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  RotateCcw,
  ScrollText,
  Search,
  ShieldCheck,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { ROLE_LABELS, type NotificationDTO, type Permission, type SearchResultDTO } from '@workspace/api-zod';
import { useSession } from '@/hooks/use-session';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { relativeTime } from '@/lib/format';
import { Avatar, ConfirmDialog, useDebounced } from './common';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: Permission;
}

const NAV: { label: string; items: NavItem[] }[] = [
  { label: 'Pilotage', items: [{ href: '/', label: 'Tableau de bord', icon: LayoutDashboard }] },
  {
    label: 'Activité du cabinet',
    items: [
      { href: '/clients', label: 'Clients & justiciables', icon: UsersRound },
      { href: '/dossiers', label: 'Dossiers', icon: FolderOpen },
      { href: '/demarches', label: 'Démarches au palais', icon: Landmark },
      { href: '/agenda', label: 'Agenda & audiences', icon: CalendarDays },
      { href: '/taches', label: 'Tâches', icon: KanbanSquare },
    ],
  },
  {
    label: 'Production documentaire',
    items: [
      { href: '/documents', label: 'Pièces & bordereaux', icon: FileStack, permission: 'documents.read' },
      { href: '/requetes', label: 'Requêtes & actes', icon: ScrollText, permission: 'documents.read' },
      { href: '/modeles', label: 'Modèles', icon: BookText, permission: 'documents.read' },
    ],
  },
  {
    label: 'Gestion',
    items: [
      { href: '/facturation', label: 'Facturation', icon: Receipt, permission: 'billing.read' },
      { href: '/utilisateurs', label: 'Utilisateurs & rôles', icon: UserRound },
      { href: '/journal', label: 'Journal d’audit', icon: ShieldCheck, permission: 'audit.read' },
    ],
  },
];

function isActive(location: string, href: string) {
  return href === '/' ? location === '/' : location === href || location.startsWith(`${href}/`);
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();
  const { can, session } = useSession();
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 px-5 pb-5 pt-6">
        <span className="grid size-9 place-items-center rounded-lg bg-[#c9a55a]/15 ring-1 ring-[#c9a55a]/40">
          <Gavel className="size-[18px] text-[#d9b86e]" />
        </span>
        <div className="min-w-0">
          <div className="font-serif text-[17px] font-semibold leading-tight text-white">TechSolution</div>
          <div className="truncate text-[11px] uppercase tracking-[0.16em] text-[#c9a55a]">Cabinet</div>
        </div>
      </div>
      <div className="mx-5 mb-4 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5">
        <div className="truncate text-xs font-medium text-white">{session?.cabinet.name}</div>
        <div className="text-[11px] text-sidebar-foreground/60">{session?.cabinet.city} · données fictives</div>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-6" aria-label="Navigation principale">
        {NAV.map((group) => {
          const items = group.items.filter((i) => !i.permission || can(i.permission));
          if (!items.length) return null;
          return (
            <div key={group.label}>
              <div className="mb-1.5 px-3 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/45">{group.label}</div>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active = isActive(location, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        className={cn(
                          'relative flex items-center gap-3 rounded-md px-3 py-2 text-[13.5px] transition-colors',
                          active ? 'bg-white/[0.09] font-medium text-white' : 'text-sidebar-foreground/80 hover:bg-white/[0.05] hover:text-white',
                        )}
                        aria-current={active ? 'page' : undefined}
                      >
                        {active && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-[#c9a55a]" />}
                        <item.icon className={cn('size-[17px]', active ? 'text-[#d9b86e]' : 'text-sidebar-foreground/60')} />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
      <div className="border-t border-white/10 px-5 py-4 text-[11px] leading-relaxed text-sidebar-foreground/50">
        Prototype de démonstration — les documents générés sont des modèles à valider par un avocat.
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Recherche globale (Ctrl + K)                                       */
/* ------------------------------------------------------------------ */

function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const debounced = useDebounced(q, 250);
  const [, navigate] = useLocation();
  const { data, isFetching } = useQuery({
    queryKey: ['search', debounced],
    queryFn: () => api.get<SearchResultDTO>('/search', { q: debounced }),
    enabled: open && debounced.length >= 2,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    setQ('');
    navigate(href);
  };
  const total = (data?.clients.length ?? 0) + (data?.dossiers.length ?? 0) + (data?.documents.length ?? 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full max-w-md items-center gap-2 rounded-md border border-input bg-background/60 px-3 text-sm text-muted-foreground transition-colors hover:border-[#b08d3c]/60"
      >
        <Search className="size-4" />
        <span className="min-w-0 flex-1 truncate text-left"><span className="sm:hidden">Rechercher…</span><span className="hidden sm:inline">Rechercher un client, un dossier, un document…</span></span>
        <kbd className="hidden rounded border border-border bg-card px-1.5 text-[10px] font-medium sm:inline">Ctrl K</kbd>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-xl">
          <DialogTitle className="sr-only">Recherche globale</DialogTitle>
          <Command shouldFilter={false}>
            <CommandInput value={q} onValueChange={setQ} placeholder="Nom, raison sociale, référence DOS-…, document…" />
            <CommandList className="max-h-[60vh]">
              {debounced.length < 2 ? (
                <div className="px-4 py-6 text-center text-xs text-muted-foreground">Saisissez au moins 2 caractères.</div>
              ) : (
                <>
                  {!isFetching && total === 0 && <CommandEmpty>Aucun résultat pour « {debounced} ».</CommandEmpty>}
                  {!!data?.dossiers.length && (
                    <CommandGroup heading="Dossiers">
                      {data.dossiers.map((d) => (
                        <CommandItem key={`d${d.id}`} value={`d${d.id}`} onSelect={() => go(`/dossiers/${d.id}`)}>
                          <FolderOpen className="text-muted-foreground" />
                          <span className="font-mono text-xs text-muted-foreground">{d.reference}</span>
                          <span className="truncate">{d.title}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                  {!!data?.clients.length && (
                    <CommandGroup heading="Clients">
                      {data.clients.map((c) => (
                        <CommandItem key={`c${c.id}`} value={`c${c.id}`} onSelect={() => go(`/clients/${c.id}`)}>
                          {c.type === 'morale' ? <BriefcaseBusiness className="text-muted-foreground" /> : <UserRound className="text-muted-foreground" />}
                          <span className="truncate">{c.displayName}</span>
                          {c.city && <span className="ml-auto text-xs text-muted-foreground">{c.city}</span>}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                  {!!data?.documents.length && (
                    <CommandGroup heading="Documents">
                      {data.documents.map((doc) => (
                        <CommandItem key={`f${doc.id}`} value={`f${doc.id}`} onSelect={() => go(`/dossiers/${doc.dossierId}?onglet=documents`)}>
                          <FileText className="text-muted-foreground" />
                          <span className="truncate">{doc.name}</span>
                          <span className="ml-auto font-mono text-xs text-muted-foreground">{doc.dossierReference}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </>
              )}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Notifications                                                      */
/* ------------------------------------------------------------------ */

const READ_KEY = 'cabinet.notifications.read';
function readSet(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(READ_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

const KIND_STYLE: Record<NotificationDTO['kind'], string> = {
  rappel: 'bg-[#14213d]',
  retard: 'bg-red-500',
  validation: 'bg-amber-500',
  assignation: 'bg-[#b08d3c]',
};

function Notifications() {
  const [, navigate] = useLocation();
  const [read, setRead] = useState<Set<string>>(readSet);
  const { data = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<NotificationDTO[]>('/notifications'),
    refetchInterval: 60_000,
  });
  const unread = data.filter((n) => !read.has(n.id)).length;
  const markAll = () => {
    const next = new Set([...read, ...data.map((n) => n.id)]);
    setRead(next);
    try {
      localStorage.setItem(READ_KEY, JSON.stringify([...next].slice(-300)));
    } catch {
      /* stockage indisponible : sans conséquence */
    }
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications (${unread} non lues)`}>
          <Bell className="size-[18px]" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-4 text-white">{unread}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-semibold">Notifications & rappels</span>
          {unread > 0 && (
            <button className="text-xs text-[#8a6d2b] hover:underline" onClick={markAll}>
              Tout marquer comme lu
            </button>
          )}
        </div>
        <ul className="max-h-[420px] divide-y overflow-y-auto">
          {data.length === 0 && <li className="px-4 py-8 text-center text-xs text-muted-foreground">Aucune notification.</li>}
          {data.map((n) => (
            <li key={n.id}>
              <button
                className={cn('flex w-full gap-3 px-4 py-3 text-left hover:bg-muted/60', !read.has(n.id) && 'bg-[#fbf7ee]')}
                onClick={() => {
                  markAll();
                  navigate(n.href);
                }}
              >
                <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', KIND_STYLE[n.kind])} />
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium">{n.title}</span>
                  <span className="block text-xs text-muted-foreground">{n.body}</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground/80">{relativeTime(n.date)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------------------------------------------ */
/* Profil                                                             */
/* ------------------------------------------------------------------ */

function UserMenu() {
  const { session, logout, can } = useSession();
  const [, navigate] = useLocation();
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const qc = useQueryClient();
  if (!session) return null;
  const u = session.user;
  const reset = async () => {
    setResetting(true);
    try {
      await api.post('/demo/reset');
      qc.clear();
      qc.setQueryData(['session'], null);
      toast.success('Données de démonstration réinitialisées. Reconnectez-vous.');
      navigate('/');
    } catch {
      toast.error('La réinitialisation a échoué.');
    } finally {
      setResetting(false);
      setConfirmReset(false);
    }
  };
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2.5 rounded-md px-1.5 py-1 hover:bg-muted">
            <Avatar name={u.fullName} />
            <span className="hidden text-left leading-tight md:block">
              <span className="block text-[13px] font-medium">{u.fullName}</span>
              <span className="block text-[11px] text-muted-foreground">{ROLE_LABELS[u.role]}</span>
            </span>
            <ChevronDown className="hidden size-4 text-muted-foreground md:block" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="font-normal">
            <div className="text-sm font-medium">{u.fullName}</div>
            <div className="text-xs text-muted-foreground">{u.email}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => navigate('/utilisateurs')}>
            <ShieldCheck /> Mes droits d’accès
          </DropdownMenuItem>
          {can('demo.reset') && (
            <DropdownMenuItem onSelect={() => setConfirmReset(true)}>
              <RotateCcw /> Réinitialiser la démo
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={async () => {
              await logout();
              navigate('/');
            }}
          >
            <LogOut /> Se déconnecter
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Réinitialiser les données de démonstration ?"
        description="Toutes les modifications effectuées pendant la démonstration seront effacées et le jeu de données d’origine rechargé. Tous les utilisateurs seront déconnectés."
        confirmLabel="Réinitialiser"
        destructive
        pending={resetting}
        onConfirm={reset}
      />
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);
  const year = useMemo(() => new Date().getFullYear(), []);

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-[264px] lg:block">
        <SidebarContent />
      </aside>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[280px] border-none p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarContent onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col lg:pl-[264px]">
        <header className="no-print sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-card/90 px-4 backdrop-blur sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Ouvrir le menu">
            <Menu />
          </Button>
          <div className="min-w-0 flex-1">
            <GlobalSearch />
          </div>
          <Notifications />
          <UserMenu />
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        <footer className="no-print border-t border-border px-6 py-4 text-center text-[11px] text-muted-foreground">
          © {year} TechSolution — Prototype (POC) de gestion de cabinet d’avocats. Données entièrement fictives.
        </footer>
      </div>
    </div>
  );
}
