// === RENTAL AGENCY FINDER - Main App ===
// Supabase config (GCM project)
const SUPABASE_URL = 'https://dciiqcoinlaradmjnkxv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjaWlxY29pbmxhcmFkbWpua3h2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTk4NDczNzgsImV4cCI6MjAzNTQyMzM3OH0.bEReJn3oFQkGz-scFVGYHmHfSVxfjnV9WhYvkqMFspA';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === STATE ===
let countries = [];
let cities = [];
let userUnlocked = false;

// === INIT ===
document.addEventListener('DOMContentLoaded', async () => {
  initNav();
  initStarRating();
  initModal();
  initReviewForm();
  checkUserUnlock();

  // Route based on current page
  const path = window.location.pathname;
  if (path === '/' || path === '/index.html') {
    await loadHomepage();
  } else if (path.startsWith('/agencies')) {
    await loadAgenciesPage();
  } else if (path === '/for-agencies' || path === '/for-agencies/') {
    // Static page, no dynamic data needed
  } else if (path.startsWith('/blog')) {
    await loadBlogPage();
  } else if (path.startsWith('/agency/')) {
    await loadAgencyDetail();
  }
});

// === NAV ===
function initNav() {
  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      links.classList.toggle('open');
      toggle.classList.toggle('active');
    });
  }
  // Sticky nav shadow
  window.addEventListener('scroll', () => {
    const nav = document.getElementById('nav');
    if (nav) nav.style.boxShadow = window.scrollY > 10 ? '0 2px 12px rgba(0,0,0,0.06)' : 'none';
  });
}

// === HOMEPAGE ===
async function loadHomepage() {
  await Promise.all([
    loadCountries(),
    loadCities()
  ]);
  populateSearchDropdowns();
  renderCountryGrid();
  renderCityGrid();
  loadStats();
  initSearch();
}

async function loadCountries() {
  const { data, error } = await sb.from('raf_countries').select('*').order('name');
  if (!error && data) countries = data;
}

async function loadCities() {
  const { data, error } = await sb.from('raf_cities')
    .select('*, raf_countries(name, slug, flag_emoji)')
    .eq('is_major_rental_market', true)
    .order('population', { ascending: false })
    .limit(20);
  if (!error && data) cities = data;
}

function populateSearchDropdowns() {
  const countrySelect = document.getElementById('searchCountry');
  if (!countrySelect) return;
  countries.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.slug;
    opt.textContent = `${c.flag_emoji} ${c.name}`;
    countrySelect.appendChild(opt);
  });

  countrySelect.addEventListener('change', async () => {
    const citySelect = document.getElementById('searchCity');
    citySelect.innerHTML = '<option value="">Loading...</option>';
    citySelect.disabled = true;
    if (!countrySelect.value) {
      citySelect.innerHTML = '<option value="">Select country first</option>';
      return;
    }
    const country = countries.find(c => c.slug === countrySelect.value);
    if (!country) return;
    const { data } = await sb.from('raf_cities')
      .select('name, slug')
      .eq('country_id', country.id)
      .order('name');
    citySelect.innerHTML = '<option value="">All cities</option>';
    if (data) data.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.slug;
      opt.textContent = c.name;
      citySelect.appendChild(opt);
    });
    citySelect.disabled = false;
  });
}

