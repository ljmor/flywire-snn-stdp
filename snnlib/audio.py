"""Auditory encoding: from the sound wave to spike trains on the JO neurons.

Chain:  sound  ->  gammatone filterbank  ->  envelope  ->  inner hair cell
        ->  instantaneous rate per channel  ->  inhomogeneous Poisson process per JO neuron

Changes from an earlier version:
  Filterbank. Each channel convolves its ANALYTIC impulse response, with a
       length matched to its center frequency (8 time constants: 37.5 ms at
       80 Hz, 19.0 ms at 380 Hz). Neither variant of `scipy.signal.gammatone`
       is used. The FIR one cuts every channel to 15 ms and widens every
       bandwidth to 78.4-86.5 Hz. The IIR one diverges in the two lowest
       channels (pole magnitudes 1.009256 and 1.010026) and stays mistuned
       below 250 Hz. See Section 2 of `04-modeling/01-audio-encoding.ipynb`
  Normalization. It fixes the mean rate, not the peak, so every stimulus has
       the same expected number of spikes and the total spike count no longer
       gives an artificial cue
  Envelope. The Hilbert envelope follows the amplitude of each channel, not
       its carrier cycle, so the rate is a true envelope and the code is a pure
       rate code. Phase locking can be measured with `vector_strength`
  Seeds. Each stimulus is drawn N times with recorded seeds, and the seed
       depends on the repetition, never on the class
"""
from __future__ import annotations

import numpy as np
from scipy.signal import fftconvolve, hilbert

SR = 44_100
DURATION = 0.5           # s
DT = 1e-4                # s, step of the Poisson generator (= Brian2 dt)
N_CHANNELS = 32
F_MIN, F_MAX = 80.0, 380.0
MEAN_RATE = 40.0         # Hz per channel; sets the spike budget of the stimulus
MIN_RATE = 5.0           # Hz, spontaneous activity of the afferent


def erb_space(f_min=F_MIN, f_max=F_MAX, n=N_CHANNELS):
    """Center frequencies equally spaced on the ERB scale (Glasberg & Moore, 1990)."""
    a = 9.265
    e0, e1 = a * np.log(1 + f_min / (24.7 * a)), a * np.log(1 + f_max / (24.7 * a))
    return 24.7 * a * (np.exp(np.linspace(e0, e1, n) / a) - 1)


CF = erb_space()


def theoretical_erb(fc):
    return 24.7 * (4.37 * np.asarray(fc) / 1000 + 1)


def tone(freq, duration=DURATION, sr=SR, snr_db=None, noise_seed=None):
    """Pure tone with 10 ms linear ramps; optional Gaussian noise with its own seed."""
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    x = np.sin(2 * np.pi * freq * t)
    n_ramp = int(0.01 * sr)
    r = np.linspace(0, 1, n_ramp)
    x[:n_ramp] *= r
    x[-n_ramp:] *= r[::-1]
    if snr_db is not None:
        rng = np.random.RandomState(noise_seed)
        noise_power = np.mean(x ** 2) / (10 ** (snr_db / 10))
        x = x + rng.randn(len(x)) * np.sqrt(noise_power)
    return x / np.max(np.abs(x))


_IR = {}
GT_ORDER = 4
B_GT = 1.019          # gives an order-4 gammatone the bandwidth of the ERB (Holdsworth et al., 1988)
N_TAU = 8             # length of the impulse response, in time constants


def impulse_response(fc, sr=SR, order=GT_ORDER, b=B_GT, n_tau=N_TAU):
    """Analytic gammatone (Patterson et al., 1992), normalized to unit energy.

    h(t) = t^(n-1) · exp(-2π·b·ERB(fc)·t) · cos(2π·fc·t)

    The length follows each center frequency: n_tau time constants, which is
    37.5 ms at 80 Hz and 19.0 ms at 380 Hz. This is why we build the filters
    ourselves. `scipy.signal.gammatone(ftype='fir')` uses 15 ms for ALL
    channels and cuts the tail of the low ones, so the 80 Hz channel ends up
    83.1 Hz wide instead of 33.3 Hz. The `ftype='iir'` variant is not usable
    here: for an 80 Hz channel sampled at 44,100 Hz its poles sit so close to
    the unit circle that the cascade diverges numerically.
    """
    k = (round(float(fc), 6), sr, order, b, n_tau)
    if k not in _IR:
        tau = 1.0 / (2 * np.pi * b * theoretical_erb(fc))
        t = np.arange(int(np.ceil(n_tau * tau * sr))) / sr
        h = t ** (order - 1) * np.exp(-2 * np.pi * b * theoretical_erb(fc) * t) * np.cos(2 * np.pi * fc * t)
        _IR[k] = h / np.sqrt(np.sum(h ** 2))
    return _IR[k]


