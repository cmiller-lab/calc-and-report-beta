# SeaWorld Water Chemistry Console v15.11

Stenner calculator simplified:
- Motor series: 45, 85, 170
- Select tube size
- Ideal output = 50% of maximum tube/pump capacity
- Sizing ranks combinations by how closely required GPD matches the 50% target
- Manual pool volume remains in both modes

This retains the theoretical 12.5% NaOCl ppm/min relationship and field-calibration warning.

## Phase 1 Lab Sheet Intake POC

The beta repository now includes a front-end proof of concept for SeaWorld water-quality lab-sheet intake:

- `lab-sheets.html` — technician submission-history interface.
- `lab-upload.html` — minimal iPad camera/upload workflow.
- `lab-config.js` / `lab-api.js` — separated backend configuration and API boundary.
- `LAB_SHEETS_SETUP.md` — Supabase storage/database/Edge Function design and security notes.

The Phase 1 pages default to demo mode. They do not store or transmit customer photographs until the secure backend is configured.
