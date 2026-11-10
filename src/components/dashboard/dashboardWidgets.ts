// Central registry of personal-dashboard cards. Pure data, no React, so it can be tested.

export type WidgetId = 'bulletin' | 'rooms' | 'announcements' | 'requests' | 'activity' | 'leave' | 'changelog';
export type WidgetColumn = 'top' | 'main' | 'side';

export interface WidgetDef {
  id: WidgetId;
  title: string;
  description: string;
  column: WidgetColumn;
  /** Roles allowed to add it; empty = everyone. */
  roles: string[];
}

export const WIDGETS: WidgetDef[] = [
  { id: 'bulletin', title: 'Avizier', description: 'Afișele institutului, prin rotație', column: 'top', roles: [] },
  { id: 'rooms', title: 'Rezervări săli azi', description: 'Cine folosește sălile astăzi', column: 'main', roles: [] },
  { id: 'announcements', title: 'Anunțuri', description: 'Ultimele anunțuri importante', column: 'main', roles: [] },
  { id: 'requests', title: 'Cererile mele', description: 'Starea cererilor depuse', column: 'main', roles: [] },
  { id: 'activity', title: 'Activitatea mea', description: 'Ce ai făcut recent pe platformă', column: 'main', roles: [] },
  { id: 'leave', title: 'Concediul meu', description: 'Soldul de concediu', column: 'side', roles: [] },
  { id: 'changelog', title: 'Noutăți platformă', description: 'Ce s-a schimbat recent', column: 'side', roles: [] },
];

export interface LayoutItem { id: WidgetId; visible: boolean }

export function availableWidgets(roles: string[]): WidgetDef[] {
  return WIDGETS.filter(w => w.roles.length === 0 || w.roles.some(r => roles.includes(r)) || roles.includes('super_admin'));
}

export function defaultLayout(roles: string[]): LayoutItem[] {
  return availableWidgets(roles).map(w => ({ id: w.id, visible: true }));
}

/** Merge a saved layout with the current registry: drop unknown/forbidden ids, append new ones. */
export function resolveLayout(saved: unknown, roles: string[]): LayoutItem[] {
  const allowed = availableWidgets(roles);
  const allowedIds = new Set(allowed.map(w => w.id));
  const out: LayoutItem[] = [];
  if (Array.isArray(saved)) {
    for (const it of saved) {
      const id = (it as any)?.id;
      if (allowedIds.has(id) && !out.some(o => o.id === id)) out.push({ id, visible: (it as any).visible !== false });
    }
  }
  for (const w of allowed) if (!out.some(o => o.id === w.id)) out.push({ id: w.id, visible: true });
  return out;
}

export const widgetById = (id: WidgetId) => WIDGETS.find(w => w.id === id)!;
