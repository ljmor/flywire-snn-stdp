"""Shared library of the project: a spiking network wired like the Drosophila auditory connectome.

Modules:
    extraction   raw FlyWire files  ->  canonical JO subgraph (data/processed/)
    graph        loading of the subgraph and generation of the control topologies
    audio        auditory encoding (analytic gammatone filterbank -> spike trains)
    network      three-channel LIF model, STDP and sparse WTA on Brian2
    calibration  matched operating point (bisection on the input gain)
    evaluation   classification protocol (train/test) and evaluation metrics
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_RAW = ROOT / 'data' / 'raw'
DATA_PROCESSED = ROOT / 'data' / 'processed'
FIGURES = ROOT / 'docs' / 'figures'

# Connectome snapshot used throughout the project (Dorkenwald et al., 2024).
FLYWIRE_SNAPSHOT = 'v783'

__all__ = ['ROOT', 'DATA_RAW', 'DATA_PROCESSED', 'FIGURES', 'FLYWIRE_SNAPSHOT']