function renderCountryGrid() {
  const grid = document.getElementById('countryGrid');
  if (!grid) return;
  // Show top 18 countries by region importance
  const priority = ['ES','PT','IT','GR','FR','DE','NL','GB','IE','AT','CH','CZ','PL','HU','HR','SE','DK','NO'];
  const sorted = [...countries].sort((a,b) => {
    const ai = priority.indexOf(a.code);
    const bi = priority.indexOf(b.code);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  grid.innerHTML = sorted.slice(0, 18).map(c => `
    <a href="/agencies/${c.slug}" class="country-card">
      <span class="flag">${c.flag_emoji}</span>
      <div class="info">
        <strong>${c.name}</strong>
        <span>${c.agency_count || 0} agencies</span>
      </div>
    </a>
  `).join('');
}

function renderCityGrid() {
  const grid = document.getElementById('cityGrid');
  if (!grid) return;
  grid.innerHTML = cities.slice(0, 12).map(c => {
    const country = c.raf_countries;
    return `
    <a href="/agencies/${country?.slug}/${c.slug}" class="city-card">
      <h3>${c.name}</h3>
      <div class="city-country">${country?.flag_emoji || ''} ${country?.name || ''}</div>
      <div class="city-stats">
        <span>${c.agency_count || 0} agencies</span>
        <span>Pop. ${(c.population/1000).toFixed(0)}k</span>
      </div>
    </a>
  `}).join('');
}

async function loadStats() {
  const { count: agencyCount } = await sb.from('raf_agencies').select('*', { count: 'exact', head: true });
  const { count: reviewCount } = await sb.from('raf_reviews').select('*', { count: 'exact', head: true }).eq('status', 'approved');
  const el = (id) => document.getElementById(id);
  if (el('statAgencies')) el('statAgencies').textContent = agencyCount || '0';
  if (el('statReviews')) el('statReviews').textContent = reviewCount || '0';
}

function initSearch() {
  const btn = document.getElementById('searchBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const country = document.getElementById('searchCountry').value;
    const city = document.getElementById('searchCity').value;
    const type = document.getElementById('searchType').value;
    let url = '/agencies';
    if (country) url += `/${country}`;
    if (city) url += `/${city}`;
    if (type) url += `?type=${type}`;
    window.location.href = url;
  });
}

// === AGENCIES PAGE ===
async function loadAgenciesPage() {
  const path = window.location.pathname.replace('/agencies', '').replace(/^\//, '').replace(/\/$/, '');
  const parts = path.split('/').filter(Boolean);
  const params = new URLSearchParams(window.location.search);
  const type = params.get('type');

  let countrySlug = parts[0] || null;
  let citySlug = parts[1] || null;

  // Load data
  let query = sb.from('raf_agencies')
    .select('*, raf_cities(name, slug), raf_countries(name, slug, flag_emoji)')
    .eq('status', 'active')
    .order('featured', { ascending: false })
    .order('our_rating', { ascending: false, nullsFirst: false });

  if (countrySlug) {
    const { data: country } = await sb.from('raf_countries').select('*').eq('slug', countrySlug).single();
    if (country) query = query.eq('country_id', country.id);
  }
  if (citySlug) {
    const { data: city } = await sb.from('raf_cities').select('*').eq('slug', citySlug).single();
    if (city) query = query.eq('city_id', city.id);
  }
  if (type) {
    query = query.contains('rental_types', [type]);
  }

  const { data: agencies } = await query.limit(50);
  renderAgencyList(agencies || [], countrySlug, citySlug, type);
}

function renderAgencyList(agencies, country, city, type) {
  const main = document.querySelector('.agency-list') || document.querySelector('main');
  if (!main) return;

  if (agencies.length === 0) {
    main.innerHTML = `
      <div class="empty-state">
        <h3>No agencies found yet</h3>
        <p>We're actively adding agencies in this area. Check back soon or help us by submitting an agency you've used.</p>
        <button class="btn btn-primary" onclick="openReviewModal()">Submit a Review</button>
      </div>`;
    return;
  }

  main.innerHTML = agencies.map(a => {
    const rentalBadges = (a.rental_types || []).map(t => {
      const cls = t === 'short_term' ? 'short' : t === 'mid_term' ? 'mid' : 'long';
      const label = t.replace('_', '-');
      return `<span class="agency-tag ${cls}">${label}</span>`;
    }).join('');

    const stars = a.our_rating ? '&#9733;'.repeat(Math.round(a.our_rating)) + '&#9734;'.repeat(5 - Math.round(a.our_rating)) : 'No ratings yet';
    const tierBadge = a.tier === 'pro' ? '<span class="badge badge-premium">Premium Partner</span>' :
                      a.tier === 'advanced' ? '<span class="badge badge-verified">Verified</span>' :
                      a.tier === 'starter' ? '<span class="badge badge-listed">Listed</span>' : '';

    const contactHtml = userUnlocked ? `
      <div class="agency-contact">
        ${a.email ? `<a href="mailto:${a.email}">${a.email}</a>` : ''}
        ${a.phone ? `<span>${a.phone}</span>` : ''}
        ${a.website ? `<a href="${a.website}" target="_blank" rel="noopener">Website</a>` : ''}
      </div>` : `<button class="btn btn-sm btn-secondary" onclick="openReviewModal()">Unlock Contact</button>`;

    return `
    <div class="agency-card">
      <div class="agency-logo">${a.name.charAt(0)}</div>
      <div class="agency-info">
        <h3><a href="/agency/${a.slug}">${a.name}</a></h3>
        <div class="agency-location">${a.raf_cities?.name || ''}, ${a.raf_countries?.name || ''}</div>
        <div class="agency-tags">${rentalBadges}</div>
        <div class="agency-rating">
          <span class="stars">${stars}</span>
          <span>(${a.our_review_count || 0} reviews)</span>
        </div>
      </div>
      <div class="agency-actions">
        ${tierBadge}
        ${contactHtml}
      </div>
    </div>`;
  }).join('');
}

// === AGENCY DETAIL ===
async function loadAgencyDetail() {
  const slug = window.location.pathname.replace('/agency/', '').replace(/\/$/, '');
  const { data: agency } = await sb.from('raf_agencies')
    .select('*, raf_cities(name, slug), raf_countries(name, slug, flag_emoji)')
    .eq('slug', slug)
    .single();

  if (!agency) {
    document.querySelector('main').innerHTML = '<div class="container section"><h2>Agency not found</h2></div>';
    return;
  }

  const { data: reviews } = await sb.from('raf_reviews')
    .select('*')
    .eq('agency_id', agency.id)
    .eq('status', 'approved')
    .order('created_at', { ascending: false });

  renderAgencyDetail(agency, reviews || []);
}

function renderAgencyDetail(agency, reviews) {
  // This will be used when we have the agency detail page template
  console.log('Agency detail:', agency, reviews);
}

// === STAR RATING ===
function initStarRating() {
  const container = document.getElementById('starRating');
  if (!container) return;
  const stars = container.querySelectorAll('span');
  stars.forEach(star => {
    star.addEventListener('click', () => {
      const val = parseInt(star.dataset.val);
      document.getElementById('revRating').value = val;
      stars.forEach(s => {
        s.classList.toggle('active', parseInt(s.dataset.val) <= val);
      });
    });
    star.addEventListener('mouseenter', () => {
      const val = parseInt(star.dataset.val);
      stars.forEach(s => {
        s.classList.toggle('active', parseInt(s.dataset.val) <= val);
      });
    });
  });
  container.addEventListener('mouseleave', () => {
    const current = parseInt(document.getElementById('revRating').value);
    stars.forEach(s => {
      s.classList.toggle('active', parseInt(s.dataset.val) <= current);
    });
  });
}

// === MODAL ===
function initModal() {
  const modal = document.getElementById('reviewModal');
  const closeBtn = document.getElementById('closeReviewModal');
  if (!modal || !closeBtn) return;
  closeBtn.addEventListener('click', () => modal.classList.remove('active'));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('active');
  });
}

