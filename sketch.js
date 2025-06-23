// Thick, Green, Calmer-When-Quiet, Hyper-Reactive Flow Field & Particles
// + MP4 Recording via MediaRecorder
// Place “KAYTRANADA - Freefall (Instrumental (Visualizer)).mp3” in your sketch folder

let sound, fft, peakKick, peakSnare;
let inc = 0.01;
let scl = 20;
let rows, cols;
let field = [];
let zoff = 0;

let particleNum = 250;
let particles = [];

let kickHold = 0;
let snareHold = 0;

// Recording variables
let mediaRecorder;
let recordedChunks = [];

function preload() {
  sound = loadSound('KAYTRANADA - Freefall (Instrumental (Visualizer)).mp3');
}

function setup() {
  createCanvas(600, 600);
  rows = floor(width / scl);
  cols = floor(height / scl);
  field = new Array(rows * cols);

  // start audio analysis
  sound.loop();
  fft = new p5.FFT(0.9, 128);
  fft.setInput(sound);
  peakKick  = new p5.PeakDetect(20,   80,   0.15, 20);
  peakSnare = new p5.PeakDetect(200, 2000, 0.15, 20);

  // create particles
  for (let i = 0; i < particleNum; i++) {
    particles[i] = new Particle();
  }

  // ——— Setup recording ———
  // Capture the canvas stream
  const canvasStream = document.querySelector('canvas').captureStream(60);
  // Create a MediaStreamDestination from the audio context
  const audioCtx = getAudioContext();
  const audioDest = audioCtx.createMediaStreamDestination();
  // Redirect p5 sound to that destination
  sound.disconnect();
  sound.connect(audioDest);
  sound.connect(audioCtx.destination);
  // Combine video + audio tracks
  const combined = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...audioDest.stream.getAudioTracks()
  ]);
  // Create MediaRecorder for mp4 (if supported) or webm fallback
  const options = { mimeType: 'video/mp4;codecs=avc1' };
  mediaRecorder = new MediaRecorder(combined, options);
  mediaRecorder.ondataavailable = e => {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };
  mediaRecorder.onstop = saveRecording;

  // Create UI buttons
  let startBtn = createButton('Start Recording');
  startBtn.position(10, 10);
  startBtn.mousePressed(() => {
    recordedChunks = [];
    mediaRecorder.start();
    console.log('Recording started');
  });
  let stopBtn = createButton('Stop & Save');
  stopBtn.position(150, 10);
  stopBtn.mousePressed(() => {
    mediaRecorder.stop();
    console.log('Recording stopped');
  });
}

function draw() {
  // audio analysis
  fft.analyze();
  peakKick.update(fft);
  peakSnare.update(fft);
  if (peakKick.isDetected)  kickHold  = 1;
  if (peakSnare.isDetected) snareHold = 1;
  kickHold  *= 0.9;
  snareHold *= 0.9;

  // spectral bands & overall loudness
  let bass   = fft.getEnergy('bass')   / 255;
  let mid    = fft.getEnergy('mid')    / 255;
  let treble = fft.getEnergy('treble') / 255;
  let overall = (bass + mid + treble) / 3;

  // dynamic background fade
  let fadeAlpha = map(overall, 0, 1, 50, 5);
  background(0, fadeAlpha);

  // build flow field
  let yoff = 0;
  for (let y = 0; y < rows; y++) {
    let xoff = 0;
    for (let x = 0; x < cols; x++) {
      let idx = x + y * cols;
      let angle = noise(xoff, yoff, zoff) * TWO_PI;
      let v = p5.Vector.fromAngle(angle);
      let mag = map(overall, 0, 1, 1, 6) + kickHold * 3 + snareHold * 3;
      v.setMag(mag);
      field[idx] = v;
      xoff += inc;
    }
    yoff += inc;
  }

  // advance noise time
  zoff += 0.00005 + overall * 0.008 + kickHold * 0.01 + snareHold * 0.01;

  // update & draw particles
  for (let p of particles) {
    p.follow(field, scl, cols);
    let windSpeed = map(overall, 0, 1, 0.5, 4) + kickHold * 4 + snareHold * 4;
    p.update(windSpeed);
    p.show(overall, kickHold, snareHold);
  }
}

// save the recording as an MP4 file
function saveRecording() {
  const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType });
  const url = URL.createObjectURL(blob);
  const a = createA(url, 'download.mp4');
  a.attribute('download', 'recording.mp4');
  a.hide();
  a.click();
  URL.revokeObjectURL(url);
}

// — Particle class —
class Particle {
  constructor() {
    this.pos = createVector(random(width), random(height));
    this.vel = createVector();
    this.acc = createVector();
    this.maxSpeed = 1;
    this.prevPos = this.pos.copy();
  }

  follow(field, scl, cols) {
    let x = floor(this.pos.x / scl);
    let y = floor(this.pos.y / scl);
    let idx = x + y * cols;
    this.applyForce(field[idx]);
  }

  applyForce(f) {
    this.acc.add(f);
  }

  update(windSpeed) {
    this.vel.add(this.acc);
    this.vel.limit(this.maxSpeed * windSpeed * 1.5);
    this.pos.add(this.vel);
    this.acc.mult(0);
    // wrap edges
    if (this.pos.x > width)  this.pos.x = 0;
    if (this.pos.x < 0)      this.pos.x = width;
    if (this.pos.y > height) this.pos.y = 0;
    if (this.pos.y < 0)      this.pos.y = height;
  }

  show(overall, kick, snare) {
    let intensity = overall + max(kick, snare) * 0.5;
    let sw = map(intensity, 0, 1.5, 2, 6);
    strokeWeight(sw);
    let bright = map(intensity, 0, 1.5, 60, 255);
    let alpha  = map(intensity, 0, 1.5, 30, 80);
    stroke(0, bright, 0, alpha);
    line(this.prevPos.x, this.prevPos.y, this.pos.x, this.pos.y);
    this.prevPos.set(this.pos);
  }
}
