export type PartType = 'ramp' | 'bumper' | 'fan' | 'domino';
export interface Point {
  x: number;
  y: number;
}
export interface Part extends Point {
  id: string;
  type: PartType;
  angle: number;
  fixed?: boolean;
}
export interface Platform {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
export interface Level {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  difficulty: string;
  spawn: Point;
  goal: Point;
  platforms: Platform[];
  parts: Part[];
  inventory: Record<PartType, number>;
  hint: string;
  solution: Part[];
}
export interface Simulation {
  ball: Point & { vx: number; vy: number };
  time: number;
  status: 'running' | 'won' | 'lost';
  parts: Part[];
  activated: string[];
  trail: Point[];
  events: Array<{ type: string; x: number; y: number }>;
}

export const WORLD_WIDTH = 1000;
export const WORLD_HEIGHT = 600;
export const BALL_RADIUS = 12;
export const RAMP_LENGTH = 140;
export const BUMPER_RADIUS = 25;
export const FAN_RADIUS = 80;
export const GOAL_RADIUS = 34;
const FIXED_STEP = 1 / 240;
const GRAVITY = 620;
const states = new WeakMap<
  Simulation,
  {
    level: Level;
    accumulator: number;
    steps: number;
    cooldowns: Map<string, number>;
  }
>();

export const LEVELS: Level[] = [
  {
    id: 1,
    title: 'A little momentum',
    subtitle: 'Every great idea starts with a small push.',
    description: 'Bridge the gap. Guide the marble down the rails and ring the little brass bell.',
    difficulty: 'WARM-UP',
    spawn: { x: 170, y: 85 },
    goal: { x: 885, y: 475 },
    platforms: [
      { x1: 115, y1: 150, x2: 275, y2: 208 },
      { x1: 510, y1: 365, x2: 790, y2: 442 },
    ],
    parts: [],
    inventory: { ramp: 1, bumper: 0, fan: 0, domino: 0 },
    hint: 'Put a ramp in the gap between the two rails. Tilt its right end down to keep the marble moving.',
    solution: [{ id: 'solution-ramp-1', type: 'ramp', x: 400, y: 305, angle: 20 }],
  },
  {
    id: 2,
    title: 'A breath of fresh air',
    subtitle: 'Sometimes a good idea just needs a lift.',
    description: 'The gap got bigger. Give the marble a little wind beneath its wings.',
    difficulty: 'CURIOUS',
    spawn: { x: 170, y: 85 },
    goal: { x: 890, y: 460 },
    platforms: [
      { x1: 115, y1: 150, x2: 275, y2: 208 },
      { x1: 610, y1: 365, x2: 815, y2: 425 },
    ],
    parts: [],
    inventory: { ramp: 1, bumper: 0, fan: 1, domino: 0 },
    hint: 'A ramp catches the first fall. A fan near its far end can carry the marble across the long gap.',
    solution: [
      { id: 'solution-ramp-2', type: 'ramp', x: 400, y: 305, angle: 20 },
      { id: 'solution-fan-2', type: 'fan', x: 510, y: 350, angle: -45 },
    ],
  },
  {
    id: 3,
    title: 'The long way home',
    subtitle: 'A delightfully unnecessary chain reaction.',
    description:
      'The bell is up there. Catch the marble, give it a breeze, and bounce it all the way home.',
    difficulty: 'INVENTOR',
    spawn: { x: 170, y: 85 },
    goal: { x: 870, y: 220 },
    platforms: [{ x1: 115, y1: 150, x2: 275, y2: 208 }],
    parts: [],
    inventory: { ramp: 1, bumper: 1, fan: 1, domino: 1 },
    hint: 'Catch the first fall with a ramp. A fan carries the marble right, then a bumper underneath its path sends it up to the bell.',
    solution: [
      { id: 'solution-ramp-3', type: 'ramp', x: 400, y: 305, angle: 20 },
      { id: 'solution-fan-3', type: 'fan', x: 510, y: 350, angle: -30 },
      { id: 'solution-bumper-3', type: 'bumper', x: 720, y: 420, angle: 0 },
    ],
  },
  {
    id: 4,
    title: 'The domino effect',
    subtitle: 'A roundabout way to bring it all together.',
    description:
      'A fresh perspective. Send the marble left through all four tools, then bounce it back up to the bell.',
    difficulty: 'GRAND FINALE',
    spawn: { x: 880, y: 115 },
    goal: { x: 110, y: 180 },
    platforms: [{ x1: 935, y1: 180, x2: 775, y2: 238 }],
    parts: [],
    inventory: { ramp: 1, bumper: 1, fan: 1, domino: 1 },
    hint: 'Tilt a ramp downhill to the left. Point the dominoes left for an extra nudge, aim the fan up and left, and catch the final fall with a bumper.',
    solution: [
      { id: 'solution-ramp-4', type: 'ramp', x: 650, y: 335, angle: 155 },
      { id: 'solution-domino-4', type: 'domino', x: 570, y: 350, angle: -180 },
      { id: 'solution-fan-4', type: 'fan', x: 430, y: 350, angle: -135 },
      { id: 'solution-bumper-4', type: 'bumper', x: 250, y: 440, angle: 0 },
    ],
  },
];

export function createSimulation(level: Level, userParts: Part[]): Simulation {
  const simulation: Simulation = {
    ball: { ...level.spawn, vx: 0, vy: 0 },
    time: 0,
    status: 'running',
    parts: [...level.parts, ...userParts].map((part) => ({ ...part })),
    activated: [],
    trail: [{ ...level.spawn }],
    events: [],
  };
  states.set(simulation, { level, accumulator: 0, steps: 0, cooldowns: new Map() });
  return simulation;
}

/** Accumulates render-frame time and advances the same 240 Hz simulation on every device. */
export function stepSimulation(simulation: Simulation, dt: number): void {
  const state = states.get(simulation);
  if (!state || simulation.status !== 'running' || !Number.isFinite(dt) || dt <= 0) return;
  state.accumulator += Math.min(dt, 0.25);
  while (state.accumulator + 1e-10 >= FIXED_STEP && simulation.status === 'running') {
    state.accumulator -= FIXED_STEP;
    state.steps += 1;
    simulation.time = state.steps * FIXED_STEP;
    advance(simulation, state.level, state.cooldowns);
    if (state.steps % 10 === 0) {
      simulation.trail.push({ x: simulation.ball.x, y: simulation.ball.y });
      if (simulation.trail.length > 400) simulation.trail.shift();
    }
  }
}

function activate(simulation: Simulation, part: Part): void {
  if (simulation.activated.includes(part.id)) return;
  simulation.activated.push(part.id);
  simulation.events.push({ type: part.type, x: part.x, y: part.y });
}

function collideSegment(simulation: Simulation, segment: Platform): boolean {
  const ball = simulation.ball;
  const sx = segment.x2 - segment.x1;
  const sy = segment.y2 - segment.y1;
  const lengthSquared = sx * sx + sy * sy;
  if (lengthSquared === 0) return false;
  const t = Math.max(
    0,
    Math.min(1, ((ball.x - segment.x1) * sx + (ball.y - segment.y1) * sy) / lengthSquared),
  );
  const nearestX = segment.x1 + t * sx;
  const nearestY = segment.y1 + t * sy;
  const dx = ball.x - nearestX;
  const dy = ball.y - nearestY;
  const distance = Math.hypot(dx, dy);
  const radius = BALL_RADIUS + 4;
  if (distance >= radius) return false;
  const length = Math.sqrt(lengthSquared);
  const nx = distance > 0.0001 ? dx / distance : sy / length;
  const ny = distance > 0.0001 ? dy / distance : -sx / length;
  ball.x = nearestX + nx * radius;
  ball.y = nearestY + ny * radius;
  const approach = ball.vx * nx + ball.vy * ny;
  if (approach < 0) {
    const bounce = approach < -80 ? 1.1 : 1;
    ball.vx -= bounce * approach * nx;
    ball.vy -= bounce * approach * ny;
  }
  return true;
}

function advance(simulation: Simulation, level: Level, cooldowns: Map<string, number>): void {
  const ball = simulation.ball;
  for (const part of simulation.parts) {
    const angle = (part.angle * Math.PI) / 180;
    const distance = Math.hypot(ball.x - part.x, ball.y - part.y);
    if (part.type === 'fan' && distance < FAN_RADIUS) {
      const strength = 1500 * (0.55 + 0.45 * (1 - distance / FAN_RADIUS));
      ball.vx += Math.cos(angle) * strength * FIXED_STEP;
      ball.vy += Math.sin(angle) * strength * FIXED_STEP;
      activate(simulation, part);
    }
    const localX = (ball.x - part.x) * Math.cos(angle) + (ball.y - part.y) * Math.sin(angle);
    const localY = -(ball.x - part.x) * Math.sin(angle) + (ball.y - part.y) * Math.cos(angle);
    if (
      part.type === 'domino' &&
      !simulation.activated.includes(part.id) &&
      Math.abs(localX) < 60 &&
      Math.abs(localY) < 36
    ) {
      ball.vx += Math.cos(angle) * 280;
      ball.vy += Math.sin(angle) * 280 - 100;
      activate(simulation, part);
    }
  }
  ball.vy += GRAVITY * FIXED_STEP;
  ball.x += ball.vx * FIXED_STEP;
  ball.y += ball.vy * FIXED_STEP;
  for (const platform of level.platforms) collideSegment(simulation, platform);
  for (const part of simulation.parts) {
    const angle = (part.angle * Math.PI) / 180;
    if (part.type === 'ramp') {
      const dx = (Math.cos(angle) * RAMP_LENGTH) / 2;
      const dy = (Math.sin(angle) * RAMP_LENGTH) / 2;
      if (
        collideSegment(simulation, {
          x1: part.x - dx,
          y1: part.y - dy,
          x2: part.x + dx,
          y2: part.y + dy,
        })
      ) {
        activate(simulation, part);
      }
    }
    if (part.type === 'bumper') {
      const dx = ball.x - part.x;
      const dy = ball.y - part.y;
      const distance = Math.hypot(dx, dy);
      if (distance < BALL_RADIUS + BUMPER_RADIUS) {
        const nx = distance > 0.001 ? dx / distance : 0;
        const ny = distance > 0.001 ? dy / distance : -1;
        ball.x = part.x + nx * (BALL_RADIUS + BUMPER_RADIUS);
        ball.y = part.y + ny * (BALL_RADIUS + BUMPER_RADIUS);
        const approach = ball.vx * nx + ball.vy * ny;
        if (approach < 0 && simulation.time > (cooldowns.get(part.id) ?? -1)) {
          const impulse = Math.max(420, -approach * 1.9);
          ball.vx += nx * impulse;
          ball.vy += ny * impulse;
          cooldowns.set(part.id, simulation.time + 0.16);
          activate(simulation, part);
        }
      }
    }
  }
  if (Math.hypot(ball.x - level.goal.x, ball.y - level.goal.y) < GOAL_RADIUS + BALL_RADIUS * 0.35) {
    simulation.status = 'won';
    simulation.events.push({ type: 'win', x: level.goal.x, y: level.goal.y });
  } else if (
    ball.y > WORLD_HEIGHT + 50 ||
    ball.x < -80 ||
    ball.x > WORLD_WIDTH + 80 ||
    simulation.time >= 16
  ) {
    simulation.status = 'lost';
    simulation.events.push({ type: 'fall', x: ball.x, y: ball.y });
  }
}
