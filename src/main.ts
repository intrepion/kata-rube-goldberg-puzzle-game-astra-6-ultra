import './style.css';
import { LEVELS, WORLD_WIDTH, WORLD_HEIGHT, createSimulation, stepSimulation } from './engine';
import type { Level, Part, PartType, Point, Simulation } from './engine';
import { partArt, bellArt, marbleArt, brandMark, toolIcon } from './art';

type Mode = 'build' | 'running' | 'paused' | 'won' | 'lost';
type Save = { completed: number[]; builds: Record<string, Part[]>; sound: boolean };
const SAVE_KEY = 'oddly-workshop-v1';
const TOOL_TYPES: PartType[] = ['ramp', 'bumper', 'fan', 'domino'];
const TOOL_INFO: Record<
  PartType,
  { name: string; description: string; angle: number; color: string }
> = {
  ramp: { name: 'Ramp', description: 'A little direction', angle: 20, color: 'green' },
  bumper: { name: 'Bumper', description: 'Put a spring in it', angle: 0, color: 'peach' },
  fan: { name: 'Fan', description: 'A gentle persuasion', angle: -45, color: 'blue' },
  domino: { name: 'Dominoes', description: 'One thing leads to…', angle: 0, color: 'yellow' },
};
const clone = (parts: Part[]) => parts.map((part) => ({ ...part }));
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const icon = (name: string, className = '') =>
  `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" aria-hidden="true">${toolIcon(name)}</svg>`;
const svgArt = (content: string, viewBox = '-80 -50 160 100', className = '') =>
  `<svg viewBox="${viewBox}" class="${className}" fill="none" aria-hidden="true">${content}</svg>`;
function readSave(): Save {
  try {
    const value = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
    const builds: Record<string, Part[]> = {};
    for (const level of LEVELS) {
      const saved = value.builds?.[String(level.id)];
      if (!Array.isArray(saved)) continue;
      const counts: Record<PartType, number> = { ramp: 0, bumper: 0, fan: 0, domino: 0 };
      const ids = new Set<string>();
      builds[level.id] = saved
        .filter((p: Part) => {
          if (
            !p ||
            typeof p.id !== 'string' ||
            !/^[a-zA-Z0-9_-]{1,100}$/.test(p.id) ||
            ids.has(p.id) ||
            p.fixed ||
            !TOOL_TYPES.includes(p.type) ||
            ![p.x, p.y, p.angle].every(Number.isFinite)
          )
            return false;
          if (
            p.x < 0 ||
            p.x > WORLD_WIDTH ||
            p.y < 0 ||
            p.y > WORLD_HEIGHT ||
            counts[p.type] >= level.inventory[p.type]
          )
            return false;
          counts[p.type]++;
          ids.add(p.id);
          return true;
        })
        .map(({ id, type, x, y, angle }: Part) => ({ id, type, x, y, angle }));
    }
    return {
      completed: Array.isArray(value.completed)
        ? [
            ...new Set<number>(
              value.completed.filter((id: unknown) => LEVELS.some((l) => l.id === id)),
            ),
          ]
        : [],
      builds,
      sound: value.sound === true,
    };
  } catch {
    return { completed: [], builds: {}, sound: false };
  }
}
const save = readSave();
let levelIndex = 0;
let level: Level = LEVELS[levelIndex];
let userParts = clone(save.builds[level.id] || []);
let mode: Mode = 'build';
let selectedId: string | null = null;
let pendingType: PartType | null = null;
let history: Part[][] = [];
let simulation: Simulation | null = null;
let lastTrail: Point[] = [];
let speed = 1;
let attempts = 0;
let hintVisible = false;
let toast = '';
let toastTimer = 0;
let previousFrame = 0;
let accumulator = 0;
let audioContext: AudioContext | null = null;
let playedActivations = 0;
let drag: {
  id: string;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  before: Part[];
  moved: boolean;
} | null = null;
let toolboxDrag: { type: PartType; clientX: number; clientY: number; moved: boolean } | null = null;
let activePointer: number | null = null;
let nextId = 1;
const app = document.querySelector<HTMLDivElement>('#app')!;

