"""Extraction of the auditory subgraph of Johnston's organ (JO) from the raw FlyWire files.

Pipeline (the single source of the subgraph; the exploratory analysis calls it
and documents each step):

  1. JO = neurons annotated sensory / mechanosensory / auditory (JO-A and JO-B)
  2. Second-order partners = the POSTsynaptic neurons of the JO
  3. Edges = every connection inside the set JO ∪ partners. Rows of the same
     (pre, post) pair are merged by SUMMING their contacts over neuropils
  4. The neurotransmitter is assigned per presynaptic NEURON, not per edge. It
     is the transmitter with most synapses over ALL of that neuron's
     connections in the full connectome, as in Eckstein et al. (2024), which
     applies Dale's principle
  5. Biological prior. Most JO neurons are cholinergic mechanosensory
     afferents (Ishikawa et al., 2017), so their outgoing edges are set to ACH.
     The transmitter classifier mispredicts several first-order sensory neurons
     as serotonergic (Eckstein et al., 2024)
  6. Threshold of at least 5 contacts per connection. Dorkenwald et al. (2024)
     use it for their analyses and Codex applies it by default; the authors
     call it reasonable but arbitrary
  7. Input layer = JO neurons with out-degree > 0 in the final graph. Only
     they can pass the stimulus on
  8. JO-A / JO-B subtype from consolidated_cell_types.csv.gz (annotations of
     Schlegel et al., 2024). It is the anatomical basis of the tonotopic
     mapping. JO-A and JO-B project to separate zones of the AMMC; JO-B
     prefers low-frequency vibrations and JO-A carries the high-frequency
     responses (Kamikouchi et al., 2009; Matsuo et al., 2014)

Changes from an earlier version. The input layer no longer includes the 146 JO
neurons without outgoing connections. The neurotransmitter is no longer taken
with groupby('first'), which depended on the row order of the file. JO
afferents now get the cholinergic prior.
"""
from __future__ import annotations

import json
from pathlib import Path
import numpy as np
import pandas as pd

from . import DATA_RAW, DATA_PROCESSED, FLYWIRE_SNAPSHOT, ROOT

# Sign convention of Dorkenwald et al. (2024): acetylcholine excites, GABA and
# glutamate inhibit. Glutamate inhibits in the fly central brain through the
# GluClα receptor (Liu & Wilson, 2013). Serotonin, dopamine and octopamine go to
# a separate modulatory channel, which is a choice of this project.
POLARITY = {'ACH': 'Excitatory', 'GABA': 'Inhibitory', 'GLUT': 'Inhibitory',
            'SER': 'Modulatory', 'DA': 'Modulatory', 'OCT': 'Modulatory'}
MIN_CONTACTS = 5
CHUNK = 3_000_000


def load_annotations(path=None):
    return pd.read_csv(path or DATA_RAW / 'classification.csv.gz')


def load_cell_types(path=None):
    """Fine cell type from Codex. For the auditory JO neurons it is JO-A or JO-B."""
    path = path or DATA_RAW / 'consolidated_cell_types.csv.gz'
    if not path.exists():
        return None
    return pd.read_csv(path)[['root_id', 'primary_type']]


def jo_neurons(annot):
    """The 393 auditory afferents of Johnston's organ (both sides)."""
    m = ((annot['super_class'] == 'sensory') & (annot['class'] == 'mechanosensory')
         & (annot['sub_class'] == 'auditory'))
    return annot[m].copy()


def nt_per_neuron(path=None, chunk=CHUNK):
    """Dominant neurotransmitter of each presynaptic neuron, weighted by synapse count.

    It scans the FULL connectome, not only the subgraph. The transmitter is a
    property of the neuron, so it should be estimated from all of its evidence.
    Returns a DataFrame with neuron_nt, purity (fraction of synapses that
    support the dominant transmitter) and syn_total.
    """
    path = path or DATA_RAW / 'connections_buhmann_no_threshold.csv.gz'
    acc = {}
    for ch in pd.read_csv(path, usecols=['pre_root_id', 'nt_type', 'syn_count'],
                          chunksize=chunk):
        for k, v in ch.groupby(['pre_root_id', 'nt_type'], observed=True)['syn_count'].sum().items():
            acc[k] = acc.get(k, 0) + v
    s = pd.Series(acc)
    s.index = pd.MultiIndex.from_tuples(s.index, names=['pre_root_id', 'nt_type'])
    df = s.reset_index(name='syn')
    # Deterministic tie-break: most synapses first, then alphabetical order of the NT code.
    df = df.sort_values(['pre_root_id', 'syn', 'nt_type'], ascending=[True, False, True])
    dom = df.groupby('pre_root_id').first()['nt_type']
    tot = df.groupby('pre_root_id')['syn'].sum()
    mx = df.groupby('pre_root_id')['syn'].max()
    return pd.DataFrame({'neuron_nt': dom, 'purity': mx / tot, 'syn_total': tot})


def subgraph_connections(jo_ids, path=None, chunk=CHUNK):
    """Raw rows (pre, post, neuropil, contacts) inside JO ∪ partners."""
    path = path or DATA_RAW / 'connections_buhmann_no_threshold.csv.gz'
    outgoing = []
    for ch in pd.read_csv(path, chunksize=chunk):
        outgoing.append(ch[ch.pre_root_id.isin(jo_ids)])
    partners = set(pd.concat(outgoing, ignore_index=True).post_root_id) - set(jo_ids)
    nodes = set(jo_ids) | partners
    internal_rows = []
    for ch in pd.read_csv(path, chunksize=chunk):
        internal_rows.append(ch[ch.pre_root_id.isin(nodes) & ch.post_root_id.isin(nodes)])
    return pd.concat(internal_rows, ignore_index=True), partners


