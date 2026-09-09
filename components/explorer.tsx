/* Browser storage is synchronized after hydration; the second render is intentional. */
/* oxlint-disable react/react-compiler */
'use client';
import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import {
  Waves,
  Layers as LayerIcon,
  ArrowUpRight,
  ArrowUp,
  FileText,
  ExternalLink,
  LocateFixed,
  Info,
  ChevronRight,
  Download,
  Check,
  Square,
  Route,
  Fish,
  ScanSearch,
  X,
  Maximize2,
  Minimize2,
  ChevronDown,
  Camera,
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import Ocean from '@/components/ocean';
import OpenAILogo from '@/components/openai-logo';
import ReferenceGallery from '@/components/reference-gallery';
import {
  referenceImages,
  referenceLocations,
  imageLicenseUrl,
  annotationLicenseUrl,
} from '@/lib/abyss/fathomnet';
import ChatText from '@/components/chat-text';
import {
  candidates as compute,
  makeBrief,
  components,
  WEIGHTS,
} from '@/lib/abyss/science';
import { grid, runDemo } from '@/lib/abyss/tools';
import { sources, sourceById } from '@/lib/abyss/registry';
import { readSSE } from '@/lib/abyss/sse';
import type {
  Candidate,
  DiveBrief,
  Layers,
  UiEvent,
  Track,
} from '@/lib/abyss/types';
import Voting from '@/components/voting';
const initial = compute(grid);
const prompts = [
  {
    id: 'direct',
    label: 'Show direct measurements only',
    full: 'Show only areas supported by direct-measurement source types.',
  },
  {
    id: 'rov',
    label: 'Show recorded ROV activity',
    full: 'Show recorded ROV survey activity. Explain in English.',
  },
  {
    id: 'discover',
    label: 'Find a deep public-data gap',
    full: 'Find a deep area that is mapped but has sparse public biological and visual-observation coverage.',
  },
  {
    id: 'brief',
    label: 'Explain this candidate',
    full: 'Explain what we know here, what the public datasets do not tell us, and why this candidate is interesting.',
  },
] as const;
const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
export default function Explorer() {
  const [truth, setTruth] = useState(100),
    [layers, setLayers] = useState<Layers>({
      terrain: true,
      provenance: true,
      rov: false,
      obis: false,
      grid: false,
    }),
    [list, setList] = useState(initial),
    [selected, setSelected] = useState<string | null>(initial[0]?.id ?? null),
    [focusKey, setFocusKey] = useState(0),
    [overviewKey, setOverviewKey] = useState(0),
    [minDepth, setMinDepth] = useState(2000),
    [brief, setBrief] = useState<DiveBrief | null>(null),
    [sourceOpen, setSourceOpen] = useState(false),
    [briefOpen, setBriefOpen] = useState(false),
    [track, setTrack] = useState<Track | null>(null),
    [connected, setConnected] = useState(false),
    [provider, setProvider] = useState(''),
    [busy, setBusy] = useState(false),
    [input, setInput] = useState(''),
    [status, setStatus] = useState('Loading verified GEBCO terrain…'),
    [toolLog, setToolLog] = useState<string[]>([]),
    [messages, setMessages] = useState<
      { role: 'user' | 'assistant'; content: string }[]
    >([]),
    [voteOpen, setVoteOpen] = useState(false),
    [drawer, setDrawer] = useState<'layers' | 'astra' | null>(null),
    [focused, setFocused] = useState(false),
    [journeysOpen, setJourneysOpen] = useState(true),
    [photosOpen, setPhotosOpen] = useState(false),
    [photosVisible, setPhotosVisible] = useState(true),
    [photoLocationId, setPhotoLocationId] = useState<string | null>(null),
    [photoFocus, setPhotoFocus] = useState<{ id: string; key: number } | null>(
      null,
    );
  function openPhotos(locationId: string | null = null) {
    setPhotoLocationId(locationId);
    setPhotosOpen(true);
    setDrawer(null);
    setFocused(false);
  }
  const layerButton = useRef<HTMLButtonElement>(null),
    astraButton = useRef<HTMLButtonElement>(null);
  function closeDrawer() {
    (drawer === 'layers' ? layerButton : astraButton).current?.focus();
    setDrawer(null);
  }
  useEffect(() => {
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (drawer)
          (drawer === 'layers' ? layerButton : astraButton).current?.focus();
        setDrawer(null);
        setFocused(false);
      }
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [drawer]);
  function explore(mode: 'rov' | 'obis' | 'discover') {
    setJourneysOpen(false);
    setDrawer(null);
    setLayers((p) => ({
      ...p,
      terrain: true,
      rov: mode === 'rov' || mode === 'obis',
      obis: mode === 'obis',
      grid: mode === 'discover',
    }));
    if (mode === 'discover' && list[1]) select(list[1].id);
    else setOverviewKey((k) => k + 1);
    if (mode === 'obis') {
      setPhotosVisible(true);
      openPhotos();
    }
  }
  const abort = useRef<AbortController | null>(null),
    chatEnd = useRef<HTMLDivElement>(null);
  const active = list.find((c) => c.id === selected) ?? null;
  useEffect(() => {
    void fetch('/api/astra')
      .then((r) => r.json())
      .then((s) => {
        const state = s as { connected: boolean; provider?: string };
        setConnected(Boolean(state.connected));
        setProvider(state.provider ?? 'responses-api');
      })
      .catch(() => setConnected(false));
    try {
      const d = Number(localStorage.getItem('abyss-min-depth') ?? 2000);
      if (d >= 0 && d <= 11000) {
        setMinDepth(d);
        const c = compute(grid, d);
        setList(c);
        setSelected(c[0]?.id ?? null);
      }
    } catch {}
    return () => abort.current?.abort();
  }, []);
  useEffect(() => {
    chatEnd.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [messages, busy]);
  function select(id: string) {
    const c = list.find((c) => c.id === id);
    if (!c) return;
    setSelected(id);
    setFocusKey((n) => n + 1);
    setBrief(makeBrief(c));
    if (window.scrollY > 160)
      window.scrollTo({
        top: 0,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
      });
  }
  function apply(e: UiEvent) {
    switch (e.type) {
      case 'layers':
        setLayers((v) => ({ ...v, ...(e.value as Partial<Layers>) }));
        break;
      case 'truth':
        setTruth(e.value as number);
        break;
      case 'focus':
        setSelected(e.value as string);
        setFocusKey((n) => n + 1);
        break;
      case 'candidates': {
        const v = e.value as { candidates: Candidate[]; minDepth: number };
        setList(v.candidates);
        setMinDepth(v.minDepth);
        setSelected(v.candidates[0]?.id ?? null);
        setBrief(null);
        try {
          localStorage.setItem('abyss-min-depth', String(v.minDepth));
        } catch {}
        break;
      }
      case 'brief':
        setBrief(e.value as DiveBrief);
        break;
    }
  }
  async function chat(text: string) {
    if (!text.trim() || busy) return;
    setInput('');
    setMessages((m) => [
      ...m,
      { role: 'user', content: text },
      { role: 'assistant', content: '' },
    ]);
    setToolLog([]);
    setBusy(true);
    const controller = new AbortController();
    abort.current = controller;
    const update = (delta: string) =>
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = {
          role: 'assistant',
          content: (copy.at(-1)?.content ?? '') + delta,
        };
        return copy;
      });
    try {
      const r = await fetch('/api/astra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: messages.slice(-10),
          minDepth,
          selectedId: selected,
        }),
        signal: controller.signal,
      });
      if (!r.ok) {
        const b = (await r.json()) as { error?: string };
        throw Error(b.error ?? 'Astra is unavailable.');
      }
      if (!r.body) throw Error('No response stream.');
      for await (const e of readSSE(r.body)) {
        if (e.type === 'delta')
          update(
            String(e.value).replace(
              /https?:\/\/\S+/g,
              '[Inspect source registry]',
            ),
          );
        if (e.type === 'tool') setToolLog((t) => [...t, String(e.value)]);
        if (e.type === 'ui') apply(e.value as UiEvent);
        if (e.type === 'error') update('\n' + e.value);
      }
    } catch (error) {
      update(
        controller.signal.aborted
          ? '\nStopped. Adjust your constraints and send a new request.'
          : error instanceof Error
            ? error.message
            : 'Astra is unavailable.',
      );
    } finally {
      setBusy(false);
      abort.current = null;
    }
  }
  function demo(id: (typeof prompts)[number]['id']) {
    if (connected) {
      void chat(prompts.find((p) => p.id === id)!.full);
      return;
    }
    const r = runDemo(id, { minDepth, selectedId: selected });
    r.events.forEach(apply);
    setToolLog(r.calls);
    setMessages((m) => [
      ...m,
      { role: 'user', content: prompts.find((p) => p.id === id)!.full },
      { role: 'assistant', content: 'Snapshot demo · ' + r.text },
    ]);
  }
  function updateDepth(n: number) {
    abort.current?.abort();
    setMinDepth(n);
    const c = compute(grid, n);
    setList(c);
    setSelected(c[0]?.id ?? null);
    setBrief(null);
    setFocusKey((k) => k + 1);
    try {
      localStorage.setItem('abyss-min-depth', String(n));
    } catch {}
  }
  function download() {
    if (!brief) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(
      new Blob([JSON.stringify(brief, null, 2)], { type: 'application/json' }),
    );
    a.download = `abyss-dive-brief-${brief.candidateId}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const labels: {
    key: keyof Layers;
    name: string;
    note: string;
    color: string;
  }[] = [
    {
      key: 'terrain',
      name: 'Seafloor terrain',
      note: 'GEBCO · 15 arc-seconds',
      color: '#56beaf',
    },
    {
      key: 'provenance',
      name: 'Source provenance',
      note: 'GEBCO · categorical TID',
      color: '#b0cdd2',
    },
    {
      key: 'rov',
      name: 'Robot dive paths',
      note: 'NOAA · 4 paths to replay',
      color: '#3ee6d6',
    },
    {
      key: 'obis',
      name: 'Traces of life',
      note: 'OBIS · click a purple cell',
      color: '#b69bea',
    },
    {
      key: 'grid',
      name: 'Analysis grid',
      note: '16 × 16 exploration cells',
      color: '#6f9dbb',
    },
  ];
  return (
    <main className={`abyss-app immersive-app ${focused ? 'is-focused' : ''}`}>
      <header className="topbar">
        <div className="brand">
          <Waves />
          <strong>ABYSS COMMONS</strong>
          <span>MAP THE UNKNOWN</span>
        </div>
        <div className="header-actions">
          <button
            ref={layerButton}
            aria-label="Layers"
            className="header-tool"
            aria-expanded={drawer === 'layers'}
            aria-controls="evidence-drawer"
            onClick={() => {
              setFocused(false);
              setDrawer((v) => (v === 'layers' ? null : 'layers'));
            }}
          >
            <LayerIcon size={16} />
            <span>Layers</span>
          </button>
          <button
            ref={astraButton}
            aria-label="Ask Astra"
            className="header-tool astra-launch"
            aria-expanded={drawer === 'astra'}
            aria-controls="astra-drawer"
            onClick={() => {
              setFocused(false);
              setDrawer((v) => (v === 'astra' ? null : 'astra'));
            }}
          >
            <OpenAILogo size={16} />
            <span>Ask Astra</span>
            <i
              className={
                connected ? 'connection-dot connected' : 'connection-dot'
              }
            />
          </button>
          <button
            className="header-tool focus-toggle"
            aria-label={focused ? 'Exit focus view' : 'Enter focus view'}
            aria-pressed={focused}
            title={focused ? 'Exit focus view' : 'Focus on the ocean'}
            onClick={() => {
              setFocused((v) => !v);
              setDrawer(null);
            }}
          >
            {focused ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <div className="snapshot-badge">
            <i /> SNAPSHOT · 08 SEP 2026
          </div>
          <button className="text-button" onClick={() => setSourceOpen(true)}>
            <Info size={15} /> Sources
          </button>
        </div>
      </header>
      <div className={`workspace ${journeysOpen ? 'journeys-open' : ''}`}>
        <aside
          id="evidence-drawer"
          className="layers-panel ocean-drawer"
          aria-label="Evidence layers"
          hidden={drawer !== 'layers'}
        >
          <button
            className="drawer-close"
            aria-label="Close evidence layers"
            onClick={closeDrawer}
          >
            <X size={18} />
          </button>
          <div className="eyebrow">
            <LayerIcon size={15} /> EVIDENCE LAYERS
          </div>
          <h2>Layers of discovery.</h2>
          <p className="panel-intro">
            Terrain, expeditions, life.
            <br />
            Bring the evidence together.
          </p>
          {labels.map((l) => (
            <div className="layer" key={l.key}>
              <div>
                <label htmlFor={'layer-' + l.key}>
                  <i style={{ background: l.color }} />
                  {l.name}
                </label>
                <small>{l.note}</small>
              </div>
              <Switch
                id={'layer-' + l.key}
                checked={layers[l.key]}
                onCheckedChange={(v) =>
                  setLayers((p) => ({ ...p, [l.key]: v }))
                }
                aria-label={l.name}
              />
            </div>
          ))}
          <div className="layer">
            <div>
              <label htmlFor="layer-photos">
                <i style={{ background: '#f1b8cb' }} /> Reference photos
              </label>
              <small>FathomNet · 3 registered locations</small>
              <button
                className="text-button photo-layer-link"
                onClick={() => openPhotos()}
              >
                Browse {referenceImages.length} real images{' '}
                <ArrowUpRight size={13} />
              </button>
            </div>
            <Switch
              id="layer-photos"
              checked={photosVisible}
              onCheckedChange={setPhotosVisible}
              aria-label="Reference photo locations"
            />
          </div>
          <div className="truth-panel">
            <div className="truth-header">
              <span className="eyebrow">REVEAL THE EVIDENCE</span>
              <span className="truth-state">
                {truth === 0
                  ? 'DIRECT ONLY'
                  : truth === 100
                    ? 'ALL SOURCE TYPES'
                    : 'FILTERED'}
              </span>
            </div>
            <div className="truth-labels">
              <b>Measured</b>
              <span>Include inferred</span>
            </div>
            <span id="provenance-label" className="sr-only">
              Data provenance
            </span>
            <Slider
              value={[truth]}
              onValueChange={(v) => {
                setTruth(Array.isArray(v) ? v[0] : v);
                setLayers((l) => ({ ...l, provenance: true }));
              }}
              aria-labelledby="provenance-label"
            />
            <p>
              Filter by how the terrain was mapped, not its statistical
              confidence.
            </p>
          </div>
          <div className="legend">
            <div className="eyebrow">SOURCE TYPES</div>
            <p>
              <i className="direct" /> Direct measurement <b>98.4%</b>
            </p>
            <p>
              <i className="indirect" /> Indirect / derived <b>1.6%</b>
            </p>
            <p>
              <i className="unknown" /> Mixed / unknown <b>&lt;0.1%</b>
            </p>
            <small>
              Underwater raster cells. Source type describes how the grid was
              compiled.
            </small>
          </div>
          <div className="source-summary">
            <span className="eyebrow">THE LOCAL SNAPSHOT</span>
            <div className="big-stat">
              323,640<small>public occurrence records</small>
            </div>
            <p>65 contributing datasets</p>
            <button className="text-button" onClick={() => setSourceOpen(true)}>
              Inspect data & licenses <ArrowUpRight size={14} />
            </button>
          </div>
        </aside>
        <section className="ocean-panel">
          <div className="map-heading">
            <div className="map-heading-top">
              <span className="eyebrow">SOUTH PACIFIC / 01</span>
              <button
                className="photo-gallery-launch"
                onClick={() => openPhotos()}
                aria-label="View real dive photos"
              >
                <Camera size={13} /> Real dive photos{' '}
                <span>{referenceImages.length}</span>
              </button>
            </div>
            <h1>
              American Samoa<span>Follow the evidence into the deep.</span>
            </h1>
            <p>14°–15° S · 169°–171° W</p>
          </div>
          <Ocean
            truth={truth}
            layers={layers}
            candidates={list}
            selected={selected}
            focusKey={focusKey}
            overviewKey={overviewKey}
            photosVisible={photosVisible}
            photoFocus={photoFocus}
            onPhotoLocation={openPhotos}
            photoGalleryOpen={photosOpen}
            onSelect={select}
            onTrack={setTrack}
            onStatus={setStatus}
            onLayers={(v) => setLayers((p) => ({ ...p, ...v }))}
            onInspect={() => setFocused(false)}
            onSwimStart={() => {
              setDrawer(null);
              setJourneysOpen(false);
              setFocused(true);
            }}
          />
          <div className="map-status">{status}</div>
          {layers.obis && (
            <div className="obis-legend">
              <i /> Public records <span>1</span>
              <div />
              <span>60,506</span>
              <small>Logarithmic visibility</small>
            </div>
          )}
          {layers.rov && (
            <div className="track-legend">
              Cyan: recorded paths · Amber: DIVE01
              <br />
              Draped on GEBCO for display; vehicle depth unavailable.
            </div>
          )}
        </section>
        <aside
          id="astra-drawer"
          className="astra-panel ocean-drawer"
          aria-label="Astra exploration assistant"
          hidden={drawer !== 'astra'}
        >
          <button
            className="drawer-close"
            aria-label="Close Astra"
            onClick={closeDrawer}
          >
            <X size={18} />
          </button>
          <Image
            unoptimized
            className="astra-atmosphere"
            src="/imagery/abyss-atmosphere.jpg"
            alt=""
            width="1536"
            height="1024"
          />
          <div className="panel-heading">
            <OpenAILogo size={18} />
            <h2>Astra</h2>
            <span className="mode-chip">
              {connected
                ? provider === 'codex-app-server'
                  ? 'CODEX CONNECTED'
                  : 'CONNECTED'
                : 'AI NOT CONNECTED'}
            </span>
          </div>
          <h3>
            Let evidence lead
            <br />
            the next dive.
          </h3>
          <p>
            Find what is mapped.
            <br />
            Ask what is missing.
          </p>
          <div className="quick-prompts">
            {prompts.map((p, i) => (
              <button
                className="quick-prompt"
                key={p.id}
                onClick={() => demo(p.id)}
                disabled={busy}
              >
                <span className="prompt-number">0{i + 1}</span>
                {p.label}
                <ArrowUpRight size={16} />
              </button>
            ))}
          </div>
          <div className="depth-control">
            <label htmlFor="depth">Minimum mean depth</label>
            <div>
              <input
                id="depth"
                type="number"
                min="0"
                max="11000"
                step="100"
                value={minDepth}
                onChange={(e) =>
                  updateDepth(
                    Math.max(0, Math.min(11000, Number(e.target.value))),
                  )
                }
              />
              <span>meters</span>
            </div>
          </div>
          <div className="chat-messages" aria-live="polite">
            {messages.map((m, i) => (
              <div key={i} className={'message ' + m.role}>
                {m.role === 'assistant' && (
                  <span className="message-label">
                    {connected ? 'ASTRA' : 'SNAPSHOT DEMO'}
                  </span>
                )}
                <ChatText text={m.content || 'Consulting the evidence…'} />
              </div>
            ))}
            <div ref={chatEnd} />
          </div>
          {toolLog.length > 0 && (
            <div className="tool-log">
              <Check size={13} /> {toolLog.length} data tools executed
              <details>
                <summary>Inspect calls</summary>
                {toolLog.map((t, i) => (
                  <code key={i}>{t}</code>
                ))}
              </details>
            </div>
          )}
          <form
            className="chat-input"
            onSubmit={(e) => {
              e.preventDefault();
              void chat(input);
            }}
          >
            <input
              aria-label="Ask Astra"
              placeholder={
                connected
                  ? 'Ask Astra about this region…'
                  : 'Connect Astra for free-form questions'
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={!connected}
            />
            {busy ? (
              <button
                type="button"
                aria-label="Stop Astra"
                onClick={() => abort.current?.abort()}
              >
                <Square size={15} />
              </button>
            ) : (
              <button
                aria-label="Send message"
                disabled={!connected || !input.trim()}
              >
                <ArrowUp size={18} />
              </button>
            )}
          </form>
          {!connected && (
            <div className="integrity-note">
              Quick prompts run explicit snapshot tools. Run locally with Codex
              signed in to enable AI chat.
            </div>
          )}
          <button
            className="brief-peek"
            disabled={!active}
            onClick={() => {
              if (active && !brief) setBrief(makeBrief(active));
              setBriefOpen(true);
            }}
          >
            <div className="brief-icon">
              <FileText size={18} />
            </div>
            <div>
              <span className="eyebrow">COMMUNITY DIVE BRIEF</span>
              <strong>
                {brief ? 'Evidence is ready' : 'Inspect candidate evidence'}
              </strong>
            </div>
            <ChevronRight size={17} />
          </button>
        </aside>
        <div className="expedition-bar">
          <button
            className="expedition-toggle"
            aria-expanded={journeysOpen}
            aria-controls="expedition-dock"
            onClick={() => setJourneysOpen((v) => !v)}
          >
            <Waves size={16} />
            <span>
              {journeysOpen ? 'Hide expeditions' : 'Choose an expedition'}
            </span>
            <ChevronDown size={14} />
          </button>
          <a href="#next-dives">
            Compare next dives <ChevronDown size={13} />
          </a>
        </div>
        <section
          id="expedition-dock"
          className="explore-ribbon"
          aria-label="Ways to explore"
          hidden={!journeysOpen}
        >
          <div className="ribbon-intro">
            <span className="eyebrow">DIVE INTO THE UNKNOWN</span>
            <h2>Where will you dive?</h2>
            <p>Three ways to follow your curiosity.</p>
          </div>
          <button
            className="journey-card journey-rov"
            onClick={() => explore('rov')}
          >
            <Image
              unoptimized
              className="journey-art"
              src="/imagery/abyss-rov.jpg"
              alt=""
              width="1536"
              height="1024"
            />
            <span className="journey-icon">
              <Route size={18} />
            </span>
            <div>
              <small>01 / FOLLOW THE DIVE</small>
              <strong>Follow a robot’s journey</strong>
              <span>Replay four recorded dive paths</span>
            </div>
            <ArrowUpRight size={18} />
          </button>
          <button
            className="journey-card journey-life"
            onClick={() => explore('obis')}
          >
            <Image
              unoptimized
              className="journey-art"
              src="/imagery/abyss-corals.jpg"
              alt=""
              width="1536"
              height="1024"
            />
            <span className="journey-icon">
              <Fish size={18} />
            </span>
            <div>
              <small>02 / TRACES OF LIFE</small>
              <strong>Find traces of life</strong>
              <span>Browse real photos & public records</span>
            </div>
            <ArrowUpRight size={18} />
          </button>
          <button
            className="journey-card journey-frontier"
            onClick={() => explore('discover')}
          >
            <Image
              unoptimized
              className="journey-art"
              src="/imagery/abyss-ridge.jpg"
              alt=""
              width="1536"
              height="1024"
            />
            <span className="journey-icon">
              <ScanSearch size={18} />
            </span>
            <div>
              <small>03 / THE NEXT DISCOVERY</small>
              <strong>Explore the unknown</strong>
              <span>Compare places to look next</span>
            </div>
            <ArrowUpRight size={18} />
          </button>
          <p className="imagery-note">
            AI concept imagery · not field observations
          </p>
        </section>
      </div>
      <section className="candidate-section" id="next-dives">
        <div className="candidate-heading">
          <div className="eyebrow">WHERE SHOULD WE LOOK NEXT?</div>
          <span>Exploration heuristic · not scientific value</span>
        </div>
        <div className="candidate-row">
          {list.length ? (
            list.map((c) => (
              <button
                className={
                  'candidate-card ' + (selected === c.id ? 'selected' : '')
                }
                key={c.id}
                onClick={() => select(c.id)}
              >
                <div className="candidate-top">
                  <span className="candidate-letter">{c.archetype}</span>
                  <span className="candidate-depth">
                    ↓ {fmt(c.meanDepth)} m
                  </span>
                  <LocateFixed size={15} />
                </div>
                <strong>{c.title}</strong>
                <p>{c.subtitle}</p>
                <div className="candidate-metrics">
                  <span>
                    <b>{(c.directFraction * 100).toFixed(0)}%</b> direct
                  </span>
                  <span>
                    <b>{fmt(c.obisRecords)}</b> records
                  </span>
                  <span className="score">
                    {Math.round(c.score * 100)}
                    <small>/100</small>
                  </span>
                </div>
              </button>
            ))
          ) : (
            <div className="no-candidates">
              No candidates meet {fmt(minDepth)} m. Reduce the minimum depth to
              explore this snapshot.
            </div>
          )}
          <button className="vote-card" onClick={() => setVoteOpen(true)}>
            <div className="eyebrow">A COMMUNITY QUESTION</div>
            <strong>
              60 <span>ROV MINUTES</span>
            </strong>
            <p>Where would you send them?</p>
            <span className="vote-cta">
              Cast your vote <ArrowUpRight size={17} />
            </span>
            <small>Hypothetical exploration time</small>
          </button>
        </div>
      </section>
      <footer className="bottom-bar">
        <button className="text-button" onClick={() => setSourceOpen(true)}>
          GEBCO 2026 · NOAA Ocean Exploration · OBIS <ExternalLink size={12} />
        </button>
        <span>
          Public-data gaps do not prove an absence of life or prior exploration.
        </span>
      </footer>
      <ReferenceGallery
        open={photosOpen}
        onOpenChange={setPhotosOpen}
        locationId={photoLocationId}
        onLocate={(id) => {
          setPhotosOpen(false);
          setPhotosVisible(true);
          setFocused(false);
          setJourneysOpen(false);
          setPhotoFocus((p) => ({ id, key: (p?.key ?? 0) + 1 }));
        }}
      />
      <Dialog open={sourceOpen} onOpenChange={setSourceOpen}>
        <DialogContent className="evidence-dialog">
          <DialogTitle>Evidence, sources & limitations</DialogTitle>
          <DialogDescription>
            Fixed local snapshots, retrieved 8 September 2026. No scientific
            data is labeled live.
          </DialogDescription>
          <p>
            Decorative ROV, coral, ridge and ocean images are AI-generated
            concepts, not observations. The interactive terrain and evidence
            layers use the datasets below.
          </p>
          {sources.map((s) => (
            <article className="source-entry" key={s.id}>
              <div className="eyebrow">{s.provider} · SNAPSHOT</div>
              <h3>{s.dataset}</h3>
              <p>{s.attribution}</p>
              <p className="license">{s.license}</p>
              <small>Retrieved {new Date(s.retrievedAt).toISOString()}</small>
              <div className="source-links">
                <a href={s.sourceUrl} target="_blank" rel="noreferrer">
                  Official source ↗
                </a>
                <a href={s.metadataUrl} target="_blank" rel="noreferrer">
                  Full metadata ↗
                </a>
              </div>
            </article>
          ))}
          <article className="source-entry">
            <div className="eyebrow">FATHOMNET · REFERENCE IMAGES</div>
            <h3>{referenceImages.length} original NOAA images</h3>
            <p>
              NOAA Ocean Exploration, via FathomNet. Original PNGs are
              unchanged. All annotation labels are unverified. Images share{' '}
              {referenceLocations.length} registered positions; location
              precision is unavailable.
            </p>
            <p>
              These reference images are separate from OBIS occurrence counts
              and exploration scores. They do not establish species presence at
              an exact point or explain habitat causes.
            </p>
            <div className="source-links">
              <a href={imageLicenseUrl} target="_blank" rel="noreferrer">
                Images: CC BY-NC-ND 4.0 ↗
              </a>
              <a href={annotationLicenseUrl} target="_blank" rel="noreferrer">
                Annotations: CC BY-NC 4.0 ↗
              </a>
              <a
                href="https://www.fathomnet.org/datause"
                target="_blank"
                rel="noreferrer"
              >
                FathomNet data use ↗
              </a>
            </div>
            <button
              className="text-button"
              onClick={() => {
                setSourceOpen(false);
                openPhotos();
              }}
            >
              Open reference gallery <ArrowUpRight size={14} />
            </button>
          </article>
          <a
            href="/data/snapshot/obis/dataset_licenses_and_citations.json"
            target="_blank"
            rel="noreferrer"
          >
            Inspect all 65 OBIS source licenses and citations ↗
          </a>
          <p>
            GEBCO is not for navigation. NOAA paths are draped on the terrain
            for display; per-vertex depth and time are unavailable. DIVE13 has a
            source-date inconsistency. OBIS cell counts are records, not
            abundance, and contain mixed licenses including CC-BY-NC.
          </p>
        </DialogContent>
      </Dialog>
      <Dialog open={briefOpen} onOpenChange={setBriefOpen}>
        <DialogContent className="evidence-dialog">
          <DialogTitle>Community Dive Brief</DialogTitle>
          <DialogDescription>
            {brief?.title ?? 'Select a candidate to inspect evidence.'}
          </DialogDescription>
          {brief && (
            <>
              <div className="brief-coordinates">
                {active &&
                  `${Math.abs(active.centerLat).toFixed(4)}° S · ${Math.abs(active.centerLon).toFixed(4)}° W`}
              </div>
              {(
                [
                  ['What we know', brief.known],
                  ['What the cache does not tell us', brief.dataGaps],
                  ['Why consider this cell', brief.whyExplore],
                ] as const
              ).map(([title, items]) => (
                <section className="brief-section" key={title}>
                  <h3>{title}</h3>
                  {items.map((i, k) => (
                    <p key={k}>
                      {i.statement}
                      <span className="citations">
                        {i.sourceIds.map((id) => (
                          <a
                            href={sourceById(id)?.metadataUrl}
                            target="_blank"
                            rel="noreferrer"
                            key={id}
                          >
                            [{id}]
                          </a>
                        ))}
                      </span>
                    </p>
                  ))}
                </section>
              ))}
              {active && (
                <div className="score-breakdown">
                  {Object.entries(components(active)).map(([k, v]) => (
                    <div key={k}>
                      <span>
                        {k} × {WEIGHTS[k as keyof typeof WEIGHTS]}
                      </span>
                      <meter min={0} max={1} value={v} />
                      <b>{v.toFixed(2)}</b>
                    </div>
                  ))}
                </div>
              )}
              <section className="brief-section">
                <h3>Questions for a future observation</h3>
                {brief.questions.map((q) => (
                  <p key={q}>{q}</p>
                ))}
              </section>
              <details className="caveats" open>
                <summary>Caveats</summary>
                <ul>
                  {brief.caveats.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </details>
              <button className="primary-button" onClick={download}>
                <Download size={16} /> Download brief
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={track !== null}
        onOpenChange={(v) => {
          if (!v) setTrack(null);
        }}
      >
        <DialogContent className="evidence-dialog">
          <figure className="dive-concept">
            <Image
              unoptimized
              src="/imagery/abyss-rov.jpg"
              alt="AI concept of an underwater exploration robot"
              width="1536"
              height="1024"
            />
            <figcaption>
              AI concept illustration · not a photograph of this dive
            </figcaption>
          </figure>
          <DialogTitle>{track?.properties.dive_id}</DialogTitle>
          <DialogDescription>
            NOAA EX1702 recorded ROV activity
          </DialogDescription>
          {track && (
            <>
              <p>
                {track.properties.platform} · NOAA-listed date{' '}
                {track.properties.date_as_listed_by_noaa}
              </p>
              <p>
                {track.properties.vertex_count.toLocaleString()} vertices, in
                source order.
              </p>
              <p>
                {track.properties.reached_bottom
                  ? 'This dive reached the seafloor. The entire path is not verified as bottom-only activity.'
                  : 'DIVE01 did not reach the seafloor. Excluded from coverage scoring.'}
              </p>
              <p>
                Paths follow GEBCO terrain only for display. No measured vehicle
                depths or per-vertex timestamps are supplied.
              </p>
              {track.properties.note && <p>{track.properties.note}</p>}
              <a
                href={track.properties.source_url}
                target="_blank"
                rel="noreferrer"
              >
                NOAA source KML ↗
              </a>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={voteOpen} onOpenChange={setVoteOpen}>
        <DialogContent className="evidence-dialog">
          <DialogTitle>60 ROV minutes</DialogTitle>
          <DialogDescription>
            Allocate hypothetical community exploration time. This does not
            allocate a real NOAA vehicle.
          </DialogDescription>
          <Voting minDepth={minDepth} />
        </DialogContent>
      </Dialog>
    </main>
  );
}
