import assert from 'node:assert/strict';

const messages = [];
let Processor;

globalThis.sampleRate = 48_000;
globalThis.currentFrame = 0;
globalThis.AudioWorkletProcessor = class {
  constructor() {
    this.port = { postMessage: (data) => messages.push(data) };
  }
};
globalThis.registerProcessor = (name, processor) => {
  assert.equal(name, 'pcm-envelope');
  Processor = processor;
};

await import(new URL('../public/worklets/pcm-envelope-processor.js', import.meta.url));

const processor = new Processor();
const alternatingFrame = (length) => Float32Array.from(
  { length },
  (_, sample) => sample % 2 ? 0.5 : -0.5,
);
processor.process([[alternatingFrame(479)]]);
assert.equal(messages.length, 0);
globalThis.currentFrame = 479;
processor.process([[alternatingFrame(1)]]);
globalThis.currentFrame = 480;
processor.process([[alternatingFrame(480)]]);

assert.equal(messages.length, 2);
assert.equal(messages[0].endTime, 0.01);
assert.equal(messages[1].endTime, 0.02);
for (const message of messages) {
  assert.equal(message.values.length, 64);
  for (let index = 0; index < message.values.length; index += 2) {
    assert.ok(message.values[index] <= message.values[index + 1]);
    assert.equal(message.values[index], -16384);
    assert.equal(message.values[index + 1], 16384);
  }
}

console.log('PCM envelope check passed');
