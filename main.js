/* -------------------------------------------------
       Core game constants
    ------------------------------------------------- */
const CANVAS = document.getElementById('game');
const CTX = CANVAS.getContext('2d');
const GROUND_Y = CANVAS.height - 60; // baseline
const GRAVITY = 0.75;

const UI = {
  score: document.getElementById('score'),
  speed: document.getElementById('speed'),
  restart: document.getElementById('restart'),
  jumpBtn: document.querySelector('.jump'),
  modal: document.getElementById('quizModal'),
  prompt: document.getElementById('quizPrompt'),
  opts: document.getElementById('quizOptions'),
  feedback: document.getElementById('quizFeedback'),
  continueBtn: document.getElementById('continueBtn'),
};

/* -------------------------------------------------
   Restart overlay UI (Save to leaderboard on restart)
------------------------------------------------- */
const restartOverlay = document.createElement('div');
restartOverlay.id = 'restartOverlay';
restartOverlay.className = 'modal'; // reuse site modal styles
restartOverlay.innerHTML = `
  <div class="card">
    <h2>Restart Run?</h2>
    <p style="margin-top:6px">Current Score: <b id="rsScore">0</b></p>
    <div class="meta">
      <button id="rsSaveRestart" class="btn">Save & Restart</button>
      <button id="rsCancel" class="btn" style="background:#374151">Cancel</button>
    </div>
    <p style="font-size:12px;opacity:.8;margin-top:12px">Tip: press <b>Enter</b> to save & restart, <b>Esc</b> to cancel.</p>
  </div>
`;
document.body.appendChild(restartOverlay);

const rsScoreEl     = restartOverlay.querySelector('#rsScore');
const rsSaveRestart = restartOverlay.querySelector('#rsSaveRestart');
const rsCancel      = restartOverlay.querySelector('#rsCancel');

function showRestart(){
  rsScoreEl.textContent = Math.floor(game.score || 0);
  restartOverlay.classList.add('open');
}
function hideRestart(){
  restartOverlay.classList.remove('open');
}

/* -------------------------------------------------
       Jake (runner) — simple avatar: red polo + khakis
    ------------------------------------------------- */
class Runner {
  constructor(){ this.reset(); }
  reset(){
    this.x = 80; this.y = GROUND_Y; this.w = 85; this.h = 85;
    this.vy = 0; this.onGround = true; this.anim = 0;
  }
  jump(){
    if(this.onGround){ this.vy = -14; this.onGround = false; }
  }
  update(){
    this.vy += GRAVITY; this.y += this.vy;
    if(this.y >= GROUND_Y){ this.y = GROUND_Y; this.vy = 0; this.onGround = true; }
    this.anim = (this.anim + 0.2) % 2;
  }
  draw(ctx){
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath();
    ctx.ellipse(this.x + this.w/2, GROUND_Y + 10, 18, 6, 0, 0, Math.PI*2);
    ctx.fill();
    // Avatar image
    const img = new Image();
    img.src = './imgs/jake.svg';
    ctx.drawImage(img, this.x, this.y - this.h + 15, this.w, this.h);
  }
  bbox(){ return {x:this.x, y:this.y- this.h, w:this.w, h:this.h}; }
}

/* -------------------------------------------------
       Obstacles + Hazard triggers
    ------------------------------------------------- */
class Obstacle {
  constructor(x, speed, kind){
    this.x = x; this.y = GROUND_Y; this.w = 32; this.h = 32;
    this.speed = speed; this.kind = kind; this.active = true;
  }
  update(){ this.x -= this.speed; if(this.x < -60) this.active = false; }
  draw(ctx){
    ctx.save();
    ctx.translate(this.x, this.y - this.h);
    ctx.fillStyle = '#0b1324'; ctx.strokeStyle = '#334155'; ctx.lineWidth = 2;
    roundRect(ctx, 0, 0, this.w, this.h, 6, true, true);
    ctx.fillStyle = iconColor(this.kind);
    drawIcon(ctx, this.kind, this.w, this.h);
    ctx.restore();
  }
  bbox(){ return {x:this.x, y:this.y-this.h, w:this.w, h:this.h}; }
}