def build(min_contacts=MIN_CONTACTS, save=True, verbose=True, out_dir=None):
    """Runs the whole extraction and returns (nodes, edges, meta)."""
    log = print if verbose else (lambda *a, **k: None)

    annot = load_annotations()
    jo = jo_neurons(annot)
    jo_ids = set(jo.root_id)
    log(f'1. JO neurons (auditory): {len(jo_ids)}   '
        f'{dict(jo.side.value_counts())}')

    raw_rows, partners = subgraph_connections(jo_ids)
    log(f'2. Second-order postsynaptic partners: {len(partners)}')
    log(f'3. Internal rows (pre→post→neuropil): {len(raw_rows):,}')

    edges = (raw_rows.groupby(['pre_root_id', 'post_root_id'], as_index=False)['syn_count']
             .sum().rename(columns={'syn_count': 'weight'}))
    log(f'   Unique connections after merging neuropils: {len(edges):,} '
        f'(collapse {len(raw_rows)/len(edges):.2f}×)')

    nt_by_neuron = nt_per_neuron()
    edges['nt'] = edges.pre_root_id.map(nt_by_neuron['neuron_nt'])
    edges['nt_purity'] = edges.pre_root_id.map(nt_by_neuron['purity'])
    is_jo = edges.pre_root_id.isin(jo_ids)
    edges['nt_source'] = np.where(is_jo, 'jo_biological_prior', 'weighted_majority')
    n_reassigned = int((is_jo & (edges.nt != 'ACH')).sum())
    edges.loc[is_jo, 'nt'] = 'ACH'
    log(f'4. NT per neuron: mean purity {nt_by_neuron.purity.mean():.3f}')
    log(f'5. JO cholinergic prior: {n_reassigned} afferent edges reassigned to ACH')

    edges['polarity'] = edges.nt.map(POLARITY)
    assert edges.polarity.notna().all(), 'Neurotransmitter without a defined polarity'

    final_edges = edges[edges.weight >= min_contacts].copy().reset_index(drop=True)
    final_nodes = sorted(set(final_edges.pre_root_id) | set(final_edges.post_root_id))
    input_jo = sorted(set(final_edges[final_edges.pre_root_id.isin(jo_ids)].pre_root_id))
    log(f'6. Threshold ≥{min_contacts}: {len(final_edges):,} connections, {len(final_nodes)} nodes, '
        f'{len(set(final_nodes) & jo_ids)} JO')
    log(f'7. Input layer = JO neurons with outgoing connections (out-degree > 0): {len(input_jo)}')

    info = annot.set_index('root_id')
    nodes = pd.DataFrame({'root_id': final_nodes})
    nodes['is_jo'] = nodes.root_id.isin(jo_ids)
    nodes['is_input'] = nodes.root_id.isin(input_jo)
    for c in ['super_class', 'class', 'sub_class', 'side', 'nerve']:
        nodes[c if c != 'class' else 'cell_class'] = nodes.root_id.map(info[c])

    cell_types = load_cell_types()
    if cell_types is not None:
        nodes['cell_type'] = nodes.root_id.map(cell_types.set_index('root_id').primary_type)
        n_typed = int(nodes.loc[nodes.is_input, 'cell_type'].notna().sum())
        log(f'8. Cell subtype: {n_typed}/{len(input_jo)} input neurons typed '
            + str(dict(nodes.loc[nodes.is_input, 'cell_type'].value_counts())))
    else:
        nodes['cell_type'] = pd.NA
        log('8. consolidated_cell_types.csv.gz not found: no cell subtype')

    meta = {
        'flywire_snapshot': FLYWIRE_SNAPSHOT,
        'min_contacts': int(min_contacts),
        'n_jo_total': len(jo_ids),
        'n_partners': len(partners),
        'n_nodes': len(final_nodes),
        'n_jo_in_graph': int(nodes.is_jo.sum()),
        'n_jo_input': len(input_jo),
        'n_edges': len(final_edges),
        'edges_by_polarity': {k: int(v) for k, v in final_edges.polarity.value_counts().items()},
        'jo_edges_reassigned_to_ach': n_reassigned,
        'total_weight': int(final_edges.weight.sum()),
        'jo_input_by_side': {k: int(v) for k, v in
                             nodes[nodes.is_input].side.value_counts().items()},
        'jo_input_by_subtype': {k: int(v) for k, v in
                                nodes[nodes.is_input].cell_type.value_counts().items()},
    }

    if save:
        d = Path(out_dir) if out_dir else DATA_PROCESSED
        d.mkdir(parents=True, exist_ok=True)
        nodes.to_csv(d / 'jo_nodes.csv', index=False)
        final_edges.to_csv(d / 'jo_edges.csv', index=False)
        (d / 'jo_meta.json').write_text(json.dumps(meta, indent=2, ensure_ascii=False))
        shown = d.resolve().relative_to(ROOT) if d.resolve().is_relative_to(ROOT) else d
        log(f'\nSaved to {shown}/  (jo_nodes.csv, jo_edges.csv, jo_meta.json)')
    return nodes, final_edges, meta
