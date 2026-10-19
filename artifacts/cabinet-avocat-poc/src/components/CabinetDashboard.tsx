import { useMemo, useState, type FormEvent } from 'react';
import {
  Activity, Archive, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, CalendarDays,
  Check, ChevronDown, ChevronLeft, ChevronRight, CircleAlert, Clock3, CreditCard,
  Download, FileClock, FileText, FolderOpen, Gavel, LayoutDashboard, LockKeyhole,
  MoreHorizontal, Plus, Search, ShieldCheck, SlidersHorizontal, Sparkles, UserRound,
  UsersRound, X,
} from 'lucide-react';
import AgendaCalendar, { type AgendaCalendarEvent } from './AgendaCalendar';

type Section = 'Vue d’ensemble' | 'Clients' | 'Dossiers' | 'Audiences' | 'Agenda' | 'Échéances' | 'Documents' | 'Honoraires' | 'Paiements' | 'Utilisateurs' | 'Activité';
type RecordItem = { id: string; title: string; subtitle: string; status: string; date: string; kind: string; calendarDay?: number; calendarTime?: string };
type DataSection = Exclude<Section, 'Vue d’ensemble'>;

const agendaDayNames: Record<number, string> = {
  16: 'Lundi',
  17: 'Mardi',
  18: 'Mercredi',
  19: 'Jeudi',
  20: 'Vendredi',
  21: 'Samedi',
  22: 'Dimanche',
};

const navGroups = [
  { label: 'ESPACE DE TRAVAIL', items: [{ name: 'Vue d’ensemble' as Section, icon: LayoutDashboard }] },
  { label: 'SUIVI DU CABINET', items: [
    { name: 'Clients' as Section, icon: UsersRound }, { name: 'Dossiers' as Section, icon: FolderOpen },
    { name: 'Audiences' as Section, icon: Gavel }, { name: 'Agenda' as Section, icon: CalendarDays },
    { name: 'Échéances' as Section, icon: FileClock },
  ] },
  { label: 'RESSOURCES', items: [
    { name: 'Documents' as Section, icon: FileText }, { name: 'Honoraires' as Section, icon: CreditCard },
    { name: 'Paiements' as Section, icon: CreditCard }, { name: 'Utilisateurs' as Section, icon: UserRound },
    { name: 'Activité' as Section, icon: Activity },
  ] },
];