function iconColor(kind){
  switch(kind){
    case 'flood': return '#38bdf8';
    case 'fire':  return '#f97316';
    case 'hail':  return '#a78bfa';
    case 'quake': return '#22c55e';
    case 'road':  return '#facc15';
    default:      return '#e5e7eb';
  }
}

function drawIcon(ctx, kind, w, h){
  ctx.save();
  ctx.translate(w/2, h/2);
  ctx.beginPath();
  if(kind==='fire'){
    ctx.moveTo(0,-10); ctx.bezierCurveTo(10,-6, 10,6, 0,10); ctx.bezierCurveTo(-10,6, -8,-6, 0,-10);
  } else if(kind==='flood'){
    for(let i=-8;i<=8;i+=8){ ctx.moveTo(-12,i); ctx.quadraticCurveTo(-4,i+4, 4,i); ctx.quadraticCurveTo(12,i-4, 20,i); }
  } else if(kind==='hail'){
    for(let i=0;i<6;i++){ ctx.moveTo(0,0); ctx.lineTo(10*Math.cos(i*Math.PI/3), 10*Math.sin(i*Math.PI/3)); }
  } else if(kind==='quake'){
    ctx.rect(-8,-2,16,4); ctx.moveTo(-10,4); ctx.lineTo(10,4); ctx.moveTo(-10,-4); ctx.lineTo(10,-4);
  } else if(kind==='road'){
    ctx.rect(-12,-8,24,16); ctx.moveTo(0,-8); ctx.lineTo(0,8);
  }
  ctx.strokeStyle = iconColor(kind); ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
}

/* -------------------------------------------------
       Quiz system
    ------------------------------------------------- */
