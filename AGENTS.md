# Project Architecture Rules

- Kiosk conference live streams must use fixed UTC windows and automatically fall back to the institute presentation, so TV timezone differences cannot break scheduling.
- Kiosk bulletin PDFs are converted to optimized page images before TV playback; the Samsung client only rotates image URLs after the institute video.
- Decision registry access is enforced by the can_access_decision_registry DB function (super_admin or listed in decision_registry_access); decisions are never deleted, only marked cancelled, so yearly numbering stays continuous.
- Decision registry frontend visibility is centralized in useDecisionRegistryAccess, including navigation and direct-route guards; hiding it must preserve database permissions and records.
- School visits: access via can_access_school_visits (super_admin or school_visits_access); visits are never deleted, only cancelled; the kiosk reads only the kiosk_today_visits() SECURITY DEFINER function (no teacher names) so anon never reads the table.
- Kiosk welcome visits refresh through the privacy-safe RPC every 30 seconds, clear stale visits on request failure, and never reload the page; this keeps cancellations current without exposing the visits table or interrupting playback.
- The school-visits guide test uses the existing institutional SMTP transport in a dedicated authenticated sender with server-verified identity and role and a fixed single recipient; this preserves operational email separation and prevents unintended distribution.
- Annual leave opening is date-gated in both the database and HR interface using Europe/Bucharest; no force or service-role bypass may open a future year, while prior-year closure stays a separate operation to preserve current balances.
- Bulletin playback must resolve a valid current slide during render when settings change; effect-based index cleanup alone cannot prevent a dashboard crash after poster withdrawal.
