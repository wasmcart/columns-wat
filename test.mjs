import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const wasm = await readFile(new URL('./game.wasm', import.meta.url));

async function makeGame() {
  const { instance } = await WebAssembly.instantiate(wasm);
  const e = instance.exports;
  assert.equal(e.wc_get_info(), 0);
  assert.deepEqual([...new Uint32Array(e.memory.buffer).slice(0, 3)], [3, 1280, 720]);
  e.wc_init();
  return {
    e,
    board: new Uint8Array(e.memory.buffer, 3740000, 78),
    buttons: new Uint16Array(e.memory.buffer, 96, 1),
  };
}

function tap(game, button) {
  game.buttons[0] = button;
  game.e.wc_render();
  game.buttons[0] = 0;
  game.e.wc_render();
}

// B reverses the triplet and does not drop or lock it.
{
  const game = await makeGame();
  const before = [
    game.e.debug_gem_bottom.value,
    game.e.debug_gem_middle.value,
    game.e.debug_gem_top.value,
  ];
  const y = game.e.debug_y.value;
  tap(game, 2);
  assert.deepEqual([
    game.e.debug_gem_bottom.value,
    game.e.debug_gem_middle.value,
    game.e.debug_gem_top.value,
  ], [before[1], before[2], before[0]]);
  assert.equal(game.e.debug_y.value, y);
  assert.equal(game.board.some(Boolean), false);
}

// Down advances the falling triplet at soft-drop speed.
{
  const game = await makeGame();
  for (let i = 0; i < 10; i++) game.e.wc_render();
  assert.equal(game.e.debug_y.value, 0, 'normal gravity is too fast');
  game.buttons[0] = 512;
  for (let i = 0; i < 4; i++) game.e.wc_render();
  game.buttons[0] = 0;
  assert.ok(game.e.debug_y.value >= 2, 'Down did not accelerate descent');
}

// Seed a horizontal match, move with the real input ABI, and use Down until
// the triplet locks. Resolving the lock must clear the match.
{
  const game = await makeGame();
  game.board[72] = game.board[73] = game.board[74] = 1;
  for (let i = 0; i < 3; i++) tap(game, 2048);
  game.buttons[0] = 512;
  let cleared = false;
  for (let frame = 0; frame < 120; frame++) {
    game.e.wc_render();
    if (game.board[72] === 0 && game.board[73] === 0 && game.board[74] === 0) {
      cleared = true;
      break;
    }
  }
  game.buttons[0] = 0;
  game.e.wc_render();
  assert.equal(cleared, true, 'Down never locked and resolved the triplet');
  const words = new Uint32Array(game.e.memory.buffer);
  assert.ok(words[20] > 0, 'audio cursor did not advance');
  const audio = new Float32Array(game.e.memory.buffer, 3700000, 8192);
  assert.ok(audio.some((sample) => sample !== 0), 'audio ring is silent');
}

console.log('columns-wat: classic controls, soft drop, matching, and audio passed');