const QUIZZES = [
  {
    kind: 'road',
    prompt: 'You approach a flooded street while driving. What’s the safest choice?',
    options: [
      {text: 'Drive through slowly to avoid waves', correct:false, explain:'Even shallow water can stall or sweep a car.'},
      {text: 'Turn around and find an alternate route', correct:true, explain:'Turn Around, Don’t Drown.'},
      {text: 'Follow the car ahead closely', correct:false, explain:'Their weight doesn’t make it safe for you.'},
    ],
  },
  {
    kind: 'fire',
    prompt: 'There’s smoke from a pan on the stove. Best first step?',
    options: [
      {text: 'Throw water on the pan', correct:false, explain:'Water can spread grease fires.'},
      {text: 'Cover with a lid and turn off heat', correct:true, explain:'Smothers oxygen; cutting heat stops the source.'},
      {text: 'Carry the pan outside', correct:false, explain:'Moving it risks burns and spreading fire.'},
    ],
  },
  {
    kind: 'hail',
    prompt: 'Hailstorm ahead while driving—what do you do?',
    options: [
      {text: 'Stop under an overpass and block traffic', correct:false, explain:'Unsafe to stop in traffic lanes.'},
      {text: 'Pull over safely, angle car so hail hits windshield', correct:true, explain:'Windshields are reinforced; side glass is weaker.'},
      {text: 'Speed up to get out quickly', correct:false, explain:'Speeding reduces traction and visibility.'},
    ],
  },
  {
    kind: 'quake',
    prompt: 'During an earthquake at home, safest immediate action?',
    options: [
      {text: 'Run outside down the stairs', correct:false, explain:'Falling objects and stairs can be dangerous.'},
      {text: 'Drop, cover, and hold on under sturdy furniture', correct:true, explain:'Protects from falling debris.'},
      {text: 'Stand in a doorway', correct:false, explain:'Doorways are not the safest spot in modern homes.'},
    ],
  },
  {
    kind: 'flood',
    prompt: 'Flash flood warning while you’re walking near a wash?',
    options: [
      {text: 'Get closer to see the water level', correct:false, explain:'Fast water can rise suddenly and sweep you.'},
      {text: 'Move to higher ground immediately', correct:true, explain:'Gain elevation quickly and avoid channels.'},
      {text: 'Call a friend to pick you up under the bridge', correct:false, explain:'Underpasses can collect water fast.'},
    ],
  },
  {
    kind: 'road',
    prompt: 'On a rainy night, traffic is moving at the posted limit. What’s the safest approach to speed?',
    options: [
      {text: 'Match the posted limit exactly', correct:false, explain:'Speed limits are for ideal conditions; rain reduces traction and visibility.'},
      {text: 'Slow to a safe speed below the limit and increase following distance', correct:true, explain:'Adjust speed to conditions and leave extra space to stop.'},
      {text: 'Drive faster to get out of the rain sooner', correct:false, explain:'Higher speed increases hydroplaning risk and stopping distance.'},
    ],
  },
  {
    kind: 'road',
    prompt: 'On a dry highway at 55 mph, what following distance is safest?',
    options: [
      {text: 'At least 3 seconds (more if heavy or large vehicle)', correct:true, explain:'Time-based gaps work at any speed; add more in poor conditions.'},
      {text: 'One car length', correct:false, explain:'Way too short at highway speeds.'},
      {text: 'Half a car length', correct:false, explain:'Extremely unsafe at speed.'},
    ],
  },
  {
    kind: 'road',
    prompt: 'You enter a construction work zone with lane shifts. What should you do with speed?',
    options: [
      {text: 'Maintain speed so you don’t block traffic', correct:false, explain:'Work zones require extra caution and often lower speeds.'},
      {text: 'Reduce speed to posted work-zone speed and be ready for sudden stops', correct:true, explain:'Lane shifts, workers, and equipment demand slower speeds.'},
      {text: 'Speed up to pass the zone quickly', correct:false, explain:'Higher speed reduces reaction time around unexpected hazards.'},
    ],
  },
  {
    kind: 'fire',
    prompt: 'A grease fire starts in a pan and you have baking soda nearby. What should you do?',
    options: [
      {text: 'Throw water to cool it quickly', correct:false, explain:'Water spreads burning grease and can cause flare-ups.'},
      {text: 'Smother with a metal lid or use baking soda; turn off heat', correct:true, explain:'Removing oxygen/heat stops the reaction safely.'},
      {text: 'Carry the pan outside to avoid smoke', correct:false, explain:'Moving the pan risks spilling burning oil.'},
    ],
  },
  {
    kind: 'fire',
    prompt: 'Your smoke alarm chirps intermittently at night. Best response?',
    options: [
      {text: 'Remove the battery to stop the noise', correct:false, explain:'Never disable alarms; replace the battery or unit if expired.'},
      {text: 'Replace the battery and test the alarm', correct:true, explain:'Functioning alarms cut fire fatality risk roughly in half.'},
      {text: 'Ignore it until morning', correct:false, explain:'A failing alarm might not warn you in time.'},
    ],
  },
  {
    kind: 'fire',
    prompt: 'You see a small electrical outlet fire. What should you do first?',
    options: [
      {text: 'Spray with water from a bottle', correct:false, explain:'Water conducts electricity and increases shock risk.'},
      {text: 'Cut power if safe (breaker) and use a Class C or ABC extinguisher', correct:true, explain:'De-energize and use the right extinguisher type.'},
      {text: 'Open windows to vent before acting', correct:false, explain:'Ventilation can feed oxygen to the fire.'},
    ],
  },
  {
    kind: 'hail',
    prompt: 'Hail begins while you\'re driving on a highway. What’s the safest move?',
    options: [
      {text: 'Stop under an overpass in a travel lane', correct:false, explain:'Stopping in-lane can cause crashes.'},
      {text: 'Exit or pull off the roadway safely; face hail with the windshield', correct:true, explain:'Windshields are reinforced compared to side glass.'},
      {text: 'Speed up to clear the storm faster', correct:false, explain:'Higher speed reduces traction and control.'},
    ],
  },
  {
    kind: 'hail',
    prompt: 'Before a forecasted hailstorm at home, best protection for your car?',
    options: [
      {text: 'Park under a sturdy cover or in a garage', correct:true, explain:'Physical cover greatly reduces damage.'},
      {text: 'Lower tire pressure to absorb impacts', correct:false, explain:'Tire pressure doesn’t protect body panels or glass.'},
      {text: 'Leave wipers up to protect the windshield', correct:false, explain:'Wipers don’t protect against hail.'},
    ],
  },
  {
    kind: 'hail',
    prompt: 'After a heavy hail event, what should you check around your home?',
    options: [
      {text: 'Roof, skylights, and gutters for dents or cracks', correct:true, explain:'Early detection prevents leaks and water damage.'},
      {text: 'Only the lawn for ice accumulation', correct:false, explain:'Structural components are the priority.'},
      {text: 'Nothing; hail can’t damage roofs', correct:false, explain:'Hail can damage shingles and flashing.'},
    ],
  },
  {
    kind: 'quake',
    prompt: 'Indoors during an earthquake, what’s the safest action?',
    options: [
      {text: 'Run outside immediately', correct:false, explain:'Falling debris and glass outside can be dangerous.'},
      {text: 'Drop, cover, and hold on under sturdy furniture', correct:true, explain:'Protects from falling objects and reduces injury.'},
      {text: 'Stand in a doorway', correct:false, explain:'Not the safest in modern buildings.'},
    ],
  },
  {
    kind: 'quake',
    prompt: 'After shaking stops, what should you do first?',
    options: [
      {text: 'Check for injuries and hazards like gas leaks before moving', correct:true, explain:'Life safety and immediate hazards come first.'},
      {text: 'Use elevators to evacuate quickly', correct:false, explain:'Elevators may be unsafe after quakes.'},
      {text: 'Light candles to see better', correct:false, explain:'Open flame + possible gas leaks = fire risk.'},
    ],
  },
  {
    kind: 'quake',
    prompt: 'You are driving when a quake starts. Best response?',
    options: [
      {text: 'Stop in the road under the nearest overpass', correct:false, explain:'Structures may fail; stopping in-lane is unsafe.'},
      {text: 'Pull over safely, set parking brake, stay in the vehicle', correct:true, explain:'Avoid overpasses/bridges/trees; move after shaking stops.'},
      {text: 'Accelerate to get past bridges quickly', correct:false, explain:'Bridges may be compromised; speed increases risk.'},
    ],
  },
  {
    kind: 'flood',
    prompt: 'Walking near a wash during a flash flood warning, what should you do?',
    options: [
      {text: 'Move to higher ground immediately', correct:true, explain:'Avoid channels; water can rise suddenly.'},
      {text: 'Stand on the bank to watch the water level', correct:false, explain:'Banks can collapse and water rises fast.'},
      {text: 'Take a short cut through shallow water', correct:false, explain:'Even shallow fast water can sweep you away.'},
    ],
  },
  {
    kind: 'flood',
    prompt: 'Your basement is flooding and water may be near outlets. First action?',
    options: [
      {text: 'Enter to rescue belongings quickly', correct:false, explain:'Risk of electric shock and contaminants.'},
      {text: 'Shut off power if safe to do so; avoid entering standing water', correct:true, explain:'De-energize and wait for professionals if in doubt.'},
      {text: 'Open doors and windows to let more water out', correct:false, explain:'Uncontrolled flow may worsen damage or risk.'},
    ],
  },
  {
    kind: 'flood',
    prompt: 'You approach standing water across the road at night. Safest choice?',
    options: [
      {text: 'Turn around and find another route', correct:true, explain:'“Turn Around, Don’t Drown.” Depth and current are deceiving.'},
      {text: 'Follow a taller vehicle closely', correct:false, explain:'Their path doesn’t guarantee your safety.'},
      {text: 'Drive slowly through using the center of the road', correct:false, explain:'Even slow entry can stall or sweep a vehicle.'},
    ],
  },
];