def gammatone_filterbank(x, cf=CF, sr=SR):
    """Filters the signal through the auditory filterbank. Returns (n_channels, n_samples)."""
    return np.array([fftconvolve(x, impulse_response(fc, sr), mode='same') for fc in cf])


THRESHOLD_DB = -12.0  # threshold level of the afferent, relative to the reference
SLOPE_DB = 5.0        # slope of the rate-level function (dynamic range ≈ 20 dB)
_REF = {}


def envelope(y):
    """Analytic (Hilbert) envelope of each channel.

    It replaces the 2 ms rectangular moving average used before. A moving
    average of T ms cancels exactly the frequencies that are multiples of
    1000/T Hz, and the carrier ripple sits at 2·fc. With T = 2 ms the blind
    spot fell right on fc = 250 Hz, the song carrier. That channel came out
    perfectly smooth while the others kept their ripple: 0.001 at 250 Hz
    against 0.169 at 150 Hz, 0.133 at 170 Hz and 0.052 at 300 Hz. It was a
    systematic difference BETWEEN FREQUENCIES with nothing to do with
    tonotopy. The analytic envelope needs no window and gives 0.000 at all of
    them. Measured in Section 3 of `04-modeling/01-audio-encoding.ipynb`.
    """
    return np.abs(hilbert(y, axis=-1))


def _reference(sr=SR, cf=CF):
    """Fixed reference level: peak of the filterbank for a full-scale reference tone.

    It is a constant of the model, not of the stimulus. Using the peak of EACH
    stimulus would act as an automatic gain control and erase the energy
    differences between classes.
    """
    k = (sr, len(cf))
    if k not in _REF:
        f0 = float(np.sqrt(cf[0] * cf[-1]))
        _REF[k] = float(envelope(gammatone_filterbank(tone(f0, sr=sr), cf, sr)).max())
    return _REF[k]


def inner_hair_cell(y, threshold_db=THRESHOLD_DB, slope_db=SLOPE_DB):
    """Rate-level function of the auditory afferent (Sachs & Abbas, 1974).

    The level of each channel in dB goes through a sigmoid with a threshold
    and saturation. It replaces the cube-root compression used before. The
    cube root squeezes five decades of filterbank energy into fewer than two,
    and once the mean was normalized the floor ended up dominating the
    profile. The mean cosine between different tones was 0.301 with this
    sigmoid and 0.705 with the cube root; for the most distant pair of tones
    tested (100 vs 350 Hz) it went from 0.005 to 0.475, so the tones lost their
    spectral identity. The threshold gives the excitation pattern its real
    shape. Channels far from the tone frequency stay at spontaneous rate
    instead of adding an artificial pedestal.
    Measured in Section 3 of `04-modeling/01-audio-encoding.ipynb`.
    """
    L = 20 * np.log10(np.maximum(y, 1e-14) / _reference())
    return 1.0 / (1.0 + np.exp(-(L - threshold_db) / slope_db))


def envelope_to_rates(ihc, mean_rate=MEAN_RATE, min_rate=MIN_RATE):
    """Afferent activation (0-1) -> instantaneous rate, with the MEAN fixed.

    Fixing the mean (and not the peak, as before) gives every stimulus the
    SAME expected number of spikes, so the class cannot be inferred from the
    total spike count of the network.
    """
    mu = ihc.mean()
    if mu <= 1e-12:
        return np.full_like(ihc, min_rate)
    return min_rate + (mean_rate - min_rate) * ihc / mu


def vector_strength(rates, freq, sr=SR):
    """Phase locking of the rate to the carrier (Goldberg & Brown, 1969).

    0 = flat envelope (pure rate code); 1 = full modulation at the carrier
    period. It documents that the envelope removes the carrier ripple.
    """
    channel = rates[np.argmax(rates.mean(axis=1))]
    t = np.arange(len(channel)) / sr
    phase = 2 * np.pi * freq * t
    p = channel - channel.mean()
    if np.abs(p).sum() < 1e-12:
        return 0.0
    return float(np.abs(np.sum(p * np.exp(1j * phase))) / np.sum(np.abs(p)))


