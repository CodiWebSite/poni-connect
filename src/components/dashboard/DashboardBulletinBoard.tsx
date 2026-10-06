import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Images } from 'lucide-react';
import { useAppSettings, type KioskBulletin } from '@/hooks/useAppSettings';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const DashboardBulletinBoard = () => {
  const { settings, loading } = useAppSettings();
  const [selected, setSelected] = useState<KioskBulletin | null>(null);
  const [pageIndex, setPageIndex] = useState(0);

  const bulletins = useMemo(() => {
    const now = Date.now();
    return settings.kiosk_bulletins.filter(item => {
      if (!item?.enabled || !Array.isArray(item.pages) || item.pages.length === 0) return false;
      if (!item.expires_at) return true;
      const expiry = new Date(item.expires_at).getTime();
      return Number.isFinite(expiry) && expiry >= now;
    });
  }, [settings.kiosk_bulletins]);

  if (loading || bulletins.length === 0) return null;

  const openBulletin = (bulletin: KioskBulletin) => {
    setSelected(bulletin);
    setPageIndex(0);
  };

  const movePage = (direction: -1 | 1) => {
    if (!selected) return;
    setPageIndex(current => (current + direction + selected.pages.length) % selected.pages.length);
  };

  const downloadCurrentPage = async () => {
    const currentUrl = selected?.pages[pageIndex];
    if (!currentUrl || !selected) return;
    try {
      const response = await fetch(currentUrl);
      if (!response.ok) throw new Error('download_failed');
      const blobUrl = URL.createObjectURL(await response.blob());
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = `${selected.title.replace(/[^a-zA-Z0-9ăâîșțĂÂÎȘȚ -]/g, '').trim() || 'afis'}-pagina-${pageIndex + 1}.jpg`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(currentUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <section className="mt-4 animate-fade-in" aria-labelledby="dashboard-bulletin-title">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Images className="h-4 w-4 text-primary" />
            <h2 id="dashboard-bulletin-title" className="font-display text-base font-semibold text-foreground">
              Avizier
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">Afișe și informări vizuale pentru colegi</p>
        </div>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {bulletins.length} {bulletins.length === 1 ? 'afiș' : 'afișe'}
        </span>
      </div>

      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3 [scrollbar-width:thin]">
        {bulletins.map(bulletin => (
          <button
            key={bulletin.id}
            type="button"
            onClick={() => openBulletin(bulletin)}
            className="group w-[min(76vw,15rem)] shrink-0 snap-start overflow-hidden rounded-md border border-border bg-card text-left shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label={`Deschide afișul ${bulletin.title}`}
          >
            <div className="aspect-[4/3] overflow-hidden bg-muted">
              <img
                src={bulletin.pages[0]}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.02]"
              />
            </div>
            <div className="p-3">
              <p className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-card-foreground">{bulletin.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {bulletin.pages.length} {bulletin.pages.length === 1 ? 'pagină' : 'pagini'} · Deschide afișul
              </p>
            </div>
          </button>
        ))}
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={open => !open && setSelected(null)}>
        <DialogContent className="flex h-[92vh] max-h-[92vh] w-[96vw] max-w-5xl flex-col overflow-hidden p-4 sm:p-5">
          <DialogHeader className="shrink-0 pr-8 text-left">
            <DialogTitle className="leading-snug">{selected?.title}</DialogTitle>
            <DialogDescription>
              Pagina {pageIndex + 1} din {selected?.pages.length ?? 0}
            </DialogDescription>
          </DialogHeader>

          <div className="relative min-h-0 flex-1 overflow-auto rounded-md border border-border bg-muted p-2 sm:p-4">
            {selected?.pages[pageIndex] && (
              <img
                src={selected.pages[pageIndex]}
                alt={`${selected.title}, pagina ${pageIndex + 1}`}
                className="mx-auto block h-auto max-h-full max-w-full object-contain shadow-card"
              />
            )}
          </div>

          <div className="flex shrink-0 items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => movePage(-1)}
                disabled={!selected || selected.pages.length < 2}
                title="Pagina anterioară"
              >
                <ChevronLeft />
                <span className="sr-only">Pagina anterioară</span>
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => movePage(1)}
                disabled={!selected || selected.pages.length < 2}
                title="Pagina următoare"
              >
                <ChevronRight />
                <span className="sr-only">Pagina următoare</span>
              </Button>
            </div>
            <Button type="button" variant="outline" onClick={downloadCurrentPage}>
              <Download />
              Descarcă pagina
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default DashboardBulletinBoard;