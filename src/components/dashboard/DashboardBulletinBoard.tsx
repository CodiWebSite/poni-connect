import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Eye, Images } from 'lucide-react';
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

  const openBulletin = (bulletin: KioskBulletin, initialPage = 0) => {
    setSelected(bulletin);
    setPageIndex(initialPage);
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
    <section className="mt-4 animate-fade-in overflow-hidden rounded-md border border-border bg-bulletin-background px-4 py-5 shadow-card sm:px-6 sm:py-6" aria-labelledby="dashboard-bulletin-title">
      <div className="mb-6 flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 font-bulletin-sans text-xs font-semibold uppercase text-bulletin-ink">
            <Images className="h-4 w-4 text-bulletin-gold" />
            Anunțuri și evenimente
          </div>
          <h2 id="dashboard-bulletin-title" className="font-bulletin text-2xl font-bold leading-tight text-foreground sm:text-3xl">
            Avizier ICMPP
          </h2>
          <p className="mt-1 font-bulletin-sans text-sm text-muted-foreground">Toate paginile afișelor active, în ordinea publicării</p>
        </div>
        <span className="w-fit border-l-2 border-bulletin-gold pl-3 font-bulletin-sans text-xs font-medium text-muted-foreground">
          {bulletins.length} {bulletins.length === 1 ? 'afiș activ' : 'afișe active'}
        </span>
      </div>

      <div className="space-y-8">
        {bulletins.map(bulletin => (
          <article key={bulletin.id} aria-label={bulletin.title}>
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h3 className="font-bulletin text-lg font-bold leading-snug text-bulletin-ink sm:text-xl">{bulletin.title}</h3>
              <span className="shrink-0 font-bulletin-sans text-xs tabular-nums text-muted-foreground">
                {bulletin.pages.length} {bulletin.pages.length === 1 ? 'pagină' : 'pagini'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-5">
              {bulletin.pages.map((pageUrl, index) => (
                <Button
                  key={`${bulletin.id}-${index}-${pageUrl}`}
                  type="button"
                  variant="ghost"
                  onClick={() => openBulletin(bulletin, index)}
                  className="group h-auto min-w-0 flex-col items-stretch overflow-hidden rounded-md border border-border bg-card p-0 text-left shadow-flat hover:border-bulletin-gold hover:bg-card hover:shadow-raised"
                  aria-label={`Deschide ${bulletin.title}, pagina ${index + 1}`}
                >
                  <span className="relative block aspect-[3/4] w-full overflow-hidden bg-bulletin-surface">
                    <img
                      src={pageUrl}
                      alt={`${bulletin.title}, pagina ${index + 1}`}
                      loading="lazy"
                      className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                    <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-foreground/80 px-2 py-2 font-bulletin-sans text-xs font-medium text-background opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                      <Eye className="h-4 w-4" /> Vezi pagina
                    </span>
                  </span>
                  <span className="flex w-full items-center justify-between gap-2 px-3 py-3">
                    <span className="font-bulletin-sans text-sm font-semibold text-card-foreground">Pagina {index + 1}</span>
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-bulletin-gold" />
                  </span>
                </Button>
              ))}
            </div>
          </article>
        ))}
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={open => !open && setSelected(null)}>
        <DialogContent className="flex h-[94vh] max-h-[94vh] w-[96vw] max-w-6xl flex-col overflow-hidden p-3 sm:p-5">
          <DialogHeader className="shrink-0 pr-8 text-left">
            <DialogTitle className="font-bulletin leading-snug text-bulletin-ink">{selected?.title}</DialogTitle>
            <DialogDescription className="font-bulletin-sans">
              Pagina {pageIndex + 1} din {selected?.pages.length ?? 0}
            </DialogDescription>
          </DialogHeader>

          <div className="relative min-h-0 flex-1 overflow-auto rounded-md border border-border bg-bulletin-background p-2 sm:p-4">
            {selected?.pages[pageIndex] && (
              <img
                src={selected.pages[pageIndex]}
                alt={`${selected.title}, pagina ${pageIndex + 1}`}
                className="mx-auto block h-auto max-h-full max-w-full object-contain shadow-card"
              />
            )}
          </div>

          {selected && selected.pages.length > 1 && (
            <div className="flex shrink-0 gap-2 overflow-x-auto py-1 [scrollbar-width:thin]">
              {selected.pages.map((pageUrl, index) => (
                <Button
                  key={`${selected.id}-dialog-${index}-${pageUrl}`}
                  type="button"
                  variant="ghost"
                  onClick={() => setPageIndex(index)}
                  className={`h-20 w-16 shrink-0 overflow-hidden rounded-sm border p-0 ${index === pageIndex ? 'border-bulletin-gold ring-2 ring-bulletin-gold/30' : 'border-border opacity-65 hover:opacity-100'}`}
                  aria-label={`Pagina ${index + 1}`}
                  aria-current={index === pageIndex ? 'page' : undefined}
                >
                  <img src={pageUrl} alt="" className="h-full w-full object-cover object-top" />
                </Button>
              ))}
            </div>
          )}

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