const seedRecords: Record<DataSection, RecordItem[]> = {
  Clients: [
    { id: 'CL-024', title: 'Société Ndar Industrie', subtitle: 'Entreprise · Saint-Louis', status: 'Actif', date: '12 juin 2025', kind: 'Client' },
    { id: 'CL-023', title: 'Aminata Diop', subtitle: 'Particulier · Dakar', status: 'Actif', date: '10 juin 2025', kind: 'Cliente' },
    { id: 'CL-021', title: 'Groupe Saly Invest', subtitle: 'Entreprise · Mbour', status: 'À suivre', date: '06 juin 2025', kind: 'Client' },
    { id: 'CL-018', title: 'Mamadou Fall', subtitle: 'Particulier · Thiès', status: 'Actif', date: '29 mai 2025', kind: 'Client' },
  ],
  Dossiers: [
    { id: 'DOS-2025-041', title: 'Ndar Industrie c. Ba & Fils', subtitle: 'Droit commercial · Me A. Ndiaye', status: 'En cours', date: 'Audience · 24 juin', kind: 'Contentieux' },
    { id: 'DOS-2025-038', title: 'Succession Diop', subtitle: 'Droit de la famille · Me S. Mbaye', status: 'En cours', date: 'Pièce attendue · 20 juin', kind: 'Conseil' },
    { id: 'DOS-2025-032', title: 'Bail commercial — Saly', subtitle: 'Droit immobilier · Me A. Ndiaye', status: 'En attente', date: 'Mis à jour · 12 juin', kind: 'Conseil' },
    { id: 'DOS-2025-027', title: 'Litige foncier, Rufisque', subtitle: 'Droit foncier · Me M. Cissé', status: 'En cours', date: 'Audience · 02 juil.', kind: 'Contentieux' },
  ],
  Audiences: [
    { id: 'AUD-0624', title: 'Ndar Industrie c. Ba & Fils', subtitle: 'Tribunal de commerce · Dakar', status: 'À préparer', date: 'Mar. 24 juin · 09:00', kind: 'Mise en état' },
    { id: 'AUD-0626', title: 'Succession Diop', subtitle: 'Tribunal de grande instance · Dakar', status: 'Confirmée', date: 'Jeu. 26 juin · 11:30', kind: 'Conciliation' },
    { id: 'AUD-0702', title: 'Litige foncier, Rufisque', subtitle: 'Tribunal de grande instance · Rufisque', status: 'Confirmée', date: 'Mer. 02 juil. · 08:30', kind: 'Plaidoirie' },
  ],
  Agenda: [
    { id: 'RDV-0618', title: 'Rendez-vous · Aminata Diop', subtitle: 'Cabinet · Me S. Mbaye', status: 'Confirmé', date: 'Mardi 17 juin · 10:30', kind: 'Rendez-vous', calendarDay: 17, calendarTime: '10:30' },
    { id: 'RDV-0618b', title: 'Revue de pièces · Ndar Industrie', subtitle: 'Salle de réunion · Me A. Ndiaye', status: 'Confirmé', date: 'Mardi 17 juin · 14:00', kind: 'Réunion', calendarDay: 17, calendarTime: '14:00' },
    { id: 'RDV-0619', title: 'Consultation · M. Fall', subtitle: 'Visioconférence · Me M. Cissé', status: 'À confirmer', date: 'Mercredi 18 juin · 09:00', kind: 'Consultation', calendarDay: 18, calendarTime: '09:00' },
  ],
  'Échéances': [
    { id: 'ECH-0619', title: 'Conclusions en réponse', subtitle: 'Ndar Industrie c. Ba & Fils', status: 'Urgent', date: 'Demain · 17:00', kind: 'Procédure' },
    { id: 'ECH-0620', title: 'Transmettre les pièces au notaire', subtitle: 'Succession Diop', status: 'À venir', date: 'Ven. 20 juin', kind: 'Dossier' },
    { id: 'ECH-0624', title: 'Audience de mise en état', subtitle: 'Ndar Industrie c. Ba & Fils', status: 'À venir', date: 'Mar. 24 juin · 09:00', kind: 'Audience' },
  ],
  Documents: [
    { id: 'DOC-118', title: 'Projet de conclusions en réponse', subtitle: 'Ndar Industrie c. Ba & Fils · PDF', status: 'À relire', date: 'Modifié · 17 juin', kind: 'Conclusions' },
    { id: 'DOC-112', title: 'Mandat de représentation', subtitle: 'Succession Diop · DOCX', status: 'Validé', date: 'Modifié · 16 juin', kind: 'Mandat' },
    { id: 'DOC-106', title: 'Convention d’honoraires', subtitle: 'Groupe Saly Invest · PDF', status: 'Signé', date: 'Modifié · 12 juin', kind: 'Convention' },
  ],
  Honoraires: [
    { id: 'FAC-2025-019', title: 'Facture · Ndar Industrie', subtitle: 'DOS-2025-041 · Échéance 30 juin', status: 'À régler', date: '480 000 FCFA', kind: 'Facture' },
    { id: 'FAC-2025-017', title: 'Provision · Succession Diop', subtitle: 'DOS-2025-038 · Échéance 20 juin', status: 'En attente', date: '250 000 FCFA', kind: 'Provision' },
    { id: 'FAC-2025-014', title: 'Consultation · M. Fall', subtitle: 'DOS-2025-029 · Réglée le 12 juin', status: 'Réglé', date: '75 000 FCFA', kind: 'Facture' },
  ],
  Paiements: [
    { id: 'PAY-2025-026', title: 'Règlement · Groupe Saly Invest', subtitle: 'DOS-2025-032 · Réf. VRT-9041', status: 'Enregistré', date: '350 000 FCFA · 14 juin', kind: 'Virement' },
    { id: 'PAY-2025-024', title: 'Provision · Succession Diop', subtitle: 'DOS-2025-038 · Réf. ESP-2186', status: 'Partiel', date: '125 000 FCFA · 11 juin', kind: 'Espèces' },
    { id: 'PAY-2025-019', title: 'Consultation · Aminata Diop', subtitle: 'DOS-2025-029 · Réf. CHQ-1103', status: 'Enregistré', date: '75 000 FCFA · 06 juin', kind: 'Chèque' },
  ],
  Utilisateurs: [
    { id: 'USR-01', title: 'Me Aïssatou Ndiaye', subtitle: 'Avocate · Associée', status: 'Actif', date: 'Dernière activité · 09:42', kind: 'Équipe' },
    { id: 'USR-02', title: 'Me Saliou Mbaye', subtitle: 'Avocat · Collaborateur', status: 'Actif', date: 'Dernière activité · 09:18', kind: 'Équipe' },
    { id: 'USR-03', title: 'Me Marième Cissé', subtitle: 'Avocate · Collaboratrice', status: 'Actif', date: 'Dernière activité · Hier', kind: 'Équipe' },
    { id: 'USR-04', title: 'Fatou Sarr', subtitle: 'Assistante juridique', status: 'Actif', date: 'Dernière activité · Hier', kind: 'Équipe' },
  ],
  Activité: [
    { id: 'ACT-0942', title: 'Document ajouté au dossier', subtitle: 'Me Saliou Mbaye · Succession Diop', status: 'Aujourd’hui', date: '09:42', kind: 'Document' },
    { id: 'ACT-0918', title: 'Échéance mise à jour', subtitle: 'Fatou Sarr · Ndar Industrie c. Ba & Fils', status: 'Aujourd’hui', date: '09:18', kind: 'Échéance' },
    { id: 'ACT-1640', title: 'Note de rendez-vous ajoutée', subtitle: 'Me Aïssatou Ndiaye · Aminata Diop', status: 'Hier', date: '16:40', kind: 'Note' },
  ],
};

