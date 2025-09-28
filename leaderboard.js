// leaderboard.js — persistent leaderboard with name memory + export/import.
// No changes to your original files required.

(() => {
  const STORAGE_KEY = 'hazard_runner_leaderboard_v1';
  const NAME_KEY    = 'hazard_runner_player_name_v1';

  document.addEventListener('DOMContentLoaded', () => {
    const wait = setInterval(() => {
      if (window.reset && window.game) {
        clearInterval(wait);
        initLeaderboard();
      }
    }, 30);
  });

  function initLeaderboard() {
    const originalReset = window.reset;

    // Styles
    const style = document.createElement('style');
    style.textContent = `
      .lb-wrap{margin-top:12px}
      .lb-card{background:#0b1220;border:1px solid #1f2937;border-radius:12px;padding:12px}
      .lb-title{margin:0 0 8px;font-size:16px;display:flex;align-items:center;gap:8px}
      .lb-row{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:4px 0;padding:6px 8px;border-radius:8px;background:rgba(17,24,39,.55)}
      .lb-row span{font-size:13px;color:#e5e7eb}
      .lb-controls{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
      .lb-btn{appearance:none;border:0;background:#3b82f6;color:#fff;padding:8px 10px;border-radius:10px;font-weight:600;cursor:pointer;box-shadow:0 6px 14px rgba(59,130,246,.35)}
      .lb-btn:active{transform:translateY(1px)}
      .lb-secondary{background:#374151}
      .lb-input{background:#0a1324;border:1px solid #243041;color:#e5e7eb;border-radius:10px;padding:8px 10px;min-width:160px}
      .lb-empty{font-size:13px;color:#9ca3af;margin:6px 0}
    `;
    document.head.appendChild(style);

    // UI
    const shell = document.querySelector('.shell') || document.body;
    const lbWrap = document.createElement('div');
    lbWrap.className = 'lb-wrap';
    lbWrap.innerHTML = `
      <div class="lb-card">
        <h3 class="lb-title">🏆 Leaderboard</h3>
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
          <input id="lbName" class="lb-input" placeholder="Your name/initials"/>
          <button id="lbRemember" class="lb-btn">Remember Name</button>
        </div>
        <div id="lbList"></div>
        <div class="lb-controls">
          <button id="lbSave" class="lb-btn">Save Now</button>
          <button id="lbExport" class="lb-btn lb-secondary">Export</button>
          <button id="lbImport" class="lb-btn lb-secondary">Import</button>
          <button id="lbClear" class="lb-btn lb-secondary">Clear</button>
          <input id="lbFile" type="file" accept="application/json" style="display:none"/>
        </div>
      </div>
    `;
    shell.appendChild(lbWrap);

    const $list     = lbWrap.querySelector('#lbList');
    const $save     = lbWrap.querySelector('#lbSave');
    const $clear    = lbWrap.querySelector('#lbClear');
    const $export   = lbWrap.querySelector('#lbExport');
    const $import   = lbWrap.querySelector('#lbImport');
    const $file     = lbWrap.querySelector('#lbFile');
    const $nameIn   = lbWrap.querySelector('#lbName');
    const $remember = lbWrap.querySelector('#lbRemember');

    // Storage helpers
    function getBoard(){
      try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
      catch { return []; }
    }
    function setBoard(board){
      localStorage.setItem(STORAGE_KEY, JSON.stringify(board));
      render();
    }
    function getName(){
      try { return localStorage.getItem(NAME_KEY) || ''; }
      catch { return ''; }
    }
    function setName(n){
      localStorage.setItem(NAME_KEY, String(n||'').slice(0,24));
      $nameIn.value = getName();
    }
    function addScore(name, score){
      const entry = { name: (name||'YOU').slice(0,24), score: Math.floor(score||0), at: Date.now() };
      const board = getBoard().concat(entry).sort((a,b)=> b.score - a.score).slice(0,10);
      setBoard(board);
    }
    function render(){
      const data = getBoard();
      if(!data.length){
        $list.innerHTML = `<div class="lb-empty">No scores yet. Finish a run or click “Save Now”.</div>`;
        return;
      }
      $list.innerHTML = data.map((e,i)=>{
        const d = new Date(e.at);
        const when = d.toLocaleString([], {hour:'2-digit', minute:'2-digit', month:'short', day:'numeric'});
        return `<div class="lb-row">
          <span>#${i+1}. ${escapeHTML(e.name)}</span>
          <span>${e.score}</span>
          <span style="opacity:.7">${when}</span>
        </div>`;
      }).join('');
    }
    function escapeHTML(s){ return String(s).replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }

    // Load remembered name
    $nameIn.value = getName();

    // Patch reset(): auto-save last run with remembered name, then run original reset
    window.reset = function patchedReset(){
      try {
        if (window.game && Number.isFinite(window.game.score) && window.game.score > 0) {
          const nm = getName() || 'YOU';
          addScore(nm, window.game.score);
        }
      } catch(_) {}
      return originalReset();
    };

    // Controls
    $remember.addEventListener('click', () => setName($nameIn.value.trim() || 'YOU'));
    $save.addEventListener('click', () => {
      const score = (window.game && window.game.score) ? Math.floor(window.game.score) : 0;
      const nm = getName() || ($nameIn.value.trim() || 'YOU');
      setName(nm);
      addScore(nm, score);
    });
    $clear.addEventListener('click', () => {
      if (confirm('Clear all leaderboard entries?')) setBoard([]);
    });

    $export.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify({board:getBoard(), name:getName()}, null, 2)], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'hazard_runner_leaderboard.json';
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    });

    $import.addEventListener('click', () => $file.click());
    $file.addEventListener('change', async () => {
      const f = $file.files && $file.files[0];
      if (!f) return;
      try {
        const text = await f.text();
        const parsed = JSON.parse(text);
        if (parsed && Array.isArray(parsed.board)) setBoard(parsed.board);
        if (parsed && typeof parsed.name === 'string') setName(parsed.name);
        alert('Import complete.');
      } catch (e) {
        alert('Import failed: invalid file.');
      } finally {
        $file.value = '';
      }
    });

    // Safety: auto-save on unload (as "AUTO") if there’s a score > 0 and no reset occurred
    window.addEventListener('beforeunload', () => {
      try {
        if (window.game && window.game.score > 0) {
          const board = getBoard();
          board.push({ name: getName() || 'AUTO', score: Math.floor(window.game.score), at: Date.now() });
          localStorage.setItem(STORAGE_KEY, JSON.stringify(board.sort((a,b)=>b.score-a.score).slice(0,10)));
        }
      } catch(_) {}
    });

    render();
  }
})();
