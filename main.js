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
       Jake (runner) — simple avatar: red polo + khakis
    ------------------------------------------------- */
    class Runner {
      constructor(){
        this.reset();
      }
      reset(){
        this.x = 120; this.y = GROUND_Y; this.w = 36; this.h = 48;
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
        ctx.beginPath(); ctx.ellipse(this.x + this.w/2, GROUND_Y + 10, 18, 6, 0, 0, Math.PI*2); ctx.fill();
        // Legs (khakis)
        ctx.fillStyle = getCSS('--khaki');
        ctx.fillRect(this.x+6, this.y - this.h + 34, 10, 22);
        ctx.fillRect(this.x+20, this.y - this.h + 34, 10, 22);
        // Shoes
        ctx.fillStyle = '#111827';
        ctx.fillRect(this.x+6, this.y - 6, 12, 6);
        ctx.fillRect(this.x+22, this.y - 6, 12, 6);
        // Torso (red polo)
        ctx.fillStyle = getCSS('--accent');
        ctx.fillRect(this.x, this.y - this.h + 4, this.w, 34);
        // Head
        ctx.fillStyle = '#f9d3a6';
        ctx.beginPath(); ctx.arc(this.x + this.w/2, this.y - this.h + 4, 10, 0, Math.PI*2); ctx.fill();
        // Name tag
        ctx.fillStyle = '#ffffff'; ctx.fillRect(this.x + 6, this.y - this.h + 10, 12, 8);
      }
      bbox(){ return {x:this.x, y:this.y- this.h, w:this.w, h:this.h}; }
    }

    /* -------------------------------------------------
       Obstacles + Hazard triggers
    ------------------------------------------------- */
    class Obstacle {
      constructor(x, speed, kind){
        this.x = x; this.y = GROUND_Y; this.w = 32; this.h = 32; this.speed = speed; this.kind = kind; this.active = true;
      }
      update(){ this.x -= this.speed; if(this.x < -60) this.active = false; }
      draw(ctx){
        // Draw different icons per hazard kind
        ctx.save();
        ctx.translate(this.x, this.y - this.h);
        ctx.fillStyle = '#0b1324'; ctx.strokeStyle = '#334155'; ctx.lineWidth = 2;
        roundRect(ctx, 0, 0, this.w, this.h, 6, true, true);
        // icon
        ctx.fillStyle = iconColor(this.kind);
        drawIcon(ctx, this.kind, this.w, this.h);
        ctx.restore();
      }
      bbox(){ return {x:this.x, y:this.y-this.h, w:this.w, h:this.h}; }
    }

    function iconColor(kind){
      switch(kind){
        case 'flood': return '#38bdf8';
        case 'fire': return '#f97316';
        case 'hail': return '#a78bfa';
        case 'quake': return '#22c55e';
        case 'road': return '#facc15';
        default: return '#e5e7eb';
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
          for(let child of UI.opts.children){ 
            if (child.dataset.correct==='true') {
            child.classList.add('correct'); }
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
        // pick a quiz matching kind (or any)
        const pool = QUIZZES.filter(q=>q.kind===kind);
        const quiz = (pool.length? pool : QUIZZES)[Math.floor(Math.random()*(pool.length?pool.length:QUIZZES.length))];
        this.queue.push(quiz);
      }
      showNext(){
        const quiz = this.queue.shift();
        if(!quiz) return false;
        UI.prompt.textContent = quiz.prompt;
        UI.opts.innerHTML = '';
        quiz.options.forEach((opt,i)=>{
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
    };

    function reset(){
      game.running = true; game.speed = 6; game.score = 0; game.tick = 0; game.obstacles = []; game.player.reset();
      updateHUD();
      loop();
    }

    function updateHUD(){
      UI.score.textContent = `Score: ${Math.floor(game.score)}`;
      UI.speed.textContent = `Speed: ${game.speed.toFixed(0)}`;
    }

    function spawnObstacle(){
      const kinds = ['road','fire','hail','quake','flood'];
      const kind = kinds[Math.floor(Math.random()*kinds.length)];
      const x = CANVAS.width + 40;
      game.obstacles.push(new Obstacle(x, game.speed, kind));
    }

    function collide(a,b){
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }

    function loop(){
      if(!game.running) return;
      requestAnimationFrame(loop);
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
            // Reward or penalty
            if(correct){ game.score += 50; }
            else { game.speed = Math.max(5, game.speed - 1); game.score = Math.max(0, game.score - 20); }
            updateHUD();
            game.pausedForQuiz = false;
          };
          game.quiz.showNext();
          // remove obstacle after trigger
          o.active = false;
          break;
        }
      }

      // Scoring
      game.score += 0.08 * game.speed;

      // Draw
      render();
      updateHUD();
    }

    /* -------------------------------------------------
       Rendering
    ------------------------------------------------- */
    function render(){
      // Clear
      CTX.clearRect(0,0,CANVAS.width,CANVAS.height);

      // Parallax background
      drawBackground();

      // Ground line
      CTX.strokeStyle = '#1f2937'; CTX.lineWidth = 2;
      CTX.beginPath(); CTX.moveTo(0,GROUND_Y+0.5); CTX.lineTo(CANVAS.width,GROUND_Y+0.5); CTX.stroke();

      // Obstacles
      for(const o of game.obstacles){ o.draw(CTX); }

      // Player
      game.player.draw(CTX);
    }

    function drawBackground(){
      // distant skyline
      CTX.fillStyle = '#0b1220';
      CTX.fillRect(0,0,CANVAS.width, CANVAS.height);
      CTX.fillStyle = '#111827';
      for(let i=0;i<14;i++){
        const w = 60 + Math.random()*120;
        const h = 40 + Math.random()*80;
        const x = (i*120 + (game.tick*game.speed*0.2)%1200) % (CANVAS.width+120) - 120;
        const y = GROUND_Y - 20 - h;
        CTX.fillRect(x,y,w,h);
      }
      // stars
      CTX.fillStyle = 'rgba(255,255,255,.08)';
      for(let i=0;i<60;i++){
        const x = (i*18 + (game.tick*0.5)%2000) % CANVAS.width;
        const y = 20 + (i*7 % (GROUND_Y-80));
        CTX.fillRect(x,y,1,1);
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
    function getCSS(varName){ return getComputedStyle(document.documentElement).getPropertyValue(varName).trim(); }

    // Input
    window.addEventListener('keydown', (e)=>{ if(e.code==='Space'){ e.preventDefault(); game.player.jump(); } });
    UI.jumpBtn.addEventListener('click', ()=> game.player.jump());
    document.getElementById('gameWrap').addEventListener('pointerdown', ()=> game.player.jump());

    // Restart
    UI.restart.addEventListener('click', ()=>{ reset(); });

    // Pause game when quiz modal opens
    const obsConfig = { attributes: true, attributeFilter: ['class'] };
    new MutationObserver(()=>{ game.pausedForQuiz = UI.modal.classList.contains('open'); }).observe(UI.modal, obsConfig);

    // Start
    reset();