def tone_rates(freq, snr_db=None, noise_seed=None, **kw):
    """Shortcut: frequency -> rate matrix (n_channels, n_samples)."""
    y = gammatone_filterbank(tone(freq, snr_db=snr_db, noise_seed=noise_seed))
    return envelope_to_rates(inner_hair_cell(envelope(y)), **kw)


# --- courtship song ---------------------------------------------------------
SONG_CARRIER_HZ = 250.0   # Hz, inside the carrier range of D. melanogaster song pulses
PULSE_WIDTH_MS = 10.0     # duration of each song pulse


def pulse_song(ipi_ms, carrier_hz=SONG_CARRIER_HZ, width_ms=PULSE_WIDTH_MS,
               duration=DURATION, sr=SR, jitter_ms=0.0, seed=None):
    """Courtship song: a train of song pulses separated by a fixed interval.

    The Drosophila melanogaster male courts with a pulse song. The
    INTER-PULSE INTERVAL is one of the main cues the female uses to recognize
    her species: about 34 ms in D. melanogaster and about 48 ms in D. simulans
    (Bennet-Clark & Ewing, 1969; Kyriacou & Hall, 1980). In the fly,
    selectivity for the interval appears downstream of the JO -> AMMC stage
    that this project models (Zhou et al., 2015; Baker et al., 2022), so
    classifying it is a proxy task imposed on an early-stage circuit.

    For the experimental design, the key point is that two songs with the same
    carrier and different intervals have practically the same spectrum. The
    interval is therefore NOT in the rate code of the input layer. It can only
    be recovered through temporal dynamics, which is where the network
    topology can make a difference.

    `jitter_ms` shifts each pulse at random, so the readout cannot memorize a
    particular temporal alignment.
    """
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    x = np.zeros_like(t)
    n_w = int(width_ms / 1000 * sr)
    window = np.hanning(n_w)
    pulse_wave = np.sin(2 * np.pi * carrier_hz * np.arange(n_w) / sr) * window
    rng = np.random.RandomState(seed)
    step = ipi_ms / 1000.0
    k = 0
    while True:
        t0 = k * step
        if jitter_ms:
            t0 += rng.uniform(-jitter_ms, jitter_ms) / 1000.0
        i0 = int(round(max(t0, 0) * sr))
        if i0 + n_w > len(x):
            break
        x[i0:i0 + n_w] += pulse_wave
        k += 1
    m = np.max(np.abs(x))
    return x / m if m > 0 else x


def song_rates(ipi_ms, jitter_seed=None, jitter_ms=2.0, **kw):
    """Shortcut: inter-pulse interval -> rate matrix."""
    y = gammatone_filterbank(pulse_song(ipi_ms, jitter_ms=jitter_ms,
                                        seed=jitter_seed))
    return envelope_to_rates(inner_hair_cell(envelope(y)), **kw)


def spike_trains(rates, channel_map, seed, duration=DURATION, dt=DT):
    """Inhomogeneous Poisson process: one spike realization for the input JO neurons.

    `channel_map[i]` is the channel that drives the i-th input neuron.
    `seed` identifies the REPETITION, never the class. Two different classes
    share the noise realization, so the comparison stays paired.
    """
    rng = np.random.RandomState(seed)
    n_steps = int(round(duration / dt))
    t_audio = np.linspace(0, duration, rates.shape[1])
    t_sim = np.linspace(0, duration, n_steps)
    lam = np.array([np.interp(t_sim, t_audio, c) for c in rates])
    idx, tms = [], []
    for i, channel in enumerate(channel_map):
        p = np.clip(lam[channel] * dt, 0, 1)
        s = np.flatnonzero(rng.random_sample(n_steps) < p)
        idx.append(np.full(len(s), i, np.int32))
        tms.append(s * dt * 1000.0)
    idx = np.concatenate(idx) if idx else np.zeros(0, np.int32)
    tms = np.concatenate(tms) if tms else np.zeros(0)
    o = np.argsort(tms, kind='stable')
    return idx[o], tms[o]
