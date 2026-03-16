

## Problema

Când un concediu este rezolvat prin `profileMap` (fallback pe `user_id`, linia 100/124), numele vine din `profiles.full_name` — care poate fi "CATALINA BALAN" (PRENUME NUME). Dar când alt concediu al aceleiași persoane are `epd_id`, numele vine din `epdMap` — "BALAN CATALINA" (NUME PRENUME, formatul corect).

Rezultat: cheia de deduplicare `"catalina balan|..."` ≠ `"balan catalina|..."` → persoana apare dublu.

## Soluția

**Fișier**: `src/pages/LeaveCalendar.tsx`

1. **Construiesc o hartă `userIdToEpdId`** din `epdData` + `records` (date deja fetch-uite):
   ```typescript
   const userIdToEpdId: Record<string, string> = {};
   (epdData || []).forEach(e => {
     const userId = e.employee_record_id ? recordUserMap[e.employee_record_id] : null;
     if (userId) userIdToEpdId[userId] = e.id;
   });
   ```

2. **Modific fallback-ul de la `profileMap`** (liniile 100 și 124): înainte de a folosi `profileMap`, verific dacă `user_id` are un EPD asociat și folosesc `epdMap` (formatul NUME PRENUME):
   ```typescript
   // Instead of: else if (lr.user_id && profileMap[lr.user_id]) empInfo = profileMap[lr.user_id];
   // Do:
   else if (lr.user_id) {
     const linkedEpdId = userIdToEpdId[lr.user_id];
     if (linkedEpdId && epdMap[linkedEpdId]) empInfo = epdMap[linkedEpdId];
     else if (profileMap[lr.user_id]) empInfo = profileMap[lr.user_id];
   }
   ```

Astfel, toate concediile unei persoane se rezolvă la același nume canonical (NUME PRENUME din EPD), iar deduplicarea funcționează corect.

