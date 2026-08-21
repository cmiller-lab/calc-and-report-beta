# SeaWorld Water Chemistry Console v15.5

## Parallel pump sizing
The Pump Selection page can now evaluate 1–4 identical Pentair EQ pumps operating in parallel.

For N pumps:
- Total system GPM is divided by N.
- Each pump sees the full system TDH.
- Each pump uses the same calculated VFD frequency.
- Total estimated electrical power is the sum of all running pumps.

Comparison modes:
- Selected pump count only
- 1 pump versus selected count
- All counts from 1 through selected count

## Energy comparison
For every capable configuration the calculator shows:
- Required VFD frequency
- Estimated total input kW at required frequency
- Estimated total input kW for the same pump configuration at 60 Hz
- Estimated VFD savings %
- Annual kWh
- Annual cost
- Annual cost savings compared with 60 Hz

Energy estimates remain affinity-law screening values. Hydraulic suitability and operating-speed tier remain the primary selection criteria.
