import { Lock, ShieldAlert } from 'lucide-react';
import {
  BORDEREAU_STATUS_LABELS,
  DEMARCHE_STATUS_LABELS,
  DOSSIER_STATUS_LABELS,
  PAYMENT_STATE_LABELS,
  REQUETE_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type BordereauStatus,
  type Confidentiality,
  type DemarcheStatus,
  type DossierStatus,
  type PaymentState,
  type RequeteStatus,
  type TaskPriority,
  type TaskStatus,
} from '@workspace/api-zod';
import {
  BORDEREAU_STATUS_TONE,
  DEMARCHE_STATUS_TONE,
  DOSSIER_STATUS_TONE,
  PAYMENT_STATE_TONE,
  PRIORITY_TONE,
  REQUETE_STATUS_TONE,
  TASK_STATUS_TONE,
} from '@/lib/tones';
import { StatusPill } from './common';

export const DossierStatusPill = ({ status }: { status: DossierStatus }) => (
  <StatusPill tone={DOSSIER_STATUS_TONE[status]}>{DOSSIER_STATUS_LABELS[status]}</StatusPill>
);
export const DemarcheStatusPill = ({ status }: { status: DemarcheStatus }) => (
  <StatusPill tone={DEMARCHE_STATUS_TONE[status]}>{DEMARCHE_STATUS_LABELS[status]}</StatusPill>
);
export const TaskStatusPill = ({ status }: { status: TaskStatus }) => <StatusPill tone={TASK_STATUS_TONE[status]}>{TASK_STATUS_LABELS[status]}</StatusPill>;
export const PriorityPill = ({ priority }: { priority: TaskPriority }) => <StatusPill tone={PRIORITY_TONE[priority]}>{TASK_PRIORITY_LABELS[priority]}</StatusPill>;
export const RequeteStatusPill = ({ status }: { status: RequeteStatus }) => (
  <StatusPill tone={REQUETE_STATUS_TONE[status]}>{REQUETE_STATUS_LABELS[status]}</StatusPill>
);
export const BordereauStatusPill = ({ status }: { status: BordereauStatus }) => (
  <StatusPill tone={BORDEREAU_STATUS_TONE[status]}>{BORDEREAU_STATUS_LABELS[status]}</StatusPill>
);
export const PaymentPill = ({ state }: { state: PaymentState }) => <StatusPill tone={PAYMENT_STATE_TONE[state]}>{PAYMENT_STATE_LABELS[state]}</StatusPill>;

export function ConfidentialityMark({ level }: { level: Confidentiality }) {
  if (level === 'standard') return null;
  return level === 'confidentiel' ? (
    <span className="inline-flex items-center gap-1 rounded bg-red-50 px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-red-700 ring-1 ring-inset ring-red-600/20" title="Dossier confidentiel : accès limité à l’équipe affectée et aux associés">
      <Lock className="size-3" /> Confidentiel
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-amber-800 ring-1 ring-inset ring-amber-600/25" title="Dossier à accès restreint">
      <ShieldAlert className="size-3" /> Restreint
    </span>
  );
}
