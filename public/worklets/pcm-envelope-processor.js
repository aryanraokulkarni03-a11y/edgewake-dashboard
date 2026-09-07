const FRAME_DURATION_SECONDS = 0.01;
const COLUMNS = 32;
const toQ15 = (value) => Math.round(value * (value < 0 ? 32768 : 32767));

class PcmEnvelopeProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.samplesPerFrame = sampleRate * FRAME_DURATION_SECONDS;
    this.frameNumber = 0;
    this.frameSize = this.getFrameSize();
    this.frame = new Float32Array(Math.ceil(this.samplesPerFrame));
    this.offset = 0;
  }

  getFrameSize() {
    return Math.round((this.frameNumber + 1) * this.samplesPerFrame)
      - Math.round(this.frameNumber * this.samplesPerFrame);
  }

  process(inputs) {
    const samples = inputs[0]?.[0];
    if (!samples) return true;

    for (let index = 0; index < samples.length; index += 1) {
      this.frame[this.offset] = samples[index];
      this.offset += 1;

      if (this.offset === this.frameSize) {
        const envelope = new Int16Array(COLUMNS * 2);

        for (let column = 0; column < COLUMNS; column += 1) {
          const from = Math.floor((column * this.frameSize) / COLUMNS);
          const to = Math.floor(((column + 1) * this.frameSize) / COLUMNS);
          let minimum = 1;
          let maximum = -1;

          for (let sample = from; sample < to; sample += 1) {
            minimum = Math.min(minimum, this.frame[sample]);
            maximum = Math.max(maximum, this.frame[sample]);
          }

          envelope[column * 2] = toQ15(minimum);
          envelope[column * 2 + 1] = toQ15(maximum);
        }

        this.port.postMessage({
          endTime: (currentFrame + index + 1) / sampleRate,
          values: envelope,
        }, [envelope.buffer]);
        this.frameNumber += 1;
        this.frameSize = this.getFrameSize();
        this.offset = 0;
      }
    }

    return true;
  }
}

registerProcessor('pcm-envelope', PcmEnvelopeProcessor);
