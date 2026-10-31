// @ts-nocheck
/**
 * Everything that runs on /partnership, started by DeckRuntime on mount and torn down on
 * unmount (client-side navigation away must not leave key handlers or body classes behind).
 *
 *  - --hdr: the site header's real height, so the hero and the sticky tab bar clear it.
 *  - Tabs: six panels, one visible; the URL hash names the tab (#overview … #apply) or any
 *    section inside one (#types, #request …) — such a link opens its tab first.
 *  - Presentation mode: every .slide full screen in order, across all tabs.
 *  - Real covers of published Arabic titles from /api/books.
 *  - The «طلب الشراكة» wizard → POST /api/partnership-requests (see that route).
 * Plain DOM code on purpose: the page body is static HTML (deck.html) rendered by the server.
 */
export function initDeck(root) {
  var cleanups = [];
  function on(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    cleanups.push(function () { target.removeEventListener(type, fn, opts); });
  }

  /* ── header height ── */
  var header = document.querySelector('body > header, header');
  function setHdr() { root.style.setProperty('--hdr', ((header && header.offsetHeight) || 80) + 'px'); }
  setHdr();
  if (header && window.ResizeObserver) {
    var ro = new ResizeObserver(setHdr);
    ro.observe(header);
    cleanups.push(function () { ro.disconnect(); });
  }

  /* ── tabs ── */
  var tabs = Array.prototype.slice.call(root.querySelectorAll('.tab'));
  var panels = Array.prototype.slice.call(root.querySelectorAll('.tab-panel'));
  var keys = tabs.map(function (t) { return t.getAttribute('data-tab'); });
  var bar = root.querySelector('.tabs-wrap');
  var hero = root.querySelector('.sv-hero');
  function heroBottom() { return hero ? hero.getBoundingClientRect().bottom + window.scrollY : 0; }
  function barHeight() { return bar ? bar.offsetHeight : 0; }
  // Past the hero, the site header slides up out of the way and the tab bar takes the top.
  var past = null;
  if (header) header.style.transition = 'transform .25s ease';
  function onScroll() {
    var now = window.scrollY > heroBottom() - ((header && header.offsetHeight) || 80) - 4;
    if (now === past) return;
    past = now;
    root.classList.toggle('past-hero', now);
    // -160%: the logo hangs below the header's own box, so -100% leaves its tip showing.
    if (header) header.style.transform = now ? 'translateY(-160%)' : '';
  }
  on(window, 'scroll', onScroll, { passive: true });
  onScroll();
  cleanups.push(function () {
    root.classList.remove('past-hero');
    if (header) { header.style.transform = ''; header.style.transition = ''; }
  });

  function showTab(key, opts) {
    opts = opts || {};
    if (keys.indexOf(key) === -1) return;
    tabs.forEach(function (t) {
      var sel = t.getAttribute('data-tab') === key;
      t.setAttribute('aria-selected', sel ? 'true' : 'false');
      t.tabIndex = sel ? 0 : -1;
      if (sel) {
        if (opts.focus) t.focus({ preventScroll: true });
        var list = t.parentElement;  // keep the chosen tab in view inside the scrolling bar
        var l = t.offsetLeft, r = l + t.offsetWidth;
        if (l < list.scrollLeft || r > list.scrollLeft + list.clientWidth) list.scrollLeft = l - 24;
      }
    });
    panels.forEach(function (p) { p.hidden = p.getAttribute('data-panel') !== key; });
    if (opts.hash !== false) { try { history.replaceState(null, '', '#' + key); } catch (e) {} }
    var stop = heroBottom() - ((header && header.offsetHeight) || 80);
    if (opts.scroll && window.scrollY > stop) window.scrollTo({ top: stop, behavior: 'auto' });
  }
  function revealTarget(id) {
    if (!id) return false;
    if (keys.indexOf(id) > -1) { showTab(id, { scroll: true }); return true; }
    var el = root.querySelector('#' + (window.CSS && CSS.escape ? CSS.escape(id) : id));
    if (!el) return false;
    var panel = el.closest('.tab-panel');
    if (panel && panel.hidden) showTab(panel.getAttribute('data-panel'), { hash: false });
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - barHeight() - 8, behavior: 'smooth' });
    return true;
  }

  tabs.forEach(function (t, i) {
    on(t, 'click', function () { showTab(keys[i], { scroll: true }); });
    on(t, 'keydown', function (e) {
      // RTL: the next tab is to the LEFT.
      var d = e.key === 'ArrowLeft' ? 1 : e.key === 'ArrowRight' ? -1 : 0;
      if (e.key === 'Home') d = -i; else if (e.key === 'End') d = tabs.length - 1 - i;
      if (!d) return;
      e.preventDefault();
      var n = (i + d + tabs.length) % tabs.length;
      showTab(keys[n], { focus: true });
    });
  });
  on(root, 'click', function (e) {
    var go = e.target.closest('[data-go-tab]');
    if (go) { showTab(go.getAttribute('data-go-tab'), { scroll: true }); return; }
    if (e.defaultPrevented) return;
    var a = e.target.closest('a[href^="#"]');
    if (!a || a.hasAttribute('data-open-wizard')) return;
    if (revealTarget(a.getAttribute('href').slice(1))) e.preventDefault();
  });
  var initial = (location.hash || '').slice(1);
  if (keys.indexOf(initial) > -1) showTab(initial, { hash: false });
  else if (initial && initial !== 'start') setTimeout(function () { revealTarget(initial); }, 50);

  /* ── presentation mode ── */
  (function () {
    var slides = Array.prototype.slice.call(root.querySelectorAll('.slide'));
    var total = slides.length, cur = 0, inPres = false;
    var dotsEl = root.querySelector('#slide-dots');
    var counter = root.querySelector('#slide-counter');
    var btn = root.querySelector('#pres-btn');
    if (!dotsEl || !btn) return;
    dotsEl.innerHTML = '';
    slides.forEach(function (_, i) {
      var d = document.createElement('span');
      d.addEventListener('click', function () { goTo(i); });
      dotsEl.appendChild(d);
    });
    function updateUI() {
      dotsEl.querySelectorAll('span').forEach(function (d, i) { d.classList.toggle('on', i === cur); });
      counter.textContent = (cur + 1) + ' / ' + total;
    }
    function goTo(n) {
      if (!inPres) return;
      slides[cur].classList.remove('on');
      cur = Math.max(0, Math.min(n, total - 1));
      slides[cur].classList.add('on');
      slides[cur].scrollTop = 0;
      updateUI();
    }
    function toggle() {
      inPres = !inPres;
      document.body.classList.toggle('pres-mode', inPres);
      slides.forEach(function (s) { s.classList.remove('on'); });
      if (inPres) {
        slides[cur].classList.add('on');
        btn.innerHTML = '<svg class="ic" width="18" height="18"><use href="#ic-shrink"/></svg> إغلاق العرض';
        updateUI();
      } else {
        btn.innerHTML = '<svg class="ic" width="18" height="18"><use href="#ic-expand"/></svg> عرض تقديمي';
        var panel = slides[cur].closest('.tab-panel');
        if (panel) showTab(panel.getAttribute('data-panel'), {});
        slides[cur].scrollIntoView({ behavior: 'auto' });
      }
    }
    on(root, 'click', function (e) {
      var b = e.target.closest('[data-pres]');
      if (!b) return;
      var a = b.getAttribute('data-pres');
      if (a === 'toggle') toggle(); else if (a === 'next') goTo(cur + 1); else if (a === 'prev') goTo(cur - 1);
    });
    on(document, 'keydown', function (e) {
      if (!inPres || document.body.classList.contains('wz-open')) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === ' ') { e.preventDefault(); goTo(cur + 1); }
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); goTo(cur - 1); }
      if (e.key === 'Escape') toggle();
    });
    updateUI();
  })();

  /* ═══ «ابدأ معنا» wizard ═══
     Seven questions, then «مسارك معنا» built from the answers, then POST /api/partnership-requests.
     Answers live in sessionStorage while the visitor moves between steps, and survive a
     failed send. Without JavaScript the buttons are plain links to the request section. */
  (function(){
    var INBOX = 'edara@moslimleader.com';
    var SITE_KEY = '0x4AAAAAACzKEGf-IQ39WfSB';
    var STORE = 'ml-partner-wizard';
    var QUESTIONS = 7;
    var GULF_EG = ['السعودية','الإمارات','الكويت','قطر','البحرين','عُمان','مصر'];

    var ROLE = {distributor:'موزّع',affiliate:'مسوّق بالعمولة',operator:'مشغّل محلي',licensee:'ترخيص المحتوى والشخصيات',investor:'مستثمر',unsure:'لست متأكدًا'};
    var STAGE = {existing:'نشاط قائم',founding:'في مرحلة التأسيس',individual:'فرد بلا شركة بعد'};
    var CHANNEL = {schools:'مدارس',nurseries:'حضانات',bookstores:'مكتبات','online-store':'متجر إلكتروني',marketplaces:'أمازون/نون','book-fairs':'معارض كتب','islamic-centers':'مراكز ومساجد إسلامية','direct-families':'بيع مباشر للأسر',other:'أخرى'};
    var EXPERIENCE = {none:'لا خبرة سابقة',general:'خبرة في منتجات عامة',kids:'خبرة في الأطفال أو الكتب أو التعليم'};
    var SIZE = {small:'تجربة صغيرة',medium:'متوسطة',large:'كبيرة',later:'أحدده بعد المكالمة'};

    var PATHS = {
      distributor: ['تواصل أولي عبر البريد','مكالمة تعارف أونلاين (20–30 دقيقة)','مستندات داعمة: ملف الشركة وأمثلة الأعمال السابقة','تجربة توزيع محدودة غير حصرية — المدة وحجم الطلبية بالاتفاق','تقييم بمستهدفات متفق عليها: المبيعات والسداد والالتزام بقواعد البراند','قرار: توسّع، أو حصرية محدودة، أو إنهاء التعاون'],
      affiliate: ['مكالمة تعارف','مواد تسويق معتمدة','عمولة على المبيعات المحصّلة — النسبة تُحدَّد بالاتفاق'],
      operator: ['مكالمة تعارف','عرض تشغيل ومسؤوليات مكتوبة','فترة تجريبية','اتفاق تشغيل'],
      licensee: ['مكالمة تعارف','تحديد المحتوى أو الشخصيات، والنطاق، والمدة','عقد ترخيص محدود']
    };

    var overlay = document.getElementById('wizard');
    if(!overlay) return;
    var form = document.getElementById('wz-form');
    var steps = Array.prototype.slice.call(form.querySelectorAll('.wz-step'));
    var backBtn = document.getElementById('wz-back');
    var nextBtn = document.getElementById('wz-next');
    var errEl = document.getElementById('wz-err');
    var statusEl = document.getElementById('wz-status');
    var cur = 1, opener = null, sending = false, tsToken = null, tsWidget = null, tsState = 'idle';

    /* ── answers ── */
    function read(){
      var fd = new FormData(form), a = {channels:[]};
      fd.forEach(function(v,k){ if(k==='channels') a.channels.push(v); else a[k]=String(v); });
      return a;
    }
    function save(){ try{ sessionStorage.setItem(STORE, JSON.stringify({a:read(), step:cur})); }catch(e){} }
    function restore(){
      var s; try{ s = JSON.parse(sessionStorage.getItem(STORE)||'null'); }catch(e){ s=null; }
      if(!s || !s.a) return 1;
      Array.prototype.forEach.call(form.elements, function(el){
        if(!el.name || !(el.name in s.a) && el.name!=='channels') return;
        var v = s.a[el.name];
        if(el.type==='radio') el.checked = (el.value===v);
        else if(el.type==='checkbox') el.checked = el.name==='channels' ? (s.a.channels||[]).indexOf(el.value)>-1 : v==='yes';
        else if(v!=null) el.value = v;
      });
      return Math.min(Math.max(1, s.step|0), QUESTIONS+1);
    }
    function country(a){ return a.country==='other' ? (a.countryOther||'').trim() : (a.country||''); }

    /* ── conditional fields ── */
    function syncConditional(){
      var a = read();
      form.querySelectorAll('[data-show-if]').forEach(function(el){
        var p = el.getAttribute('data-show-if').split('='), on;
        on = p[0]==='channels' ? a.channels.indexOf(p[1])>-1 : a[p[0]]===p[1];
        el.hidden = !on;
      });
    }

    /* ── validation, one step at a time ── */
    function problem(step, a){
      if(step===1 && !a.role) return 'اختر الدور الأقرب لك.';
      if(step===2 && !country(a)) return a.country==='other' ? 'اكتب اسم الدولة.' : 'اختر الدولة.';
      if(step===3 && !a.businessStage) return 'اختر وضع نشاطك.';
      if(step===4 && a.channels.indexOf('other')>-1 && !(a.channelsOther||'').trim()) return 'اكتب القنوات الأخرى، أو ألغِ اختيار «أخرى».';
      if(step===5 && !a.experience) return 'اختر خبرتك السابقة.';
      if(step===6 && !a.startSize) return 'اختر حجم البداية.';
      if(step===7){
        if(!(a.name||'').trim()) return 'اكتب اسمك.';
        if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((a.email||'').trim())) return 'اكتب بريدًا إلكترونيًا صحيحًا.';
        if(a.whatsapp && !/^[+\d\s()-]{6,40}$/.test(a.whatsapp.trim())) return 'رقم الواتساب غير صالح — أرقام فقط مع رمز الدولة.';
        if(a.consent!=='yes') return 'نحتاج موافقتك على التواصل بخصوص الطلب.';
      }
      return null;
    }
    function showError(msg){ errEl.textContent = msg||''; errEl.hidden = !msg; }

    /* ── «مسارك معنا» ── */
    function esc(s){ return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
    function suggested(a){ return a.channels.length ? 'distributor' : 'affiliate'; }
    function list(items){ return '<ol class="steps steps-sm">'+items.map(function(t){return '<li><span>'+esc(t)+'</span></li>';}).join('')+'</ol>'; }
    function note(html, gold){ return '<div class="'+(gold?'gold-box':'highlight')+' wz-box"><p>'+html+'</p></div>'; }

    function renderPath(){
      var a = read(), h = '', role = a.role;
      if(role==='investor'){
        h += note('مسلم ليدر تبحث عن <strong>شريك</strong> لا ممول فقط، ولا تبيع الملكية في هذه المرحلة. أي حصة مستقبلًا مرتبطة بالإنجاز وبنص اتفاق مكتوب.', true);
        h += '<p class="wz-hint">يمكنك متابعة طلبك بدور عملي:</p><div class="btn-row wz-switch">'
          + '<button type="button" class="btn-ghost" data-switch-role="operator">متابعة كمشغّل محلي</button>'
          + '<button type="button" class="btn-ghost" data-switch-role="distributor">متابعة كموزّع</button></div>'
          + '<p class="wz-hint">أو أرسل طلبك كما هو، وسنتواصل معك للتعارف.</p>';
      } else if(role==='unsure'){
        var s = suggested(a);
        h += note('نبدأ بمكالمة تعارف. وبحسب إجاباتك، الدور الأنسب لك مبدئيًا: <strong>'+ROLE[s]+'</strong>'+(a.channels.length?' — لأن لديك قنوات بيع.':' — لأنه لا يحتاج قنوات بيع قائمة.'));
        h += list(['مكالمة تعارف'].concat(PATHS[s].filter(function(t){return t.indexOf('مكالمة تعارف')!==0 && t.indexOf('تواصل أولي')!==0;})));
      } else {
        if(a.businessStage==='individual'){
          var sg = suggested(a);
          h += note('نبدأ بمكالمة تعارف.'+(sg!==role?' وبحسب إجاباتك قد يناسبك أيضًا دور <strong>'+ROLE[sg]+'</strong> — نناقشه معك في المكالمة.':''));
        }
        h += list(PATHS[role]);
        if(role==='distributor') h += note('الحصرية تُناقش بعد نتيجة التجربة فقط، وليست شرطًا لبدء التعاون.', true);
      }
      var c = country(a);
      if(c && GULF_EG.indexOf(c)===-1){
        h += note('أسواق التوسع الحالية بالترتيب: الخليج، ثم أوروبا، ثم أمريكا الشمالية، كما في خارطة الطريق أعلاه — لذلك لا نَعِد بموعد لسوق '+esc(c)+'، لكن يسعدنا التعارف.');
      }
      if(a.businessStage==='individual' || a.businessStage==='founding'){
        h += note('يسعدنا الاطلاع على خطة التأسيس والخبرات ذات الصلة.');
      }
      document.getElementById('wz-path').innerHTML = h;

      var rows = [['الدور',ROLE[a.role]],['الدولة',c],['وضع النشاط',STAGE[a.businessStage]],
        ['قنوات البيع',a.channels.map(function(k){return CHANNEL[k];}).join('، ')||'—'],
        ['قنوات أخرى',(a.channelsOther||'').trim()||'—'],['الخبرة',EXPERIENCE[a.experience]],
        ['أمثلة الخبرة',(a.experienceNotes||'').trim()||'—'],['حجم البداية',SIZE[a.startSize]],
        ['الاسم',a.name],['البريد',a.email],['واتساب',(a.whatsapp||'').trim()||'—'],
        ['الشركة',(a.company||'').trim()||'—'],['الروابط',(a.links||'').trim()||'—'],['الرسالة',(a.message||'').trim()||'—']];
      document.getElementById('wz-summary').innerHTML = rows.map(function(r){return '<dt>'+esc(r[0])+'</dt><dd>'+esc(r[1]||'—')+'</dd>';}).join('');
      return rows;
    }

    /* ── Turnstile, loaded only when the last step is reached ── */
    function mountTurnstile(){
      var box = document.getElementById('wz-turnstile');
      if(tsWidget!==null && window.turnstile){ return; }
      var render = function(){
        try{
          tsWidget = window.turnstile.render(box, {
            sitekey: SITE_KEY, language: 'ar', theme: 'dark',
            callback: function(t){ tsToken = t; tsState = 'ok'; syncNext(); },
            'expired-callback': function(){ tsToken = null; tsState = 'idle'; syncNext(); },
            'error-callback': function(){ tsToken = null; tsState = 'error'; syncNext(); }
          });
        }catch(e){ tsState = 'error'; syncNext(); }
      };
      if(window.turnstile){ render(); return; }
      window.mlTsReady = render;
      var s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=mlTsReady';
      s.async = true;
      s.onerror = function(){ tsState = 'error'; syncNext(); };
      document.head.appendChild(s);
    }
    function resetTurnstile(){ tsToken = null; tsState = 'idle'; try{ if(window.turnstile && tsWidget!==null) window.turnstile.reset(tsWidget); }catch(e){} }

    /* ── navigation ── */
    function syncNext(){
      if(cur===8){
        nextBtn.innerHTML = sending ? 'جارٍ الإرسال…' : 'إرسال الطلب';
        // Without a token the check has not passed yet — unless it could not load at all,
        // in which case the server decides and the visitor still has the email fallback.
        nextBtn.disabled = sending || (tsState!=='ok' && tsState!=='error');
      } else {
        nextBtn.disabled = false;
        nextBtn.innerHTML = (cur===7 ? 'اعرض مساري' : 'التالي') + ' <svg class="ic" width="16" height="16"><use href="#ic-arrl"/></svg>';
      }
    }
    function show(n){
      cur = n;
      steps.forEach(function(s){ s.hidden = Number(s.getAttribute('data-step'))!==n; });
      var q = Math.min(n, QUESTIONS);
      document.getElementById('wz-count').textContent = n===9 ? 'تم الإرسال' : n===8 ? 'مسارك معنا' : 'الخطوة '+q+' من '+QUESTIONS;
      document.getElementById('wz-bar').style.width = (n>=8 ? 100 : ((n-1)/QUESTIONS)*100) + '%';
      backBtn.hidden = n===1 || n===9;
      nextBtn.hidden = n===9;
      showError('');
      if(n===8){ renderPath(); mountTurnstile(); }
      syncConditional();
      syncNext();
      save();
      var first = steps[n-1] && steps[n-1].querySelector('input:checked, input:not([type=hidden]), select, textarea, button');
      if(first) first.focus({preventScroll:true});
      form.scrollTop = 0;
    }

    function mailtoHref(){
      var rows = renderPath();
      var body = rows.map(function(r){return r[0]+': '+(r[1]||'—');}).join('\n');
      return 'mailto:'+INBOX+'?subject='+encodeURIComponent('طلب شراكة — مسلم ليدر')+'&body='+encodeURIComponent(body);
    }
    function failure(msg){
      sending = false;
      resetTurnstile();
      statusEl.innerHTML = '<div class="wz-fail"><p>'+esc(msg)+'</p><p>إجاباتك محفوظة. اضغط «إرسال الطلب» لإعادة المحاولة، أو أرسلها بالبريد:</p>'
        + '<div class="btn-row"><a class="btn-ghost" href="'+mailtoHref()+'">أرسل إلى '+INBOX+'</a>'
        + '<button type="button" class="btn-ghost" id="wz-copy">نسخ الطلب</button></div></div>';
      document.getElementById('wz-copy').onclick = function(){
        var text = renderPath().map(function(r){return r[0]+': '+(r[1]||'—');}).join('\n');
        var done = function(){ document.getElementById('wz-copy').textContent = 'تم النسخ'; };
        if(navigator.clipboard){ navigator.clipboard.writeText(text).then(done, fallback); } else fallback();
        function fallback(){ var t=document.createElement('textarea'); t.value=text; t.style.position='fixed'; t.style.opacity='0'; document.body.appendChild(t); t.select(); try{document.execCommand('copy');}catch(e){} t.remove(); done(); }
      };
      syncNext();
    }
    function submit(){
      var a = read();
      for(var i=1;i<=QUESTIONS;i++){ var p = problem(i,a); if(p){ show(i); showError(p); return; } }
      sending = true; statusEl.innerHTML = ''; syncNext();
      var payload = {
        role:a.role, country:country(a), businessStage:a.businessStage, channels:a.channels,
        channelsOther:a.channelsOther||'', experience:a.experience, experienceNotes:a.experienceNotes||'',
        startSize:a.startSize, name:(a.name||'').trim(), email:(a.email||'').trim(), whatsapp:(a.whatsapp||'').trim(),
        company:a.company||'', links:a.links||'', message:a.message||'', consent:a.consent==='yes', turnstileToken:tsToken
      };
      var ctrl = window.AbortController ? new AbortController() : null;
      var timer = setTimeout(function(){ if(ctrl) ctrl.abort(); }, 20000);
      fetch('/api/partnership-requests', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload), signal: ctrl ? ctrl.signal : undefined})
        .then(function(r){ return r.json().catch(function(){return {};}).then(function(d){ return {ok:r.ok, d:d}; }); })
        .then(function(res){
          clearTimeout(timer);
          if(!res.ok || !res.d.ok){ failure(res.d.error || 'تعذّر إرسال الطلب الآن.'); return; }
          sending = false;
          try{ sessionStorage.removeItem(STORE); }catch(e){}
          form.reset();
          show(9);
        })
        .catch(function(){ clearTimeout(timer); failure('تعذّر الاتصال بالخادم — تحقق من الإنترنت.'); });
    }

    form.addEventListener('submit', function(e){
      e.preventDefault();
      if(cur===8){ if(!sending) submit(); return; }
      var p = problem(cur, read());
      if(p){ showError(p); return; }
      show(cur+1);
    });
    backBtn.addEventListener('click', function(){ if(cur>1) show(cur-1); });
    form.addEventListener('change', function(){ syncConditional(); save(); showError(''); });
    form.addEventListener('input', save);
    form.addEventListener('click', function(e){
      var b = e.target.closest('[data-switch-role]');
      if(!b) return;
      var r = form.querySelector('input[name=role][value="'+b.getAttribute('data-switch-role')+'"]');
      if(r){ r.checked = true; save(); renderPath(); }
    });

    /* ── open / close, focus kept inside ── */
    function open(e){
      if(e) e.preventDefault();
      opener = document.activeElement;
      overlay.hidden = false;
      document.body.classList.add('wz-open');
      show(restore());
    }
    function close(){
      overlay.hidden = true;
      document.body.classList.remove('wz-open');
      if(cur===9) cur = 1;
      if(opener && opener.focus) opener.focus();
    }
    root.querySelectorAll('[data-open-wizard]').forEach(function(b){ b.addEventListener('click', open); });
    overlay.querySelectorAll('[data-wz-close]').forEach(function(b){ b.addEventListener('click', close); });
    overlay.addEventListener('click', function(e){ if(e.target===overlay) close(); });
    on(document, 'keydown', function(e){
      if(overlay.hidden) return;
      if(e.key==='Escape'){ e.preventDefault(); close(); return; }
      if(e.key==='Tab'){
        var f = Array.prototype.filter.call(overlay.querySelectorAll('a[href],button:not([disabled]),input,select,textarea,summary,[tabindex]:not([tabindex="-1"])'), function(el){ return el.offsetParent!==null; });
        if(!f.length) return;
        var first=f[0], last=f[f.length-1];
        if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
        else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
      }
    }, true);
    if(location.hash==='#start' || location.hash==='#apply-now') open();
  })();

  /* Real covers of published Arabic titles, from the same API the library uses. If it fails,
     the section still lists the works by name. */
  (function(){
    var box = document.getElementById('works-covers');
    if(!box || !window.fetch) return;
    var ctrl = window.AbortController ? new AbortController() : null;
    setTimeout(function(){ if(ctrl) ctrl.abort(); }, 8000);
    fetch('/api/books', {signal: ctrl ? ctrl.signal : undefined})
      .then(function(r){ return r.ok ? r.json() : {books:[]}; })
      .then(function(d){
        var seen = {}, out = [];
        (d.books||[]).forEach(function(b){
          if(out.length>=8 || !b.cover || (b.language && b.language!=='ar')) return;
          var key = b.seriesId || b.id;      // one cover per series
          if(seen[key]) return; seen[key] = 1;
          out.push(b);
        });
        box.innerHTML = out.map(function(b){
          var t = String(b.title||'').replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});
          return '<a href="/library/'+encodeURIComponent(b.id)+'" title="'+t+'"><img src="'+encodeURI(b.cover)+'" alt="'+t+'" loading="lazy" decoding="async"></a>';
        }).join('');
      })
      .catch(function(){});
  })();

  return function () {
    cleanups.forEach(function (f) { try { f(); } catch (e) {} });
    document.body.classList.remove('pres-mode', 'wz-open');
  };
}
