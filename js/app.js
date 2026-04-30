// === RENTAL AGENCY FINDER - Main App ===
// Supabase config (GCM project)
const SUPABASE_URL = 'https://dciiqcoinlaradmjnkxv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjaWlxY29pbmxhcmFkbWpua3h2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3OTE1MjksImV4cCI6MjA4OTM2NzUyOX0.wT5Eg40gCnNzNKNfIZj7ge6eDxmXL2vFr-FAw6CTqVc';

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
  const el = (id) => document.getElementById(id);
  try {
    const [agencyRes, reviewRes, countryRes, cityRes] = await Promise.all([
      sb.from('raf_agencies').select('id', { count: 'exact', head: true }),
      sb.from('raf_reviews').select('id', { count: 'exact', head: true }),
      sb.from('raf_countries').select('id', { count: 'exact', head: true }),
      sb.from('raf_cities').select('id', { count: 'exact', head: true })
    ]);
    if (el('statAgencies')) el('statAgencies').textContent = (agencyRes.count || 0).toLocaleString();
    if (el('statReviews')) el('statReviews').textContent = (reviewRes.count || 0).toLocaleString();
    if (el('statCountries')) el('statCountries').textContent = countryRes.count || 0;
    if (el('statCities')) el('statCities').textContent = cityRes.count || 0;
  } catch (e) {
    console.error('Stats load error:', e);
  }
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
const AGENCIES_PER_PAGE = 24;
let currentPage = 1;
let totalAgencies = 0;
let currentFilters = {};

