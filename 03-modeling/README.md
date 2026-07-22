# Phase 4 — Modeling

This folder is still empty because the phase is open.

Everything published so far stops at the end of CRISP-DM phase 3. The JO subgraph is
extracted and characterized, the treatment of modulatory synapses is decided, and the
STDP and WTA parameters are calibrated. Those runs all use a Poisson input group at
100 Hz, which is a placeholder for sound.

What lands here next:

- The auditory encoding pipeline, courtship song against environmental noise, turned
  into spike trains through a gammatone filterbank and an inhomogeneous Poisson process.
- The three networks trained under identical conditions, Erdős–Rényi control,
  connectome, and connectome with STDP.
- The stratified 70/15/15 split with a fixed seed, and ten repetitions per condition.

The two configurations that phase 4 inherits, along with the reasoning behind every
parameter, are documented in
[../02-data-preparation/results-02-stdp-and-wta-calibration.md](../02-data-preparation/results-02-stdp-and-wta-calibration.md).
