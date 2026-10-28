// Run with jsdom and php-parser available on NODE_PATH (see early-access-site/README.md).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '../early-access-site');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const edgeFunction = fs.readFileSync(path.resolve(__dirname, '../supabase/functions/journal-early-access/index.ts'), 'utf8');
const migration = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/202610120001_create_journal_early_access.sql'), 'utf8');
const delay = () => new Promise(resolve => setTimeout(resolve, 30));
let checks = 0;
function check(value, message) { assert.ok(value, message); checks++; }
function setup({ fail = false, stored = null, storageBlocked = false, country = "PH", geoFail = false, url = 'https://journal.test/?utm_source=church&utm_medium=community&utm_campaign=launch&utm_content=post&utm_term=journal' } = {}) {
  const dom = new JSDOM(read('index.html'), {
    url,
    referrer: 'https://example.org/private/path?secret=excluded', runScripts: 'outside-only', pretendToBeVisual: true
  });
  const w = dom.window;
  w.matchMedia = () => ({ matches: true });
  w.HTMLElement.prototype.scrollIntoView = function () {};
  const observers = [];
  w.IntersectionObserver = class {
    constructor(callback) { this.callback = callback; this.targets = []; observers.push(this); }
    observe(target) { this.target = target; this.targets.push(target); }
    unobserve() {} disconnect() {}
  };
  if (stored) w.sessionStorage.setItem('journal-early-access-attribution-v2', stored);
  if (storageBlocked) Object.defineProperty(w, 'sessionStorage', { get() { throw Error('Blocked'); } });
  w.eval(read('attribution.js'));
  const requests = [];
  w.fetch = async (url, request) => {
    if (url === "/api/location-proxy.php") return { ok: !geoFail, json: async () => ({ country_code: country }) };
    requests.push(JSON.parse(request.body));
    return { ok: !fail, json: async () => fail ? { success: false, error: 'Please retry.' } : { success: true, signup_token: 'a'.repeat(48) } };
  };
  w.eval(read('app.js'));
  w.eval(read('pricing.js'));
  return { dom, w, d: w.document, requests, observers };
}
async function submit(ctx, action) {
  const form = ctx.d.getElementById('early-access-form');
  form.dispatchEvent(new ctx.w.SubmitEvent('submit', { bubbles: true, cancelable: true, submitter: form.querySelector(`[data-action=${action}]`) }));
  await delay();
}
function fill(ctx) {
  ctx.d.querySelector('#email').value = 'qa@example.com';
  ctx.d.querySelector('[name=platform]').checked = true;
  ctx.d.querySelector('[name=email_consent]').checked = true;
}
function events(ctx) { return ctx.w.dataLayer.map(x => x.event); }
(async () => {
  const ctx = setup();
  const { d, w } = ctx;
  const signupEndpoint = d.querySelector('meta[name=journal-signup-endpoint]')?.content || '';
  check(signupEndpoint === 'https://aesmrjinczhknchlrsmt.supabase.co/functions/v1/journal-early-access', 'Form is configured for the Journal Supabase Edge Function');
  check(read('app.js').includes('postJson(signupEndpoint, payload)') && !read('app.js').includes('api/early-access.php'), 'Frontend no longer submits signups to PHP');
  check(read('.htaccess').includes("connect-src 'self' https://aesmrjinczhknchlrsmt.supabase.co"), 'CSP allows only the configured Supabase project for browser connections');
  check(!d.querySelector('[name=expected_price]'), 'Unanchored expected-price question removed');
  check(d.querySelectorAll('[name=feature_interests]').length === 8, 'All eight feature choices available');
  check(d.querySelector('#pricing').compareDocumentPosition(d.querySelector('#early-access')) & 4, 'Pricing precedes signup');
  const featureValues = [...d.querySelectorAll('[name=feature_interests]')].map(input => input.value);
  check(d.querySelectorAll('.faq-list details').length === 8, 'FAQ is limited to eight concise questions');
  check(d.querySelector('.faq-list summary').textContent === 'Is Journal by siFia a Christian journal?', 'FAQ starts with the primary positioning question');
  check(d.querySelector('#website').closest('[hidden]'), 'Honeypot stays visually hidden even without CSS');
  check(d.querySelector('#website').tabIndex === -1 && d.querySelector('#website').closest('[aria-hidden=true]'), 'Honeypot excluded from keyboard and accessibility tree');
  const ids = [...d.querySelectorAll('[id]')].map(x => x.id);
  check(new Set(ids).size === ids.length, 'No duplicate IDs');
  for (const el of d.querySelectorAll('[src],link[href],a[href]')) {
    const value = el.getAttribute('src') || el.getAttribute('href');
    if (/^(https?:|mailto:)/.test(value)) continue;
    if (value.startsWith('#')) check(d.getElementById(value.slice(1)), `Anchor exists: ${value}`);
    else check(fs.existsSync(path.join(root, value.split('?')[0])), `Asset/legal page exists: ${value}`);
  }
  await submit(ctx, 'join');
  check(ctx.requests.length === 0 && d.querySelectorAll('[aria-invalid=true]').length >= 3, 'Invalid signup sends nothing and exposes errors');
  fill(ctx);
  d.querySelector('[name=email_consent]').checked = false;
  await submit(ctx, 'join');
  check(ctx.requests.length === 0, 'No signup without consent');
  d.querySelector('[name=email_consent]').checked = true;
  d.querySelector('#email').focus();
  d.querySelector('.hero a.cta').click();
  d.querySelector('#pricing a.cta').click();
  ctx.observers[0].callback([{ isIntersecting: true }]);
  ctx.observers[0].callback([{ isIntersecting: true }]);
  const photo = d.querySelector('.product-screenshot');
  const photoObserver = ctx.observers.find(observer => observer.targets.includes(photo));
  check(photoObserver, 'Product photos are observed for scroll-triggered animation');
  photoObserver.callback([{ isIntersecting: true, target: photo }]);
  check(photo.classList.contains('is-photo-visible'), 'Product photo animates when it reaches the viewport');
  const pending = submit(ctx, 'join');
  await submit(ctx, 'join');
  await pending;
  check(ctx.requests.length === 1, 'Concurrent signup submissions are blocked');
  check(!d.querySelector('[data-step="2"]').hidden, 'Signup succeeds before survey');
  check(d.querySelector('.form-progress').hidden, 'Signup progress is hidden when question progress takes over');
  check(!d.querySelector('[data-survey-panel="intro"]').hidden, 'Signup confirmation appears before optional questions');
  check(d.querySelectorAll('[data-survey-panel]').length === 6, 'Five optional questions are split into individual screens');
  check(d.querySelector('[data-survey-panel="intro"]').textContent.includes('Journal by siFia'), 'Signup confirmation uses the full product name');
  check(ctx.requests[0].utm_term === 'journal' && ctx.requests[0].referrer_domain === 'https://example.org', 'UTM term and privacy-limited referrer sent');
  check(ctx.requests[0].landing_page === 'https://journal.test/', 'Landing URL excludes arbitrary query data');
  const original = JSON.stringify(w.journalAttribution);
  w.history.replaceState({}, '', '/privacy.html'); w.eval(read('attribution.js'));
  w.history.replaceState({}, '', '/index.html'); w.eval(read('attribution.js'));
  check(JSON.stringify(w.journalAttribution) === original, 'Attribution survives legal-page navigation without UTMs');
  d.querySelector('[data-action=survey-start]').click();
  check(!d.querySelector('[data-survey-panel="1"]').hidden && d.querySelector('[data-survey-panel="2"]').hidden, 'Only the first optional question is shown');
  d.querySelector('#current_journaling').value = 'paper';
  d.querySelector('#current_journaling').focus();
  d.querySelector('[data-survey-panel="1"] [data-action=survey-next]').click();
  const features = [...d.querySelectorAll('[name=feature_interests]')];
  for (const input of features.slice(0, 3)) { input.checked = true; input.dispatchEvent(new w.Event('change')); }
  check(features.slice(3).every(x => x.disabled), 'Feature selection capped at three');
  features[0].checked = false; features[0].dispatchEvent(new w.Event('change'));
  check(features.every(x => !x.disabled), 'Deselecting allows another choice');
  d.querySelector('[data-survey-panel="2"] [data-action=survey-next]').click();
  check(d.querySelector('#price-question-label').textContent.includes('₱599'), 'Survey uses detected Philippine price');
  check(!d.querySelector('#pricing-region'), 'No region picker in pricing');
  check(d.querySelector('#price-context').textContent === 'one time', 'Price label has no geographic qualifier');
  d.querySelector('[name=price_reaction][value=try-first]').checked = true;
  d.querySelector('[data-survey-panel="3"] [data-action=survey-next]').click();
  check(d.querySelector('#testing-details').hidden, 'Testing details hidden before volunteering');
  d.querySelector('[name=tester_opt_in]').checked = true;
  d.querySelector('[name=tester_opt_in]').dispatchEvent(new w.Event('change'));
  check(!d.querySelector('#testing-details').hidden, 'Testing details revealed by opt-in');
  d.querySelector('[data-survey-panel="4"] [data-action=survey-next]').click();
  check(!d.querySelector('[data-survey-panel="5"]').hidden, 'Final optional question is shown by itself');
  await submit(ctx, 'finish');
  check(!d.querySelector('[data-step=success]').hidden, 'Survey reaches confirmation');
  check(d.querySelector('#success-message').textContent.split(/\s+/).length < 30, 'Final confirmation stays concise');
  check(ctx.requests[1].tester_opt_in && ctx.requests[1].price_region === 'ph' && ctx.requests[1].price_reaction === 'try-first', 'Survey/tester/price context sent together');
  for (const event of ['page_view','hero_cta_clicked','pricing_viewed','pricing_cta_clicked','form_started','joined','survey_started','survey_completed','tester_volunteered']) {
    check(events(ctx).filter(x => x === `early_access_${event}`).length === 1, `Funnel event: ${event}`);
  }
  check(!JSON.stringify(w.dataLayer).includes('qa@example.com'), 'No email in analytics');
  d.querySelector('[data-action=reset]').click();
  check(!d.querySelector('[data-step="1"]').hidden && d.querySelector('[data-step=success]').hidden, 'Add another email returns to the signup form');
  check(!d.querySelector('.form-progress').hidden, 'Signup progress returns with the reset form');
  check(d.querySelector('#email').value === '' && !d.querySelector('[name=platform]').checked && !d.querySelector('[name=email_consent]').checked, 'Signup identity and consent fields reset');
  check(d.querySelector('#current_journaling').value === '' && features.every(x => !x.checked && !x.disabled) && !d.querySelector('[name=tester_opt_in]').checked, 'Optional answers reset for a new signup');
  check(d.querySelector('[name=price_region]').value === 'ph', 'Detected pricing region survives form reset');
  ctx.dom.window.close();
  const skip = setup({ storageBlocked: true }); fill(skip); await submit(skip, 'join');
  skip.d.querySelector('[data-action=skip]').click();
  check(skip.requests.length === 1 && !skip.d.querySelector('[data-step=success]').hidden, 'Survey skip is optional; blocked storage does not break signup');
  check(!events(skip).includes('early_access_tester_volunteered'), 'Skipping does not volunteer tester');
  skip.dom.window.close();
  const empty = setup({ geoFail: true }); fill(empty); await submit(empty, 'join'); await submit(empty, 'finish');
  check(empty.requests[1].price_region === 'international' && empty.requests[1].price_reaction === '' && !empty.requests[1].tester_opt_in, 'All research fields optional, tester unchecked by default');
  empty.dom.window.close();
  const failure = setup({ fail: true }); fill(failure); await submit(failure, 'join');
  check(!failure.d.querySelector('#form-alert').hidden && !events(failure).includes('early_access_joined'), 'API failure is visible without false success');
  check(!failure.d.querySelector('[data-action=join]').disabled, 'Failed request can be retried');
  failure.dom.window.close();
  for (const [country, price] of [['PH', '₱599'], ['US', 'US$12.99'], ['GB', 'US$12.99']]) {
    const regional = setup({ country }); await delay();
    check(regional.d.querySelector('#founding-price').textContent === price, `Country ${country} gets ${price}`);
    check([...regional.d.querySelectorAll('[data-local-price]')].every(el => el.textContent === price + ' one time'), 'Early Access and FAQ match regional price');
    regional.dom.window.close();
  }
  const vpn = setup(); await delay();
  vpn.w.sessionStorage.setItem('journal-pricing-country-v1', JSON.stringify({country:'PH',at:Date.now()}));
  vpn.w.fetch = async () => ({ok:true,json:async()=>({country_code:'US'})});
  vpn.w.eval(read('pricing.js')); await delay();
  check(vpn.d.querySelector('#founding-price').textContent === 'US$12.99', 'VPN change ignores old PH session cache');
  vpn.w.fetch = async () => ({ok:true,json:async()=>({country_code:'PH'})});
  vpn.w.eval(read('pricing.js')); await delay();
  check(vpn.d.querySelector('#founding-price').textContent === '₱599', 'Reload refreshes country after VPN change');
  vpn.dom.window.close();
  const unknown = setup({ country: 'INVALID' }); await delay();
  check(unknown.d.querySelector('#founding-price').textContent === 'US$12.99', 'Unknown country defaults to USD like siFia');
  check(unknown.d.querySelector('#price-question-label').textContent.includes('US$12.99'), 'Fallback survey matches visible USD price');
  unknown.dom.window.close();
  const Parser = require('php-parser');
  new Parser({ parser: { php7: true } }).parseCode(read('api/location-proxy.php'));
  check(true, 'SiteGround pricing proxy PHP parses');
  for (const value of featureValues) check(edgeFunction.includes(`'${value}'`), `Edge Function accepts ${value}`);
  check(edgeFunction.includes("p_founding_offer_version: 'founding-launch-v1'"), 'Edge Function records founding offer eligibility');
  check(edgeFunction.includes("'https://journal.sifia.app'"), 'Edge Function allows the production website origin');
  check(edgeFunction.includes("Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')"), 'Edge Function keeps privileged database access server-side');
  check(/alter table public\.journal_early_access enable row level security/i.test(migration), 'Signup table enables Row Level Security');
  check(/revoke all on table public\.journal_early_access from anon, authenticated/i.test(migration), 'Browser roles have no direct table privileges');
  check(/grant execute on function public\.journal_early_access_start[\s\S]*to service_role/i.test(migration), 'Signup RPC is limited to the service role');
  check(!/utm_source\s*=\s*excluded\.utm_source/i.test(migration), 'Repeat signup preserves first attribution');
  console.log(`${checks} checks passed (DOM with mocked Supabase API; no browser layout or live database verification).`);
})().catch(error => { console.error(error); process.exitCode = 1; });
