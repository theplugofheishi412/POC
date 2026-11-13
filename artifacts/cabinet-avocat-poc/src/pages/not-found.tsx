import { Link } from 'wouter';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <Compass className="mb-4 size-10 text-[#b08d3c]" />
      <h1 className="font-serif text-2xl font-semibold">Page introuvable</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">Cette page n’existe pas ou vous n’y avez pas accès.</p>
      <Button asChild className="mt-6">
        <Link href="/">Retour au tableau de bord</Link>
      </Button>
    </div>
  );
}