function openReviewModal() {
  const modal = document.getElementById('reviewModal');
  if (modal) modal.classList.add('active');
}
// Make globally accessible
window.openReviewModal = openReviewModal;

// === REVIEW FORM ===
function initReviewForm() {
  const form = document.getElementById('reviewForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const rating = parseInt(document.getElementById('revRating').value);
    if (rating === 0) {
      alert('Please select a rating');
      return;
    }

    const review = {
      reviewer_name: document.getElementById('revName').value.trim(),
      reviewer_email: document.getElementById('revEmail').value.trim(),
      rating: rating,
      rental_type: document.getElementById('revType').value,
      title: document.getElementById('revTitle').value.trim(),
      body: document.getElementById('revBody').value.trim(),
      pros: document.getElementById('revPros').value.trim() || null,
      cons: document.getElementById('revCons').value.trim() || null,
      would_recommend: document.getElementById('revRecommend').checked,
      status: 'pending'
    };

    // Try to match agency or create a placeholder
    const agencyName = document.getElementById('revAgency').value.trim();
    const cityName = document.getElementById('revCity').value.trim();

    // Look up agency
    let agencyId = null;
    const { data: existing } = await sb.from('raf_agencies')
      .select('id')
      .ilike('name', `%${agencyName}%`)
      .limit(1);

    if (existing && existing.length > 0) {
      agencyId = existing[0].id;
    }

    if (agencyId) {
      review.agency_id = agencyId;
    }

    // Submit review
    const { error } = await sb.from('raf_reviews').insert([review]);
    if (error) {
      alert('Error submitting review. Please try again.');
      console.error(error);
      return;
    }

    // Track user unlock
    const email = review.reviewer_email;
    const unlockUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Upsert user
    await sb.from('raf_users').upsert({
      email: email,
      name: review.reviewer_name,
      reviews_submitted: 1,
      unlocked_until: unlockUntil
    }, { onConflict: 'email' });

    // Store in localStorage
    localStorage.setItem('raf_user_email', email);
    localStorage.setItem('raf_unlocked_until', unlockUntil);
    userUnlocked = true;

    // Close modal and show success
    document.getElementById('reviewModal').classList.remove('active');
    form.reset();
    document.querySelectorAll('#starRating span').forEach(s => s.classList.remove('active'));
    document.getElementById('revRating').value = '0';

    alert('Thank you for your review! Contact details are now unlocked for 30 days.');
    window.location.reload();
  });
}

// === USER UNLOCK CHECK ===
function checkUserUnlock() {
  const until = localStorage.getItem('raf_unlocked_until');
  if (until && new Date(until) > new Date()) {
    userUnlocked = true;
  }
}

// === BLOG ===
async function loadBlogPage() {
  const { data: posts } = await sb.from('raf_blog_posts')
    .select('*')
    .eq('status', 'published')
    .order('published_at', { ascending: false });

  const grid = document.querySelector('.blog-grid');
  if (!grid || !posts) return;

  grid.innerHTML = posts.map(p => `
    <a href="/blog/${p.slug}" class="blog-card">
      <h3>${p.title}</h3>
      <p>${p.meta_description || ''}</p>
      <span class="blog-date">${new Date(p.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
    </a>
  `).join('');
}

// === UTILITY ===
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
