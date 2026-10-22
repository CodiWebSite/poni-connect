# Project Architecture Rules

- Kiosk conference live streams must use fixed UTC windows and automatically fall back to the institute presentation, so TV timezone differences cannot break scheduling.
- Kiosk bulletin PDFs are converted to optimized page images before TV playback; the Samsung client only rotates image URLs after the institute video.
- Decision registry access is enforced by the can_access_decision_registry DB function (super_admin or listed in decision_registry_access); decisions are never deleted, only marked cancelled, so yearly numbering stays continuous.
- Decision registry frontend visibility is centralized in useDecisionRegistryAccess, including navigation and direct-route guards; hiding it must preserve database permissions and records.
- School visits: access via can_access_school_visits (super_admin or school_visits_access); visits are never deleted, only cancelled; the kiosk reads only the kiosk_today_visits() SECURITY DEFINER function (no teacher names) so anon never reads the table.
