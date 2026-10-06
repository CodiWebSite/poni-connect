import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Expand, Images, Pause, Play } from 'lucide-react';
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
  const [activeSlide, setActiveSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const bulletins = useMemo(() => {
    const now = Date.now();
    return settings.kiosk_bulletins.filter(item => {
      if (!item?.enabled || !Array.isArray(item.pages) || item.pages.length === 0) return false;
      if (!item.expires_at) return true;
      const expiry = new Date(item.expires_at).getTime();
      return Number.isFinite(expiry) && expiry >= now;
    });
  }, [settings.kiosk_bulletins]);

  const slides = useMemo(() => bulletins.flatMap(bulletin =>
    bulletin.pages.map((pageUrl, index) => ({ bulletin, pageUrl, pageIndex: index })),
  ), [bulletins]);

  useEffect(() => {
    if (slides.length < 2 || isPaused || selected) return;
    const timer = window.setInterval(() => {
      setActiveSlide(current => (current + 1) % slides.length);
    }, 10000);
    return () => window.clearInterval(timer);
  }, [isPaused, selected, slides.length]);

  useEffect(() => {
    if (activeSlide >= slides.length) setActiveSlide(0);
  }, [activeSlide, slides.length]);

  if (loading || bulletins.length === 0) return null;

  const openBulletin = (bulletin: KioskBulletin, initialPage = 0) => {
    setSelected(bulletin);
    setPageIndex(initialPage);
  };

  const moveSlide = (direction: -1 | 1) => {
    setActiveSlide(current => (current + direction + slides.length) % slides.length);
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

  const currentSlide = slides[activeSlide];

  return (
    <section className="mt-4 animate-fade-in overflow-hidden rounded-md border border-border bg-bulletin-background shadow-card" aria-labelledby="dashboard-bulletin-title">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-bulletin-sans text-xs font-semibold uppercase text-bulletin-ink">
            <Images className="h-4 w-4 shrink-0 text-bulletin-gold" />
            Avizier ICMPP
          </div>
          <h2 id="dashboard-bulletin-title" className="mt-1 truncate font-bulletin text-lg font-bold text-foreground sm:text-xl">
            {currentSlide.bulletin.title}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="mr-1 hidden font-bulletin-sans text-xs tabular-nums text-muted-foreground sm:inline">
            {activeSlide + 1} / {slides.length}
          </span>
          <Button type="button" size="icon" variant="ghost" onClick={() => moveSlide(-1)} disabled={slides.length < 2} title="Pagina anterioară">
            <ChevronLeft />
            <span className="sr-only">Pagina anterioară</span>
          </Button>
          <Button type="button" size="icon" variant="ghost" onClick={() => setIsPaused(current => !current)} disabled={slides.length < 2} title={isPaused ? 'Pornește derularea' : 'Oprește derularea'}>
            {isPaused ? <Play /> : <Pause />}
            <span className="sr-only">{isPaused ? 'Pornește derularea' : 'Oprește derularea'}</span>
          </Button>
          <Button type="button" size="icon" variant="ghost" onClick={() => moveSlide(1)} disabled={slides.length < 2} title="Pagina următoare">
            <ChevronRight />
            <span className="sr-only">Pagina următoare</span>
          </Button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => openBulletin(currentSlide.bulletin, currentSlide.pageIndex)}
        className="group relative block h-[340px] w-full overflow-hidden bg-bulletin-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:h-[440px]"
        aria-label={`Mărește ${currentSlide.bulletin.title}, pagina ${currentSlide.pageIndex + 1}`}
      >
        <img
          key={`${currentSlide.bulletin.id}-${currentSlide.pageIndex}`}
          src={currentSlide.pageUrl}
          alt={`${currentSlide.bulletin.title}, pagina ${currentSlide.pageIndex + 1}`}
          className="h-full w-full animate-fade-in object-contain"
        />
        <span className="absolute bottom-3 right-3 flex items-center gap-2 rounded-sm bg-background/90 px-3 py-2 font-bulletin-sans text-xs font-semibold text-foreground opacity-100 shadow-card sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100">
          <Expand className="h-4 w-4" /> Mărește
        </span>
      </button>

      <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 sm:px-5">
        <span className="font-bulletin-sans text-xs text-muted-foreground">
          Pagina {currentSlide.pageIndex + 1} din {currentSlide.bulletin.pages.length}
        </span>
        <div className="flex max-w-[70%] items-center gap-1.5 overflow-hidden" aria-label="Selectează pagina">
          {slides.map((slide, index) => (
            <button
              key={`${slide.bulletin.id}-${slide.pageIndex}`}
              type="button"
              onClick={() => setActiveSlide(index)}
              className={`h-2 shrink-0 rounded-full transition-[width,background-color] ${index === activeSlide ? 'w-7 bg-bulletin-gold' : 'w-2 bg-muted-foreground/30 hover:bg-muted-foreground/60'}`}
              aria-label={`Pagina ${index + 1}`}
              aria-current={index === activeSlide ? 'page' : undefined}
            />
          ))}
        </div>
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