async function loadAgenciesPage() {
  const path = window.location.pathname.replace('/agencies', '').replace(/^\//, '').replace(/\/$/, '');
  const parts = path.split('/').filter(Boolean);
  const params = new URLSearchParams(window.location.search);
  const type = params.get('type');
  const page = parseInt(params.get('page')) || 1;
  currentPage = page;

  let countrySlug = parts[0] || null;
  let citySlug = parts[1] || null;
  let countryName = null, cityName = null, countryFlag = '';

  // Build base query
  let query = sb.from('raf_agencies')
    .select('*, raf_cities(name, slug), raf_countries(name, slug, flag_emoji)', { count: 'exact' })
    .eq('status', 'active')
    .order('featured', { ascending: false })
    .order('our_rating', { ascending: false, nullsFirst: false });

  if (countrySlug) {
    const { data: country } = await sb.from('raf_countries').select('*').eq('slug', countrySlug).single();
    if (country) {
      query = query.eq('country_id', country.id);
      countryName = country.name;
      countryFlag = country.flag_emoji || '';
    }
  }
  if (citySlug) {
    const { data: city } = await sb.from('raf_cities').select('*').eq('slug', citySlug).single();
    if (city) {
      query = query.eq('city_id', city.id);
      cityName = city.name;
    }
  }
  if (type) {
    query = query.contains('rental_types', [type]);
  }

  currentFilters = { countrySlug, citySlug, type };

  // Paginated fetch
  const from = (currentPage - 1) * AGENCIES_PER_PAGE;
  const to = from + AGENCIES_PER_PAGE - 1;
  const { data: agencies, count } = await query.range(from, to);
  totalAgencies = count || 0;

  // Dynamic page title, breadcrumb, meta
  updatePageHeader(countryName, cityName, countryFlag, countrySlug, citySlug, type);
  renderAgencyList(agencies || [], countrySlug, citySlug, type);
  renderPagination();
}

function updatePageHeader(countryName, cityName, countryFlag, countrySlug, citySlug, type) {
  const titleEl = document.getElementById('pageTitle');
  const descEl = document.getElementById('pageDesc');
  const breadEl = document.getElementById('breadcrumb');
  const typeLabel = type ? type.replace('_', '-') : null;

  // Build title
  let title = 'Browse Rental Agencies Across Europe';
  let desc = `Find and compare rental agencies in 36 countries and 64 cities`;
  if (cityName && countryName) {
    title = typeLabel ? `${capitalize(typeLabel)} Rental Agencies in ${cityName}, ${countryName}` : `Rental Agencies in ${cityName}, ${countryName}`;
    desc = `${totalAgencies} ${typeLabel || ''} rental agencies in ${cityName}. Compare, read reviews, and find the right agency for your rental needs.`;
  } else if (countryName) {
    title = typeLabel ? `${capitalize(typeLabel)} Rental Agencies in ${countryName}` : `${countryFlag} Rental Agencies in ${countryName}`;
    desc = `${totalAgencies} ${typeLabel || ''} rental agencies across ${countryName}. Browse by city, read reviews, and compare.`;
  } else if (typeLabel) {
    title = `${capitalize(typeLabel)} Rental Agencies in Europe`;
    desc = `Browse ${totalAgencies} ${typeLabel} rental agencies across Europe.`;
  }

  if (titleEl) titleEl.textContent = title;
  if (descEl) descEl.textContent = desc.trim();
  document.title = `${title} | Rental Agency Finder`;

  // Build breadcrumb
  if (breadEl) {
    let crumbs = '<a href="/">Home</a> / <a href="/agencies">Agencies</a>';
    if (countryName) crumbs += ` / <a href="/agencies/${countrySlug}">${countryName}</a>`;
    if (cityName) crumbs += ` / <a href="/agencies/${countrySlug}/${citySlug}">${cityName}</a>`;
    if (typeLabel) crumbs += ` / <span>${capitalize(typeLabel)}</span>`;
    else if (!cityName && !countryName) crumbs = '<a href="/">Home</a> / <span>Agencies</span>';
    breadEl.innerHTML = crumbs;
  }
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function renderPagination() {
  const totalPages = Math.ceil(totalAgencies / AGENCIES_PER_PAGE);
  if (totalPages <= 1) return;

  const container = document.querySelector('.agency-list') || document.querySelector('main .container');
  if (!container) return;

  const { countrySlug, citySlug, type } = currentFilters;
  let baseUrl = '/agencies';
  if (countrySlug) baseUrl += `/${countrySlug}`;
  if (citySlug) baseUrl += `/${citySlug}`;
  const typeParam = type ? `type=${type}&` : '';

  let html = '<div class="pagination" style="display:flex;justify-content:center;gap:8px;margin-top:32px;flex-wrap:wrap;">';

  if (currentPage > 1) {
    html += `<a href="${baseUrl}?${typeParam}page=${currentPage - 1}" class="btn btn-sm btn-secondary">Previous</a>`;
  }

  const maxVisible = 7;
  let startPage = Math.max(1, currentPage - 3);
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);
  if (endPage - startPage < maxVisible - 1) startPage = Math.max(1, endPage - maxVisible + 1);

  if (startPage > 1) {
    html += `<a href="${baseUrl}?${typeParam}page=1" class="btn btn-sm btn-secondary">1</a>`;
    if (startPage > 2) html += '<span style="padding:8px 4px;color:var(--text-light);">...</span>';
  }

  for (let i = startPage; i <= endPage; i++) {
    if (i === currentPage) {
      html += `<span class="btn btn-sm btn-primary" style="pointer-events:none;">${i}</span>`;
    } else {
      html += `<a href="${baseUrl}?${typeParam}page=${i}" class="btn btn-sm btn-secondary">${i}</a>`;
    }
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) html += '<span style="padding:8px 4px;color:var(--text-light);">...</span>';
    html += `<a href="${baseUrl}?${typeParam}page=${totalPages}" class="btn btn-sm btn-secondary">${totalPages}</a>`;
  }

  if (currentPage < totalPages) {
    html += `<a href="${baseUrl}?${typeParam}page=${currentPage + 1}" class="btn btn-sm btn-secondary">Next</a>`;
  }

  html += '</div>';
  html += `<p style="text-align:center;color:var(--text-light);margin-top:12px;font-size:0.9rem;">Showing ${(currentPage-1)*AGENCIES_PER_PAGE+1}-${Math.min(currentPage*AGENCIES_PER_PAGE, totalAgencies)} of ${totalAgencies} agencies</p>`;

  container.insertAdjacentHTML('beforeend', html);
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
  const main = document.querySelector('main');
  if (!main) return;

  // Update page title
  document.title = `${agency.name} - ${agency.raf_cities?.name || ''}, ${agency.raf_countries?.name || ''} | Rental Agency Finder`;

  const stars = agency.our_rating ? '&#9733;'.repeat(Math.round(agency.our_rating)) + '&#9734;'.repeat(5 - Math.round(agency.our_rating)) : 'No ratings yet';
  const rentalBadges = (agency.rental_types || []).map(t => `<span class="agency-tag ${t === 'short_term' ? 'short' : t === 'mid_term' ? 'mid' : 'long'}">${t.replace('_', '-')}</span>`).join('');
  const langs = (agency.languages || []).join(', ') || 'Not specified';

  const reviewsHtml = reviews.length > 0 ? reviews.map(r => `
    <div class="review-card" style="border:1px solid var(--border);border-radius:var(--radius);padding:20px;margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <strong>${r.reviewer_name || 'Anonymous'}</strong>
        <span class="stars" style="color:#f59e0b;">${'&#9733;'.repeat(r.rating)}${'&#9734;'.repeat(5-r.rating)}</span>
      </div>
      <h4 style="margin-bottom:4px;">${r.title || ''}</h4>
      <p style="color:var(--text-light);line-height:1.6;">${r.body || ''}</p>
      ${r.pros ? `<p style="color:#16a34a;"><strong>Pros:</strong> ${r.pros}</p>` : ''}
      ${r.cons ? `<p style="color:#dc2626;"><strong>Cons:</strong> ${r.cons}</p>` : ''}
      <small style="color:var(--text-lighter);">${new Date(r.created_at).toLocaleDateString('en-GB', {day:'numeric',month:'long',year:'numeric'})}</small>
    </div>`).join('') : '<p style="color:var(--text-light);">No reviews yet. Be the first to review this agency!</p>';

  main.innerHTML = `
    <div class="container section">
      <div class="breadcrumb" style="margin-bottom:24px;">
        <a href="/">Home</a> / <a href="/agencies">Agencies</a>
        ${agency.raf_countries ? ` / <a href="/agencies/${agency.raf_countries.slug}">${agency.raf_countries.name}</a>` : ''}
        ${agency.raf_cities ? ` / <a href="/agencies/${agency.raf_countries?.slug}/${agency.raf_cities.slug}">${agency.raf_cities.name}</a>` : ''}
        / <span>${agency.name}</span>
      </div>

      <div style="display:grid;grid-template-columns:1fr 320px;gap:32px;align-items:start;">
        <div>
          <div style="display:flex;align-items:center;gap:20px;margin-bottom:24px;">
            <div style="width:80px;height:80px;border-radius:var(--radius);background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-size:2rem;font-weight:700;">${agency.name.charAt(0)}</div>
            <div>
              <h1 style="font-size:1.8rem;margin-bottom:4px;">${agency.name}</h1>
              <p style="color:var(--text-light);">${agency.raf_countries?.flag_emoji || ''} ${agency.raf_cities?.name || ''}, ${agency.raf_countries?.name || ''}</p>
            </div>
          </div>

          <div style="display:flex;gap:8px;margin-bottom:16px;">${rentalBadges}</div>
          <div style="margin-bottom:16px;"><span class="stars" style="color:#f59e0b;font-size:1.2rem;">${stars}</span> <span style="color:var(--text-light);">(${agency.our_review_count || 0} reviews)</span></div>

          ${agency.description ? `<div style="margin-bottom:24px;"><h3 style="margin-bottom:8px;">About</h3><p style="color:var(--text-light);line-height:1.7;">${agency.description}</p></div>` : ''}

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:32px;">
            ${agency.year_founded ? `<div><strong>Founded</strong><p style="color:var(--text-light);">${agency.year_founded}</p></div>` : ''}
            ${agency.properties_managed ? `<div><strong>Properties</strong><p style="color:var(--text-light);">${agency.properties_managed}+</p></div>` : ''}
            <div><strong>Languages</strong><p style="color:var(--text-light);">${langs}</p></div>
            ${agency.google_rating ? `<div><strong>Google Rating</strong><p style="color:var(--text-light);">${agency.google_rating}/5 (${agency.google_review_count || 0} reviews)</p></div>` : ''}
          </div>

          <h2 style="margin-bottom:16px;">Reviews (${reviews.length})</h2>
          ${reviewsHtml}
          <button class="btn btn-primary" onclick="openReviewModal()" style="margin-top:16px;">Write a Review</button>
        </div>

        <aside style="position:sticky;top:80px;">
          <div style="border:1px solid var(--border);border-radius:var(--radius-lg);padding:24px;">
            <h3 style="margin-bottom:16px;">Contact Details</h3>
            ${userUnlocked ? `
              ${agency.website ? `<p style="margin-bottom:8px;"><strong>Website:</strong> <a href="${agency.website}" target="_blank" rel="noopener">${agency.website.replace(/https?:\/\//, '').replace(/\/$/, '')}</a></p>` : ''}
              ${agency.email ? `<p style="margin-bottom:8px;"><strong>Email:</strong> <a href="mailto:${agency.email}">${agency.email}</a></p>` : ''}
              ${agency.phone ? `<p style="margin-bottom:8px;"><strong>Phone:</strong> ${agency.phone}</p>` : ''}
              ${agency.address ? `<p style="margin-bottom:8px;"><strong>Address:</strong> ${agency.address}</p>` : ''}
            ` : `
              <p style="color:var(--text-light);margin-bottom:16px;">Submit a review to unlock contact details for all agencies.</p>
              <button class="btn btn-primary btn-full" onclick="openReviewModal()">Unlock Contact Details</button>
            `}
          </div>
        </aside>
      </div>
    </div>`;
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
  const grid = document.querySelector('.blog-grid');
  if (!grid) return;

  // If static blog cards already exist in the HTML, keep them
  if (grid.querySelectorAll('.blog-card').length > 0) return;

  // Otherwise try loading from DB
  const { data: posts } = await sb.from('raf_blog_posts')
    .select('*')
    .eq('status', 'published')
    .order('published_at', { ascending: false });

  if (!posts || posts.length === 0) return;

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
