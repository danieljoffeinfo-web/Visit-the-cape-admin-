  (function () {

    /* ── Perf + favicon bootstrap (runs before booking logic) ── */
    (function vcPerfBootstrap() {
      var CDN = 'https://dft-admin.vercel.app';
      var head = document.head;
      if (head && !document.querySelector('link[data-vc-icon]')) {
        [
          { rel: 'icon', href: CDN + '/icon.webp', type: 'image/webp' },
          { rel: 'icon', href: CDN + '/favicon.ico', sizes: 'any' },
          { rel: 'apple-touch-icon', href: CDN + '/apple-touch-icon.png' },
        ].forEach(function (cfg) {
          var link = document.createElement('link');
          link.rel = cfg.rel;
          link.href = cfg.href;
          if (cfg.type) link.type = cfg.type;
          if (cfg.sizes) link.sizes = cfg.sizes;
          link.setAttribute('data-vc-icon', '1');
          head.appendChild(link);
        });
      }
      document.querySelectorAll('link[rel="preload"][as="image"][href^="/images/"]').forEach(function (el) {
        el.remove();
      });
      document.querySelectorAll('link[rel="preload"][as="script"][href*="/js/"]').forEach(function (el) {
        el.remove();
      });
    })();

    /* Back nav: never patch pushState or redirect to /#tours — that breaks the site. */
    var returningFromTour = false;

    try { sessionStorage.removeItem('vtc_nav_from_tour'); } catch (_) {}

    function resetBookingModal() {
      var modal = document.getElementById('booking-modal');
      if (modal) modal.classList.remove('open');
      if (document.body.style.overflow === 'hidden') document.body.style.overflow = '';
      document.querySelectorAll('.booking-step').forEach(function (el) { el.classList.remove('active'); });
      var typeStep = document.getElementById('step-type');
      if (typeStep) typeStep.classList.add('active');
    }

    function isHomepageContentMissing() {
      if (location.pathname !== '/') return false;
      var tours = document.getElementById('tours');
      if (!tours) return true;
      return !tours.querySelector('a[href^="/tours/"]');
    }

    function reloadCleanHomepage() {
      returningFromTour = false;
      resetBookingModal();
      window.location.href = '/';
    }

    document.addEventListener('click', function (e) {
      var link = e.target.closest && e.target.closest('a[href^="/tours/"]');
      if (link) returningFromTour = true;
    }, true);

    window.addEventListener('popstate', function () {
      resetBookingModal();
      if (location.pathname !== '/') return;
      window.setTimeout(function () {
        if (returningFromTour || isHomepageContentMissing()) reloadCleanHomepage();
      }, 50);
    });

    window.addEventListener('pageshow', function (e) {
      resetBookingModal();
      if (e.persisted && location.pathname === '/') reloadCleanHomepage();
    });

    window.addEventListener('pagehide', resetBookingModal);

    function recoverBrokenHomepage() {
      if (location.pathname !== '/' || !isHomepageContentMissing()) return;
      if (location.hash) {
        try { history.replaceState(null, '', '/'); } catch (_) {}
      }
      window.location.href = '/';
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', recoverBrokenHomepage);
    } else {
      recoverBrokenHomepage();
    }

    /* ── Mobile UI fixes (injected — public site CSS has form-row order bug) ── */
    (function injectMobileStyles() {
      if (document.getElementById('vtc-mobile-fixes')) return;
      var style = document.createElement('style');
      style.id = 'vtc-mobile-fixes';
      style.textContent = [
        '@media (max-width:900px){',
        '.form-row{display:grid!important;grid-template-columns:1fr!important;gap:0!important;margin-bottom:0!important}',
        '.form-group input,.form-group select,.form-group textarea{font-size:16px!important}',
        '.modal{max-height:100dvh;overflow-y:auto;-webkit-overflow-scrolling:touch}',
        '.tour-popular-tag{position:static!important;display:inline-block!important;margin-bottom:.65rem!important}',
        '.tour-card-content{display:flex;flex-direction:column}',
        'a.tour-cta,button.tour-cta{display:flex!important;width:100%!important;justify-content:center!important;',
        'align-items:center!important;padding:1rem 1.25rem!important;font-size:.72rem!important;font-weight:700!important;',
        'letter-spacing:.16em!important;margin-top:.75rem!important;min-height:48px!important;',
        '-webkit-tap-highlight-color:transparent;touch-action:manipulation}',
        'a.tour-cta{background:var(--bronze,#b8956a)!important;color:#1a1408!important;',
        'border:2px solid var(--bronze,#b8956a)!important;text-decoration:none!important}',
        'button.tour-cta--secondary,a.tour-cta--secondary{background:transparent!important;color:var(--bronze,#b8956a)!important;',
        'border:2px solid var(--bronze,#b8956a)!important}',
        '.btn-fill,.btn-outline,.form-submit,.tour-detail-cta-row .btn-fill{min-height:48px;touch-action:manipulation}',
        '.tour-detail-cta-row{flex-direction:column;width:100%}',
        '.tour-detail-cta-row .btn-fill,.tour-detail-cta-row .btn-outline{width:100%;justify-content:center}',
        '.booking-type-card,.cal-day,.tagalong-tour-item{min-height:48px;touch-action:manipulation}',
        '}'
      ].join('');
      document.head.appendChild(style);
    })();

    const bkState = {
      experience: '', date: null, passengers: 4,
      tagPassengers: 1, selectedTour: null,
      calYear: 0, calMonth: 0,
    };

    function resetBookingUi() {
      bkState.experience = '';
      bkState.date = null;
      bkState.passengers = 4;
      bkState.tagPassengers = 1;
      bkState.selectedTour = null;
      resetBookingModal();
    }

    /* Safe text setter — never interpolates into markup */
    function setText(el, str) { if (el) el.textContent = str; }

    let tagAlongCache = [];

    /* Escape helper for the few places we build HTML strings (calendar grid, list items) */
    function esc(v) {
      return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    window.openBooking = function (experience) {
      bkState.experience = experience;
      bkState.date = null;
      bkState.passengers = 4;
      bkState.tagPassengers = 1;
      bkState.selectedTour = null;
      const now = new Date();
      bkState.calYear = now.getFullYear();
      bkState.calMonth = now.getMonth();
      setText(document.getElementById('booking-exp-display'), experience);
      showBookingStep('type');
      var modal = document.getElementById('booking-modal');
      if (modal) modal.classList.add('open');
      document.body.style.overflow = 'hidden';
    };

    window.closeBooking = function () {
      resetBookingUi();
    };

    var bookingModal = document.getElementById('booking-modal');
    if (bookingModal) {
      bookingModal.addEventListener('click', function (e) {
        if (e.target === bookingModal) window.closeBooking();
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { window.closeBooking(); }
    });

    window.showBookingStep = function (step) {
      document.querySelectorAll('.booking-step').forEach(function (el) { el.classList.remove('active'); });
      var target = document.getElementById('step-' + step);
      if (target) target.classList.add('active');
      if (step === 'date')      renderCalendar();
      if (step === 'confirm')   renderBookingSummary();
      if (step === 'tagalong')  loadTagAlongTours();
    };

    window.selectBookingType = function (type) {
      window.showBookingStep(type === 'private' ? 'date' : 'tagalong');
    };

    /* ── CALENDAR ── */
    function renderCalendar () {
      var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      var yr = bkState.calYear, mo = bkState.calMonth;
      var today = new Date(); today.setHours(0,0,0,0);
      var maxDate = new Date(today); maxDate.setMonth(maxDate.getMonth() + 6);
      var firstDow = new Date(yr, mo, 1).getDay();
      var daysInMo = new Date(yr, mo + 1, 0).getDate();
      var atMin = yr === today.getFullYear() && mo === today.getMonth();
      var atMax = yr === maxDate.getFullYear() && mo === maxDate.getMonth();

      /* Build calendar HTML — only date numbers (integers) and pre-defined class strings go in */
      var rows = '<div class="cal-dow">Su</div><div class="cal-dow">Mo</div><div class="cal-dow">Tu</div><div class="cal-dow">We</div><div class="cal-dow">Th</div><div class="cal-dow">Fr</div><div class="cal-dow">Sa</div>';
      for (var i = 0; i < firstDow; i++) rows += '<div class="cal-day cal-day--empty"></div>';
      for (var d = 1; d <= daysInMo; d++) {
        var dt = new Date(yr, mo, d);
        var disabled = dt < today || dt > maxDate;
        var isSel = bkState.date && dt.getTime() === bkState.date.getTime();
        var isToday = dt.getTime() === today.getTime();
        var cls = 'cal-day' + (disabled ? ' cal-day--disabled' : isSel ? ' cal-day--selected' : isToday ? ' cal-day--today' : '');
        var dAttr = disabled ? '' : (' data-y="' + yr + '" data-m="' + mo + '" data-d="' + d + '"');
        rows += '<div class="' + cls + '"' + dAttr + '>' + d + '</div>';
      }

      var widget = document.getElementById('calendar-widget');
      widget.innerHTML = '<div class="cal-header"><button class="cal-nav" id="cal-prev"' + (atMin ? ' disabled' : '') + '>&#8249;</button><span class="cal-month-label">' + esc(MONTHS[mo]) + ' ' + yr + '</span><button class="cal-nav" id="cal-next"' + (atMax ? ' disabled' : '') + '>&#8250;</button></div><div class="cal-grid">' + rows + '</div>';

      /* Attach calendar events using delegation — no inline onclick on dynamic content */
      document.getElementById('cal-prev').onclick = function () { calNav(-1); };
      document.getElementById('cal-next').onclick = function () { calNav(1); };
      widget.querySelectorAll('.cal-day[data-y]').forEach(function (el) {
        el.addEventListener('click', function () {
          selectCalDate(+this.dataset.y, +this.dataset.m, +this.dataset.d);
        });
      });

      var confirmBtn = document.getElementById('cal-confirm-btn');
      if (confirmBtn) confirmBtn.disabled = !bkState.date;
    }

    function calNav (dir) {
      bkState.calMonth += dir;
      if (bkState.calMonth < 0)  { bkState.calMonth = 11; bkState.calYear--; }
      if (bkState.calMonth > 11) { bkState.calMonth = 0;  bkState.calYear++; }
      renderCalendar();
    }
    window.calNav = calNav;

    function selectCalDate (y, m, d) {
      bkState.date = new Date(y, m, d);
      renderCalendar();
    }

    /* ── PASSENGER STEPPER ── */
    window.adjustPassengers = function (delta) {
      var MIN = 4, MAX = 16;
      bkState.passengers = Math.min(MAX, Math.max(MIN, bkState.passengers + delta));
      setText(document.getElementById('passenger-count'), bkState.passengers);
      document.getElementById('pass-minus').disabled = bkState.passengers <= MIN;
      document.getElementById('pass-plus').disabled  = bkState.passengers >= MAX;
    };

    /* ── BOOKING SUMMARY ── */
    function renderBookingSummary () {
      var exp = bkState.experience;
      var dateStr = bkState.date ? bkState.date.toLocaleDateString('en-ZA', { weekday:'long', year:'numeric', month:'long', day:'numeric' }) : '—';
      var container = document.getElementById('booking-summary');
      container.innerHTML = '';
      [['Experience', exp], ['Type', 'Private Tour'], ['Date', dateStr], ['Passengers', bkState.passengers]].forEach(function (row) {
        var div = document.createElement('div');
        div.className = 'booking-summary-row';
        var lbl = document.createElement('span'); lbl.className = 'booking-summary-label'; lbl.textContent = row[0];
        var val = document.createElement('span'); val.className = 'booking-summary-value'; val.textContent = row[1];
        div.appendChild(lbl); div.appendChild(val);
        container.appendChild(div);
      });
    }

    /* ── PAYGATE: sync form POST keeps user-gesture chain (mobile Safari) ── */
    var PAYGATE_CHECKOUT_URL = 'https://dft-admin.vercel.app/api/paygate/checkout';

    function beginPayGateCheckout(experience, name, email, phone, passengers, dateStr) {
      var form = document.createElement('form');
      form.method = 'POST';
      form.action = PAYGATE_CHECKOUT_URL;
      form.acceptCharset = 'UTF-8';
      form.style.display = 'none';
      var fields = {
        experience: experience,
        name: name,
        email: email,
        phone: phone || '',
        passengers: String(passengers),
        date: dateStr || '',
      };
      Object.keys(fields).forEach(function (k) {
        var input = document.createElement('input');
        input.type = 'hidden';
        input.name = k;
        input.value = fields[k];
        form.appendChild(input);
      });
      document.body.appendChild(form);
      form.submit();
    }

    function redirectToPayFast(experience, name, email, phone, passengers, dateStr) {
      beginPayGateCheckout(experience, name, email, phone, passengers, dateStr);
      return Promise.resolve(true);
    }

    async function saveEnquiry(payload) {
      try {
        var res = await fetch('https://dft-admin.vercel.app/api/website/enquiry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        return res.ok;
      } catch (_) {
        return false;
      }
    }

    /* ── PRIVATE BOOKING SUBMIT ── */
    window.submitPrivateBooking = function () {
      var name  = document.getElementById('book-name').value.trim();
      var email = document.getElementById('book-email').value.trim();
      var phone = document.getElementById('book-phone').value.trim();
      var statusEl = document.getElementById('booking-status');
      var btn = document.getElementById('book-submit-btn');
      if (!name || !email) { statusEl.textContent = 'Please fill in your name and email.'; statusEl.className = 'form-status error'; return; }
      btn.disabled = true; setText(btn, 'Redirecting to payment…'); statusEl.textContent = ''; statusEl.className = 'form-status';
      var dateStr = bkState.date ? bkState.date.toLocaleDateString('en-ZA', { weekday:'long', year:'numeric', month:'long', day:'numeric' }) : 'Date TBD';
      var payload = { name: name, email: email, phone: phone || null, experience: bkState.experience, message: '[Private Tour] ' + bkState.passengers + ' passengers · ' + dateStr };
      saveEnquiry(payload);
      beginPayGateCheckout(bkState.experience, name, email, phone, bkState.passengers, dateStr);
    };

    /* ── TAG ALONG: LOAD TOURS ── */
    async function loadTagAlongTours () {
      var listEl = document.getElementById('tagalong-list');
      setText(document.getElementById('tagalong-exp-label'), bkState.experience);
      listEl.innerHTML = '';
      var loading = document.createElement('div');
      loading.className = 'tagalong-loading';
      loading.textContent = 'Loading available departures…';
      listEl.appendChild(loading);

      var today = new Date().toISOString().split('T')[0];
      var result = await window.__sb().from('tag_along_tours').select('*')
        .eq('experience', bkState.experience).gte('tour_date', today)
        .order('tour_date', { ascending: true }).limit(15);

      var available = [];
      if (!result.error && result.data) {
        available = result.data.filter(function (t) { return (t.total_seats - t.booked_seats) > 0; });
      }
      tagAlongCache = available;
      listEl.innerHTML = '';

      if (available.length === 0) {
        var msg = document.createElement('div');
        msg.className = 'tagalong-empty';
        msg.textContent = 'No upcoming departures with open seats for ' + bkState.experience + ' right now. ';
        var switchBtn = document.createElement('button');
        switchBtn.textContent = 'Book a private tour on your own date →';
        switchBtn.style.cssText = 'background:none;border:none;color:var(--bronze);cursor:pointer;font-family:var(--sans);font-size:0.82rem;text-decoration:underline;padding:0;';
        switchBtn.addEventListener('click', function () { window.selectBookingType('private'); });
        msg.appendChild(switchBtn);
        listEl.appendChild(msg);
        return;
      }

      available.forEach(function (t, i) {
        var d = new Date(t.tour_date + 'T00:00:00');
        var dStr = d.toLocaleDateString('en-ZA', { weekday:'short', day:'numeric', month:'long', year:'numeric' });
        var seats = t.total_seats - t.booked_seats;

        var item = document.createElement('div');
        item.className = 'tagalong-tour-item';
        item.dataset.idx = i;

        var info = document.createElement('div');
        var dateDiv = document.createElement('div'); dateDiv.className = 'tagalong-tour-date'; dateDiv.textContent = dStr;
        info.appendChild(dateDiv);
        if (t.departure_time) {
          var timeDiv = document.createElement('div'); timeDiv.className = 'tagalong-tour-time'; timeDiv.textContent = t.departure_time + ' Departure';
          info.appendChild(timeDiv);
        }

        var seatsDiv = document.createElement('div');
        var seatsNum = document.createElement('div'); seatsNum.className = 'tagalong-seats-num'; seatsNum.textContent = seats;
        var seatsLbl = document.createElement('span'); seatsLbl.className = 'tagalong-seats-label'; seatsLbl.textContent = 'seats left';
        seatsDiv.appendChild(seatsNum); seatsDiv.appendChild(seatsLbl);

        item.appendChild(info); item.appendChild(seatsDiv);
        item.addEventListener('click', function () { window.selectTagAlongTour(+this.dataset.idx); });
        listEl.appendChild(item);
      });
    }

    window.selectTagAlongTour = function (i) {
      var tour = tagAlongCache[i];
      bkState.selectedTour = tour;
      bkState.tagPassengers = 1;
      var d = new Date(tour.tour_date + 'T00:00:00');
      var dStr = d.toLocaleDateString('en-ZA', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
      var seats = tour.total_seats - tour.booked_seats;

      var detail = document.getElementById('selected-tour-detail');
      detail.innerHTML = '';
      var rows = [['Experience', tour.experience], ['Date', dStr]];
      if (tour.departure_time) rows.push(['Departure', tour.departure_time]);
      rows.push(['Seats available', seats + ' remaining']);
      rows.forEach(function (row) {
        var div = document.createElement('div'); div.className = 'booking-summary-row';
        var lbl = document.createElement('span'); lbl.className = 'booking-summary-label'; lbl.textContent = row[0];
        var val = document.createElement('span'); val.className = 'booking-summary-value'; val.textContent = row[1];
        div.appendChild(lbl); div.appendChild(val); detail.appendChild(div);
      });

      setText(document.getElementById('tag-count'), 1);
      document.getElementById('tag-minus').disabled = true;
      document.getElementById('tag-plus').disabled = seats <= 1;
      setText(document.getElementById('tag-seats-avail'), 'max ' + seats);
      window.showBookingStep('tagalong-confirm');
    };

    window.adjustTagPassengers = function (delta) {
      var avail = bkState.selectedTour ? (bkState.selectedTour.total_seats - bkState.selectedTour.booked_seats) : 1;
      bkState.tagPassengers = Math.min(avail, Math.max(1, bkState.tagPassengers + delta));
      setText(document.getElementById('tag-count'), bkState.tagPassengers);
      document.getElementById('tag-minus').disabled = bkState.tagPassengers <= 1;
      document.getElementById('tag-plus').disabled  = bkState.tagPassengers >= avail;
    };

    /* ── SUBMIT TAG ALONG ── */
    window.submitTagAlongBooking = async function () {
      var name  = document.getElementById('tag-name').value.trim();
      var email = document.getElementById('tag-email').value.trim();
      var phone = document.getElementById('tag-phone').value.trim();
      var statusEl = document.getElementById('tagalong-status');
      var btn = document.getElementById('tag-submit-btn');
      if (!name || !email) { statusEl.textContent = 'Please fill in your name and email.'; statusEl.className = 'form-status error'; return; }
      btn.disabled = true; setText(btn, 'Confirming…'); statusEl.textContent = ''; statusEl.className = 'form-status';
      var tour = bkState.selectedTour;
      var result = await window.__sb().from('tag_along_bookings').insert([{ tour_id: tour.id, name: name, email: email, phone: phone || null, passengers: bkState.tagPassengers, source: 'website' }]);
      if (result.error) {
        statusEl.textContent = 'Something went wrong. Please email us at hello@visitthecape.co.za';
        statusEl.className = 'form-status error';
        btn.disabled = false; setText(btn, 'Confirm Booking →');
      } else {
        setText(btn, 'Redirecting to payment…');
        var d = new Date(tour.tour_date + 'T00:00:00');
        var dStr = d.toLocaleDateString('en-ZA', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
        var ok = await redirectToPayFast(bkState.experience, name, email, phone, bkState.tagPassengers, dStr);
        if (!ok) {
          statusEl.textContent = 'Booking saved — redirecting to payment failed. Please email hello@visitthecape.co.za';
          statusEl.className = 'form-status error';
          btn.disabled = false; setText(btn, 'Confirm Booking →');
        }
      }
    };

    document.addEventListener('click', function (e) {
      var reserveBtn = e.target.closest('[data-book-tour]');
      if (reserveBtn) {
        e.preventDefault();
        e.stopImmediatePropagation();
        var tourName = reserveBtn.getAttribute('data-book-tour');
        if (tourName) window.openBooking(tourName);
        return;
      }
    }, true);

    document.addEventListener('click', function (e) {
      var typeBtn = e.target.closest('[data-booking-type]');
      if (typeBtn) {
        e.preventDefault();
        window.selectBookingType(typeBtn.getAttribute('data-booking-type'));
        return;
      }

      var stepBtn = e.target.closest('[data-booking-step]');
      if (stepBtn) {
        e.preventDefault();
        var step = stepBtn.getAttribute('data-booking-step');
        if (step) window.showBookingStep(step);
        return;
      }

      var passBtn = e.target.closest('[data-passenger-delta]');
      if (passBtn) {
        e.preventDefault();
        window.adjustPassengers(+passBtn.getAttribute('data-passenger-delta'));
        return;
      }

      var closeBtn = e.target.closest('[data-close="booking"]');
      if (closeBtn) {
        e.preventDefault();
        window.closeBooking();
        return;
      }

      var submitBtn = e.target.closest('#book-submit-btn');
      if (submitBtn) {
        e.preventDefault();
        window.submitPrivateBooking();
      }
    });

    var bookSubmit = document.getElementById('book-submit-btn');
    if (bookSubmit) bookSubmit.addEventListener('click', window.submitPrivateBooking);

    var tagSubmit = document.getElementById('tag-submit-btn');
    if (tagSubmit) tagSubmit.addEventListener('click', window.submitTagAlongBooking);

  })();