class QuizManager {
  constructor(){
    this.queue = [];
    this.onFinish = null; // callback(answerCorrect:boolean)
    this._bindUI();
  }
  _bindUI(){
    UI.opts.addEventListener('click', (e)=>{
      const btn = e.target.closest('.option');
      if(!btn) return;
      if(this.locked) return;
      this.locked = true;
      const correct = btn.dataset.correct === 'true';
      for(const child of UI.opts.children){
        if (child.dataset.correct==='true') child.classList.add('correct');
      }
      if(!correct) btn.classList.add('wrong');
      UI.feedback.textContent = correct ? 'Correct! Nice decision.' : 'Not quite. '+(btn.dataset.explain||'');
      UI.continueBtn.style.display = 'inline-block';
      this.lastResult = correct;
    });
    UI.continueBtn.addEventListener('click', ()=>{
      this.hide();
      if(this.onFinish) this.onFinish(this.lastResult);
    });
  }
  enqueue(kind){
    const pool = QUIZZES.filter(q=>q.kind===kind);
    const quiz = (pool.length? pool : QUIZZES)[Math.floor(Math.random()*(pool.length?pool.length:QUIZZES.length))];
    this.queue.push(quiz);
  }
  showNext(){
    const quiz = this.queue.shift();
    if(!quiz) return false;
    UI.prompt.textContent = quiz.prompt;
    UI.opts.innerHTML = '';
    quiz.options.forEach(opt=>{
      const b = document.createElement('button');
      b.className = 'option';
      b.textContent = opt.text;
      b.dataset.correct = !!opt.correct;
      b.dataset.explain = opt.explain || '';
      UI.opts.appendChild(b);
    });
    UI.feedback.textContent = '';
    UI.continueBtn.style.display = 'none';
    UI.modal.classList.add('open');
    this.locked = false;
    return true;
  }
  hide(){ UI.modal.classList.remove('open'); }
}

