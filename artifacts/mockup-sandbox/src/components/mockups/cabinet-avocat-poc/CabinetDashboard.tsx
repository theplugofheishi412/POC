import { useMemo, useState } from "react";
import {
  Activity,
  Archive,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  CreditCard,
  Download,
  FileClock,
  FileText,
  FolderOpen,
  Gavel,
  LayoutDashboard,
  LockKeyhole,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";

type Section =
  | "Vue d’ensemble"
  | "Clients"
  | "Dossiers"
  | "Audiences"
  | "Agenda"
  | "Échéances"
  | "Documents"
  | "Honoraires"
  | "Paiements"
  | "Utilisateurs"
  | "Activité";

type RecordItem = {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  date: string;
  kind: string;
};

const navGroups: { label: string; items: { name: Section; icon: typeof LayoutDashboard }[] }[] = [
  { label: "ESPACE DE TRAVAIL", items: [{ name: "Vue d’ensemble", icon: LayoutDashboard }] },
  {
    label: "SUIVI DU CABINET",
    items: [
      { name: "Clients", icon: UsersRound },
      { name: "Dossiers", icon: FolderOpen },
      { name: "Audiences", icon: Gavel },
      { name: "Agenda", icon: CalendarDays },
      { name: "Échéances", icon: FileClock },
    ],
  },
  {
    label: "RESSOURCES",
    items: [
      { name: "Documents", icon: FileText },
      { name: "Honoraires", icon: CreditCard },
      { name: "Paiements", icon: CreditCard },
      { name: "Utilisateurs", icon: UserRound },
      { name: "Activité", icon: Activity },
    ],
  },
];

const seedRecords: Record<Exclude<Section, "Vue d’ensemble">, RecordItem[]> = {
  Clients: [
    { id: "CL-024", title: "Société Ndar Industrie", subtitle: "Entreprise · Saint-Louis", status: "Actif", date: "12 juin 2025", kind: "Client" },
    { id: "CL-023", title: "Aminata Diop", subtitle: "Particulier · Dakar", status: "Actif", date: "10 juin 2025", kind: "Cliente" },
    { id: "CL-021", title: "Groupe Saly Invest", subtitle: "Entreprise · Mbour", status: "À suivre", date: "06 juin 2025", kind: "Client" },
    { id: "CL-018", title: "Mamadou Fall", subtitle: "Particulier · Thiès", status: "Actif", date: "29 mai 2025", kind: "Client" },
  ],
  Dossiers: [
    { id: "DOS-2025-041", title: "Ndar Industrie c. Ba & Fils", subtitle: "Droit commercial · Me A. Ndiaye", status: "En cours", date: "Audience · 24 juin", kind: "Contentieux" },
    { id: "DOS-2025-038", title: "Succession Diop", subtitle: "Droit de la famille · Me S. Mbaye", status: "En cours", date: "Pièce attendue · 20 juin", kind: "Conseil" },
    { id: "DOS-2025-032", title: "Bail commercial — Saly", subtitle: "Droit immobilier · Me A. Ndiaye", status: "En attente", date: "Mis à jour · 12 juin", kind: "Conseil" },
    { id: "DOS-2025-027", title: "Litige foncier, Rufisque", subtitle: "Droit foncier · Me M. Cissé", status: "En cours", date: "Audience · 02 juil.", kind: "Contentieux" },
  ],
  Audiences: [
    { id: "AUD-0624", title: "Ndar Industrie c. Ba & Fils", subtitle: "Tribunal de commerce · Dakar", status: "À préparer", date: "Mar. 24 juin · 09:00", kind: "Mise en état" },
    { id: "AUD-0626", title: "Succession Diop", subtitle: "Tribunal de grande instance · Dakar", status: "Confirmée", date: "Jeu. 26 juin · 11:30", kind: "Conciliation" },
    { id: "AUD-0702", title: "Litige foncier, Rufisque", subtitle: "Tribunal de grande instance · Rufisque", status: "Confirmée", date: "Mer. 02 juil. · 08:30", kind: "Plaidoirie" },
  ],
  Agenda: [
    { id: "RDV-0618", title: "Rendez-vous · Aminata Diop", subtitle: "Cabinet · Me S. Mbaye", status: "Confirmé", date: "Aujourd’hui · 10:30", kind: "Rendez-vous" },
    { id: "RDV-0618b", title: "Revue de pièces · Ndar Industrie", subtitle: "Cabinet · Me A. Ndiaye", status: "Confirmé", date: "Aujourd’hui · 14:00", kind: "Interne" },
    { id: "RDV-0619", title: "Consultation · M. Fall", subtitle: "Visioconférence · Me M. Cissé", status: "À confirmer", date: "Demain · 09:00", kind: "Consultation" },
  ],
  Échéances: [
    { id: "ECH-0619", title: "Conclusions en réponse", subtitle: "Ndar Industrie c. Ba & Fils", status: "Urgent", date: "Demain · 17:00", kind: "Procédure" },
    { id: "ECH-0620", title: "Transmettre les pièces au notaire", subtitle: "Succession Diop", status: "À venir", date: "Ven. 20 juin", kind: "Dossier" },
    { id: "ECH-0624", title: "Audience de mise en état", subtitle: "Ndar Industrie c. Ba & Fils", status: "À venir", date: "Mar. 24 juin · 09:00", kind: "Audience" },
  ],
  Documents: [
    { id: "DOC-118", title: "Projet de conclusions en réponse", subtitle: "Ndar Industrie c. Ba & Fils · PDF", status: "À relire", date: "Modifié · 17 juin", kind: "Conclusions" },
    { id: "DOC-112", title: "Mandat de représentation", subtitle: "Succession Diop · DOCX", status: "Validé", date: "Modifié · 16 juin", kind: "Mandat" },
    { id: "DOC-106", title: "Convention d’honoraires", subtitle: "Groupe Saly Invest · PDF", status: "Signé", date: "Modifié · 12 juin", kind: "Convention" },
  ],
  Honoraires: [
    { id: "FAC-2025-019", title: "Facture · Ndar Industrie", subtitle: "DOS-2025-041 · Échéance 30 juin", status: "À régler", date: "480 000 FCFA", kind: "Facture" },
    { id: "FAC-2025-017", title: "Provision · Succession Diop", subtitle: "DOS-2025-038 · Échéance 20 juin", status: "En attente", date: "250 000 FCFA", kind: "Provision" },
    { id: "FAC-2025-014", title: "Consultation · M. Fall", subtitle: "DOS-2025-029 · Réglée le 12 juin", status: "Réglé", date: "75 000 FCFA", kind: "Facture" },
  ],
  Paiements: [
    { id: "PAY-2025-026", title: "Règlement · Groupe Saly Invest", subtitle: "DOS-2025-032 · Réf. VRT-9041", status: "Enregistré", date: "350 000 FCFA · 14 juin", kind: "Virement" },
    { id: "PAY-2025-024", title: "Provision · Succession Diop", subtitle: "DOS-2025-038 · Réf. ESP-2186", status: "Partiel", date: "125 000 FCFA · 11 juin", kind: "Espèces" },
    { id: "PAY-2025-019", title: "Consultation · Aminata Diop", subtitle: "DOS-2025-029 · Réf. CHQ-1103", status: "Enregistré", date: "75 000 FCFA · 06 juin", kind: "Chèque" },
  ],
  Utilisateurs: [
    { id: "USR-01", title: "Me Aïssatou Ndiaye", subtitle: "Avocate · Associée", status: "Actif", date: "Dernière activité · 09:42", kind: "Équipe" },
    { id: "USR-02", title: "Me Saliou Mbaye", subtitle: "Avocat · Collaborateur", status: "Actif", date: "Dernière activité · 09:18", kind: "Équipe" },
    { id: "USR-03", title: "Me Marième Cissé", subtitle: "Avocate · Collaboratrice", status: "Actif", date: "Dernière activité · Hier", kind: "Équipe" },
    { id: "USR-04", title: "Fatou Sarr", subtitle: "Assistante juridique", status: "Actif", date: "Dernière activité · Hier", kind: "Équipe" },
  ],
  Activité: [
    { id: "ACT-0942", title: "Document ajouté au dossier", subtitle: "Me Saliou Mbaye · Succession Diop", status: "Aujourd’hui", date: "09:42", kind: "Document" },
    { id: "ACT-0918", title: "Échéance mise à jour", subtitle: "Fatou Sarr · Ndar Industrie c. Ba & Fils", status: "Aujourd’hui", date: "09:18", kind: "Échéance" },
    { id: "ACT-1640", title: "Note de rendez-vous ajoutée", subtitle: "Me Aïssatou Ndiaye · Aminata Diop", status: "Hier", date: "16:40", kind: "Note" },
  ],
};

const sectionIntro: Record<Section, string> = {
  "Vue d’ensemble": "Le fil clair de votre journée.",
  Clients: "Les personnes et organisations que vous accompagnez.",
  Dossiers: "Un suivi net, de l’ouverture à la clôture.",
  Audiences: "Les prochaines étapes devant les juridictions.",
  Agenda: "Les rendez-vous et temps forts du cabinet.",
  Échéances: "Ce qui mérite votre attention, au bon moment.",
  Documents: "Les pièces utiles, réunies au même endroit.",
  Honoraires: "Un aperçu des provisions et règlements du cabinet.",
  Paiements: "Les règlements enregistrés, rapprochés de leur dossier.",
  Utilisateurs: "Les membres de l’équipe de démonstration.",
  Activité: "Les derniers mouvements sur les dossiers fictifs.",
};

const moduleIcon: Record<Exclude<Section, "Vue d’ensemble">, typeof UsersRound> = {
  Clients: UsersRound,
  Dossiers: FolderOpen,
  Audiences: Gavel,
  Agenda: CalendarDays,
  Échéances: FileClock,
  Documents: FileText,
  Honoraires: CreditCard,
  Paiements: CreditCard,
  Utilisateurs: UserRound,
  Activité: Activity,
};

function formatAmount(value: number) {
  return new Intl.NumberFormat("fr-FR").format(value);
}

export function CabinetDashboard() {
  const [active, setActive] = useState<Section>("Vue d’ensemble");
  const [query, setQuery] = useState("");
  const [globalQuery, setGlobalQuery] = useState("");
  const [filter, setFilter] = useState("Tout");
  const [modal, setModal] = useState<"new" | "detail" | null>(null);
  const [selected, setSelected] = useState<RecordItem | null>(null);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDetail, setDraftDetail] = useState("");
  const [toast, setToast] = useState("");
  const [extraRecords, setExtraRecords] = useState<RecordItem[]>([]);

  const allRecords = active !== "Vue d’ensemble"
    ? [...(seedRecords[active] ?? []), ...extraRecords]
    : [];
  const visibleRecords = useMemo(() => allRecords.filter((item) => {
    const matchesQuery = `${item.id} ${item.title} ${item.subtitle} ${item.status} ${item.kind}`.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === "Tout" || item.status === filter;
    return matchesQuery && matchesFilter;
  }), [allRecords, filter, query]);
  const globalResults = useMemo(() => Object.values(seedRecords).flat().filter((item) =>
    `${item.id} ${item.title} ${item.subtitle}`.toLowerCase().includes(globalQuery.toLowerCase())
  ).slice(0, 5), [globalQuery]);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  };

  const createRecord = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draftTitle.trim()) return;
    const item: RecordItem = {
      id: `DÉMO-${String(extraRecords.length + 1).padStart(2, "0")}`,
      title: draftTitle.trim(),
      subtitle: draftDetail.trim() || "Ajout local de démonstration",
      status: "Nouveau",
      date: "À l’instant",
      kind: active === "Vue d’ensemble" ? "Note" : active,
    };
    setExtraRecords((current) => [item, ...current]);
    setDraftTitle("");
    setDraftDetail("");
    setModal(null);
    notify("Élément ajouté à cette démonstration.");
  };

  const openNew = () => {
    setDraftTitle("");
    setDraftDetail("");
    setModal("new");
  };

  const openDetail = (item: RecordItem) => {
    setSelected(item);
    setModal("detail");
  };

  const setSection = (section: Section) => {
    setActive(section);
    setQuery("");
    setFilter("Tout");
    setNoticeOpen(false);
  };

  return (
    <div className="cabinet-app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@500;600;700&display=swap');
        .cabinet-app {
          --ink: #24352f; --muted: #7d8982; --line: #e9e8df; --paper: #faf9f5;
          --surface: #fffefa; --green: #24483e; --green-2: #335e50; --pale: #edf2ec;
          --gold: #b38b53; --rose: #a85f50; --soft-rose: #f8efeb;
          min-height: 100dvh; color: var(--ink); background: var(--paper);
          font-family: 'DM Sans', 'Avenir Next', sans-serif; font-size: 13px;
        }
        .cabinet-app * { box-sizing: border-box; }
        .cabinet-app button, .cabinet-app input { font: inherit; }
        .cabinet-app button { color: inherit; cursor: pointer; }
        .cabinet-shell { min-height: 100dvh; display: flex; }
        .cabinet-sidebar { width: 246px; flex: 0 0 246px; min-height: 100dvh; padding: 26px 16px 18px; background: #f4f3ed; border-right: 1px solid #e8e7de; display: flex; flex-direction: column; }
        .brand { padding: 0 12px 26px; display: flex; align-items: center; gap: 11px; }
        .brand-mark { width: 35px; height: 35px; border-radius: 11px 11px 11px 3px; color: #f8f5e9; background: var(--green); display: grid; place-items: center; }
        .brand-mark svg { width: 18px; height: 18px; }
        .brand-name { font-family: 'Playfair Display', Georgia, serif; font-size: 18px; letter-spacing: -.45px; line-height: 1; }
        .brand-sub { color: #8d8c7d; font-size: 9px; letter-spacing: 1.45px; margin-top: 5px; text-transform: uppercase; }
        .firm-switch { border: 1px solid #e6e4da; border-radius: 10px; background: rgba(255,254,250,.68); padding: 10px 11px; margin: 0 2px 27px; display: flex; align-items: center; gap: 9px; text-align: left; }
        .firm-stamp { width: 28px; height: 28px; border-radius: 8px; background: #e7ede5; color: var(--green); display: grid; place-items: center; font-family: Georgia,serif; font-size: 14px; }
        .firm-label { font-size: 11px; font-weight: 600; flex: 1; }
        .firm-label small { display:block; color: var(--muted); font-size: 10px; font-weight: 400; margin-top: 3px; }
        .firm-switch > svg { width: 14px; height: 14px; color: #91978f; }
        .nav-group { margin-bottom: 23px; }
        .nav-caption { color: #9a9c91; font-size: 9px; letter-spacing: 1.25px; font-weight: 700; padding: 0 12px 9px; }
        .nav-item { display: flex; align-items: center; gap: 11px; width: 100%; border: 0; background: transparent; border-radius: 8px; padding: 9px 11px; margin: 2px 0; color: #68756e; text-align: left; font-size: 12px; transition: background .18s ease, color .18s ease, transform .18s ease; }
        .nav-item:hover { background: #eaece5; color: var(--green); transform: translateX(2px); }
        .nav-item.is-active { background: #e3ebe3; color: var(--green); font-weight: 600; }
        .nav-item svg { width: 16px; height: 16px; stroke-width: 1.75; }
        .nav-count { margin-left: auto; min-width: 20px; padding: 3px 5px; border-radius: 6px; text-align: center; background: #f1e7d8; color: #8d6b3d; font-size: 10px; font-weight: 600; }
        .sidebar-bottom { margin-top: auto; }
        .help-note { background: #e9eee7; border: 1px solid #e2e8df; border-radius: 11px; padding: 13px; margin: 8px 2px 17px; }
        .help-note strong { display:flex; align-items:center; gap:7px; color: var(--green); font-size: 11px; font-weight: 600; }
        .help-note strong svg { width:14px; height:14px; }
        .help-note p { color:#718077; font-size:10px; line-height:1.55; margin:7px 0 0; }
        .user-panel { border-top:1px solid #e3e2d9; padding:17px 8px 1px; display:flex; align-items:center; gap:9px; }
        .avatar { width:31px; height:31px; flex:0 0 31px; border-radius:50%; display:grid; place-items:center; color:#f8f6ee; background:#637a69; font-size:10px; font-weight:700; }
        .user-name { font-size:11px; font-weight:600; }
        .user-role { color:var(--muted); font-size:10px; margin-top:3px; }
        .user-menu { margin-left:auto; border:0; background:transparent; padding:4px; color:#89928a; }
        .user-menu svg { width:16px; height:16px; }
        .cabinet-main { flex:1; min-width:0; }
        .topbar { height:68px; padding:0 37px; border-bottom:1px solid #ebeae3; display:flex; align-items:center; justify-content:space-between; background:rgba(250,249,245,.93); }
        .crumb { display:flex; gap:9px; align-items:center; color:#92978f; font-size:11px; }
        .crumb svg { width:13px; height:13px; }
        .crumb strong { color:#4c5d53; font-weight:600; }
        .top-actions { display:flex; align-items:center; gap:14px; }
        .global-search { width:218px; height:34px; border:1px solid #e7e6de; border-radius:8px; display:flex; align-items:center; gap:8px; padding:0 10px; background:#fffefa; color:#9aa098; }
        .global-search svg { width:15px; height:15px; }
        .global-search input { width:100%; border:0; outline:0; background:transparent; font-size:11px; color:var(--ink); }
        .global-search input::placeholder { color:#a5aaa2; }
        .global-search-wrap { position:relative; }
        .global-results { position:absolute; top:41px; left:0; z-index:10; width:310px; padding:6px; border:1px solid #e9e8df; border-radius:9px; background:#fffefa; box-shadow:0 12px 30px rgba(49,62,51,.13); }
        .global-results button { width:100%; display:flex; align-items:center; gap:9px; padding:9px; border:0; border-radius:6px; background:transparent; text-align:left; }
        .global-results button:hover { background:#f4f4ed; }
        .global-results button > span:nth-child(2) { min-width:0; flex:1; }
        .global-results button > svg { width:13px; height:13px; color:#8b978d; }
        .global-results button strong { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#46594d; font-size:10px; font-weight:600; }
        .global-results button small { display:block; margin-top:4px; color:#929c93; font-size:9px; }
        .global-result-icon { width:25px; height:25px; display:grid; place-items:center; border-radius:7px; background:#edf2ec; color:#66816b; }
        .global-result-icon svg { width:13px; height:13px; }
        .global-no-results { padding:11px 9px; color:#89938a; font-size:10px; }
        .icon-button { width:34px; height:34px; position:relative; display:grid; place-items:center; border:1px solid #e7e6de; border-radius:8px; background:#fffefa; color:#65746b; }
        .icon-button svg { width:16px; height:16px; }
        .notification-dot { position:absolute; top:7px; right:7px; width:6px; height:6px; border:1px solid #fffefa; border-radius:50%; background:#bf765c; }
        .top-date { color:#7e8981; font-size:11px; padding-left:5px; }
        .content { max-width:1510px; margin:0 auto; padding:32px 37px 40px; }
        .demo-banner { display:flex; gap:8px; align-items:center; padding:9px 12px; border-radius:7px; background:#f2efe5; color:#857550; font-size:10px; margin-bottom:24px; }
        .demo-banner svg { width:14px; height:14px; flex:0 0 auto; color:#a78b50; }
        .page-head { display:flex; align-items:flex-end; justify-content:space-between; margin-bottom:24px; gap:20px; }
        .eyebrow { color:#9b8b6f; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:1.45px; margin-bottom:8px; }
        .page-title { font-family:'Playfair Display', Georgia, serif; font-size:30px; line-height:1.16; letter-spacing:-.6px; margin:0; font-weight:600; color:#263b32; }
        .page-subtitle { color:#849087; margin:7px 0 0; font-size:12px; }
        .head-actions { display:flex; align-items:center; gap:9px; }
        .secondary-button, .primary-button { min-height:36px; display:inline-flex; align-items:center; justify-content:center; gap:8px; padding:0 13px; border-radius:7px; font-size:11px; font-weight:600; transition:transform .17s ease, background .17s ease; }
        .secondary-button { border:1px solid #e2e2d9; background:#fffefa; color:#526259; }
        .secondary-button:hover { background:#f2f2ea; }
        .primary-button { border:1px solid var(--green); background:var(--green); color:#fffdf5 !important; box-shadow:0 3px 8px rgba(36,72,62,.12); }
        .primary-button:hover { background:#31594c; transform:translateY(-1px); }
        .primary-button svg, .secondary-button svg { width:14px; height:14px; }
        .stats-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-bottom:20px; }
        .stat-card { padding:16px 17px 15px; border:1px solid #e9e8df; border-radius:10px; background:var(--surface); min-height:110px; position:relative; overflow:hidden; }
        .stat-card::after { content:""; position:absolute; width:68px; height:68px; border-radius:50%; top:-40px; right:-22px; background:#f3f0e6; }
        .stat-top { color:#89958c; font-size:10px; display:flex; align-items:center; gap:7px; }
        .stat-top svg { width:14px; height:14px; color:#7d9381; }
        .stat-value { margin-top:10px; font-size:24px; line-height:1; letter-spacing:-.7px; font-weight:600; color:#2c4439; }
        .stat-foot { margin-top:9px; display:flex; align-items:center; gap:5px; color:#89938b; font-size:10px; }
        .stat-foot svg { width:12px; height:12px; color:#6b9277; }
        .stat-foot .warm { color:#b48955; }
        .dashboard-grid { display:grid; grid-template-columns:minmax(0,1.65fr) minmax(260px,.88fr); gap:15px; align-items:start; }
        .panel { border:1px solid #e9e8df; border-radius:10px; background:var(--surface); overflow:hidden; }
        .panel-head { min-height:58px; display:flex; align-items:center; justify-content:space-between; gap:10px; padding:0 17px; border-bottom:1px solid #eeede6; }
        .panel-title { margin:0; font-family:'Playfair Display', Georgia, serif; font-size:16px; font-weight:600; color:#2c4238; }
        .panel-caption { color:#9aa097; font-size:10px; margin-top:4px; }
        .text-action { border:0; background:transparent; color:#557565; font-size:10px; font-weight:600; display:flex; align-items:center; gap:5px; padding:5px; }
        .text-action svg { width:13px; height:13px; }
        .court-card { margin:15px 16px 9px; padding:14px; border-radius:8px; background:#f1f4ee; display:flex; align-items:center; gap:13px; }
        .date-block { flex:0 0 47px; height:49px; display:flex; flex-direction:column; align-items:center; justify-content:center; background:#fffefa; border:1px solid #e6e9e1; border-radius:7px; color:#637b69; }
        .date-block b { font-family:'Playfair Display', Georgia, serif; font-size:20px; line-height:1; }
        .date-block small { font-size:8px; letter-spacing:1px; margin-top:3px; text-transform:uppercase; }
        .court-info { min-width:0; flex:1; }
        .court-info strong { display:block; font-size:11px; font-weight:600; color:#31473b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .court-info span { display:block; color:#7e8b81; font-size:10px; margin-top:5px; }
        .court-time { color:#65796b; font-size:10px; white-space:nowrap; }
        .court-time svg { width:12px; height:12px; vertical-align:-2px; margin-right:3px; }
        .task-list { padding:1px 16px 9px; }
        .task-row { display:flex; align-items:center; gap:11px; padding:12px 1px; border-bottom:1px solid #f0efe9; }
        .task-row:last-child { border-bottom:0; }
        .task-mark { width:7px; height:7px; flex:0 0 7px; border-radius:50%; background:#c18f62; }
        .task-mark.green { background:#7b9b7c; }
        .task-text { min-width:0; flex:1; }
        .task-text strong { display:block; font-size:10px; font-weight:600; color:#48594e; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .task-text small { display:block; color:#979d95; font-size:9px; margin-top:4px; }
        .task-date { color:#828d84; font-size:9px; white-space:nowrap; }
        .side-stack { display:flex; flex-direction:column; gap:15px; }
        .agenda-list { padding:4px 17px 8px; }
        .agenda-item { display:grid; grid-template-columns:40px 1fr; gap:11px; padding:12px 0; border-bottom:1px solid #f0efe9; }
        .agenda-item:last-child { border:0; }
        .agenda-hour { color:#78907d; font-size:10px; font-weight:600; padding-top:2px; }
        .agenda-body { border-left:2px solid #c5d4c4; padding-left:11px; }
        .agenda-body strong { display:block; color:#4a5b50; font-size:10px; font-weight:600; }
        .agenda-body small { display:block; color:#969d95; font-size:9px; margin-top:4px; }
        .week-strip { padding:13px 17px 16px; }
        .week-label { color:#90998f; font-size:9px; display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
        .week-days { display:grid; grid-template-columns:repeat(7,1fr); gap:4px; }
        .week-day { text-align:center; color:#939a91; font-size:8px; }
        .week-day b { display:grid; place-items:center; width:25px; height:25px; margin:6px auto 0; font-size:9px; color:#526157; font-weight:500; border-radius:50%; }
        .week-day.today b { background:var(--green); color:#fffdf5; }
        .week-day.has-event b { position:relative; }
        .week-day.has-event b::after { content:""; position:absolute; bottom:1px; width:3px; height:3px; border-radius:50%; background:#bd8f5d; }
        .summary-row { margin-top:15px; display:grid; grid-template-columns:minmax(0,1fr) 250px; gap:15px; }
        .activity-feed { padding:5px 17px 7px; }
        .feed-entry { display:grid; grid-template-columns:28px 1fr auto; gap:10px; align-items:start; padding:11px 0; border-bottom:1px solid #f1f0eb; }
        .feed-entry:last-child { border:0; }
        .feed-icon { width:27px; height:27px; display:grid; place-items:center; border-radius:8px; background:#edf2ec; color:#67816b; }
        .feed-icon svg { width:13px; height:13px; }
        .feed-text strong { display:block; font-size:10px; font-weight:600; color:#4b5c51; }
        .feed-text small { display:block; color:#939b92; font-size:9px; margin-top:4px; }
        .feed-time { color:#a0a49c; font-size:9px; white-space:nowrap; }
        .note-card { padding:17px; background:#f0eee5; border:1px solid #e9e5d8; border-radius:10px; }
        .note-card > svg { color:#9b8056; width:17px; height:17px; }
        .note-card h3 { font-family:'Playfair Display',Georgia,serif; font-size:14px; margin:10px 0 6px; color:#405247; }
        .note-card p { color:#828b80; font-size:10px; line-height:1.6; margin:0; }
        .list-toolbar { display:flex; align-items:center; justify-content:space-between; padding:14px 16px; gap:10px; border-bottom:1px solid #eeede6; }
        .list-search { height:34px; width:min(290px,50%); border:1px solid #e8e7de; border-radius:7px; padding:0 10px; display:flex; align-items:center; gap:8px; background:#fffefa; }
        .list-search svg { width:14px; height:14px; color:#9aa198; }
        .list-search input { min-width:0; width:100%; border:0; outline:0; background:transparent; color:#405047; font-size:10px; }
        .list-tools { display:flex; gap:7px; align-items:center; }
        .filter-select { height:33px; padding:0 9px; background:#fffefa; border:1px solid #e8e7de; border-radius:7px; color:#69776d; font-size:10px; outline:0; }
        .filter-button { height:33px; padding:0 9px; display:flex; align-items:center; gap:6px; border:1px solid #e8e7de; border-radius:7px; background:#fffefa; color:#69776d; font-size:10px; }
        .filter-button svg { width:13px; height:13px; }
        .record-table { width:100%; border-collapse:collapse; }
        .record-table th { padding:11px 16px; color:#999e95; background:#fcfbf8; border-bottom:1px solid #efeee8; font-weight:500; font-size:9px; text-align:left; letter-spacing:.35px; }
        .record-table td { padding:14px 16px; border-bottom:1px solid #f0efe9; color:#647168; font-size:10px; vertical-align:middle; }
        .record-table tr:last-child td { border-bottom:0; }
        .record-table tbody tr { transition:background .15s; }
        .record-table tbody tr:hover { background:#fbfaf6; }
        .record-title { color:#3e5146; display:block; font-size:11px; font-weight:600; }
        .record-subtitle { color:#9a9f97; display:block; font-size:9px; margin-top:5px; }
        .record-id { color:#849187; font-family:ui-monospace, SFMono-Regular, Menlo, monospace; font-size:9px; }
        .status-pill { display:inline-flex; align-items:center; gap:5px; padding:5px 8px; border-radius:20px; color:#68806c; background:#eef3ed; font-size:9px; white-space:nowrap; }
        .status-pill::before { content:""; width:5px; height:5px; border-radius:50%; background:#87a085; }
        .status-pill.urgent, .status-pill.à-régler, .status-pill.à-préparer, .status-pill.à-relire { color:#a45f50; background:#f8efeb; }
        .status-pill.urgent::before, .status-pill.à-régler::before, .status-pill.à-préparer::before, .status-pill.à-relire::before { background:#bf7a64; }
        .status-pill.en-attente, .status-pill.à-confirmer, .status-pill.nouveau { color:#99784d; background:#f5f0e5; }
        .status-pill.en-attente::before, .status-pill.à-confirmer::before, .status-pill.nouveau::before { background:#c29b62; }
        .table-action { width:27px; height:27px; display:grid; place-items:center; border:0; border-radius:6px; background:transparent; color:#89948b; }
        .table-action:hover { background:#f0f1ea; }
        .table-action svg { width:15px; height:15px; }
        .empty-state { text-align:center; padding:54px 20px; color:#8b958c; }
        .empty-state span { width:42px; height:42px; border-radius:12px; display:grid; place-items:center; margin:0 auto 12px; background:#f0f2eb; color:#79907b; }
        .empty-state span svg { width:18px; height:18px; }
        .empty-state strong { display:block; font-family:'Playfair Display', Georgia, serif; font-size:17px; color:#45574b; font-weight:600; }
        .empty-state p { margin:7px 0 14px; font-size:10px; }
        .list-footer { display:flex; align-items:center; justify-content:space-between; border-top:1px solid #eeede6; padding:12px 16px; color:#949c93; font-size:9px; }
        .pager { display:flex; gap:5px; }
        .pager button { width:25px; height:25px; display:grid; place-items:center; border:1px solid #e8e7de; border-radius:6px; background:#fffefa; color:#778379; }
        .pager button svg { width:12px; height:12px; }
        .module-overview { margin-top:15px; display:grid; grid-template-columns:1fr 1fr; gap:14px; }
        .insight-card { border:1px solid #e9e8df; border-radius:10px; padding:17px; background:var(--surface); }
        .insight-card h3 { font-family:'Playfair Display', Georgia, serif; color:#3d5145; font-size:15px; margin:0; font-weight:600; }
        .insight-card p { color:#89948a; font-size:10px; line-height:1.6; margin:7px 0 0; }
        .notification-pop { position:absolute; z-index:5; top:57px; right:36px; width:278px; background:#fffefa; border:1px solid #e9e8df; border-radius:10px; padding:14px; box-shadow:0 12px 35px rgba(49,62,51,.12); }
        .notification-pop h4 { font-family:'Playfair Display',Georgia,serif; font-size:15px; margin:0 0 10px; color:#344a3d; }
        .notification-entry { padding:10px 0; border-top:1px solid #f0efe8; }
        .notification-entry strong { font-size:10px; display:block; color:#526257; }
        .notification-entry small { color:#969e94; font-size:9px; display:block; margin-top:4px; }
        .modal-shade { position:fixed; inset:0; z-index:20; background:rgba(27,42,35,.28); display:grid; place-items:center; padding:20px; animation:fade-in .16s ease both; }
        .modal-card { width:min(450px,100%); border:1px solid #e8e6dc; border-radius:13px; background:#fffefa; box-shadow:0 22px 70px rgba(30,45,36,.20); animation:lift-in .2s ease both; overflow:hidden; }
        .modal-head { display:flex; align-items:flex-start; justify-content:space-between; padding:21px 22px 15px; border-bottom:1px solid #efeee7; }
        .modal-head h2 { font-family:'Playfair Display',Georgia,serif; font-size:20px; color:#30483b; margin:0; font-weight:600; }
        .modal-head p { margin:5px 0 0; color:#89948a; font-size:10px; }
        .modal-close { border:0; background:transparent; color:#8d968e; padding:3px; }
        .modal-close svg { width:17px; height:17px; }
        .modal-body { padding:18px 22px 22px; }
        .form-label { display:block; color:#536358; font-size:10px; font-weight:600; margin:0 0 7px; }
        .form-input { display:block; width:100%; border:1px solid #e4e4db; background:#fffefa; border-radius:7px; height:38px; padding:0 11px; color:#3f5147; outline:none; font-size:11px; margin-bottom:15px; }
        .form-input:focus { border-color:#9cac9c; box-shadow:0 0 0 3px rgba(115,145,118,.11); }
        .modal-foot { display:flex; justify-content:flex-end; gap:8px; margin-top:18px; }
        .detail-tag { color:#8f7a53; font-size:9px; letter-spacing:.7px; text-transform:uppercase; }
        .detail-title { color:#344a3e; font-family:'Playfair Display',Georgia,serif; font-size:19px; margin:8px 0; }
        .detail-copy { color:#79867d; font-size:11px; line-height:1.65; }
        .detail-lines { border-top:1px solid #efeee7; margin-top:16px; padding-top:11px; display:grid; grid-template-columns:1fr 1fr; gap:13px; }
        .detail-lines span { display:block; color:#9aa097; font-size:9px; }
        .detail-lines strong { display:block; margin-top:4px; color:#526157; font-size:10px; font-weight:600; }
        .privacy-note { display:flex; gap:8px; padding:10px; margin-top:15px; background:#f3f2eb; color:#858b7e; border-radius:7px; font-size:9px; line-height:1.5; }
        .privacy-note svg { width:14px; height:14px; flex:0 0 auto; color:#9a865f; }
        .toast { position:fixed; z-index:30; bottom:20px; left:50%; transform:translateX(-50%); display:flex; align-items:center; gap:8px; padding:11px 15px; border-radius:8px; background:#2b4b3f; color:#fffdf6; font-size:11px; box-shadow:0 8px 24px rgba(30,50,40,.2); animation:lift-in .2s ease both; }
        .toast svg { width:14px; height:14px; color:#cadbc9; }
        @keyframes fade-in { from {opacity:0} to {opacity:1} }
        @keyframes lift-in { from {opacity:0; transform:translateY(7px)} to {opacity:1; transform:translateY(0)} }
        @media (min-width:1400px) { .content { padding-top:37px; } .stat-card { min-height:120px; padding:18px 19px; } }
        @media (max-width:1050px) {
          .cabinet-sidebar { width:210px; flex-basis:210px; }
          .topbar { padding:0 24px; }
          .content { padding:26px 24px 34px; }
          .dashboard-grid { grid-template-columns:minmax(0,1.35fr) minmax(240px,.9fr); }
          .stats-grid { gap:9px; }
          .stat-card { padding:14px; }
        }
        @media (max-width:760px) {
          .cabinet-shell { display:block; }
          .cabinet-sidebar { min-height:0; width:100%; height:auto; padding:12px 14px; border-right:0; border-bottom:1px solid #e8e7de; display:block; }
          .brand { padding:0; }
          .brand-mark { width:32px; height:32px; }
          .firm-switch, .nav-caption, .sidebar-bottom { display:none; }
          .cabinet-sidebar nav { display:flex; gap:8px; overflow-x:auto; padding:7px 0 1px; scrollbar-width:thin; }
          .nav-group { display:flex; flex:0 0 auto; gap:2px; margin:0; }
          .nav-item { display:inline-flex; width:auto; flex:0 0 auto; margin:0; padding:8px 9px; white-space:nowrap; font-size:10px; }
          .topbar { height:54px; padding:0 16px; }
          .crumb { font-size:10px; }
          .top-date { display:none; }
          .top-actions { gap:8px; }
          .global-search { width:155px; height:32px; }
          .global-results { width:min(300px,calc(100vw - 32px)); left:auto; right:0; }
          .content { padding:22px 15px 28px; }
          .demo-banner { align-items:flex-start; line-height:1.45; margin-bottom:19px; }
          .page-head { align-items:flex-start; margin-bottom:18px; }
          .page-title { font-size:26px; }
          .page-subtitle { max-width:270px; line-height:1.5; }
          .head-actions { align-self:flex-end; }
          .head-actions .secondary-button { display:none; }
          .primary-button { padding:0 10px; }
          .stats-grid { grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; margin-bottom:13px; }
          .stat-card { min-height:98px; padding:13px; }
          .stat-value { font-size:21px; }
          .dashboard-grid { grid-template-columns:1fr; gap:12px; }
          .summary-row { grid-template-columns:1fr; }
          .module-overview { grid-template-columns:1fr; }
          .list-toolbar { align-items:flex-start; flex-direction:column; }
          .list-search { width:100%; }
          .list-tools { width:100%; justify-content:space-between; }
          .record-table, .record-table tbody, .record-table tr, .record-table td { display:block; width:100%; }
          .record-table thead { display:none; }
          .record-table tr { position:relative; padding:12px 42px 12px 15px; border-bottom:1px solid #efeee8; }
          .record-table td { border:0; padding:2px 0; }
          .record-table td:nth-child(1) { display:inline; }
          .record-table td:nth-child(1) .record-id { display:none; }
          .record-table td:nth-child(2) { padding-top:3px; }
          .record-table td:nth-child(3) { display:inline-block; margin-top:8px; }
          .record-table td:nth-child(4) { display:inline-block; margin:8px 0 0 8px; }
          .record-table td:last-child { position:absolute; right:13px; top:17px; width:auto; }
          .record-table .record-title { white-space:normal; }
          .record-table .record-subtitle { margin-top:4px; }
          .list-footer { padding:11px 14px; }
          .notification-pop { top:48px; right:13px; }
        }
        @media (max-width:390px) {
          .global-search { width:125px; }
          .page-title { font-size:24px; }
          .page-head { gap:8px; }
          .topbar { padding:0 12px; }
          .content { padding-left:12px; padding-right:12px; }
        }
      `}</style>

      <div className="cabinet-shell">
        <aside className="cabinet-sidebar">
          <div className="brand">
            <div className="brand-mark"><Gavel /></div>
            <div><div className="brand-name">TechSolution</div><div className="brand-sub">Espace cabinet</div></div>
          </div>
          <button className="firm-switch" onClick={() => notify("Sélecteur de cabinet — aperçu de démonstration.")}>
            <span className="firm-stamp">N</span>
            <span className="firm-label">Ndiaye & Associés<small>Dakar · Sénégal</small></span>
            <ChevronDown />
          </button>
          <nav aria-label="Navigation principale">
            {navGroups.map((group) => (
              <div className="nav-group" key={group.label}>
                <div className="nav-caption">{group.label}</div>
                {group.items.map(({ name, icon: Icon }) => (
                  <button key={name} className={`nav-item ${active === name ? "is-active" : ""}`} onClick={() => setSection(name)}>
                    <Icon />
                    <span>{name}</span>
                    {name === "Échéances" && <span className="nav-count">3</span>}
                  </button>
                ))}
              </div>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="help-note">
              <strong><ShieldCheck /> Votre espace de travail</strong>
              <p>Prototype de présentation. Les données affichées sont fictives et conservées localement pendant cette session.</p>
            </div>
            <div className="user-panel">
              <div className="avatar">AN</div>
              <div><div className="user-name">Me Aïssatou Ndiaye</div><div className="user-role">Associée · Démo</div></div>
              <button className="user-menu" aria-label="Options du profil" onClick={() => notify("Profil de démonstration.")}><MoreHorizontal /></button>
            </div>
          </div>
        </aside>

        <main className="cabinet-main">
          <header className="topbar">
            <div className="crumb"><span>Cabinet</span><ChevronRight /><strong>{active}</strong></div>
            <div className="top-actions">
              <div className="global-search-wrap">
                <label className="global-search"><Search /><input aria-label="Recherche globale" placeholder="Rechercher un dossier…" value={globalQuery} onChange={(e) => setGlobalQuery(e.target.value)} /></label>
                {globalQuery.length > 1 && <div className="global-results">
                  {globalResults.length ? globalResults.map((result) => <button key={`${result.id}-${result.title}`} onClick={() => { openDetail(result); setGlobalQuery(""); }}>
                    <span className="global-result-icon"><FolderOpen /></span><span><strong>{result.title}</strong><small>{result.id} · {result.kind}</small></span><ArrowRight />
                  </button>) : <div className="global-no-results">Aucun résultat dans les données fictives.</div>}
                </div>}
              </div>
              <button className="icon-button" aria-label="Notifications" onClick={() => setNoticeOpen((open) => !open)}><Bell /><span className="notification-dot" /></button>
              <span className="top-date">Mardi 17 juin 2025</span>
            </div>
          </header>

          {noticeOpen && <div className="notification-pop">
            <h4>À ne pas oublier</h4>
            <div className="notification-entry"><strong>Conclusions en réponse</strong><small>Ndar Industrie c. Ba & Fils · demain à 17:00</small></div>
            <div className="notification-entry"><strong>Rendez-vous avec Aminata Diop</strong><small>Aujourd’hui · 10:30 au cabinet</small></div>
            <button className="text-action" onClick={() => { setSection("Échéances"); setNoticeOpen(false); }}>Voir les échéances <ArrowRight /></button>
          </div>}

          <div className="content">
            <div className="demo-banner"><CircleAlert /> Démonstration uniquement — noms, dossiers et montants entièrement fictifs. Aucune donnée n’est enregistrée sur un serveur.</div>
            <div className="page-head">
              <div>
                <div className="eyebrow">{active === "Vue d’ensemble" ? "MARDI 17 JUIN 2025 · DAKAR" : "Ndiaye & Associés · Sénégal"}</div>
                <h1 className="page-title">{active === "Vue d’ensemble" ? "Bonjour, Maître Ndiaye" : active}</h1>
                <p className="page-subtitle">{sectionIntro[active]}</p>
              </div>
              <div className="head-actions">
                {active === "Vue d’ensemble" && <button className="secondary-button" onClick={() => notify("Aperçu export : aucune donnée n’a été transmise.")}><Download /> Exporter</button>}
                <button className="primary-button" onClick={openNew}><Plus /> {active === "Vue d’ensemble" ? "Nouvelle entrée" : `Ajouter ${active === "Honoraires" ? "un élément" : "un élément"}`}</button>
              </div>
            </div>

            {active === "Vue d’ensemble" ? (
              <>
                <section className="stats-grid" aria-label="Indicateurs du cabinet">
                  <div className="stat-card"><div className="stat-top"><FolderOpen /> Dossiers actifs</div><div className="stat-value">28</div><div className="stat-foot"><ArrowUpRight /> 4 ouverts ce mois-ci</div></div>
                  <div className="stat-card"><div className="stat-top"><UsersRound /> Clients suivis</div><div className="stat-value">64</div><div className="stat-foot"><ArrowUpRight /> 3 nouveaux en juin</div></div>
                  <div className="stat-card"><div className="stat-top"><CalendarDays /> Audiences à venir</div><div className="stat-value">06</div><div className="stat-foot"><Clock3 className="warm" /> Prochaine dans 7 jours</div></div>
                  <div className="stat-card"><div className="stat-top"><CreditCard /> Honoraires en attente</div><div className="stat-value" style={{ fontSize: 21 }}>1,24 M</div><div className="stat-foot"><ArrowDownRight className="warm" /> FCFA · 4 factures à suivre</div></div>
                </section>

                <div className="dashboard-grid">
                  <section className="panel">
                    <div className="panel-head">
                      <div><h2 className="panel-title">À suivre cette semaine</h2><div className="panel-caption">L’essentiel, sans perdre le fil.</div></div>
                      <button className="text-action" onClick={() => setSection("Échéances")}>Toutes les échéances <ArrowRight /></button>
                    </div>
                    <div className="court-card">
                      <div className="date-block"><b>24</b><small>JUIN</small></div>
                      <div className="court-info"><strong>Ndar Industrie c. Ba & Fils</strong><span>Audience de mise en état · Tribunal de commerce</span></div>
                      <div className="court-time"><Clock3 /> 09:00</div>
                    </div>
                    <div className="task-list">
                      <div className="task-row"><span className="task-mark" /><div className="task-text"><strong>Finaliser les conclusions en réponse</strong><small>DOS-2025-041 · Me A. Ndiaye</small></div><span className="task-date">Demain, 17:00</span></div>
                      <div className="task-row"><span className="task-mark green" /><div className="task-text"><strong>Pièces à transmettre au notaire</strong><small>Succession Diop · Fatou Sarr</small></div><span className="task-date">20 juin</span></div>
                      <div className="task-row"><span className="task-mark green" /><div className="task-text"><strong>Réunion de suivi — équipe contentieux</strong><small>Salle de réunion · Cabinet</small></div><span className="task-date">23 juin, 09:30</span></div>
                    </div>
                    <div className="panel-head" style={{ borderTop: "1px solid #eeede6" }}>
                      <div><h2 className="panel-title">Dossiers récemment ouverts</h2><div className="panel-caption">Une vue rapide des affaires en cours.</div></div>
                      <button className="text-action" onClick={() => setSection("Dossiers")}>Voir les dossiers <ArrowRight /></button>
                    </div>
                    <div className="task-list">
                      <div className="task-row" onClick={() => openDetail(seedRecords.Dossiers[0])} style={{ cursor: "pointer" }}><span className="task-mark green" /><div className="task-text"><strong>Ndar Industrie c. Ba & Fils</strong><small>DOS-2025-041 · Droit commercial</small></div><span className="status-pill">En cours</span></div>
                      <div className="task-row" onClick={() => openDetail(seedRecords.Dossiers[1])} style={{ cursor: "pointer" }}><span className="task-mark" /><div className="task-text"><strong>Succession Diop</strong><small>DOS-2025-038 · Droit de la famille</small></div><span className="status-pill en-attente">Pièce attendue</span></div>
                    </div>
                  </section>

                  <div className="side-stack">
                    <section className="panel">
                      <div className="panel-head">
                        <div><h2 className="panel-title">Votre journée</h2><div className="panel-caption">Mardi 17 juin</div></div>
                        <button className="table-action" aria-label="Ouvrir l’agenda" onClick={() => setSection("Agenda")}><ArrowRight /></button>
                      </div>
                      <div className="agenda-list">
                        <div className="agenda-item"><div className="agenda-hour">10:30</div><div className="agenda-body"><strong>Rendez-vous · Aminata Diop</strong><small>Cabinet · Me S. Mbaye</small></div></div>
                        <div className="agenda-item"><div className="agenda-hour">14:00</div><div className="agenda-body"><strong>Revue de pièces · Ndar Industrie</strong><small>Salle de réunion · Équipe contentieux</small></div></div>
                        <div className="agenda-item"><div className="agenda-hour">16:15</div><div className="agenda-body"><strong>Appel · Groupe Saly Invest</strong><small>Me A. Ndiaye</small></div></div>
                      </div>
                      <div className="week-strip">
                        <div className="week-label"><span>JUIN 2025</span><span><ChevronLeft /><ChevronRight /></span></div>
                        <div className="week-days">
                          {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => <div className={`week-day ${i === 1 ? "today" : ""} ${[1, 3, 5].includes(i) ? "has-event" : ""}`} key={`${d}-${i}`}><span>{d}</span><b>{16 + i}</b></div>)}
                        </div>
                      </div>
                    </section>
                    <section className="panel">
                      <div className="panel-head"><div><h2 className="panel-title">Activité récente</h2><div className="panel-caption">Au sein de l’équipe</div></div><button className="text-action" onClick={() => setSection("Activité")}>Tout voir <ArrowRight /></button></div>
                      <div className="activity-feed">
                        <div className="feed-entry"><span className="feed-icon"><FileText /></span><div className="feed-text"><strong>Document ajouté au dossier</strong><small>Succession Diop · Me S. Mbaye</small></div><span className="feed-time">09:42</span></div>
                        <div className="feed-entry"><span className="feed-icon"><Clock3 /></span><div className="feed-text"><strong>Échéance mise à jour</strong><small>Ndar Industrie · Fatou Sarr</small></div><span className="feed-time">09:18</span></div>
                      </div>
                    </section>
                    <div className="note-card"><Sparkles /><h3>Un cabinet, un même fil.</h3><p>Retrouvez ici le contexte utile à vos décisions — dans un espace pensé pour votre pratique au quotidien.</p></div>
                  </div>
                </div>
                <div className="summary-row">
                  <section className="panel">
                    <div className="panel-head"><div><h2 className="panel-title">Derniers mouvements</h2><div className="panel-caption">L’activité récente de la démonstration</div></div><button className="text-action" onClick={() => setSection("Activité")}>Historique complet <ArrowRight /></button></div>
                    <div className="activity-feed">
                      <div className="feed-entry"><span className="feed-icon"><FileText /></span><div className="feed-text"><strong>Projet de conclusions ajouté</strong><small>Ndar Industrie c. Ba & Fils · par Me A. Ndiaye</small></div><span className="feed-time">09:42</span></div>
                      <div className="feed-entry"><span className="feed-icon"><CalendarDays /></span><div className="feed-text"><strong>Audience du 24 juin confirmée</strong><small>Tribunal de commerce · par Fatou Sarr</small></div><span className="feed-time">Hier</span></div>
                    </div>
                  </section>
                  <div className="note-card"><LockKeyhole /><h3>La discrétion d’abord.</h3><p>Maquette de présentation uniquement. Aucun mécanisme de sécurité ou de sauvegarde n’est ici représenté.</p></div>
                </div>
              </>
            ) : (
              <>
                <section className="panel">
                  <div className="list-toolbar">
                    <label className="list-search"><Search /><input aria-label={`Rechercher dans ${active}`} placeholder={`Rechercher dans ${active.toLowerCase()}…`} value={query} onChange={(e) => setQuery(e.target.value)} /></label>
                    <div className="list-tools">
                      <select className="filter-select" aria-label="Filtrer par statut" value={filter} onChange={(e) => setFilter(e.target.value)}>
                        {["Tout", ...Array.from(new Set(allRecords.map((record) => record.status)))].map((status) => <option key={status} value={status}>{status === "Tout" ? "Tous les statuts" : status}</option>)}
                      </select>
                      <button className="filter-button" onClick={() => notify("Filtres avancés — aperçu non connecté.")}><SlidersHorizontal /> Affiner</button>
                    </div>
                  </div>
                  {visibleRecords.length ? <div style={{ overflowX: "auto" }}>
                    <table className="record-table">
                       <thead><tr><th>RÉFÉRENCE</th><th>{active === "Activité" ? "ÉVÉNEMENT" : "INTITULÉ"}</th><th>{active === "Paiements" ? "MODE DE PAIEMENT" : "TYPE"}</th><th>STATUT</th><th>{active === "Honoraires" || active === "Paiements" ? "MONTANT / DATE" : "DATE / DÉTAIL"}</th><th /></tr></thead>
                      <tbody>
                        {visibleRecords.map((record) => <tr key={`${record.id}-${record.title}`}>
                          <td><span className="record-id">{record.id}</span></td>
                          <td><span className="record-title">{record.title}</span><span className="record-subtitle">{record.subtitle}</span></td>
                          <td>{record.kind}</td>
                          <td><span className={`status-pill ${record.status.toLowerCase().replaceAll(" ", "-")}`}>{record.status}</span></td>
                          <td>{record.date}</td>
                          <td><button className="table-action" aria-label={`Consulter ${record.title}`} onClick={() => openDetail(record)}><MoreHorizontal /></button></td>
                        </tr>)}
                      </tbody>
                    </table>
                  </div> : <div className="empty-state"><span><Archive /></span><strong>Aucun résultat pour l’instant</strong><p>Modifiez votre recherche ou choisissez un autre statut.</p><button className="secondary-button" onClick={() => { setQuery(""); setFilter("Tout"); }}>Effacer les filtres</button></div>}
                  <div className="list-footer"><span>{visibleRecords.length} élément{visibleRecords.length > 1 ? "s" : ""} affiché{visibleRecords.length > 1 ? "s" : ""} · données fictives</span><div className="pager"><button aria-label="Page précédente" onClick={() => notify("Vous êtes déjà sur la première page.")}><ChevronLeft /></button><button aria-label="Page suivante" onClick={() => notify("Toutes les entrées de démonstration sont affichées.")}><ChevronRight /></button></div></div>
                </section>
                <div className="module-overview">
                  <div className="insight-card"><h3>Repères du module</h3><p>{active === "Honoraires" || active === "Paiements" ? "Les sommes et références illustrées sont fictives. Aucun règlement ni encaissement n’est réalisé depuis cette maquette." : `Cette vue rassemble les éléments de démonstration du module ${active.toLowerCase()}. Les actions sont locales et temporaires.`}</p></div>
                  <div className="insight-card"><h3>Un aperçu, pas un espace réel</h3><p>Les utilisateurs et statuts ci-dessus servent uniquement à présenter une piste d’interface. Aucune permission, confidentialité ou sauvegarde n’est activée.</p></div>
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      {modal && <div className="modal-shade" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null); }}>
        <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="modal-head">
            <div><h2 id="modal-title">{modal === "new" ? "Ajouter une entrée" : "Détail de démonstration"}</h2><p>{modal === "new" ? `Ajout temporaire · ${active === "Vue d’ensemble" ? "activité du cabinet" : active.toLowerCase()}` : "Informations fictives, visibles dans cette maquette."}</p></div>
            <button className="modal-close" aria-label="Fermer" onClick={() => setModal(null)}><X /></button>
          </div>
          {modal === "new" ? <form className="modal-body" onSubmit={createRecord}>
            <label className="form-label" htmlFor="demo-title">Intitulé</label>
            <input id="demo-title" className="form-input" placeholder={active === "Clients" ? "Nom du client fictif" : "Ex. Préparer la réunion client"} value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} autoFocus required />
            <label className="form-label" htmlFor="demo-detail">Note ou référence</label>
            <input id="demo-detail" className="form-input" placeholder="Une précision (facultatif)" value={draftDetail} onChange={(e) => setDraftDetail(e.target.value)} />
            <div className="privacy-note"><CircleAlert /> Entrée de démonstration uniquement. Elle restera en mémoire locale et disparaîtra à la fermeture de cette vue.</div>
            <div className="modal-foot"><button type="button" className="secondary-button" onClick={() => setModal(null)}>Annuler</button><button type="submit" className="primary-button"><Plus /> Ajouter</button></div>
          </form> : <div className="modal-body">
            <div className="detail-tag">{selected?.kind} · {selected?.id}</div>
            <h3 className="detail-title">{selected?.title}</h3>
            <div className="detail-copy">{selected?.subtitle}</div>
            <div className="detail-lines"><div><span>Statut</span><strong>{selected?.status}</strong></div><div><span>Repère</span><strong>{selected?.date}</strong></div></div>
            <div className="privacy-note"><LockKeyhole /> Données fictives de présentation. Aucun droit d’accès, mécanisme de confidentialité ou stockage réel n’est mis en œuvre.</div>
            <div className="modal-foot"><button className="secondary-button" onClick={() => setModal(null)}>Fermer</button><button className="primary-button" onClick={() => { setModal(null); notify("Action de démonstration — aucune donnée partagée."); }}>Compris <Check /></button></div>
          </div>}
        </section>
      </div>}
      {toast && <div className="toast"><Check /> {toast}</div>}
    </div>
  );
}

export default CabinetDashboard;
