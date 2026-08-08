# SeaWorld Water Chemistry Console v15.2

## Pump sizing changes
- Hydraulic suitability is now the primary pump-selection criterion.
- Hydraulic Fit score:
  - 50% operating-speed quality
  - 35% scaled-curve position
  - 15% frequency reserve
- Overall Selection Score:
  - 85% Hydraulic Fit
  - 15% estimated energy score
- Operating-speed quality:
  - 45–55 Hz: Preferred
  - 35–45 Hz: Good
  - 30–35 Hz: Low Speed
  - Below 30 Hz: Caution
  - 55–60 Hz: High Utilization
- Energy comparison remains visible but does not determine the recommendation by itself.
- Hydraulic-fit metrics are proxies because Pentair BEP/BHP/efficiency contour data are not included.

## UI fix
The pump sticky status bar is explicitly hidden whenever the Pump Hydraulics panel is not active, preventing it from appearing on the main dashboard.

## Deployment
Upload all files in this ZIP to the repository root, replacing the existing files. Verify the footer shows Version 15.2 after GitHub Pages deploys.
