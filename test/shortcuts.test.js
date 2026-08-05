import test from "node:test";
import assert from "node:assert/strict";
import shortcutsModule from "../shortcuts.cjs";

const { getAction } = shortcutsModule;

function keyInput(overrides = {}) {
  return {
    type: "keyDown",
    key: "",
    control: false,
    meta: false,
    alt: false,
    shift: false,
    isAutoRepeat: false,
    ...overrides,
  };
}

test("maps primary shortcuts on Linux and macOS", () => {
  assert.equal(
    getAction(keyInput({ key: "n", control: true }), "linux"),
    "newChat",
  );
  assert.equal(
    getAction(keyInput({ key: "n", meta: true }), "darwin"),
    "newChat",
  );
  assert.equal(
    getAction(keyInput({ key: "s", control: true, shift: true }), "linux"),
    "toggleSidebar",
  );
  assert.equal(
    getAction(keyInput({ key: "p", meta: true, shift: true }), "darwin"),
    "togglePrivateChat",
  );
});

test("maps control-only scrolling shortcuts", () => {
  assert.equal(
    getAction(keyInput({ key: "k", control: true }), "darwin"),
    "scrollUp",
  );
  assert.equal(
    getAction(keyInput({ key: "j", control: true }), "linux"),
    "scrollDown",
  );
  assert.equal(
    getAction(keyInput({ key: "u", control: true }), "linux"),
    "scrollTop",
  );
  assert.equal(
    getAction(keyInput({ key: "d", control: true }), "linux"),
    "scrollBottom",
  );
});

test("ignores repeated, modified, and key-up events", () => {
  assert.equal(
    getAction(keyInput({ key: "n", control: true, isAutoRepeat: true })),
    null,
  );
  assert.equal(
    getAction(keyInput({ key: "k", control: true, shift: true })),
    null,
  );
  assert.equal(
    getAction(keyInput({ type: "keyUp", key: "n", control: true })),
    null,
  );
});
