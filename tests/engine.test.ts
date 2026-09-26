import assert from 'node:assert/strict';
import test from 'node:test';
import { LEVELS, createSimulation, stepSimulation, type Level, type Part } from '../src/engine.ts';

function play(level: Level, parts: Part[], frameTime = 1 / 60) {
  const simulation = createSimulation(level, parts);
  for (let frame = 0; frame < 5000 && simulation.status === 'running'; frame += 1) {
    stepSimulation(simulation, frameTime);
  }
  return simulation;
}

for (const level of LEVELS) {
  test(`level ${level.id}: the authored solution rings the bell`, () => {
    const simulation = play(level, level.solution);
    assert.equal(simulation.status, 'won');
    assert.ok(simulation.time < 8, 'solutions should finish promptly');
    assert.deepEqual(new Set(simulation.activated), new Set(level.solution.map((part) => part.id)));
    assert.equal(simulation.events.at(-1)?.type, 'win');
    for (const type of ['ramp', 'bumper', 'fan', 'domino'] as const) {
      assert.ok(
        level.solution.filter((part) => part.type === type).length <= level.inventory[type],
      );
    }
  });

  test(`level ${level.id}: doing nothing cannot win`, () => {
    const simulation = play(level, []);
    assert.equal(simulation.status, 'lost');
    assert.equal(simulation.events.at(-1)?.type, 'fall');
  });

  test(`level ${level.id}: every solution gadget contributes to the chain`, () => {
    for (const missing of level.solution) {
      const simulation = play(
        level,
        level.solution.filter((part) => part.id !== missing.id),
      );
      assert.equal(
        simulation.status,
        'lost',
        `${missing.type} must be necessary in the authored chain`,
      );
    }
  });
}

test('fixed steps produce identical outcomes at 30, 60, and 120 render frames per second', () => {
  for (const level of LEVELS) {
    const reference = play(level, level.solution, 1 / 120);
    for (const frameTime of [1 / 30, 1 / 60]) {
      const simulation = play(level, level.solution, frameTime);
      assert.equal(simulation.status, reference.status);
      assert.equal(simulation.time, reference.time);
      assert.deepEqual(simulation.ball, reference.ball);
      assert.deepEqual(simulation.events, reference.events);
    }
  }
});

test('the first puzzle tolerates small placement errors', () => {
  const level = LEVELS[0]!;
  for (const x of [380, 400, 420]) {
    for (const y of [285, 305, 315]) {
      assert.equal(play(level, [{ ...level.solution[0]!, x, y }]).status, 'won');
    }
  }
});

test('authored solutions can be built with the normal placement and rotation controls', () => {
  const startingAngles = { ramp: 20, bumper: 0, fan: -45, domino: 0 };
  for (const level of LEVELS) {
    for (const part of level.solution) {
      assert.equal(
        Math.abs((part.angle - startingAngles[part.type]) % 15),
        0,
        `${level.id}: ${part.type} uses an unreachable angle`,
      );
      assert.ok(part.x >= 40 && part.x <= 960, 'placement must fit the workbench controls');
      assert.ok(part.y >= 45 && part.y <= 550, 'placement must fit the workbench controls');
    }
  }
});

test('the finale uses all four gadgets in a domino chain from right to left', () => {
  const finale = LEVELS.at(-1)!;
  const simulation = play(finale, finale.solution);
  assert.ok(finale.spawn.x > finale.goal.x);
  assert.deepEqual(
    simulation.events.map((event) => event.type),
    ['ramp', 'domino', 'fan', 'bumper', 'win'],
  );
});

test('a rotated fan accelerates the marble in the direction it points', () => {
  const level: Level = {
    ...LEVELS[0]!,
    spawn: { x: 500, y: 200 },
    goal: { x: 900, y: 500 },
    platforms: [],
  };
  const right = createSimulation(level, [{ id: 'fan', type: 'fan', x: 500, y: 200, angle: 0 }]);
  const left = createSimulation(level, [{ id: 'fan', type: 'fan', x: 500, y: 200, angle: 180 }]);
  stepSimulation(right, 0.1);
  stepSimulation(left, 0.1);
  assert.ok(right.ball.vx > 100);
  assert.ok(left.ball.vx < -100);
  assert.deepEqual(right.activated, ['fan']);
  assert.equal(right.events.length, 1, 'continuous wind should not repeat activation events');
});

test('a spring bumper sends a falling marble upward', () => {
  const level: Level = {
    ...LEVELS[0]!,
    spawn: { x: 500, y: 200 },
    goal: { x: 900, y: 500 },
    platforms: [],
  };
  const simulation = createSimulation(level, [
    { id: 'spring', type: 'bumper', x: 500, y: 260, angle: 0 },
  ]);
  for (let frame = 0; frame < 60 && !simulation.activated.length; frame += 1)
    stepSimulation(simulation, 1 / 120);
  assert.deepEqual(simulation.activated, ['spring']);
  assert.ok(simulation.ball.vy < -200);
});

test('dominoes give one kick and retain their activated state', () => {
  const level: Level = {
    ...LEVELS[0]!,
    spawn: { x: 500, y: 200 },
    goal: { x: 900, y: 500 },
    platforms: [],
  };
  const simulation = createSimulation(level, [
    { id: 'dominoes', type: 'domino', x: 500, y: 200, angle: 0 },
  ]);
  stepSimulation(simulation, 0.1);
  assert.equal(simulation.ball.vx, 280);
  assert.ok(simulation.ball.vy < 0);
  assert.deepEqual(simulation.activated, ['dominoes']);
  assert.equal(simulation.events.length, 1);
});

test('a run snapshots placements and does not change the level or editing state', () => {
  const level = LEVELS[0]!;
  const placement = { ...level.solution[0]! };
  const originalLevel = structuredClone(level);
  const simulation = createSimulation(level, [placement]);
  placement.x = 10;
  assert.equal(simulation.parts[0]?.x, 400);
  while (simulation.status === 'running') stepSimulation(simulation, 1 / 60);
  assert.equal(simulation.status, 'won');
  assert.deepEqual(level, originalLevel);
  assert.ok(simulation.trail.length <= 400);
});

test('the diagnostic trail retains the entire longest allowed attempt', () => {
  const level: Level = {
    ...LEVELS[0]!,
    spawn: { x: 500, y: 100 },
    goal: { x: 900, y: 500 },
    platforms: [{ x1: 400, y1: 150, x2: 600, y2: 150 }],
  };
  const simulation = play(level, []);
  assert.equal(simulation.status, 'lost');
  assert.equal(simulation.time, 16);
  assert.deepEqual(simulation.trail[0], level.spawn);
  assert.deepEqual(simulation.trail.at(-1), { x: simulation.ball.x, y: simulation.ball.y });
  assert.ok(simulation.trail.length <= 400);
});

test('invalid frame times and updates after completion leave the run unchanged', () => {
  const level = LEVELS[0]!;
  const simulation = createSimulation(level, []);
  const initial = structuredClone(simulation);
  for (const frameTime of [0, -1, Number.NaN, Number.POSITIVE_INFINITY])
    stepSimulation(simulation, frameTime);
  assert.deepEqual(simulation, initial);
  while (simulation.status === 'running') stepSimulation(simulation, 1 / 60);
  const completed = structuredClone(simulation);
  stepSimulation(simulation, 1);
  assert.deepEqual(simulation, completed);
});
