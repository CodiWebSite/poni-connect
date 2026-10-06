# Project Architecture Rules

- Kiosk conference live streams must use fixed UTC windows and automatically fall back to the institute presentation, so TV timezone differences cannot break scheduling.
- Decision registry access is enforced by the can_access_decision_registry DB function (super_admin or listed in decision_registry_access); decisions are never deleted, only marked cancelled, so yearly numbering stays continuous.