/* -------------------------------------------------
       Game state
    ------------------------------------------------- */
const game = {
  running: false,
  speed: 6,
  score: 0,
  tick: 0,
  player: new Runner(),
  obstacles: [],
  quiz: new QuizManager(),
  pausedForQuiz: false,
  lives: 3,
  savedOnGameOver: false,
};

let last = performance.now();
let frameId = null;

function reset(){
  if (frameId) { cancelAnimationFrame(frameId); frameId = null; }

  game.running = true;
  game.speed = 6;
  game.score = 0;
  game.tick = 0;
  game.obstacles = [];
  game.player.reset();
  game.lives = 3;

  hideRestart(); // close restart overlay if it was open

  updateHUD();
  last = performance.now();
  frameId = requestAnimationFrame(loop);
}

// expose globals so leaderboard.js can read/patch
window.game  = game;
window.reset = reset;

function updateHUD(){
  UI.score.textContent = `Score: ${Math.floor(game.score)}`;
  UI.speed.textContent = `Speed: ${game.speed.toFixed(0)}  |  Lives: ${game.lives}`;
}

function spawnObstacle(){
  const kind2 = ['road'];
  const kinds = ['quake'];
  const kinds2 = kind2[Math.floor(Math.random()*kind2.length)];
  const kind = kinds[Math.floor(Math.random()*kinds.length)];
  const kind3 = ['flood'];
  const kinds3 = kind3[Math.floor(Math.random()*kind3.length)];
  const kind4 = ['hail'];
  const kinds4 = kind4[Math.floor(Math.random()*kind4.length)];
  const kind5 = ['fire'];
  const kinds5 = kind5[Math.floor(Math.random()*kind5.length)];
  const kind6 = ['fire','road','quake','hail','flood'];
  const kinds6 = kind6[Math.floor(Math.random()*kind6.length)];
  const x = CANVAS.width + 40;
  if (game.score < 100){
    game.obstacles.push(new Obstacle(x, game.speed, kinds2));
  }
  else if (game.score >= 100 && game.score < 250){
    game.obstacles.push(new Obstacle(x, game.speed, kind));
  }
  else if (game.score >= 250 && game.score < 400){
    game.obstacles.push(new Obstacle(x, game.speed, kinds3));
  }
  else if (game.score >= 400 && game.score < 550){
    game.obstacles.push(new Obstacle(x, game.speed, kinds4));
  }
  else if (game.score >= 550 && game.score < 700){
    game.obstacles.push(new Obstacle(x, game.speed, kinds5));
  }
  else{
    game.obstacles.push(new Obstacle(x, game.speed, kinds6));
  }
}

