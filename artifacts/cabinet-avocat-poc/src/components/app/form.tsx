import { useEffect, type ReactNode } from 'react';
import { useForm, type FieldValues, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ZodTypeAny } from 'zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { errorBody } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * Formulaire validé par les schémas Zod partagés avec l'API : les mêmes
 * règles s'appliquent dans le navigateur et sur le serveur.
 */
export function useZodForm(schema: ZodTypeAny, defaultValues: FieldValues, deps: unknown[] = []) {
  const form = useForm<FieldValues>({ resolver: zodResolver(schema), defaultValues, mode: 'onSubmit' });
  useEffect(() => {
    form.reset(defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return form;
}

/** Reporte les erreurs de champ renvoyées par l'API sur le formulaire. */
export function applyServerErrors(form: UseFormReturn<FieldValues>, err: unknown) {
  const fields = errorBody(err).fields;
  if (!fields) return;
  for (const [name, message] of Object.entries(fields)) form.setError(name, { message });
}

export function fieldError(form: UseFormReturn<FieldValues>, name: string): string | undefined {
  const parts = name.split('.');
  let cur: unknown = form.formState.errors;
  for (const p of parts) cur = (cur as Record<string, unknown> | undefined)?.[p];
  return (cur as { message?: string } | undefined)?.message;
}

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  onSubmit,
  pending,
  submitLabel = 'Enregistrer',
  children,
  wide,
  footerExtra,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: ReactNode;
  onSubmit: (e: React.FormEvent) => void;
  pending?: boolean;
  submitLabel?: string;
  children: ReactNode;
  wide?: boolean;
  footerExtra?: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('max-h-[92vh] overflow-y-auto', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          {children}
          <DialogFooter className="gap-2 sm:items-center">
            {footerExtra && <div className="mr-auto text-xs text-muted-foreground">{footerExtra}</div>}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
