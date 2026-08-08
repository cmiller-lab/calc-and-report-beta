# SeaWorld Water Chemistry Console v15.3

## Pump selection logic
Pump sizing now uses a tiered hydraulic-selection hierarchy:

1. Pump must meet the required GPM and TDH.
2. Pump must meet the required VFD reserve.
3. Operating-speed tier is evaluated:
   - Tier 1: 45–55 Hz — Preferred
   - Tier 2: 35–45 Hz — Good
   - Tier 3: 55–60 Hz — High Utilization
   - Tier 4: 30–35 Hz — Low Speed
   - Tier 5: Below 30 Hz — Caution
4. Within the highest available tier, curve position and frequency reserve rank the models.
5. Energy is used only as a tie-breaker between hydraulically similar pumps in the same tier.

The calculator now distinguishes:
- Recommended
- Hydraulic Alternative
- Energy-Favorable Alternative
- Near Limit
- Not Capable

This prevents a larger pump running substantially slower from being recommended solely because the affinity-law energy model predicts lower kW.

## Deployment
Upload all files in this ZIP to the GitHub Pages repository root and replace the existing files. Verify the footer shows Version 15.3 after deployment.
