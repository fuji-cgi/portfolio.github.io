const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── レイアウトを背景のドットグリッドに揃える ──
     position:fixedの要素(ヘッダー・HUD・ライトボックス・カーソルラベルなど)は対象外。
     それ以外の通常の流し込みレイアウトは、コンテンツの幅と左右の余白を
     --dot-spacingの倍数にスナップさせることで、格子に揃って見えるようにする。
     margin:0 autoによる中央寄せは画面幅に応じて半端な位置になるため、
     ここでJSが計算した値をCSS変数として上書きし、.sectionなどがそれを参照する。 */
  (function snapLayoutToGrid() {
    const root = document.documentElement;
    const SPACING = parseFloat(getComputedStyle(root).getPropertyValue('--dot-spacing')) || 22;
    const MAX_CONTENT = 980; // これまでのmax-widthに相当する上限の目安
    const MIN_MARGIN = 22;   // 画面端に最低限確保したい余白の目安

    function apply() {
      const vw = window.innerWidth;
      const available = Math.max(SPACING, Math.min(MAX_CONTENT, vw - MIN_MARGIN * 2));
      const width = Math.max(SPACING, Math.floor(available / SPACING) * SPACING);
      const rawOffset = Math.max(0, (vw - width) / 2);
      const offset = Math.floor(rawOffset / SPACING) * SPACING;

      root.style.setProperty('--grid-content-width', `${width}px`);
      root.style.setProperty('--grid-content-offset', `${offset}px`);
    }

    apply();
    window.addEventListener('resize', apply);
  })();

  /* ── WORKS用アートワーク生成（サムネイルとライトボックスで共有） ──
     今は実写真の代わりに、木目・石目を模したプロシージャルなアートワークを使っている。
     本物の写真に差し替えるときはdrawWorkArt()の中身を
     `ctx.drawImage(realImage, 0, 0, w, h)` に置き換えるだけでよい。
     偶数indexは木目、奇数indexは石目のパターンを交互に生成する。
  */
  const WOOD_PALETTES = [
    ['#3a2a1c', '#5a3f28', '#7a5636'], // ウォルナット系
    ['#4a3320', '#6b4a2c', '#9c6f3f'], // オーク系
  ];
  const STONE_PALETTES = [
    ['#39352e', '#4d473e', '#6b6255'], // スレート系
    ['#37332c', '#524b40', '#8f8575'], // ライムストーン系
  ];

  function drawWoodGrain(ctx, w, h, paletteIndex) {
    const [c0, c1, c2] = WOOD_PALETTES[paletteIndex % WOOD_PALETTES.length];

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, c1);
    grad.addColorStop(1, c0);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 年輪のような、なだらかに波打つ筋を何本か描く
    const lines = 9;
    for (let i = 0; i < lines; i++) {
      const t = i / (lines - 1);
      const baseY = h * (0.08 + t * 0.86);
      ctx.beginPath();
      ctx.moveTo(0, baseY + Math.sin(t * 5) * h * 0.02);
      const segments = 5;
      for (let s = 1; s <= segments; s++) {
        const x = (w / segments) * s;
        const wob = Math.sin(t * 9 + s * 1.7) * h * 0.035;
        ctx.lineTo(x, baseY + wob);
      }
      ctx.strokeStyle = c2;
      ctx.globalAlpha = 0.12 + (i % 3) * 0.05;
      ctx.lineWidth = Math.max(1, h * 0.012);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // 節(ふし)をひとつ
    const knotX = w * 0.72;
    const knotY = h * 0.55;
    const knotGrad = ctx.createRadialGradient(knotX, knotY, 1, knotX, knotY, w * 0.08);
    knotGrad.addColorStop(0, c0);
    knotGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = knotGrad;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.ellipse(knotX, knotY, w * 0.06, h * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawStoneTexture(ctx, w, h, paletteIndex) {
    const [c0, c1, c2] = STONE_PALETTES[paletteIndex % STONE_PALETTES.length];

    ctx.fillStyle = c0;
    ctx.fillRect(0, 0, w, h);

    // 斑(まだら)模様をいくつか重ねる
    const blobs = 6;
    for (let i = 0; i < blobs; i++) {
      const bx = (Math.sin(i * 12.9898) * 0.5 + 0.5) * w;
      const by = (Math.sin(i * 78.233 + 4) * 0.5 + 0.5) * h;
      const r = w * (0.18 + (i % 3) * 0.08);
      const rg = ctx.createRadialGradient(bx, by, 0, bx, by, r);
      rg.addColorStop(0, i % 2 === 0 ? c1 : c2);
      rg.addColorStop(1, 'transparent');
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(bx, by, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 大理石の筋のような細い線
    ctx.strokeStyle = c2;
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = Math.max(1, w * 0.004);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      const startY = h * (0.15 + i * 0.3);
      ctx.moveTo(0, startY);
      ctx.bezierCurveTo(w * 0.3, startY - h * 0.12, w * 0.6, startY + h * 0.15, w, startY - h * 0.05);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawWorkArt(ctx, w, h, index) {
    if (index % 2 === 0) {
      drawWoodGrain(ctx, w, h, Math.floor(index / 2));
    } else {
      drawStoneTexture(ctx, w, h, Math.floor(index / 2));
    }
  }

  /* ── HOME: 複数のパスパターンから、読み込みごとにランダムで1つ選ぶ ──
     Houdiniから書き出したパスを増やしたい場合は、この配列にd属性の文字列を追加するだけでよい。
     #bakedPathのdを書き換えれば、animateMotion(mpath経由)もカーソル操作も自動的に連動する。
     viewBoxは "0 0 400 260" を前提に、この範囲に収まるよう座標を決めている。 */
  const HERO_PATHS = [
    'M 20,210 C 90,50 160,50 200,150 S 340,240 380,110',
    'M 20,60 C 90,220 160,220 200,110 S 340,20 380,150',
    'M 20,130 C 80,30 140,230 200,130 S 320,30 380,130',
    'M 20,180 C 120,40 280,40 380,180',
    'M 20,140 C 60,40 140,40 180,140 S 300,240 380,60',
  ];
  (function pickRandomHeroPath() {
    const el = document.getElementById('bakedPath');
    if (!el) return;
    const chosen = HERO_PATHS[Math.floor(Math.random() * HERO_PATHS.length)];
    el.setAttribute('d', chosen);
  })();

  /* ── Hero: cursor interaction on top of the baked SVG motion ── */
  (function initHeroInteraction() {
    const svgEl = document.querySelector('#stage');
    const wrapper = document.querySelector('#interactive-wrapper');
    const moverCircle = document.querySelector('#mover circle');
    if (!svgEl || !wrapper || !moverCircle) return;

    if (prefersReducedMotion) {
      svgEl.pauseAnimations();
      return;
    }

    const MODE = 'repel';   // 'attract' or 'repel'
    const RADIUS = 90;
    const STRENGTH = 14;
    const DEAD_ZONE = 6;
    const EASE = 0.12;

    let target = { x: 0, y: 0 };
    let current = { x: 0, y: 0 };
    let mouse = null;

    function toViewBoxCoords(clientX, clientY) {
      const rect = svgEl.getBoundingClientRect();
      const vb = svgEl.viewBox.baseVal;
      return {
        x: ((clientX - rect.left) / rect.width) * vb.width + vb.x,
        y: ((clientY - rect.top) / rect.height) * vb.height + vb.y,
      };
    }

    window.addEventListener('mousemove', (e) => {
      const rect = svgEl.getBoundingClientRect();
      const inside =
        e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top && e.clientY <= rect.bottom;
      mouse = inside ? toViewBoxCoords(e.clientX, e.clientY) : null;
    });

    function tick() {
      if (mouse) {
        const rect = moverCircle.getBoundingClientRect();
        const center = toViewBoxCoords(rect.left + rect.width / 2, rect.top + rect.height / 2);
        const dx = mouse.x - center.x;
        const dy = mouse.y - center.y;
        const dist = Math.hypot(dx, dy);

        if (dist < DEAD_ZONE) {
          target.x = 0; target.y = 0;
        } else if (dist < RADIUS) {
          const influence = 1 - dist / RADIUS;
          const eased = influence * influence;
          const dir = MODE === 'attract' ? 1 : -1;
          target.x = (dx / dist) * eased * STRENGTH * dir;
          target.y = (dy / dist) * eased * STRENGTH * dir;
        } else {
          target.x = 0; target.y = 0;
        }
      } else {
        target.x = 0; target.y = 0;
      }

      current.x += (target.x - current.x) * EASE;
      current.y += (target.y - current.y) * EASE;
      wrapper.setAttribute('transform', `translate(${current.x},${current.y})`);
      requestAnimationFrame(tick);
    }
    tick();
  })();

  /* ── Nav active state + HUD, driven by scroll position ── */
  (function initSectionTracking() {
    const sections = Array.from(document.querySelectorAll('main .section'));
    const navLinks = Array.from(document.querySelectorAll('.nav-links a'));
    const hud = document.querySelector('#hud');
    const labels = { home: 'home', works: 'works', profile: 'profile', contact: 'contact' };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          navLinks.forEach((a) => a.classList.toggle('active', a.dataset.section === id));
          const idx = sections.findIndex((s) => s.id === id) + 1;
          if (hud) hud.textContent = `0${idx}/0${sections.length} — ${labels[id] || id}`;
        }
      });
    }, { threshold: 0.5 });

    sections.forEach((s) => observer.observe(s));
  })();

  /* ── WORKS: dot-matrix thumbnails that resolve into the image on hover ── */
  (function initWorkThumbnails() {
    const thumbs = document.querySelectorAll('.thumb');
    if (!thumbs.length) return;

    const rootStyles = getComputedStyle(document.documentElement);
    const SPACING = parseFloat(rootStyles.getPropertyValue('--dot-spacing')) || 22; // 背景ドットと同じ間隔
    const COVER_COLOR = rootStyles.getPropertyValue('--panel').trim() || '#1d1e23';
    const HALF = SPACING / 2;
    const REST_RADIUS = 2.6;      // 通常時：小さな色付きドット
    const MAX_STAGGER = 680;      // マウス進入点から一番遠いセルまでの遅延幅(ms)。ゆっくり広がるように
    const STAGGER_JITTER = 260;   // 各セルの開くタイミングに加えるランダムなばらつき幅(ms)

    thumbs.forEach((el, index) => {
      const imgCanvas = el.querySelector('.thumb-image');
      const maskCanvas = el.querySelector('.thumb-mask');
      const imgCtx = imgCanvas.getContext('2d');
      const maskCtx = maskCanvas.getContext('2d');

      const dpr = Math.max(window.devicePixelRatio || 1, 1);
      let w = 0, h = 0;
      let cells = [];
      let dots = []; // グリッドの全交点。休止時のドット表示専用(セル数+1本ぶん)
      let animId = null;
      let isRevealed = false;

      function sizeCanvases() {
        const rect = el.getBoundingClientRect();
        const pixelW = Math.round(rect.width * dpr);
        const pixelH = Math.round(rect.height * dpr);
        [imgCanvas, maskCanvas].forEach((c) => {
          c.width = pixelW;
          c.height = pixelH;
        });
        // 描画に使うw/hはバッキングストアの実ピクセル数から逆算する。
        // getBoundingClientRectの端数値をそのまま使うと、整数ピクセルのCanvasとの間に
        // わずかな差が生まれ、そこから背景色が線状に透けて見えてしまうため。
        w = pixelW / dpr;
        h = pixelH / dpr;
        imgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        maskCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      // 実写真に差し替える場合は drawWorkArt() の中身を変更すればよい
      function drawArt() {
        drawWorkArt(imgCtx, w, h, index);
      }

      function buildGrid() {
        const cols = Math.max(Math.floor(w / SPACING), 1);
        const rows = Math.max(Math.floor(h / SPACING), 1);
        // 余ったスペースを上下左右に均等配分し、端にドットの中心が乗らないようにする
        const offsetX = (w - (cols - 1) * SPACING) / 2;
        const offsetY = (h - (rows - 1) * SPACING) / 2;

        cells = [];
        for (let r = 0; r < rows; r++) {
          const cy = offsetY + r * SPACING;
          const top = r === 0 ? 0 : cy - HALF;
          const bottom = r === rows - 1 ? h : cy + HALF;
          for (let c = 0; c < cols; c++) {
            const cx = offsetX + c * SPACING;
            const left = c === 0 ? 0 : cx - HALF;
            const right = c === cols - 1 ? w : cx + HALF;
            cells.push({ cx, cy, left, top, right, bottom, revealed: false });
          }
        }

        // 休止時のドットは、セルの中心ではなく格子線の交点に置く。
        // 交点はセルより縦横それぞれ1本多い(cols+1)×(rows+1)本あるため、
        // セルとは別の配列として、右端・下端の交点も含めて全て作る。
        dots = [];
        for (let r = 0; r <= rows; r++) {
          const dy = Math.min(Math.max(offsetY + r * SPACING - HALF, REST_RADIUS), h - REST_RADIUS);
          for (let c = 0; c <= cols; c++) {
            const dx = Math.min(Math.max(offsetX + c * SPACING - HALF, REST_RADIUS), w - REST_RADIUS);
            dots.push({ x: dx, y: dy });
          }
        }
      }

      // 不透明なカバーに、未開放セルは丸いドット、開放済みセルは正方形の穴(destination-out)を開ける
      function drawMask() {
        maskCtx.clearRect(0, 0, w, h);
        maskCtx.fillStyle = COVER_COLOR;
        maskCtx.fillRect(0, 0, w, h);
        maskCtx.globalCompositeOperation = 'destination-out';

        // 開放済みセルは1つのパスにまとめてから一度に塗る。
        // セルごとに個別のfillRectを重ねると、隣接する境目のアンチエイリアスが
        // 完全に打ち消し合わず、うっすらグリッド状の線として画像に残ってしまうため。
        let hasRevealed = false;
        maskCtx.beginPath();
        cells.forEach((cell) => {
          if (cell.revealed) {
            maskCtx.rect(cell.left, cell.top, cell.right - cell.left, cell.bottom - cell.top);
            hasRevealed = true;
          }
        });
        if (hasRevealed) maskCtx.fill();

        // 休止時のドットは、格子線の交点全てに描く(セルの開放状態は見ない)。
        // 既に開放済みの範囲に重なっても、透明な場所をさらに透明にするだけで無害なため、
        // 「このセルは開いているから交点も消す」といった判定は不要。
        maskCtx.beginPath();
        dots.forEach((dot) => {
          maskCtx.moveTo(dot.x + REST_RADIUS, dot.y);
          maskCtx.arc(dot.x, dot.y, REST_RADIUS, 0, Math.PI * 2);
        });
        maskCtx.fill();

        maskCtx.globalCompositeOperation = 'source-over';
      }

      function computeDelays(originX, originY) {
        let maxDist = 1;
        cells.forEach((cell) => {
          cell.dist = Math.hypot(cell.cx - originX, cell.cy - originY);
          if (cell.dist > maxDist) maxDist = cell.dist;
        });
        cells.forEach((cell) => {
          const base = (cell.dist / maxDist) * MAX_STAGGER;
          const jitter = (Math.random() - 0.5) * STAGGER_JITTER;
          cell.delay = Math.max(0, base + jitter);
        });
      }

      // スクロール連動用：中心からの距離で0〜1の「しきい値」を1度だけ決めておく。
      // 中心に近いセルほど小さいしきい値＝早めに開く傾向を残しつつ、
      // ランダムな揺らぎを大きめに加えて、タイルごとの開くタイミングに
      // ばらつきが出るようにしている。
      function computeScrollThresholds() {
        const originX = w / 2;
        const originY = h / 2;
        let maxDist = 1;
        cells.forEach((cell) => {
          const dist = Math.hypot(cell.cx - originX, cell.cy - originY);
          if (dist > maxDist) maxDist = dist;
          cell.scrollDist = dist;
        });
        cells.forEach((cell) => {
          const jitter = (Math.random() - 0.5) * 0.55;
          cell.scrollThreshold = Math.min(Math.max(cell.scrollDist / maxDist + jitter, 0.05), 1);
        });
      }

      function animate() {
        const start = performance.now();

        if (animId) cancelAnimationFrame(animId);

        function frame(now) {
          const elapsed = now - start;
          let allDone = true;
          cells.forEach((cell) => {
            if (cell.revealed) return;
            if (elapsed >= cell.delay) {
              cell.revealed = true; // 補間なしで瞬時に切り替え
            } else {
              allDone = false;
            }
          });
          drawMask();
          animId = allDone ? null : requestAnimationFrame(frame);
        }
        animId = requestAnimationFrame(frame);
      }

      function reveal(originX, originY) {
        isRevealed = true;
        if (prefersReducedMotion) {
          cells.forEach((c) => { c.revealed = true; });
          drawMask();
          return;
        }
        computeDelays(originX, originY);
        animate();
      }

      function init() {
        if (animId) { cancelAnimationFrame(animId); animId = null; }
        const wasRevealed = isRevealed; // リサイズ前の状態を覚えておく
        sizeCanvases();
        drawArt();
        buildGrid();
        computeScrollThresholds();
        if (wasRevealed) {
          // 展開済みだった場合は見た目もそのまま全開にしておく。
          // ここでリセットしてしまうと、isRevealedがtrueのままセルだけ閉じた状態になり、
          // mouseenter/click/scrollが全て「もう開いている」と判定して反応しなくなるため。
          cells.forEach((c) => { c.revealed = true; });
        }
        drawMask();
      }

      el.addEventListener('mouseenter', (e) => {
        if (isRevealed) return;
        const rect = el.getBoundingClientRect();
        reveal(e.clientX - rect.left, e.clientY - rect.top);
      });
      // タッチ端末用：タップで表示（ホバーがないため）
      el.addEventListener('click', (e) => {
        if (isRevealed) return;
        const rect = el.getBoundingClientRect();
        reveal(e.clientX - rect.left, e.clientY - rect.top);
      });

      init();
      window.addEventListener('resize', init);

      // スクロール連動：カードの中心が画面のどの高さにいるかを展開の進み具合にする。
      // CENTER_STARTより下にある間は何も起きず(＝溜め)、
      // 画面中央あたり(CENTER_END)まで来たら開き切る。
      // 補間アニメーションはせず、スクロール位置と1対1で対応させているので、
      // スクロールが止まれば展開もそこでぴたりと止まる。
      const CENTER_START = 0.62; // 画面高さに対する割合。カード中心がここより下ならprogress=0
      const CENTER_END = 0.42;   // ここまで来たらprogress=1（ほぼ画面中央）

      function centerProgress() {
        const rect = el.getBoundingClientRect();
        const vh = window.innerHeight || document.documentElement.clientHeight;
        const elCenter = rect.top + rect.height / 2;
        const startAt = vh * CENTER_START;
        const endAt = vh * CENTER_END;
        return Math.min(Math.max((startAt - elCenter) / (startAt - endAt), 0), 1);
      }

      function updateFromScroll() {
        if (isRevealed) return;

        const progress = centerProgress();

        if (prefersReducedMotion) {
          if (progress > 0) {
            cells.forEach((c) => { c.revealed = true; });
            isRevealed = true;
            drawMask();
          }
          return;
        }

        let changed = false;
        cells.forEach((cell) => {
          const shouldReveal = progress >= cell.scrollThreshold;
          if (shouldReveal !== cell.revealed) {
            cell.revealed = shouldReveal;
            changed = true;
          }
        });
        if (changed) drawMask();
        if (progress >= 1) isRevealed = true;
      }

      let scrollScheduled = false;
      window.addEventListener('scroll', () => {
        if (scrollScheduled) return;
        scrollScheduled = true;
        requestAnimationFrame(() => { scrollScheduled = false; updateFromScroll(); });
      }, { passive: true });

      updateFromScroll(); // 読み込み時点ですでに画面内にある場合のため
    });
  })();

  /* ── WORKS: click a card to view it enlarged in a lightbox ── */
  (function initLightbox() {
    const cards = document.querySelectorAll('.work-card');
    const lightbox = document.getElementById('lightbox');
    if (!cards.length || !lightbox) return;

    const canvas = document.getElementById('lightboxCanvas');
    const ctx = canvas.getContext('2d');
    const elMeta = document.getElementById('lightboxMeta');
    const elTitle = document.getElementById('lightboxTitle');
    const elDesc = document.getElementById('lightboxDesc');
    const elTag = document.getElementById('lightboxTag');
    const closeEls = lightbox.querySelectorAll('[data-close]');

    let currentIndex = null;
    let lastFocused = null;

    function drawAtCurrentSize() {
      if (currentIndex === null) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.max(window.devicePixelRatio || 1, 1);
      const pixelW = Math.round(rect.width * dpr);
      const pixelH = Math.round(rect.height * dpr);
      canvas.width = pixelW;
      canvas.height = pixelH;
      const w = pixelW / dpr;
      const h = pixelH / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawWorkArt(ctx, w, h, currentIndex);
    }

    function open(card, index) {
      currentIndex = index;
      lastFocused = document.activeElement;

      elMeta.textContent = card.querySelector('.card-meta')?.textContent || '';
      elTitle.textContent = card.querySelector('h3')?.textContent || '';
      elDesc.textContent = card.querySelector('p')?.textContent || '';
      elTag.textContent = card.querySelector('.tag')?.textContent || '';

      lightbox.classList.add('open');
      lightbox.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';

      // パネルのレイアウトが確定してからサイズを取ってCanvasを描く
      requestAnimationFrame(drawAtCurrentSize);

      lightbox.querySelector('.lightbox-close').focus();
    }

    function close() {
      lightbox.classList.remove('open');
      lightbox.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      currentIndex = null;
      if (lastFocused) lastFocused.focus();
    }

    cards.forEach((card, index) => {
      card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'button');
      const title = card.querySelector('h3')?.textContent || '';
      card.setAttribute('aria-label', `${title} を拡大表示`);

      card.addEventListener('click', () => open(card, index));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open(card, index);
        }
      });
    });

    closeEls.forEach((el) => el.addEventListener('click', close));

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && lightbox.classList.contains('open')) close();
    });

    window.addEventListener('resize', () => {
      if (lightbox.classList.contains('open')) drawAtCurrentSize();
    });
  })();

  /* ── WORKS: カーソル追従の「Click」ラベル ──
     カードにカーソルを乗せている間だけ、カーソル付近に追従して表示する。 */
  (function initCursorBadge() {
    const badge = document.getElementById('cursorBadge');
    const cards = document.querySelectorAll('.work-card');
    if (!badge || !cards.length) return;

    const OFFSET_X = 18;
    const OFFSET_Y = 18;

    function moveBadge(e) {
      badge.style.left = `${e.clientX + OFFSET_X}px`;
      badge.style.top = `${e.clientY + OFFSET_Y}px`;
    }

    cards.forEach((card) => {
      card.addEventListener('mouseenter', (e) => {
        moveBadge(e);
        badge.classList.add('visible');
      });
      card.addEventListener('mousemove', moveBadge);
      card.addEventListener('mouseleave', () => {
        badge.classList.remove('visible');
      });
    });
  })();

