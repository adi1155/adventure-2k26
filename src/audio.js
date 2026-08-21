export function createScore(ctx) {
  const master = ctx.createGain();
  master.gain.value = 0.0;
  master.connect(ctx.destination);

  const recorder = ctx.createMediaStreamDestination();
  master.connect(recorder);

  const makeOsc = (type, freq, dest, gain = 0.05) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = gain;
    osc.connect(g);
    g.connect(dest);
    osc.start();
    return { osc, g };
  };

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 420;
  filter.Q.value = 0.7;
  filter.connect(master);

  const droneA = makeOsc("sine", 73.42, filter, 0.07);
  const droneB = makeOsc("sine", 110, filter, 0.05);
  const droneC = makeOsc("triangle", 146.83, filter, 0.03);

  const strings = ctx.createGain();
  strings.gain.value = 0.0;
  strings.connect(filter);
  const s1 = makeOsc("sawtooth", 220, strings, 0.03);
  const s2 = makeOsc("sawtooth", 261.63, strings, 0.025);
  const s3 = makeOsc("sawtooth", 329.63, strings, 0.02);
  s1.osc.detune.value = -7;
  s2.osc.detune.value = 6;

  const choir = ctx.createGain();
  choir.gain.value = 0.0;
  choir.connect(master);
  makeOsc("sine", 293.66, choir, 0.04);
  makeOsc("sine", 440, choir, 0.035);
  makeOsc("sine", 587.33, choir, 0.025);

  const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuf;
  noise.loop = true;
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.value = 900;
  const noiseGain = ctx.createGain();
  noiseGain.gain.value = 0.012;
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(master);
  noise.start();

  const pulse = ctx.createOscillator();
  const pulseGain = ctx.createGain();
  pulse.type = "sine";
  pulse.frequency.value = 49;
  pulseGain.gain.value = 0;
  pulse.connect(pulseGain);
  pulseGain.connect(master);
  pulse.start();

  function impact() {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const n = ctx.createBufferSource();
    const ng = ctx.createGain();
    n.buffer = noiseBuf;
    o.type = "sine";
    o.frequency.setValueAtTime(180, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(48, ctx.currentTime + 0.7);
    g.gain.setValueAtTime(0.18, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
    ng.gain.setValueAtTime(0.08, ctx.currentTime);
    ng.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    o.connect(g);
    g.connect(master);
    n.connect(ng);
    ng.connect(master);
    o.start();
    n.start();
    o.stop(ctx.currentTime + 0.85);
    n.stop(ctx.currentTime + 0.4);
  }

  function whoosh() {
    const n = ctx.createBufferSource();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    n.buffer = noiseBuf;
    f.type = "highpass";
    f.frequency.setValueAtTime(400, ctx.currentTime);
    f.frequency.exponentialRampToValueAtTime(2400, ctx.currentTime + 0.45);
    g.gain.setValueAtTime(0.001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.07, ctx.currentTime + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.55);
    n.connect(f);
    f.connect(g);
    g.connect(master);
    n.start();
    n.stop(ctx.currentTime + 0.6);
  }

  return {
    stream: recorder.stream,
    start() {
      master.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.5);
    },
    impact,
    whoosh,
    setStage({ t, mountain, travel, peak, finale }) {
      const now = ctx.currentTime;
      const safe = (v, fallback = 0) => (Number.isFinite(v) ? v : fallback);
      const mt = safe(mountain);
      const tr = safe(travel);
      const pk = safe(peak);
      const fin = safe(finale);
      const time = safe(t);
      if (!Number.isFinite(now)) return;
      filter.frequency.setTargetAtTime(420 + tr * 1600 + pk * 900, now, 0.4);
      strings.gain.setTargetAtTime(0.02 + tr * 0.12 + mt * 0.1, now, 0.5);
      choir.gain.setTargetAtTime(pk * 0.22 + fin * 0.16, now, 0.35);
      noiseGain.gain.setTargetAtTime(0.01 + mt * 0.02 + pk * 0.03, now, 0.4);
      pulseGain.gain.setTargetAtTime(tr * 0.05 * (0.4 + 0.6 * Math.abs(Math.sin(time * 1.7))), now, 0.12);
      droneA.osc.frequency.setTargetAtTime(fin ? 82.41 : 73.42, now, 0.8);
    },
  };
}