function persist() {
  save.builds[level.id] = clone(userParts);
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    /* A private session can still play. */
  }
}
function remember(before = userParts) {
  history.push(clone(before));
  if (history.length > 40) history.shift();
}
function canEdit() {
  return mode === 'build';
}
function remaining(type: PartType) {
  return level.inventory[type] - userParts.filter((p) => p.type === type).length;
}
function partName(part: Part) {
  return TOOL_INFO[part.type].name;
}
function showToast(message: string) {
  toast = message;
  const target = document.querySelector('#toast');
  if (target) {
    target.textContent = message;
    target.classList.add('visible');
  }
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast = '';
    document.querySelector('#toast')?.classList.remove('visible');
  }, 3200);
}
function playTone(frequency: number, duration = 0.12, gain = 0.05) {
  if (!save.sound) return;
  try {
    audioContext ||= new AudioContext();
    void audioContext.resume();
    const oscillator = audioContext.createOscillator();
    const envelope = audioContext.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    envelope.gain.setValueAtTime(gain, audioContext.currentTime);
    envelope.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
    oscillator.connect(envelope);
    envelope.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  } catch {
    /* Sound is optional on devices without Web Audio. */
  }
}
function renderPart(part: Part) {
  const selected = part.id === selectedId;
  const activated = simulation?.activated.includes(part.id);
  return `<g class="machine-part ${part.fixed ? 'fixed-part' : 'movable-part'} ${selected ? 'selected' : ''} ${activated ? 'activated' : ''}" data-part-id="${part.id}" transform="translate(${part.x} ${part.y}) rotate(${part.angle})" ${part.fixed ? '' : `tabindex="0" role="button" aria-label="${partName(part)}. Arrow keys to move, R to rotate, Delete to remove."`}>
    ${selected ? `<rect class="selection-ring" x="${part.type === 'ramp' ? -82 : part.type === 'domino' ? -65 : -42}" y="-45" width="${part.type === 'ramp' ? 164 : part.type === 'domino' ? 130 : 84}" height="90" rx="12" fill="none" stroke="#5d9f85" stroke-width="1.5" stroke-dasharray="5 5"/>` : ''}
    <rect x="${part.type === 'ramp' ? -78 : part.type === 'domino' ? -60 : -35}" y="-35" width="${part.type === 'ramp' ? 156 : part.type === 'domino' ? 120 : 70}" height="70" fill="transparent"/>
    ${partArt(part.type)}
    ${part.fixed ? '' : `<circle cx="0" cy="0" r="3" fill="#fffdf8" stroke="#345c4c" stroke-width="1.5" class="part-pivot"/>`}
  </g>`;
}
function boardMarkup() {
  const ball = simulation?.ball || level.spawn;
  return `<svg id="workbench" viewBox="0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}" tabindex="0" role="group" aria-label="Puzzle workbench. Choose a part from the toolbox, then click to place it. Drag parts to move them." class="${pendingType ? 'placing' : ''}">
    <defs>
      <pattern id="paper-dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="12" cy="12" r="1" fill="#cdd8ce"/></pattern>
      <pattern id="wood-grain" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)"><path d="M0 0V12" stroke="#d8d9c9" stroke-width="2"/></pattern>
      <filter id="ball-shadow" x="-80%" y="-80%" width="260%" height="260%"><feDropShadow dx="1" dy="3" stdDeviation="2" flood-color="#586549" flood-opacity=".17"/></filter>
    </defs>
    <rect width="1000" height="600" fill="url(#paper-dots)"/>
    <g class="workbench-landscape" opacity=".75">
      <path d="M0 555 Q130 520 235 558 T460 554 T700 558 T1000 542 V600 H0Z" fill="#eaf0e5"/>
      <path d="M0 581 Q180 550 350 582 T680 577 T1000 577 V600 H0Z" fill="#e1ebdb"/>
      <path d="M40 568v-14m-5 8 5 4 6-7m881 9v-17m-6 9 6 4 6-8" stroke="#b5c7ad" stroke-width="2" fill="none" stroke-linecap="round"/>
    </g>
    <g class="board-notes" fill="#799084">
      <text x="${level.spawn.x - 73}" y="${Math.max(63, level.spawn.y - 27)}" transform="rotate(-8 ${level.spawn.x - 73} ${Math.max(63, level.spawn.y - 27)})">a little nudge…</text>
      <path d="M${level.spawn.x - 72} ${level.spawn.y - 8} Q${level.spawn.x - 36} ${level.spawn.y + 17} ${level.spawn.x - 20} ${level.spawn.y + 2} m-8 0 8 0 -3 8" stroke="#99afa0" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      <text x="${clamp(level.goal.x - 27, 30, 845)}" y="${Math.min(level.goal.y + 68, 558)}" transform="rotate(-5 ${level.goal.x} ${level.goal.y + 68})">…a big little finish.</text>
    </g>
    <g class="platforms">${level.platforms.map((p) => `<g><path d="M${p.x1} ${p.y1 + 8} L${p.x2} ${p.y2 + 8}" stroke="#dee2d1" stroke-width="16" stroke-linecap="round"/><path d="M${p.x1} ${p.y1} L${p.x2} ${p.y2}" stroke="#344e43" stroke-width="11" stroke-linecap="round"/><path d="M${p.x1} ${p.y1 - 1} L${p.x2} ${p.y2 - 1}" stroke="#d8cfaa" stroke-width="7" stroke-linecap="round"/><circle cx="${p.x1 + (p.x2 - p.x1) * 0.12}" cy="${p.y1 + (p.y2 - p.y1) * 0.12}" r="2.2" fill="#8c947a"/><circle cx="${p.x1 + (p.x2 - p.x1) * 0.88}" cy="${p.y1 + (p.y2 - p.y1) * 0.88}" r="2.2" fill="#8c947a"/></g>`).join('')}</g>
    <g class="start-point"><path d="M${level.spawn.x - 19} ${level.spawn.y - 20} v-13 h38 v13" stroke="#8aa596" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="${level.spawn.x}" cy="${level.spawn.y - 33}" r="3" fill="#8aa596"/></g>
    <path id="ball-trail" d="${lastTrail.map((point, i) => `${i === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ')}" fill="none" stroke="#e9aa83" stroke-width="3" stroke-linecap="round" stroke-dasharray="2 10" opacity=".55"/>
    <g id="parts-layer">${[...level.parts, ...userParts].map(renderPart).join('')}</g>
    <g id="goal-bell" class="${mode === 'won' ? 'ringing' : ''}" transform="translate(${level.goal.x} ${level.goal.y})"><circle r="43" fill="#f1df99" opacity=".2"/><g class="bell-inner">${bellArt()}</g><text y="-52" text-anchor="middle" class="goal-label">THE GOAL</text></g>
    <g id="marble" transform="translate(${ball.x} ${ball.y})" filter="url(#ball-shadow)">${marbleArt()}</g>
    ${mode === 'build' && userParts.length === 0 ? `<g class="placement-hint" transform="translate(${(level.solution[0]?.x || 400) - 400} ${(level.solution[0]?.y || 305) - 305})" pointer-events="none" opacity=".6"><path d="M350 290q38-22 92-3" fill="none" stroke="#94ad9a" stroke-width="1.5" stroke-dasharray="5 6"/><text x="365" y="325" fill="#7f9586">room for an idea</text><path d="m367 333-14 14m0-8v8h8" fill="none" stroke="#94ad9a" stroke-width="1.5"/></g>` : ''}
  </svg>`;
}
function toolMarkup(type: PartType) {
  const info = TOOL_INFO[type];
  const available = remaining(type);
  return `<button class="tool-card ${info.color} ${pendingType === type ? 'active' : ''}" data-tool="${type}" ${!canEdit() || available <= 0 ? 'disabled' : ''} aria-label="Add ${info.name}; ${available} available" aria-pressed="${pendingType === type}">
    <span class="tool-count">${available}<span> left</span></span>
    <span class="tool-illustration">${svgArt(partArt(type), '-90 -52 180 104')}</span>
    <span class="tool-name">${info.name}</span><span class="tool-description">${info.description}</span>
  </button>`;
}
function selectionMarkup() {
  const selected = userParts.find((p) => p.id === selectedId);
  if (selected && canEdit())
    return `<div class="selected-part-panel"><div><span class="eyebrow">TINKERING WITH</span><strong>${partName(selected)} <span>${Math.round(selected.angle)}°</span></strong></div><div class="selection-actions"><button class="icon-button" id="rotate-left" title="Rotate counterclockwise (Shift+R)" aria-label="Rotate counterclockwise">${icon('rotate', 'flipped')}</button><button class="icon-button" id="rotate-right" title="Rotate clockwise (R)" aria-label="Rotate clockwise">${icon('rotate')}</button><span></span><button class="icon-button danger" id="remove-part" title="Remove part (Delete)" aria-label="Remove selected part">${icon('trash')}</button></div><p>${icon('move')} Drag to move · arrow keys to fine-tune</p></div>`;
  return `<div class="workshop-tip"><span class="tip-icon">${icon('bulb')}</span><p>${pendingType ? `Click the workbench to place your ${TOOL_INFO[pendingType].name.toLowerCase()}.` : 'Drag a part onto the board.<br/>A small adjustment can change everything.'}</p></div>`;
}
function outcomeMarkup() {
  if (mode !== 'won' && mode !== 'lost') return '';
  const won = mode === 'won';
  return `<div class="outcome-wrap"><section class="outcome ${won ? 'success' : ''}" role="status" aria-live="polite"><div class="outcome-icon">${icon(won ? 'sparkles' : 'reset')}</div><span class="eyebrow">${won ? 'BEAUTIFULLY UNNECESSARY' : 'EVERY GREAT INVENTION TAKES A FEW TRIES'}</span><h2>${won ? 'That rings a bell!' : 'Almost a masterpiece.'}</h2><p>${won ? `${userParts.length} part${userParts.length === 1 ? '' : 's'}. ${simulation?.time.toFixed(1)} seconds. One delightfully roundabout success.` : 'The marble missed its mark. Follow its trail, adjust a part, and give it another nudge.'}</p><div class="outcome-actions"><button class="button ${won ? 'secondary' : 'primary'}" id="edit-build">${icon('reset')} ${won ? 'Keep tinkering' : 'Back to the drawing board'}</button>${won ? `<button class="button primary" id="next-level">${levelIndex < LEVELS.length - 1 ? 'Next puzzle' : 'All puzzles'} ${icon('arrow')}</button>` : ''}</div></section></div>`;
}
function render() {
  const completed = save.completed.includes(level.id);
  const maxParts = Object.values(level.inventory).reduce((sum, value) => sum + value, 0);
  app.innerHTML = `<header class="site-header"><a class="brand" href="./" aria-label="Oddly home"><svg class="brand-symbol" viewBox="0 0 40 40" aria-hidden="true">${brandMark()}</svg><span>oddly<span class="brand-dot">.</span></span></a><span class="brand-divider"></span><span class="brand-tagline">THE CONTRAPTION CLUB</span><nav class="header-actions" aria-label="Game tools"><button class="text-button" id="help-button">${icon('help')}<span>How to play</span></button><span class="header-separator"></span><button class="icon-button sound-button" id="sound-button" aria-label="${save.sound ? 'Mute sound' : 'Enable sound'}" title="${save.sound ? 'Mute sound' : 'Enable sound'}" aria-pressed="${save.sound}">${icon(save.sound ? 'sound' : 'muted')}</button><a class="club-badge" href="https://en.wikipedia.org/wiki/Rube_Goldberg_machine" target="_blank" rel="noreferrer">Made for curious minds ${icon('arrow')}</a></nav></header>
  <main class="page-shell"><section class="workshop-heading"><div><div class="eyebrow workshop-kicker"><span class="little-spark">✳</span> A PLAYGROUND FOR CHAIN REACTIONS</div><h1>Small moves. <span>Big possibilities.</span></h1><p>A marble, a few odd parts, and your wonderfully overcomplicated idea.</p></div><button class="level-picker" id="levels-button" aria-haspopup="dialog"><span class="level-picker-icon">${icon('grid')}</span><span><small>YOUR WORKSHOP</small><strong>Puzzle ${String(levelIndex + 1).padStart(2, '0')} <span>/ ${String(LEVELS.length).padStart(2, '0')}</span></strong></span>${icon('chevron')}</button></section>
  <div class="workshop-layout"><aside class="sidebar"><section class="mission-card"><div class="mission-top"><span class="eyebrow">THE CHALLENGE</span><span class="difficulty"><span></span>${level.difficulty}</span></div><div class="mission-title"><span class="level-number">${String(levelIndex + 1).padStart(2, '0')}</span><h2>${level.title}</h2></div><p>${level.description}</p><div class="goal-line"><span class="mini-bell">${svgArt(bellArt(), '-45 -43 90 90')}</span><span>One simple goal.<strong>Get the marble to the bell.</strong></span>${completed ? `<span class="completed-check" title="Puzzle completed">${icon('check')}</span>` : ''}</div></section>
  <section class="toolbox"><div class="section-heading"><h3>Your toolbox</h3><span>${userParts.length} / ${maxParts} used</span></div><p class="section-subtitle">A few good things to set in motion.</p><div class="tool-grid">${TOOL_TYPES.map(toolMarkup).join('')}</div></section>
  <div id="selection-panel">${selectionMarkup()}</div>
  <div class="hint-area"><button class="hint-button" id="hint-button" aria-expanded="${hintVisible}">${icon('bulb')} A nudge in the right direction ${icon('chevron', hintVisible ? 'up' : '')}</button>${hintVisible ? `<div class="hint-content"><p>${level.hint}</p><button class="text-button" id="solution-button" ${!canEdit() ? 'disabled' : ''}>Try an example arrangement ${icon('arrow')}</button></div>` : ''}</div>
  </aside>
  <section class="workbench-card" aria-label="Contraption puzzle"><div class="board-toolbar"><span class="board-mode"><span class="mode-dot ${mode === 'running' ? 'pulse' : ''}"></span>${mode === 'running' ? 'IN MOTION' : mode === 'paused' ? 'PAUSED' : mode === 'won' ? 'MISSION ACCOMPLISHED' : 'THE DRAWING BOARD'}</span><div class="board-tools"><span class="autosave">${icon('check')} Saved as you tinker</span><button class="icon-button" id="undo-button" title="Undo (⌘/Ctrl+Z)" aria-label="Undo last edit" ${history.length === 0 || !canEdit() ? 'disabled' : ''}>${icon('undo')}</button><button class="icon-button" id="clear-button" title="Clear all placed parts" aria-label="Clear all placed parts" ${userParts.length === 0 || !canEdit() ? 'disabled' : ''}>${icon('trash')}</button></div></div>
  <div class="board-container">${boardMarkup()}${outcomeMarkup()}<div id="toast" role="status" class="toast ${toast ? 'visible' : ''}">${toast}</div><div class="board-corner-label">EST. 2026 <span>·</span> ANYTHING IS POSSIBLE-ISH.</div></div>
  <div class="transport"><div class="simulation-status"><span class="status-orbit ${mode === 'running' ? 'rolling' : ''}">${icon(mode === 'won' ? 'check' : mode === 'running' ? 'play' : 'sparkles')}</span><span><strong>${mode === 'running' ? 'A little motion. A lot of possibility.' : mode === 'paused' ? 'Holding that thought.' : mode === 'won' ? 'A very good chain of events.' : 'Ready when you are.'}</strong><small>${mode === 'running' || mode === 'paused' ? `<span id="sim-time">${simulation?.time.toFixed(1) || '0.0'}</span>s elapsed · attempt ${attempts}` : pendingType ? 'Click the board to place your part' : 'Build it. Test it. Tinker a little.'}</small></span></div><div class="transport-actions"><button id="speed-button" class="speed-button" title="Change simulation speed" aria-label="Simulation speed ${speed} times">${speed}×</button><button id="reset-button" class="reset-button" title="Reset simulation" aria-label="Reset simulation" ${!simulation ? 'disabled' : ''}>${icon('reset')}</button><button id="play-button" class="button primary play-button">${icon(mode === 'running' ? 'pause' : 'play')} ${mode === 'running' ? 'Pause' : mode === 'paused' ? 'Keep rolling' : 'Let it roll'}<span class="keycap">${mode === 'running' ? 'Ⅱ' : '↵'}</span></button></div></div></section></div>
  <footer class="workshop-footer"><span><span class="footer-star">✳</span> There’s no wrong way to wonder. Just another way to try.</span><span class="keyboard-hints"><kbd>R</kbd> rotate <span>·</span><kbd>space</kbd> play / pause <span>·</span><kbd>⌫</kbd> remove</span></footer></main>
  <dialog id="help-dialog" class="modal"><button class="modal-close icon-button" data-close-dialog aria-label="Close instructions">${icon('close')}</button><span class="eyebrow">WELCOME TO THE CLUB</span><h2>Wonderful things start<br/>with a little nudge.</h2><p class="modal-intro">Build a Rube Goldberg machine: an unnecessarily delightful way to do something simple. Here, that something is ringing a bell.</p><div class="help-steps"><div><span>01</span><h3>Make your move</h3><p>Drag a part from the toolbox, or select it and click the board. Move it around. Select a part and press R to rotate it. Keyboard: Tab to a tool and press Enter to place it, then use arrow keys to move it (Shift for precision).</p></div><div><span>02</span><h3>Let it roll</h3><p>Release the marble and watch gravity do its thing. Ramps guide, bumpers bounce, fans push, and dominoes give a nudge.</p></div><div><span>03</span><h3>A little trial. A little error.</h3><p>Missed the bell? Reset, follow the dotted trail, and try a new angle. Your parts stay put between attempts.</p></div></div><p class="help-note">Fixed wooden rails stay in place. Mint parts are yours to tinker with. Need an idea? Open the hint below your toolbox.</p><button class="button primary" data-close-dialog>Let’s make something happen ${icon('arrow')}</button></dialog>
  <dialog id="levels-dialog" class="modal levels-modal"><button class="modal-close icon-button" data-close-dialog aria-label="Close puzzle chooser">${icon('close')}</button><span class="eyebrow">A COLLECTION OF LITTLE EXPERIMENTS</span><h2>Pick your next possibility.</h2><p class="modal-intro">Every puzzle starts with a marble. Where it goes is up to you.</p><div class="level-list">${LEVELS.map((l, i) => `<button class="level-option ${i === levelIndex ? 'current' : ''}" data-level="${i}"><span class="level-option-number">${String(i + 1).padStart(2, '0')}</span><span><strong>${l.title}</strong><small>${l.difficulty} · ${l.subtitle}</small></span><span class="level-option-status">${save.completed.includes(l.id) ? icon('check') : icon('arrow')}</span></button>`).join('')}</div><p class="levels-progress">${save.completed.length} of ${LEVELS.length} puzzles completed. Plenty of room for curiosity.</p></dialog>`;
  bindEvents();
  if (simulation) updateSimulationView();
}
function pointFromEvent(event: PointerEvent | MouseEvent) {
  const svg = document.querySelector<SVGSVGElement>('#workbench')!;
  const rect = svg.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * WORLD_WIDTH,
    y: ((event.clientY - rect.top) / rect.height) * WORLD_HEIGHT,
  };
}
function makePart(type: PartType, x: number, y: number): Part {
  return {
    id: `part-${Date.now()}-${nextId++}`,
    type,
    x: clamp(x, 40, 960),
    y: clamp(y, 45, 550),
    angle: TOOL_INFO[type].angle,
  };
}
function placePart(type: PartType, x: number, y: number) {
  if (!canEdit() || remaining(type) <= 0) return;
  remember();
  const part = makePart(type, x, y);
  userParts.push(part);
  selectedId = part.id;
  pendingType = null;
  persist();
  render();
  playTone(420, 0.06, 0.025);
}
function rotateSelected(direction = 1) {
  if (!canEdit()) return;
  const part = userParts.find((p) => p.id === selectedId);
  if (!part) return;
  remember();
  part.angle = ((part.angle + direction * 15 + 540) % 360) - 180;
  persist();
  render();
}
function removeSelected() {
  if (!canEdit() || !selectedId) return;
  remember();
  userParts = userParts.filter((p) => p.id !== selectedId);
  selectedId = null;
  persist();
  render();
}
function undo() {
  if (!canEdit() || !history.length) return;
  userParts = history.pop()!;
  selectedId = null;
  pendingType = null;
  persist();
  render();
  showToast('One step back. A new possibility.');
}
function resetSimulation() {
  lastTrail = simulation ? simulation.trail.map((point) => ({ ...point })) : lastTrail;
  mode = 'build';
  simulation = null;
  accumulator = 0;
  previousFrame = 0;
  render();
}
function startOrPause() {
  pendingType = null;
  selectedId = null;
  if (mode === 'running') {
    mode = 'paused';
    render();
    return;
  }
  if (mode === 'paused') {
    mode = 'running';
    previousFrame = 0;
    render();
    return;
  }
  lastTrail = [];
  simulation = createSimulation(level, userParts);
  mode = 'running';
  attempts++;
  accumulator = 0;
  previousFrame = 0;
  playedActivations = 0;
  playTone(500, 0.08, 0.03);
  render();
}
function chooseLevel(index: number) {
  persist();
  levelIndex = index;
  level = LEVELS[index];
  userParts = clone(save.builds[level.id] || []);
  lastTrail = [];
  history = [];
  hintVisible = false;
  selectedId = null;
  pendingType = null;
  simulation = null;
  mode = 'build';
  attempts = 0;
  accumulator = 0;
  render();
}
function openDialog(id: string) {
  if (mode === 'running') {
    mode = 'paused';
    render();
  }
  document.querySelector<HTMLDialogElement>(`#${id}`)!.showModal();
}
function focusSelected() {
  if (selectedId)
    document
      .querySelector<SVGGElement>(`[data-part-id="${selectedId}"]`)
      ?.focus({ preventScroll: true });
}
function bindEvents() {
  const on = (id: string, callback: () => void) =>
    document.getElementById(id)?.addEventListener('click', callback);
  on('help-button', () => openDialog('help-dialog'));
  on('levels-button', () => openDialog('levels-dialog'));
  on('sound-button', () => {
    save.sound = !save.sound;
    persist();
    render();
    if (save.sound) playTone(620, 0.15);
  });
  on('hint-button', () => {
    hintVisible = !hintVisible;
    render();
  });
  on('solution-button', () => {
    if (!canEdit()) return;
    remember();
    userParts = level.solution.map((p, i) => ({
      ...p,
      id: `example-${level.id}-${i}`,
      fixed: false,
    }));
    selectedId = null;
    pendingType = null;
    persist();
    render();
    showToast('An idea to start with. Make it your own.');
  });
  on('rotate-left', () => rotateSelected(-1));
  on('rotate-right', () => rotateSelected(1));
  on('remove-part', removeSelected);
  on('undo-button', undo);
  on('clear-button', () => {
    if (!canEdit()) return;
    remember();
    userParts = [];
    lastTrail = [];
    selectedId = null;
    pendingType = null;
    persist();
    render();
  });
  on('play-button', startOrPause);
  on('reset-button', resetSimulation);
  on('edit-build', resetSimulation);
  on('speed-button', () => {
    speed = speed === 1 ? 2 : speed === 2 ? 0.5 : 1;
    render();
  });
  on('next-level', () => {
    if (levelIndex < LEVELS.length - 1) chooseLevel(levelIndex + 1);
    else document.querySelector<HTMLDialogElement>('#levels-dialog')!.showModal();
  });
  document
    .querySelectorAll<HTMLElement>('[data-close-dialog]')
    .forEach((button) => button.addEventListener('click', () => button.closest('dialog')?.close()));
  document.querySelectorAll<HTMLDialogElement>('dialog').forEach((dialog) =>
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) {
        const r = dialog.getBoundingClientRect();
        if (
          event.clientX < r.left ||
          event.clientX > r.right ||
          event.clientY < r.top ||
          event.clientY > r.bottom
        )
          dialog.close();
      }
    }),
  );
  document
    .querySelectorAll<HTMLElement>('[data-level]')
    .forEach((button) =>
      button.addEventListener('click', () => chooseLevel(Number(button.dataset.level))),
    );
  document.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((button) => {
    button.addEventListener('pointerdown', (event) => {
      if (!canEdit() || button.disabled || event.button !== 0) return;
      activePointer = event.pointerId;
      document.documentElement.setPointerCapture(event.pointerId);
      toolboxDrag = {
        type: button.dataset.tool as PartType,
        clientX: event.clientX,
        clientY: event.clientY,
        moved: false,
      };
    });
    button.addEventListener('click', (event) => {
      if (event.detail === 0) {
        placePart(button.dataset.tool as PartType, 500, 300);
        focusSelected();
        return;
      }
      if ((event as PointerEvent).detail > 0 && suppressToolClick) {
        suppressToolClick = false;
        return;
      }
      pendingType = pendingType === button.dataset.tool ? null : (button.dataset.tool as PartType);
      selectedId = null;
      render();
      if (pendingType)
        showToast(`Click the board to place a ${TOOL_INFO[pendingType].name.toLowerCase()}.`);
    });
  });
  document.querySelector('#workbench')?.addEventListener('pointerdown', (event) => {
    const pointer = event as PointerEvent;
    if (!canEdit() || pointer.button !== 0) return;
    const point = pointFromEvent(pointer);
    const partElement = (pointer.target as Element).closest<SVGGElement>('.movable-part');
    if (partElement) {
      pointer.preventDefault();
      activePointer = pointer.pointerId;
      document.documentElement.setPointerCapture(pointer.pointerId);
      const part = userParts.find((p) => p.id === partElement.dataset.partId)!;
      selectedId = part.id;
      pendingType = null;
      drag = {
        id: part.id,
        startX: pointer.clientX,
        startY: pointer.clientY,
        offsetX: part.x - point.x,
        offsetY: part.y - point.y,
        before: clone(userParts),
        moved: false,
      };
      render();
      return;
    }
    if (pendingType) {
      placePart(pendingType, point.x, point.y);
      return;
    }
    selectedId = null;
    render();
  });
}
let suppressToolClick = false;
window.addEventListener('pointermove', (event) => {
  if (activePointer !== null && event.pointerId !== activePointer) return;
  if (toolboxDrag) {
    if (Math.hypot(event.clientX - toolboxDrag.clientX, event.clientY - toolboxDrag.clientY) > 7) {
      toolboxDrag.moved = true;
      document.body.classList.add('dragging-tool');
      let ghost = document.querySelector<HTMLDivElement>('#drag-ghost');
      if (!ghost) {
        ghost = document.createElement('div');
        ghost.id = 'drag-ghost';
        ghost.innerHTML = svgArt(partArt(toolboxDrag.type), '-90 -52 180 104');
        document.body.append(ghost);
      }
      ghost.style.left = `${event.clientX}px`;
      ghost.style.top = `${event.clientY}px`;
    }
  }
  if (!drag) return;
  const part = userParts.find((p) => p.id === drag!.id);
  if (!part) return;
  const point = pointFromEvent(event);
  if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 3) drag.moved = true;
  if (!drag.moved) return;
  part.x = clamp(point.x + drag.offsetX, 40, 960);
  part.y = clamp(point.y + drag.offsetY, 45, 550);
  const element = document.querySelector<SVGGElement>(`[data-part-id="${part.id}"]`);
  element?.setAttribute('transform', `translate(${part.x} ${part.y}) rotate(${part.angle})`);
});
window.addEventListener('pointerup', (event) => {
  if (activePointer !== null && event.pointerId !== activePointer) return;
  activePointer = null;
  if (toolboxDrag) {
    const tool = toolboxDrag;
    toolboxDrag = null;
    document.body.classList.remove('dragging-tool');
    document.querySelector('#drag-ghost')?.remove();
    if (!tool.moved) {
      pendingType = pendingType === tool.type ? null : tool.type;
      selectedId = null;
      render();
      if (pendingType)
        showToast(`Click the board to place a ${TOOL_INFO[pendingType].name.toLowerCase()}.`);
    }
    if (tool.moved) {
      suppressToolClick = true;
      const rect = document.querySelector('#workbench')!.getBoundingClientRect();
      if (
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
      ) {
        const point = pointFromEvent(event);
        placePart(tool.type, point.x, point.y);
      }
      window.setTimeout(() => {
        suppressToolClick = false;
      }, 0);
    }
  }
  if (drag) {
    if (drag.moved) {
      remember(drag.before);
      persist();
    }
    drag = null;
    render();
  }
});
function cancelDrag() {
  activePointer = null;
  if (drag) {
    userParts = drag.before;
    drag = null;
    render();
  }
  toolboxDrag = null;
  document.querySelector('#drag-ghost')?.remove();
  document.body.classList.remove('dragging-tool');
}
window.addEventListener('pointercancel', cancelDrag);
window.addEventListener('blur', cancelDrag);
document.documentElement.addEventListener('lostpointercapture', () => {
  if (activePointer !== null) cancelDrag();
});
window.addEventListener('keydown', (event) => {
  if (document.querySelector('dialog[open]')) return;
  const target = event.target as HTMLElement;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
  if (event.key === 'Escape') {
    pendingType = null;
    selectedId = null;
    render();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    undo();
    return;
  }
  if (event.code === 'Space' && target.tagName !== 'BUTTON' && target.tagName !== 'A') {
    event.preventDefault();
    startOrPause();
    return;
  }
  if (!canEdit()) return;
  if (event.key === 'Enter' && pendingType && target.id === 'workbench') {
    event.preventDefault();
    placePart(pendingType, 500, 300);
    focusSelected();
    return;
  }
  const focused = target.closest<SVGElement>('.movable-part');
  if (focused?.dataset.partId) selectedId = focused.dataset.partId;
  if (event.key.toLowerCase() === 'r' && selectedId) {
    event.preventDefault();
    rotateSelected(event.shiftKey ? -1 : 1);
    focusSelected();
  }
  if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId) {
    event.preventDefault();
    removeSelected();
  }
  const directions: Record<string, [number, number]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  };
  if (directions[event.key] && selectedId) {
    const part = userParts.find((p) => p.id === selectedId);
    if (!part) return;
    event.preventDefault();
    remember();
    const [dx, dy] = directions[event.key];
    const step = event.shiftKey ? 1 : 10;
    part.x = clamp(part.x + dx * step, 40, 960);
    part.y = clamp(part.y + dy * step, 45, 550);
    persist();
    render();
    focusSelected();
  }
});
function updateSimulationView() {
  if (!simulation) return;
  document
    .querySelector('#marble')
    ?.setAttribute(
      'transform',
      `translate(${simulation.ball.x} ${simulation.ball.y}) rotate(${simulation.ball.x * 2})`,
    );
  document
    .querySelector('#ball-trail')
    ?.setAttribute(
      'd',
      simulation.trail
        .map((point, i) => `${i === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
        .join(' '),
    );
  const timer = document.querySelector('#sim-time');
  if (timer) timer.textContent = simulation.time.toFixed(1);
  for (const id of simulation.activated)
    document.querySelector(`[data-part-id="${id}"]`)?.classList.add('activated');
}
function frame(timestamp: number) {
  if (mode === 'running' && simulation && !document.hidden) {
    const elapsed = previousFrame ? Math.min((timestamp - previousFrame) / 1000, 0.1) : 0;
    previousFrame = timestamp;
    accumulator += elapsed * speed;
    while (accumulator >= 1 / 120 && simulation.status === 'running') {
      stepSimulation(simulation, 1 / 120);
      accumulator -= 1 / 120;
    }
    updateSimulationView();
    if (simulation.activated.length > playedActivations) {
      playTone(300 + simulation.activated.length * 90, 0.1, 0.03);
      playedActivations = simulation.activated.length;
    }
    if (simulation.status !== 'running') {
      mode = simulation.status;
      if (mode === 'won') {
        if (!save.completed.includes(level.id)) save.completed.push(level.id);
        persist();
        playTone(880, 0.7, 0.07);
        window.setTimeout(() => playTone(1320, 0.8, 0.035), 120);
      }
      render();
    }
  } else previousFrame = 0;
  requestAnimationFrame(frame);
}
render();
requestAnimationFrame(frame);
