import type {
  BordereauStatus,
  DemarcheStatus,
  DossierStatus,
  EventType,
  PaymentState,
  RequeteStatus,
  TaskPriority,
  TaskStatus,
} from '@workspace/api-zod';

/**
 * Codes couleur métier (toujours accompagnés d'un libellé) :
 * vert = validé, orange = en attente, rouge = urgent, bleu = en cours,
 * gris = neutre / archivé, doré = mise en avant.
 */
export type Tone = 'green' | 'orange' | 'red' | 'blue' | 'gray' | 'gold' | 'navy';

export const TONE_CLASSES: Record<Tone, string> = {
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-600/25',
  orange: 'bg-amber-50 text-amber-800 ring-amber-600/30',
  red: 'bg-red-50 text-red-700 ring-red-600/25',
  blue: 'bg-sky-50 text-sky-800 ring-sky-600/25',
  gray: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  gold: 'bg-[#f7f0df] text-[#7a5a1c] ring-[#b08d3c]/35',
  navy: 'bg-[#e8ecf5] text-[#14213d] ring-[#14213d]/20',
};

export const TONE_DOT: Record<Tone, string> = {
  green: 'bg-emerald-500',
  orange: 'bg-amber-500',
  red: 'bg-red-500',
  blue: 'bg-sky-500',
  gray: 'bg-slate-400',
  gold: 'bg-[#b08d3c]',
  navy: 'bg-[#14213d]',
};

export const DOSSIER_STATUS_TONE: Record<DossierStatus, Tone> = {
  nouveau: 'gold',
  preparation: 'blue',
  en_cours: 'blue',
  en_attente: 'orange',
  audience_programmee: 'navy',
  decision_rendue: 'green',
  cloture: 'gray',
  archive: 'gray',
};

export const DEMARCHE_STATUS_TONE: Record<DemarcheStatus, Tone> = {
  a_effectuer: 'gold',
  en_cours: 'blue',
  effectuee: 'green',
  en_attente: 'orange',
  reportee: 'red',
};

export const TASK_STATUS_TONE: Record<TaskStatus, Tone> = {
  a_faire: 'gray',
  en_cours: 'blue',
  en_attente: 'orange',
  terminee: 'green',
};

export const PRIORITY_TONE: Record<TaskPriority, Tone> = {
  basse: 'gray',
  normale: 'blue',
  haute: 'orange',
  urgente: 'red',
};

export const REQUETE_STATUS_TONE: Record<RequeteStatus, Tone> = {
  brouillon: 'gray',
  a_valider: 'orange',
  validee: 'green',
  deposee: 'navy',
};

export const BORDEREAU_STATUS_TONE: Record<BordereauStatus, Tone> = {
  brouillon: 'orange',
  finalise: 'green',
};

export const PAYMENT_STATE_TONE: Record<PaymentState, Tone> = {
  impayee: 'red',
  partielle: 'orange',
  payee: 'green',
};

/** Couleurs des événements de l'agenda (bordure gauche + pastille). */
export const EVENT_TYPE_STYLE: Record<EventType, { bar: string; bg: string; text: string }> = {
  audience: { bar: 'border-l-[#14213d]', bg: 'bg-[#e8ecf5]', text: 'text-[#14213d]' },
  rendez_vous: { bar: 'border-l-emerald-600', bg: 'bg-emerald-50', text: 'text-emerald-900' },
  depot_requete: { bar: 'border-l-sky-600', bg: 'bg-sky-50', text: 'text-sky-900' },
  deplacement: { bar: 'border-l-[#b08d3c]', bg: 'bg-[#f7f0df]', text: 'text-[#5f4614]' },
  echeance: { bar: 'border-l-red-600', bg: 'bg-red-50', text: 'text-red-900' },
  reunion: { bar: 'border-l-slate-500', bg: 'bg-slate-100', text: 'text-slate-800' },
};
