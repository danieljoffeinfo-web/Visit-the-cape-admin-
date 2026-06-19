  (function () {
    /* ─── SUPABASE (lazy — never blocks animation startup) ─── */
    const SUPA_URL = window.__SUPA_CONFIG?.url || 'https://ufcawaywfgzrhfbzxtgz.supabase.co';
    const SUPA_KEY = window.__SUPA_CONFIG?.key || 'sb_publishable_mbKqLIKHFrP0TvJjhCtf-A_QFgo2Tai';
    let _sbClient = null;
    function sb() { return _sbClient || (_sbClient = window.supabase.createClient(SUPA_URL, SUPA_KEY)); }
    window.__sb = sb;

    /* ─── CANVAS FRAME ANIMATION (homepage only) ─── */
    const canvas = document.getElementById('frame-canvas');
    const VC = window.__VC;

    if (canvas && VC) {
    const stickyCanvas = document.getElementById('sticky-canvas');
    const scrollContEl = document.getElementById('scroll-container');
    const progressEl   = document.getElementById('progress');

    /* LCP poster — visible before canvas draws; uses frame 1 preloaded in layout */
    if (stickyCanvas && !document.getElementById('hero-poster')) {
      const poster = document.createElement('img');
      poster.id = 'hero-poster';
      poster.alt = '';
      poster.decoding = 'sync';
      if ('fetchPriority' in poster) poster.fetchPriority = 'high';
      poster.src = (VC.first && VC.first.src) || VC.url(1);
      poster.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;pointer-events:none;background:#0c0b09';
      stickyCanvas.insertBefore(poster, canvas);
      canvas.style.position = 'relative';
      canvas.style.zIndex = '1';
    }

    /* Mobile: static hero only — no canvas scrub (saves ~50MB+ and fixes LCP) */
    if (VC.mobile) {
      if (scrollContEl) scrollContEl.style.height = '100svh';
      if (progressEl) progressEl.style.display = 'none';
      canvas.style.display = 'none';
      const navEl = document.getElementById('nav');
      window.addEventListener('scroll', () => {
        if (navEl) navEl.classList.toggle('scrolled', window.scrollY > 60);
      }, { passive: true });
      document.querySelectorAll('.reveal, .reveal-img, .reveal-card').forEach(function (el) {
        el.classList.add('visible');
      });
    } else {

    const TOTAL_FRAMES = 193;
    /* Mobile scrubs a shorter stage (280vh) — every 2nd frame is
       indistinguishable through the lerp smoothing and halves the payload. */
    const STEP = VC.mobile ? 2 : 1;

    const frameList = [];
    for (let i = 1; i <= TOTAL_FRAMES; i += STEP) frameList.push(i);
    if (frameList[frameList.length - 1] !== TOTAL_FRAMES) frameList.push(TOTAL_FRAMES);
    const N = frameList.length;
    const posOf = {};
    frameList.forEach((f, p) => { posOf[f] = p; });

    /* True device DPR — support high-density 4K/retina displays */
    const REAL_DPR = window.devicePixelRatio || 1;
    const DPR      = Math.min(REAL_DPR, 3);

    /* Canvas setup */
    const ctx = canvas.getContext('2d', { alpha: false });

    function resizeCanvas() {
      canvas.width  = Math.round(window.innerWidth  * DPR);
      canvas.height = Math.round(window.innerHeight * DPR);
      canvas.style.width  = window.innerWidth  + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      if (lastImg) drawCover(lastImg);
    }

    /* Draw frame — cover on desktop; on mobile the vehicle is centred with
       a blurred frame fill behind any letterbox so portrait never looks empty. */
    let lastImg = null;
    function getFramePlacement(img) {
      const cw = window.innerWidth, ch = window.innerHeight;
      const iw = img.naturalWidth,  ih = img.naturalHeight;
      if (!iw || !ih) return null;

      if (isMobile()) {
        /* Fit full vehicle width; if that makes it too small, scale up to
           ~52% viewport height so the car stays prominent and centred. */
        const fitW = cw / iw;
        const minH = (ch * 0.52) / ih;
        const scale = Math.max(fitW, minH);
        const dw = iw * scale, dh = ih * scale;
        return { cw, ch, dw, dh, drawX: (cw - dw) / 2, drawY: (ch - dh) / 2, mobile: true };
      }

      const coverScale = Math.max(cw / iw, ch / ih);
      const dw = iw * coverScale, dh = ih * coverScale;
      return { cw, ch, dw, dh, drawX: (cw - dw) / 2, drawY: (ch - dh) / 2, mobile: false };
    }

    function fillFrameBackdrop(img, metrics) {
      ctx.fillStyle = '#0c0b09';
      ctx.fillRect(0, 0, metrics.cw, metrics.ch);
      if (!metrics.mobile) return;
      /* Blurred cover behind the sharp frame — matches frame colours, no black bars */
      const bgScale = Math.max(metrics.cw / img.naturalWidth, metrics.ch / img.naturalHeight) * 1.12;
      const bgW = img.naturalWidth * bgScale;
      const bgH = img.naturalHeight * bgScale;
      ctx.save();
      ctx.filter = 'blur(32px) brightness(0.55)';
      ctx.drawImage(img, (metrics.cw - bgW) / 2, (metrics.ch - bgH) / 2, bgW, bgH);
      ctx.restore();
      ctx.fillStyle = 'rgba(12,11,9,0.28)';
      ctx.fillRect(0, 0, metrics.cw, metrics.ch);
    }

    function drawCover(img) {
      const metrics = getFramePlacement(img);
      if (!metrics) return;
      fillFrameBackdrop(img, metrics);
      ctx.drawImage(img, metrics.drawX, metrics.drawY, metrics.dw, metrics.dh);
      lastImg = img;
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas, { passive: true });

    const heroText    = document.getElementById('hero-text');
    const midText     = document.getElementById('mid-text');
    const endText     = document.getElementById('end-text');
    const scrollHint  = document.getElementById('scroll-hint');
    const progressBar = document.getElementById('progress');
    const scrollCont  = document.getElementById('scroll-container');
    const navEl       = document.getElementById('nav');

    const isMobile = () => window.innerWidth <= 900;

    /* Shorter scroll stage on mobile — snappy not exhausting */
    function setScrollHeight() {
      scrollCont.style.height = isMobile() ? '280vh' : '500vh';
    }
    setScrollHeight();
    window.addEventListener('resize', setScrollHeight, { passive: true });

    /* ── Progressive frame loader ──
       Binary-subdivision order: every 32nd frame first, then 16th, 8th, 4th,
       2nd, then the rest. The full scrub range is coverable after ~7 requests;
       every later download only refines temporal resolution.
       A small concurrency cap keeps bandwidth focused on the frames that
       unblock the animation soonest, and scrolling re-prioritises the queue. */
    const images  = new Array(TOTAL_FRAMES + 1);
    const isReady = new Array(TOTAL_FRAMES + 1).fill(false);
    const MAX_CONC = VC.slow ? 4 : 10;
    let inFlight = 0;
    let loadedCount = 0;
    let retryList = [];
    let retried = false;

    function buildLoadOrder() {
      const order = [], seen = new Set();
      [32, 16, 8, 4, 2, 1].forEach(stride => {
        for (let p = 0; p < N; p += stride) {
          const f = frameList[p];
          if (!seen.has(f)) { seen.add(f); order.push(f); }
        }
      });
      const last = frameList[N - 1];
      if (!seen.has(last)) order.push(last);
      return order;
    }
    let queue = buildLoadOrder();

    function onFrameReady(f) {
      isReady[f] = true;
      loadedCount++;
      /* If this frame is closer to the scroll target than what's on screen, swap it in */
      if (drawnIdx !== desiredIdx) {
        const best = nearestReady(desiredIdx);
        if (best && best !== drawnIdx) { drawCover(images[best]); drawnIdx = best; }
      }
    }

    function loadFrame(f, priority) {
      if (images[f]) return;
      const img = (f === 1 && VC.first) ? VC.first : new Image();
      images[f] = img;
      inFlight++;
      const settle = ok => {
        inFlight--;
        if (ok) onFrameReady(f);
        else { images[f] = undefined; retryList.push(f); }
        pump();
      };
      const finish = () => {
        if (!(img.complete && img.naturalWidth > 0)) return settle(false);
        /* Pre-decode off the draw path so scrubbing never hits decode jank */
        if (img.decode) img.decode().then(() => settle(true), () => settle(true));
        else settle(true);
      };
      img.decoding = 'async';
      if ('fetchPriority' in img && priority) img.fetchPriority = priority;
      if (!img.src) img.src = VC.url(f);
      if (img.complete && img.naturalWidth > 0) finish();
      else { img.onload = finish; img.onerror = () => settle(false); }
    }

    function pump() {
      while (inFlight < MAX_CONC && queue.length) {
        const f = queue.shift();
        if (images[f]) continue;
        loadFrame(f, loadedCount < 16 ? 'high' : 'auto');
      }
      /* One retry pass for anything that failed (flaky connections) */
      if (!queue.length && !inFlight && retryList.length && !retried) {
        retried = true;
        queue = retryList;
        retryList = [];
        pump();
      }
    }

    /* Move frames around the scroll position to the front of the queue */
    function prioritize(f) {
      const p = posOf[f] || 0;
      const want = [];
      for (let off = 0; off <= 10; off++) {
        const offs = off === 0 ? [0] : [-off, off];
        for (const s of offs) {
          const pp = p + s;
          if (pp >= 0 && pp < N) {
            const ff = frameList[pp];
            if (!images[ff]) want.push(ff);
          }
        }
      }
      if (want.length) {
        const wantSet = new Set(want);
        queue = want.concat(queue.filter(x => !wantSet.has(x)));
        pump();
      }
    }

    /* Closest loaded frame to the target — scrubbing never stalls or blanks */
    function nearestReady(f) {
      if (isReady[f]) return f;
      const p = posOf[f] || 0;
      for (let off = 1; off < N; off++) {
        const a = p - off, b = p + off;
        if (a >= 0 && isReady[frameList[a]]) return frameList[a];
        if (b < N && isReady[frameList[b]]) return frameList[b];
      }
      return 0;
    }

    let targetFrac  = 0;
    let currentFrac = 0;
    let desiredIdx  = 1;
    let drawnIdx    = 0;
    let animating   = false;

    pump();

    window.addEventListener('scroll', () => {
      const maxScroll = scrollCont.offsetHeight - window.innerHeight;
      targetFrac = Math.min(Math.max(window.scrollY / maxScroll, 0), 1);
      navEl.classList.toggle('scrolled', window.scrollY > 60);
      if (!animating) { animating = true; requestAnimationFrame(loop); }
    }, { passive: true });

    function loop() {
      const LERP = isMobile() ? 0.20 : 0.13;
      currentFrac += (targetFrac - currentFrac) * LERP;
      const done = Math.abs(targetFrac - currentFrac) < 0.0003;
      if (done) { currentFrac = targetFrac; animating = false; }
      else { requestAnimationFrame(loop); }
      render(currentFrac);
    }

    function render(f) {
      progressBar.style.width = (f * 100) + '%';

      /* Target frame — snapped to the frames this device actually loads */
      const pos = Math.max(0, Math.min(
        Math.round((Math.min(f / 0.88, 1)) * (N - 1)),
        N - 1
      ));
      const fi = frameList[pos];

      if (fi !== desiredIdx || drawnIdx !== fi) {
        desiredIdx = fi;
        const best = isReady[fi] ? fi : nearestReady(fi);
        if (best && best !== drawnIdx) { drawCover(images[best]); drawnIdx = best; }
        if (!isReady[fi]) prioritize(fi);
      }

      /* ── Hero parallax — minimal on mobile so animation breathes ── */
      const moveScale = isMobile() ? 120 : 340;
      const fadeSpeed = isMobile() ? 0.32 : 0.18;
      const heroOp   = Math.max(0, 1 - f / fadeSpeed);
      heroText.style.transform = `translateY(-${f * moveScale}px)`;
      heroText.style.opacity   = heroOp;

      if (scrollHint) scrollHint.style.opacity = Math.max(0, 1 - f / 0.08);

      /* Mid text */
      let midOp = 0;
      if (f >= 0.35 && f < 0.68) {
        if (f < 0.48)      midOp = (f - 0.35) / 0.13;
        else if (f < 0.58) midOp = 1;
        else               midOp = 1 - (f - 0.58) / 0.10;
      }
      midText.style.opacity   = midOp;
      midText.style.transform = `translateY(${Math.max(0, (0.35 - f) * 200)}px)`;

      /* End text */
      const endOp = f > 0.80 ? Math.min((f - 0.80) / 0.12, 1) : 0;
      endText.style.opacity       = endOp;
      endText.style.pointerEvents = endOp > 0.5 ? 'all' : 'none';
    }

    /* ─── SCROLL REVEAL ─── */
    const revealEls = document.querySelectorAll('.reveal, .reveal-img, .reveal-card');
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(el => obs.observe(el));

    } /* end desktop canvas scrub */

    } /* end canvas + homepage scroll reveal */

    /* ─── MOBILE NAV DRAWER ─── */
    const hamburger = document.getElementById('hamburger');
    const drawer    = document.getElementById('nav-drawer');

    if (hamburger && drawer) {
    window.toggleDrawer = function () {
      const open = drawer.classList.toggle('open');
      hamburger.classList.toggle('open', open);
      document.body.style.overflow = open ? 'hidden' : '';
    };

    window.closeDrawer = function () {
      drawer.classList.remove('open');
      hamburger.classList.remove('open');
      document.body.style.overflow = '';
    };
    }

    /* ─── MODAL: ENQUIRY ─── */
    const enquiryModal = document.getElementById('enquiry-modal');
    window.openEnquiry = function (experience) {
      if (experience) {
        const sel = document.getElementById('enq-experience');
        if (sel) {
          for (let i = 0; i < sel.options.length; i++) {
            if (sel.options[i].value === experience) { sel.selectedIndex = i; break; }
          }
        }
      }
      if (enquiryModal) enquiryModal.classList.add('open');
      document.body.style.overflow = 'hidden';
    };

    window.closeEnquiry = function () {
      if (enquiryModal) enquiryModal.classList.remove('open');
      document.body.style.overflow = '';
    };

    if (enquiryModal) enquiryModal.addEventListener('click', function (e) {
      if (e.target === this) window.closeEnquiry();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { window.closeEnquiry(); window.closeBooking && window.closeBooking(); window.closeVideo(); window.closePrivacy && window.closePrivacy(); window.closeDrawer(); }
    });

    /* ─── FORM SUBMIT → SUPABASE ─── */
    window.submitEnquiry = async function (e) {
      e.preventDefault();
      const btn    = document.getElementById('form-submit-btn');
      const status = document.getElementById('form-status');

      const payload = {
        name:       document.getElementById('enq-name').value.trim(),
        email:      document.getElementById('enq-email').value.trim(),
        phone:      document.getElementById('enq-phone').value.trim() || null,
        experience: document.getElementById('enq-experience').value || null,
        message:    document.getElementById('enq-message').value.trim() || null,
      };

      btn.disabled = true;
      btn.textContent = 'Sending…';
      status.textContent = '';
      status.className = 'form-status';

      const { error } = await sb().from('enquiries').insert([payload]);

      if (error) {
        status.textContent = 'Something went wrong. Please email us directly at hello@visitthecape.co.za';
        status.className = 'form-status error';
        btn.disabled = false;
        btn.textContent = 'Send Enquiry';
      } else {
        status.textContent = 'Thank you — we\'ll be in touch within 24 hours.';
        status.className = 'form-status success';
        btn.textContent = 'Sent';
        document.getElementById('enquiry-form').reset();
        setTimeout(() => { window.closeEnquiry(); btn.disabled = false; btn.textContent = 'Send Enquiry'; status.textContent = ''; }, 2800);
      }
    };

    /* ─── MODAL: PRIVACY ─── */
    const privacyModal = document.getElementById('privacy-modal');
    window.openPrivacy = function () {
      if (privacyModal) privacyModal.classList.add('open');
      document.body.style.overflow = 'hidden';
    };

    window.closePrivacy = function () {
      if (privacyModal) privacyModal.classList.remove('open');
      document.body.style.overflow = '';
    };

    if (privacyModal) privacyModal.addEventListener('click', function (e) {
      if (e.target === this) window.closePrivacy();
    });

    /* ─── MODAL: VIDEO ─── */
    const videoModal = document.getElementById('video-modal');
    window.openVideo = function () {
      if (videoModal) videoModal.classList.add('open');
      document.body.style.overflow = 'hidden';
    };

    window.closeVideo = function () {
      if (videoModal) videoModal.classList.remove('open');
      document.body.style.overflow = '';
    };

    if (videoModal) videoModal.addEventListener('click', function (e) {
      if (e.target === this) window.closeVideo();
    });

    document.querySelectorAll('[data-close="enquiry"]').forEach(function (btn) {
      btn.addEventListener('click', window.closeEnquiry);
    });

    document.querySelectorAll('[data-close="privacy"]').forEach(function (btn) {
      btn.addEventListener('click', window.closePrivacy);
    });

    document.querySelectorAll('[data-close="video"]').forEach(function (btn) {
      btn.addEventListener('click', window.closeVideo);
    });

  })();
