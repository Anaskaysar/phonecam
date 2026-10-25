/* Floating Help button. Contact and issue reports open the visitor's email app. */
(function () {
  var SUPPORT = 'kaysarulanas2@gmail.com'
  var style = document.createElement('style')
  style.textContent = [
    '.help-dock{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:60;display:flex;flex-direction:column;align-items:flex-end;gap:10px;font:15px/1.45 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}',
    '.help-dock[hidden]{display:none}',
    '.help-fab{display:inline-flex;align-items:center;gap:8px;height:48px;padding:0 18px 0 14px;border:0;border-radius:999px;background:#12151c;color:#f4f6f8;box-shadow:0 12px 40px rgba(0,0,0,.45),inset 0 0 0 1px rgba(255,255,255,.14);cursor:pointer}',
    '.help-fab svg{width:22px;height:22px;color:var(--accent,#dff25a)}',
    '.help-fab:hover{background:#1a1e28}',
    '.help-pop{width:min(380px,calc(100vw - 32px));max-height:min(70vh,560px);overflow:auto;padding:18px 18px 16px;border-radius:22px;background:#12151c;color:#f4f6f8;border:1px solid rgba(255,255,255,.1);box-shadow:0 24px 70px rgba(0,0,0,.5)}',
    '.help-pop[hidden]{display:none}',
    '.help-pop h2{margin:0 28px 14px 0;font-size:18px;letter-spacing:-.03em}',
    '.help-x{position:absolute;top:12px;right:12px;width:32px;height:32px;border:0;border-radius:50%;background:transparent;color:#a7b0bd;font-size:20px;line-height:1;cursor:pointer}',
    '.help-x:hover{background:rgba(255,255,255,.06);color:#f4f6f8}',
    '.help-pop{position:relative}',
    '.help-label{margin:0 0 8px;color:#f4f6f8;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;text-align:start}',
    '.help-pop textarea{display:block;width:100%;margin:0 0 10px;padding:12px 14px;border-radius:16px;border:1px solid rgba(255,255,255,.12);background:#0c0e14;color:#f4f6f8;resize:vertical;min-height:72px}',
    '.help-pop textarea::placeholder,.help-row input::placeholder{color:#6d7888}',
    '.help-row{display:flex;align-items:center;gap:8px;padding:5px 5px 5px 14px;border-radius:999px;background:#0c0e14;border:1px solid rgba(255,255,255,.12)}',
    '.help-row span{color:#a7b0bd;font-weight:700}',
    '.help-row input{flex:1;min-width:0;border:0;background:transparent;color:#f4f6f8;padding:8px 0}',
    '.help-row input:focus,.help-pop textarea:focus{outline:none}',
    '.help-row:focus-within,.help-pop textarea:focus{border-color:var(--accent,#dff25a)}',
    '.help-row button,.help-report{border:0;border-radius:999px;background:var(--accent,#dff25a);color:var(--accent-ink,#161a04);font-weight:700;cursor:pointer;text-decoration:none}',
    '.help-row button{padding:10px 14px;white-space:nowrap}',
    '.help-row button:hover,.help-report:hover{filter:brightness(1.05)}',
    '.help-fine{margin:8px 0 0;color:#8b97a8;font-size:12px;line-height:1.45;text-align:start;hyphens:manual}',
    '.help-fine a{color:#c5ced8}',
    '.help-split{height:1px;margin:14px 0;background:rgba(255,255,255,.08)}',
    '.help-report{display:flex;align-items:center;justify-content:center;width:100%;min-height:44px;padding:10px 16px;font:inherit}',
    '@media (max-width:420px){.help-row{padding-left:12px}.help-row button{padding-inline:12px}}'
  ].join('')
  document.head.appendChild(style)

  var dock = document.createElement('div')
  dock.className = 'help-dock'
  dock.innerHTML = [
    '<div class="help-pop" id="help-pop" role="dialog" aria-labelledby="help-title" hidden>',
    '<button type="button" class="help-x" aria-label="Close">×</button>',
    '<h2 id="help-title">How can we help?</h2>',
    '<form class="help-form">',
    '<p class="help-label">Contact us</p>',
    '<textarea name="message" required placeholder="What do you need?" rows="3"></textarea>',
    '<div class="help-row">',
    '<span aria-hidden="true">@</span>',
    '<input type="email" name="email" required placeholder="email@example.com" autocomplete="email" aria-label="Your email">',
    '<button type="submit">Email us</button>',
    '</div>',
    '<p class="help-fine">Opens your email app. <a href="/privacy.html">Privacy</a>.</p>',
    '</form>',
    '<div class="help-split"></div>',
    '<button type="button" class="help-report">Report an issue</button>',
    '<p class="help-fine">The email includes this page, so we can see where it happened.</p>',
    '</div>',
    '<button type="button" class="help-fab" aria-expanded="false" aria-controls="help-pop">',
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9.2 9.2a2.8 2.8 0 1 1 3.5 2.7c-.6.3-1 .9-1 1.6V15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="11.7" cy="17.2" r=".9" fill="currentColor"/></svg>',
    '<span>Help</span>',
    '</button>'
  ].join('')
  document.body.appendChild(dock)

  var pop = dock.querySelector('.help-pop')
  var fab = dock.querySelector('.help-fab')
  var form = dock.querySelector('form')
  var report = dock.querySelector('.help-report')
  var open = false

  function onCamera() {
    return location.hash.indexOf('#/camera') === 0
  }

  function version() {
    var match = document.body.innerText.match(/Version\s+(\d+\.\d+\.\d+)/)
    return match ? match[1] : ''
  }

  function openMail(subject, body) {
    var href = 'mailto:' + SUPPORT + '?subject=' + encodeURIComponent(subject)
    if (body) href += '&body=' + encodeURIComponent(body)
    var link = document.createElement('a')
    link.href = href
    link.click()
  }

  function issueBody() {
    var lines = ['Page: ' + location.href]
    var current = version()
    if (current) lines.push('Version: ' + current)
    lines.push('', 'What happened:', '')
    return lines.join('\n')
  }

  function place() {
    dock.hidden = onCamera()
    if (onCamera() && open) setOpen(false)
  }

  function setOpen(next) {
    open = next
    pop.hidden = !open
    fab.setAttribute('aria-expanded', open ? 'true' : 'false')
    if (open) {
      var field = form.elements.message
      if (field) field.focus()
    }
  }

  fab.addEventListener('click', function (event) {
    event.stopPropagation()
    setOpen(!open)
  })
  dock.querySelector('.help-x').addEventListener('click', function () {
    setOpen(false)
    fab.focus()
  })
  document.addEventListener('click', function (event) {
    if (open && !dock.contains(event.target)) setOpen(false)
  })
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && open) {
      setOpen(false)
      fab.focus()
    }
  })
  report.addEventListener('click', function () {
    openMail('PhoneCam issue', issueBody())
  })
  document.addEventListener('click', function (event) {
    var trigger = event.target.closest('[data-mail]')
    if (!trigger || dock.contains(trigger)) return
    var kind = trigger.getAttribute('data-mail')
    if (kind === 'issue') openMail('PhoneCam issue', issueBody())
    else if (kind === 'support') openMail('PhoneCam support')
    else openMail('PhoneCam')
  })
  form.addEventListener('submit', function (event) {
    event.preventDefault()
    var email = String(form.elements.email.value || '').trim()
    var message = String(form.elements.message.value || '').trim()
    openMail('PhoneCam', 'From: ' + email + '\n\n' + message + '\n\nPage: ' + location.href)
  })

  window.addEventListener('hashchange', place)
  place()

  // Count this browser once. The map is only on the About page, at the end.
  if (window.__pcVisitStarted) return
  window.__pcVisitStarted = true
  var panel = document.getElementById('visit-map')
  var seen = false
  try { seen = localStorage.getItem('pc.visit') === '1' } catch (e) {}
  if (!seen || panel) {
    fetch('/api/visits', { method: seen ? 'GET' : 'POST', headers: { accept: 'application/json' } })
      .then(function (response) { return response.ok ? response.json() : null })
      .then(function (data) {
        if (!data || typeof data.total !== 'number') return
        try { localStorage.setItem('pc.visit', '1') } catch (e) {}
        if (panel) paintVisits(panel, data)
      })
      .catch(function () {})
  }

  function countryName(code) {
    try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) || code } catch (e) { return code }
  }

  function paintVisits(root, data) {
    var total = root.querySelector('#visits')
    if (total) total.textContent = String(data.total)
    var list = root.querySelector('#visit-flags')
    var rows = Array.isArray(data.countries) ? data.countries : []
    if (list) {
      list.replaceChildren()
      rows.forEach(function (row) {
        if (!row || !/^[A-Z]{2}$/.test(row.code) || !(row.count > 0)) return
        var code = row.code.toLowerCase()
        var li = document.createElement('li')
        var img = document.createElement('img')
        img.src = 'https://flagcdn.com/w40/' + code + '.png'
        img.srcset = 'https://flagcdn.com/w80/' + code + '.png 2x'
        img.width = 28
        img.height = 20
        img.alt = ''
        var name = document.createElement('span')
        name.className = 'visit-name'
        name.textContent = countryName(row.code)
        var count = document.createElement('b')
        count.textContent = String(row.count)
        li.append(img, name, count)
        list.append(li)
      })
    }
    root.dataset.empty = rows.length ? 'false' : 'true'
    root.hidden = false
  }
})()