const sectionIntro: Record<Section, string> = {
  'Vue d’ensemble': 'Le fil clair de votre journée.',
  Clients: 'Les personnes et organisations que vous accompagnez.',
  Dossiers: 'Un suivi net, de l’ouverture à la clôture.',
  Audiences: 'Les prochaines étapes devant les juridictions.',
  Agenda: 'Les rendez-vous et temps forts du cabinet.',
  'Échéances': 'Ce qui mérite votre attention, au bon moment.',
  Documents: 'Les pièces utiles, réunies au même endroit.',
  Honoraires: 'Un aperçu des provisions et règlements du cabinet.',
  Paiements: 'Les règlements enregistrés, rapprochés de leur dossier.',
  Utilisateurs: 'Les membres de l’équipe de démonstration.',
  Activité: 'Les derniers mouvements sur les dossiers fictifs.',
};

function CabinetDashboard() {
  const [active, setActive] = useState<Section>('Vue d’ensemble');
  const [query, setQuery] = useState('');
  const [globalQuery, setGlobalQuery] = useState('');
  const [filter, setFilter] = useState('Tout');
  const [modal, setModal] = useState<'new' | 'detail' | null>(null);
  const [selected, setSelected] = useState<RecordItem | null>(null);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDetail, setDraftDetail] = useState('');
  const [toast, setToast] = useState('');
  const [agendaPositions, setAgendaPositions] = useState<Record<string, { calendarDay: number; calendarTime: string }>>({});
  const [extraRecords, setExtraRecords] = useState<Record<DataSection, RecordItem[]>>({
    Clients: [], Dossiers: [], Audiences: [], Agenda: [], 'Échéances': [], Documents: [],
    Honoraires: [], Paiements: [], Utilisateurs: [], Activité: [],
  });
  const currentSection = active === 'Vue d’ensemble' ? null : active;
  const baseRecords = currentSection ? [...seedRecords[currentSection], ...extraRecords[currentSection]] : [];
  const allRecords = currentSection === 'Agenda'
    ? baseRecords.map((item) => {
      const position = agendaPositions[item.id];
      return position
        ? {
          ...item,
          ...position,
          date: `${agendaDayNames[position.calendarDay]} ${position.calendarDay} juin · ${position.calendarTime}`,
        }
        : item;
    })
    : baseRecords;
  const visibleRecords = useMemo(() => allRecords.filter((item) => {
    const matches = `${item.id} ${item.title} ${item.subtitle} ${item.status} ${item.kind}`.toLowerCase().includes(query.toLowerCase());
    return matches && (filter === 'Tout' || item.status === filter);
  }), [allRecords, filter, query]);
  const calendarEvents = visibleRecords.filter(
    (item): item is AgendaCalendarEvent => typeof item.calendarDay === 'number' && typeof item.calendarTime === 'string',
  );
  const globalResults = useMemo(() => Object.values(seedRecords).flat().filter((item) =>
    `${item.id} ${item.title} ${item.subtitle}`.toLowerCase().includes(globalQuery.toLowerCase()),
  ).slice(0, 5), [globalQuery]);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2800);
  };
  const changeSection = (section: Section) => {
    setActive(section);
    setQuery('');
    setFilter('Tout');
    setNoticeOpen(false);
  };
  const openNew = () => {
    setDraftTitle('');
    setDraftDetail('');
    setModal('new');
  };
  const openDetail = (item: RecordItem) => {
    setSelected(item);
    setModal('detail');
  };
  const moveAgendaEvent = (eventId: string, day: number, time: string) => {
    setAgendaPositions((positions) => ({
      ...positions,
      [eventId]: { calendarDay: day, calendarTime: time },
    }));
    notify(`Rendez-vous déplacé au ${agendaDayNames[day].toLowerCase()} ${day} juin à ${time}. Modifications temporaires.`);
  };
  const createRecord = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draftTitle.trim()) return;
    const target: DataSection = currentSection ?? 'Activité';
    const item: RecordItem = {
      id: `DÉMO-${String(Object.values(extraRecords).flat().length + 1).padStart(2, '0')}`,
      title: draftTitle.trim(),
      subtitle: draftDetail.trim() || 'Ajout local de démonstration',
      status: 'Nouveau',
      date: 'À l’instant',
      kind: currentSection ?? 'Note',
      ...(target === 'Agenda' ? { calendarDay: 17, calendarTime: '08:00', date: 'Mardi 17 juin · 08:00' } : {}),
    };
    setExtraRecords((records) => ({ ...records, [target]: [item, ...records[target]] }));
    setDraftTitle('');
    setDraftDetail('');
    setModal(null);
    notify('Élément ajouté à cette démonstration.');
  };
  return (
    <div className="cabinet-app">
      <div className="cabinet-shell">
        <aside className="cabinet-sidebar">
          <div className="brand" data-testid="brand-techsolution">
            <div className="brand-mark"><Gavel /></div>
            <div><div className="brand-name">TechSolution</div><div className="brand-sub">Espace cabinet</div></div>
          </div>
          <button className="firm-switch" data-testid="button-firm-switch" onClick={() => notify('Sélecteur de cabinet — aperçu de démonstration.')}>
            <span className="firm-stamp">N</span><span className="firm-label">Ndiaye &amp; Associés<small>Dakar · Sénégal</small></span><ChevronDown />
          </button>
          <nav aria-label="Navigation principale" data-testid="navigation-main">
            {navGroups.map((group) => (
              <div className="nav-group" key={group.label}>
                <div className="nav-caption">{group.label}</div>
                {group.items.map(({ name, icon: Icon }) => (
                  <button key={name} data-testid={`nav-${name.toLowerCase().replaceAll(' ', '-')}`} className={`nav-item ${active === name ? 'is-active' : ''}`} onClick={() => changeSection(name)}>
                    <Icon /><span>{name}</span>{name === 'Échéances' && <span className="nav-count">3</span>}
                  </button>
                ))}
              </div>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="help-note"><strong><ShieldCheck /> Votre espace de travail</strong><p>Prototype de présentation. Les données affichées sont fictives et les actions ne sont ni sauvegardées ni réelles.</p></div>
            <div className="user-panel"><div className="avatar">AN</div><div><div className="user-name">Me Aïssatou Ndiaye</div><div className="user-role">Associée · Démo</div></div>
              <button className="user-menu" aria-label="Options du profil" data-testid="button-profile-options" onClick={() => notify('Profil de démonstration.')}><MoreHorizontal /></button>
            </div>
          </div>
        </aside>

        <main className="cabinet-main">
          <header className="topbar">
            <div className="crumb"><span>Cabinet</span><ChevronRight /><strong>{active}</strong></div>
            <div className="top-actions">
              <div className="global-search-wrap">
                <label className="global-search"><Search /><input data-testid="input-global-search" aria-label="Recherche globale" placeholder="Rechercher un dossier…" value={globalQuery} onChange={(event) => setGlobalQuery(event.target.value)} /></label>
                {globalQuery.length > 1 && <div className="global-results" data-testid="global-search-results">
                  {globalResults.length ? globalResults.map((result) => <button key={`${result.id}-${result.title}`} data-testid={`result-global-${result.id}`} onClick={() => { openDetail(result); setGlobalQuery(''); }}>
                    <span className="global-result-icon"><FolderOpen /></span><span><strong>{result.title}</strong><small>{result.id} · {result.kind}</small></span><ArrowRight />
                  </button>) : <div className="global-no-results">Aucun résultat dans les données fictives.</div>}
                </div>}
              </div>
              <button className="icon-button" aria-label="Notifications" data-testid="button-notifications" onClick={() => setNoticeOpen((open) => !open)}><Bell /><span className="notification-dot" /></button>
              <span className="top-date">Mardi 17 juin 2025</span>
            </div>
          </header>
          {noticeOpen && <div className="notification-pop" data-testid="notification-panel">
            <h4>À ne pas oublier</h4>
            <div className="notification-entry"><strong>Conclusions en réponse</strong><small>Ndar Industrie c. Ba &amp; Fils · demain à 17:00</small></div>
            <div className="notification-entry"><strong>Rendez-vous avec Aminata Diop</strong><small>Aujourd’hui · 10:30 au cabinet</small></div>
            <button className="text-action" data-testid="button-notification-deadlines" onClick={() => changeSection('Échéances')}>Voir les échéances <ArrowRight /></button>
          </div>}

          <div className="content">
            <div className="demo-banner" data-testid="notice-demo-disclaimer"><CircleAlert /> Démonstration uniquement — toutes les personnes, affaires et sommes sont fictives. Les actions sont temporaires : rien n’est sauvegardé et aucun acte réel n’est effectué.</div>
            <div className="page-head">
              <div><div className="eyebrow">{active === 'Vue d’ensemble' ? 'MARDI 17 JUIN 2025 · DAKAR' : 'Ndiaye & Associés · Sénégal'}</div>
                <h1 className="page-title" data-testid="heading-current-section">{active === 'Vue d’ensemble' ? 'Bonjour, Maître Ndiaye' : active}</h1>
                <p className="page-subtitle">{sectionIntro[active]}</p>
              </div>
              <div className="head-actions">
                {active === 'Vue d’ensemble' && <button className="secondary-button" data-testid="button-export" onClick={() => notify('Aperçu export : aucune donnée n’a été transmise.')}><Download /> Exporter</button>}
                <button className="primary-button" data-testid="button-add-entry" onClick={openNew}><Plus /> {active === 'Vue d’ensemble' ? 'Nouvelle entrée' : 'Ajouter un élément'}</button>
              </div>
            </div>

            {active === 'Vue d’ensemble' ? (
              <>
                <section className="stats-grid" aria-label="Indicateurs du cabinet">
                  <div className="stat-card" data-testid="stat-active-files"><div className="stat-top"><FolderOpen /> Dossiers actifs</div><div className="stat-value">28</div><div className="stat-foot"><ArrowUpRight /> 4 ouverts ce mois-ci</div></div>
                  <div className="stat-card" data-testid="stat-clients"><div className="stat-top"><UsersRound /> Clients suivis</div><div className="stat-value">64</div><div className="stat-foot"><ArrowUpRight /> 3 nouveaux en juin</div></div>
                  <div className="stat-card" data-testid="stat-hearings"><div className="stat-top"><CalendarDays /> Audiences à venir</div><div className="stat-value">06</div><div className="stat-foot"><Clock3 className="warm" /> Prochaine dans 7 jours</div></div>
                  <div className="stat-card" data-testid="stat-fees"><div className="stat-top"><CreditCard /> Honoraires en attente</div><div className="stat-value" style={{ fontSize: 21 }}>1,24 M</div><div className="stat-foot"><ArrowDownRight className="warm" /> FCFA · 4 factures à suivre</div></div>
                </section>
                <div className="dashboard-grid">
                  <section className="panel">
                    <div className="panel-head"><div><h2 className="panel-title">À suivre cette semaine</h2><div className="panel-caption">L’essentiel, sans perdre le fil.</div></div><button className="text-action" data-testid="button-all-deadlines" onClick={() => changeSection('Échéances')}>Toutes les échéances <ArrowRight /></button></div>
                    <div className="court-card"><div className="date-block"><b>24</b><small>JUIN</small></div><div className="court-info"><strong>Ndar Industrie c. Ba &amp; Fils</strong><span>Audience de mise en état · Tribunal de commerce</span></div><div className="court-time"><Clock3 /> 09:00</div></div>
                    <div className="task-list">
                      <div className="task-row"><span className="task-mark" /><div className="task-text"><strong>Finaliser les conclusions en réponse</strong><small>DOS-2025-041 · Me A. Ndiaye</small></div><span className="task-date">Demain, 17:00</span></div>
                      <div className="task-row"><span className="task-mark green" /><div className="task-text"><strong>Pièces à transmettre au notaire</strong><small>Succession Diop · Fatou Sarr</small></div><span className="task-date">20 juin</span></div>
                      <div className="task-row"><span className="task-mark green" /><div className="task-text"><strong>Réunion de suivi — équipe contentieux</strong><small>Salle de réunion · Cabinet</small></div><span className="task-date">23 juin, 09:30</span></div>
                    </div>
                    <div className="panel-head" style={{ borderTop: '1px solid #eeede6' }}><div><h2 className="panel-title">Dossiers récemment ouverts</h2><div className="panel-caption">Une vue rapide des affaires en cours.</div></div><button className="text-action" data-testid="button-view-files" onClick={() => changeSection('Dossiers')}>Voir les dossiers <ArrowRight /></button></div>
                    <div className="task-list">
                      <div className="task-row" role="button" tabIndex={0} data-testid="dashboard-file-DOS-2025-041" onClick={() => openDetail(seedRecords.Dossiers[0])} onKeyDown={(event) => event.key === 'Enter' && openDetail(seedRecords.Dossiers[0])}><span className="task-mark green" /><div className="task-text"><strong>Ndar Industrie c. Ba &amp; Fils</strong><small>DOS-2025-041 · Droit commercial</small></div><span className="status-pill">En cours</span></div>
                      <div className="task-row" role="button" tabIndex={0} data-testid="dashboard-file-DOS-2025-038" onClick={() => openDetail(seedRecords.Dossiers[1])} onKeyDown={(event) => event.key === 'Enter' && openDetail(seedRecords.Dossiers[1])}><span className="task-mark" /><div className="task-text"><strong>Succession Diop</strong><small>DOS-2025-038 · Droit de la famille</small></div><span className="status-pill en-attente">Pièce attendue</span></div>
                    </div>
                  </section>
                  <div className="side-stack">
                    <section className="panel">
                      <div className="panel-head"><div><h2 className="panel-title">Votre journée</h2><div className="panel-caption">Mardi 17 juin</div></div><button className="table-action" aria-label="Ouvrir l’agenda" data-testid="button-open-agenda" onClick={() => changeSection('Agenda')}><ArrowRight /></button></div>
                      <div className="agenda-list">
                        <div className="agenda-item"><div className="agenda-hour">10:30</div><div className="agenda-body"><strong>Rendez-vous · Aminata Diop</strong><small>Cabinet · Me S. Mbaye</small></div></div>
                        <div className="agenda-item"><div className="agenda-hour">14:00</div><div className="agenda-body"><strong>Revue de pièces · Ndar Industrie</strong><small>Salle de réunion · Équipe contentieux</small></div></div>
                        <div className="agenda-item"><div className="agenda-hour">16:15</div><div className="agenda-body"><strong>Appel · Groupe Saly Invest</strong><small>Me A. Ndiaye</small></div></div>
                      </div>
                      <div className="week-strip"><div className="week-label"><span>JUIN 2025</span><span><ChevronLeft /><ChevronRight /></span></div>
                        <div className="week-days">{['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, index) => <div className={`week-day ${index === 1 ? 'today' : ''} ${[1, 3, 5].includes(index) ? 'has-event' : ''}`} key={`${day}-${index}`}><span>{day}</span><b>{16 + index}</b></div>)}</div>
                      </div>
                    </section>
                    <section className="panel"><div className="panel-head"><div><h2 className="panel-title">Activité récente</h2><div className="panel-caption">Au sein de l’équipe</div></div><button className="text-action" data-testid="button-view-activity" onClick={() => changeSection('Activité')}>Tout voir <ArrowRight /></button></div>
                      <div className="activity-feed"><div className="feed-entry"><span className="feed-icon"><FileText /></span><div className="feed-text"><strong>Document ajouté au dossier</strong><small>Succession Diop · Me S. Mbaye</small></div><span className="feed-time">09:42</span></div><div className="feed-entry"><span className="feed-icon"><Clock3 /></span><div className="feed-text"><strong>Échéance mise à jour</strong><small>Ndar Industrie · Fatou Sarr</small></div><span className="feed-time">09:18</span></div></div>
                    </section>
                    <div className="note-card"><Sparkles /><h3>Un cabinet, un même fil.</h3><p>Retrouvez ici le contexte utile à vos décisions — dans un espace pensé pour votre pratique au quotidien.</p></div>
                  </div>
                </div>
                <div className="summary-row">
                  <section className="panel"><div className="panel-head"><div><h2 className="panel-title">Derniers mouvements</h2><div className="panel-caption">L’activité récente de la démonstration</div></div><button className="text-action" data-testid="button-full-activity" onClick={() => changeSection('Activité')}>Historique complet <ArrowRight /></button></div>
                    <div className="activity-feed"><div className="feed-entry"><span className="feed-icon"><FileText /></span><div className="feed-text"><strong>Projet de conclusions ajouté</strong><small>Ndar Industrie c. Ba &amp; Fils · par Me A. Ndiaye</small></div><span className="feed-time">09:42</span></div><div className="feed-entry"><span className="feed-icon"><CalendarDays /></span><div className="feed-text"><strong>Audience du 24 juin confirmée</strong><small>Tribunal de commerce · par Fatou Sarr</small></div><span className="feed-time">Hier</span></div></div>
                  </section>
                  <div className="note-card"><LockKeyhole /><h3>La discrétion d’abord.</h3><p>Maquette de présentation uniquement. Aucun mécanisme de sécurité ou de sauvegarde n’est ici représenté.</p></div>
                </div>
              </>
            ) : active === 'Agenda' ? (
              <>
                <section className="panel agenda-filter-panel">
                  <div className="list-toolbar">
                    <label className="list-search"><Search /><input aria-label="Rechercher dans l’agenda" data-testid="input-section-search" placeholder="Rechercher un rendez-vous…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
                    <div className="list-tools">
                      <select className="filter-select" aria-label="Filtrer par statut" data-testid="select-status-filter" value={filter} onChange={(event) => setFilter(event.target.value)}>
                        {['Tout', ...Array.from(new Set(allRecords.map((record) => record.status)))].map((status) => <option key={status} value={status}>{status === 'Tout' ? 'Tous les statuts' : status}</option>)}
                      </select>
                    </div>
                  </div>
                </section>
                <AgendaCalendar events={calendarEvents} onMove={moveAgendaEvent} onSelect={openDetail} />
                <div className="module-overview">
                  <div className="insight-card"><h3>Repères de l’agenda</h3><p>Faites glisser un rendez-vous pour modifier son jour ou son horaire. Le déplacement est local et temporaire.</p></div>
                  <div className="insight-card"><h3>Un aperçu, pas un agenda réel</h3><p>Les rendez-vous affichés sont fictifs. Aucun calendrier externe n’est connecté et aucun changement n’est sauvegardé.</p></div>
                </div>
              </>
            ) : (
              <>
                <section className="panel" data-testid={`panel-${currentSection?.toLowerCase().replaceAll(' ', '-')}`}>
                  <div className="list-toolbar">
                    <label className="list-search"><Search /><input aria-label={`Rechercher dans ${active}`} data-testid="input-section-search" placeholder={`Rechercher dans ${active.toLowerCase()}…`} value={query} onChange={(event) => setQuery(event.target.value)} /></label>
                    <div className="list-tools">
                      <select className="filter-select" aria-label="Filtrer par statut" data-testid="select-status-filter" value={filter} onChange={(event) => setFilter(event.target.value)}>
                        {['Tout', ...Array.from(new Set(allRecords.map((record) => record.status)))].map((status) => <option key={status} value={status}>{status === 'Tout' ? 'Tous les statuts' : status}</option>)}
                      </select>
                      <button className="filter-button" data-testid="button-refine-filter" onClick={() => notify('Filtres avancés — aperçu non connecté.')}><SlidersHorizontal /> Affiner</button>
                    </div>
                  </div>
                  {visibleRecords.length ? <div style={{ overflowX: 'auto' }}>
                    <table className="record-table" data-testid="table-records">
                      <thead><tr><th>RÉFÉRENCE</th><th>{active === 'Activité' ? 'ÉVÉNEMENT' : 'INTITULÉ'}</th><th>{active === 'Paiements' ? 'MODE DE PAIEMENT' : 'TYPE'}</th><th>STATUT</th><th>{active === 'Honoraires' || active === 'Paiements' ? 'MONTANT / DATE' : 'DATE / DÉTAIL'}</th><th /></tr></thead>
                      <tbody>{visibleRecords.map((record) => <tr key={`${record.id}-${record.title}`} data-testid={`row-record-${record.id}`}>
                        <td><span className="record-id">{record.id}</span></td>
                        <td><span className="record-title">{record.title}</span><span className="record-subtitle">{record.subtitle}</span></td>
                        <td>{record.kind}</td>
                        <td><span className={`status-pill ${record.status.toLowerCase().replaceAll(' ', '-')}`} data-testid={`status-record-${record.id}`}>{record.status}</span></td>
                        <td>{record.date}</td><td><button className="table-action" aria-label={`Consulter ${record.title}`} data-testid={`button-detail-${record.id}`} onClick={() => openDetail(record)}><MoreHorizontal /></button></td>
                      </tr>)}</tbody>
                    </table>
                  </div> : <div className="empty-state" data-testid="empty-records"><span><Archive /></span><strong>Aucun résultat pour l’instant</strong><p>Modifiez votre recherche ou choisissez un autre statut.</p><button className="secondary-button" data-testid="button-clear-filters" onClick={() => { setQuery(''); setFilter('Tout'); }}>Effacer les filtres</button></div>}
                  <div className="list-footer" data-testid="list-summary"><span>{visibleRecords.length} élément{visibleRecords.length > 1 ? 's' : ''} affiché{visibleRecords.length > 1 ? 's' : ''} · données fictives</span><div className="pager"><button aria-label="Page précédente" data-testid="button-previous-page" onClick={() => notify('Vous êtes déjà sur la première page.')}><ChevronLeft /></button><button aria-label="Page suivante" data-testid="button-next-page" onClick={() => notify('Toutes les entrées de démonstration sont affichées.')}><ChevronRight /></button></div></div>
                </section>
                <div className="module-overview">
                  <div className="insight-card"><h3>Repères du module</h3><p>{active === 'Honoraires' || active === 'Paiements' ? 'Les sommes et références illustrées sont fictives. Aucun règlement ni encaissement n’est réalisé depuis cette maquette.' : `Cette vue rassemble les éléments de démonstration du module ${active.toLowerCase()}. Les actions sont locales et temporaires.`}</p></div>
                  <div className="insight-card"><h3>Un aperçu, pas un espace réel</h3><p>Les utilisateurs et statuts ci-dessus servent uniquement à présenter une piste d’interface. Aucune permission, confidentialité ou sauvegarde n’est activée.</p></div>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
      {modal && <div className="modal-shade" data-testid="dialog-shade" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null); }}>
        <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title" data-testid={`dialog-${modal}`}>
          <div className="modal-head"><div><h2 id="modal-title">{modal === 'new' ? 'Ajouter une entrée' : 'Détail de démonstration'}</h2><p>{modal === 'new' ? `Ajout temporaire · ${active === 'Vue d’ensemble' ? 'activité du cabinet' : active.toLowerCase()}` : 'Informations fictives, visibles dans cette maquette.'}</p></div>
            <button className="modal-close" aria-label="Fermer" data-testid="button-close-dialog" onClick={() => setModal(null)}><X /></button>
          </div>
          {modal === 'new' ? <form className="modal-body" onSubmit={createRecord}>
            <label className="form-label" htmlFor="demo-title">Intitulé</label><input id="demo-title" className="form-input" data-testid="input-entry-title" placeholder={active === 'Clients' ? 'Nom du client fictif' : 'Ex. Préparer la réunion client'} value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} autoFocus required />
            <label className="form-label" htmlFor="demo-detail">Note ou référence</label><input id="demo-detail" className="form-input" data-testid="input-entry-detail" placeholder="Une précision (facultatif)" value={draftDetail} onChange={(event) => setDraftDetail(event.target.value)} />
            <div className="privacy-note"><CircleAlert /> Entrée fictive de démonstration uniquement. Elle reste en mémoire temporaire et disparaîtra à la fermeture de la page.</div>
            <div className="modal-foot"><button type="button" className="secondary-button" data-testid="button-cancel-entry" onClick={() => setModal(null)}>Annuler</button><button type="submit" className="primary-button" data-testid="button-submit-entry"><Plus /> Ajouter</button></div>
          </form> : <div className="modal-body">
            <div className="detail-tag">{selected?.kind} · {selected?.id}</div><h3 className="detail-title" data-testid="detail-title">{selected?.title}</h3><div className="detail-copy">{selected?.subtitle}</div>
            <div className="detail-lines"><div><span>Statut</span><strong>{selected?.status}</strong></div><div><span>Repère</span><strong>{selected?.date}</strong></div></div>
            <div className="privacy-note"><LockKeyhole /> Données fictives de présentation. Aucune donnée n’est sauvegardée et aucune action réelle n’est effectuée.</div>
            <div className="modal-foot"><button className="secondary-button" data-testid="button-dismiss-detail" onClick={() => setModal(null)}>Fermer</button><button className="primary-button" data-testid="button-confirm-detail" onClick={() => { setModal(null); notify('Action de démonstration — aucune donnée partagée.'); }}>Compris <Check /></button></div>
          </div>}
        </section>
      </div>}
      {toast && <div className="toast" role="status" data-testid="notification-toast"><Check /> {toast}</div>}
    </div>
  );
}

export default CabinetDashboard;