function collide(a,b){
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function loop(){
  if(!game.running) return;

  frameId = requestAnimationFrame(loop);
  if(game.pausedForQuiz) return; // paused while quiz is open

  // Difficulty ramp
  game.tick++;
  if(game.tick % 300 === 0 && game.speed < 14) game.speed += 1;

  // Spawn obstacles
  if(game.tick % Math.max(60, 140 - game.speed*6) === 0) spawnObstacle();

  // Update
  game.player.update();
  for(const o of game.obstacles){ o.speed = game.speed; o.update(); }
  game.obstacles = game.obstacles.filter(o=>o.active);

  // Collisions → trigger quiz
  const pbox = game.player.bbox();
  for(const o of game.obstacles){
    if(collide(pbox, o.bbox())){
      game.pausedForQuiz = true;
      game.quiz.enqueue(o.kind);
      game.quiz.onFinish = (correct)=>{
        if(correct){
          game.score += 20;
        } else {
          game.lives = Math.max(0, game.lives - 1);
          if (game.lives > 0) {
            if (game.speed > 6) game.speed -= 1;
            game.score = Math.max(0, game.score - 20);
            updateHUD();
            game.pausedForQuiz = false;
            return;
          }
          // If you later add a Game Over screen, you can show it here.
          reset();
        }
        updateHUD();
        game.pausedForQuiz = false;
      };
      game.quiz.showNext();
      o.active = false; // remove obstacle after trigger
      break;
    }
  }

  // Scoring tick
  game.score += 0.02 * game.speed;

  // Draw
  render();
  updateHUD();
}

/* -------------------------------------------------
       Rendering
    ------------------------------------------------- */
function render(){
  const topic = game.obstacles[0]?.kind || 'road';
  drawBackground(topic);

  CTX.strokeStyle = '#1f2937'; CTX.lineWidth = 2;
  CTX.beginPath(); CTX.moveTo(0,GROUND_Y+0.5); CTX.lineTo(CANVAS.width,GROUND_Y+0.5); CTX.stroke();

  for(const o of game.obstacles) o.draw(CTX);
  game.player.draw(CTX);
}

function drawBackground(topic){
  CTX.clearRect(0,0,CANVAS.width, CANVAS.height);

  switch(topic){
    case 'fire': {
      const fireGrad = CTX.createLinearGradient(0,0,0,CANVAS.height);
      fireGrad.addColorStop(0, '#ff7f50');
      fireGrad.addColorStop(0.5, '#ff4500');
      fireGrad.addColorStop(1, '#8b0000');
      CTX.fillStyle = fireGrad; CTX.fillRect(0,0,CANVAS.width,CANVAS.height);
      for (let i=0;i<40;i++){
        CTX.fillStyle = `rgba(255,${100+Math.random()*155|0},0,${Math.random()})`;
        const x = Math.random()*CANVAS.width; const y = GROUND_Y - Math.random()*200;
        const size = Math.random()*3 + 1;
        CTX.beginPath(); CTX.arc(x,y,size,0,Math.PI*2); CTX.fill();
      }
      break;
    }
    case 'flood': {
      const g = CTX.createLinearGradient(0,0,0,CANVAS.height);
      g.addColorStop(0, '#00cfff'); g.addColorStop(0.5, '#0096c7'); g.addColorStop(1, '#0077b6');
      CTX.fillStyle = g; CTX.fillRect(0,0,CANVAS.width,CANVAS.height);
      for (let i=0;i<10;i++){
        CTX.strokeStyle = 'rgba(255,255,255,0.2)'; CTX.lineWidth = 2;
        CTX.beginPath(); const y = GROUND_Y - 30 - i*10;
        CTX.moveTo(0,y);
        for (let x=0;x<CANVAS.width;x+=20){
          CTX.quadraticCurveTo(x+10, y+(i%2?10:-10), x+20, y);
        }
        CTX.stroke();
      }
      break;
    }
    case 'hail': {
      const g = CTX.createLinearGradient(0,0,0,CANVAS.height);
      g.addColorStop(0, '#d0e1f9'); g.addColorStop(1, '#a0c4ff');
      CTX.fillStyle = g; CTX.fillRect(0,0,CANVAS.width,CANVAS.height);
      for (let i=0;i<50;i++){
        CTX.fillStyle = `rgba(255,255,255,${Math.random()*0.8+0.2})`;
        const x = (i*20 + game.tick*5) % CANVAS.width;
        const y = (i*15 + game.tick*5) % GROUND_Y;
        CTX.beginPath(); CTX.arc(x,y,3,0,Math.PI*2); CTX.fill();
      }
      break;
    }
    case 'quake': {
      const g = CTX.createLinearGradient(0,0,0,CANVAS.height);
      g.addColorStop(0, '#a0522d'); g.addColorStop(0.5, '#cd853f'); g.addColorStop(1, '#8b4513');
      CTX.fillStyle = g; CTX.fillRect(0,0,CANVAS.width,CANVAS.height);
      CTX.strokeStyle = 'rgba(0,0,0,0.3)'; CTX.lineWidth = 2;
      for (let i=0;i<5;i++){
        const sx = Math.random()*CANVAS.width;
        const sy = GROUND_Y - Math.random()*20;
        CTX.beginPath(); CTX.moveTo(sx,sy);
        for (let j=0;j<5;j++){
          CTX.lineTo(sx + (Math.random()*30-15), sy + (Math.random()*20-10));
        }
        CTX.stroke();
      }
      break;
    }
    default: { // road
      const g = CTX.createLinearGradient(0,0,0,CANVAS.height);
      g.addColorStop(0, '#87ceeb'); g.addColorStop(0.5, '#aee1f9'); g.addColorStop(1, '#f0f0f0');
      CTX.fillStyle = g; CTX.fillRect(0,0,CANVAS.width,CANVAS.height);
      CTX.strokeStyle = '#fff'; CTX.lineWidth = 4;
      for (let i=0;i<CANVAS.width;i+=80){
        CTX.beginPath(); CTX.moveTo(i, GROUND_Y+10); CTX.lineTo(i+40, GROUND_Y+10); CTX.stroke();
      }
    }
  }
}

/* -------------------------------------------------
       Helpers & input
    ------------------------------------------------- */
function roundRect(ctx, x, y, w, h, r, fill, stroke){
  if (typeof r === 'number') r = {tl:r,tr:r,br:r,bl:r};
  ctx.beginPath();
  ctx.moveTo(x + r.tl, y);
  ctx.lineTo(x + w - r.tr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r.tr);
  ctx.lineTo(x + w, y + h - r.br);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r.br, y + h);
  ctx.lineTo(x + r.bl, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r.bl);
  ctx.lineTo(x, y + r.tl);
  ctx.quadraticCurveTo(x, y, x + r.tl, y);
  if (fill) ctx.fill(); if (stroke) ctx.stroke();
}
function getCSS(varName){
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

// Input
window.addEventListener('keydown', (e)=>{
  // If restart overlay is open, handle Enter/Esc; otherwise gameplay jump
  if (restartOverlay.classList.contains('open')){
    if (e.code === 'Enter'){ e.preventDefault(); rsSaveRestart.click(); }
    if (e.code === 'Escape'){ e.preventDefault(); hideRestart(); }
    return;
  }
  if(e.code==='Space'){ e.preventDefault(); game.player.jump(); }
});
document.getElementById('gameWrap').addEventListener('pointerdown', ()=> game.player.jump());

// Restart button → open restart overlay (don’t stack over quiz)
UI.restart.addEventListener('click', ()=>{
  if (UI.modal.classList.contains('open')) return;
  showRestart();
});

// Restart overlay actions
rsSaveRestart.addEventListener('click', ()=>{
  const finalScore = Math.max(0, Math.floor(game.score || 0));
  // Dispatch event so leaderboard.js saves immediately
  window.dispatchEvent(new CustomEvent('hazard:restart', { detail: { score: finalScore } }));
  hideRestart();
  reset(); // leaderboard wrapper will avoid double save
});
rsCancel.addEventListener('click', ()=> hideRestart());

// Pause game when quiz modal opens
const obsConfig = { attributes: true, attributeFilter: ['class'] };
new MutationObserver(()=>{ game.pausedForQuiz = UI.modal.classList.contains('open'); }).observe(UI.modal, obsConfig);

// Start
reset();
