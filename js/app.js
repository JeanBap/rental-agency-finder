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
  initBackToTop();

  // Route based on current page
  const path = window.location.pathname;
  if (path === '/' || path === '/index.html') {
    await loadHomepage();
  } else if (path.startsWith('/agency/')) {
    await loadAgencyDetail();
  } else if (path.startsWith('/agencies')) {
    await loadAgenciesPage();
  } else if (path === '/for-agencies' || path === '/for-agencies/') {
    // Static page, no dynamic data needed
  } else if (path.startsWith('/blog')) {
    await loadBlogPage();
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
  // Show loading skeleton
  const agencyList = document.querySelector('.agency-list');
  renderLoadingSkeleton(agencyList, 6);

  const path = window.location.pathname.replace('/agencies', '').replace(/^\//, '').replace(/\/$/, '');
  const parts = path.split('/').filter(Boolean);
  const params = new URLSearchParams(window.location.search);
  const type = params.get('type');
  const page = parseInt(params.get('page')) || 1;
  currentPage = page;

  let countrySlug = parts[0] || null;
  let citySlug = parts[1] || null;
  let countryName = null, cityName = null, countryFlag = '';

  const sort = params.get('sort') || 'featured';

  // Build base query
  let query = sb.from('raf_agencies')
    .select('*, raf_cities(name, slug), raf_countries(name, slug, flag_emoji)', { count: 'exact' })
    .eq('status', 'active');

  // Apply sort
  switch (sort) {
    case 'rating_desc':
      query = query.order('our_rating', { ascending: false, nullsFirst: false });
      break;
    case 'rating_asc':
      query = query.order('our_rating', { ascending: true, nullsFirst: false });
      break;
    case 'name_asc':
      query = query.order('name', { ascending: true });
      break;
    case 'name_desc':
      query = query.order('name', { ascending: false });
      break;
    case 'reviews':
      query = query.order('our_review_count', { ascending: false, nullsFirst: false });
      break;
    default: // featured
      query = query.order('featured', { ascending: false }).order('our_rating', { ascending: false, nullsFirst: false });
  }

  let countryData = null, cityData = null;
  if (countrySlug) {
    const { data: country } = await sb.from('raf_countries').select('*').eq('slug', countrySlug).single();
    if (country) {
      query = query.eq('country_id', country.id);
      countryName = country.name;
      countryFlag = country.flag_emoji || '';
      countryData = country;
    }
  }
  if (citySlug) {
    const { data: city } = await sb.from('raf_cities').select('*').eq('slug', citySlug).single();
    if (city) {
      query = query.eq('city_id', city.id);
      cityName = city.name;
      cityData = city;
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

  // Dynamic page title, breadcrumb, meta, SEO intro
  updatePageHeader(countryName, cityName, countryFlag, countrySlug, citySlug, type, countryData, cityData);
  renderAgencyList(agencies || [], countrySlug, citySlug, type);
  renderPagination();

  // Internal linking: related cities + blog posts
  if (countryData) {
    await renderRelatedCities(countryData, citySlug);
  }
  if (citySlug || countrySlug) {
    await renderRelatedBlogPosts(cityName, countryName, countrySlug);
  }
}

// === INTERNAL LINKING ===
async function renderRelatedCities(countryData, currentCitySlug) {
  const container = document.querySelector('.agency-list') || document.querySelector('main .container');
  if (!container) return;

  const { data: relatedCities } = await sb.from('raf_cities')
    .select('name, slug, agency_count')
    .eq('country_id', countryData.id)
    .order('agency_count', { ascending: false })
    .limit(12);

  if (!relatedCities || relatedCities.length <= 1) return;

  const filtered = relatedCities.filter(c => c.slug !== currentCitySlug);
  if (filtered.length === 0) return;

  const html = `
    <div class="related-section" style="margin-top:48px;padding-top:32px;border-top:1px solid var(--border);">
      <h2 style="font-size:1.3rem;margin-bottom:16px;">${currentCitySlug ? 'Other Cities' : 'Cities'} in ${countryData.name}</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;">
        ${filtered.map(c => `
          <a href="/agencies/${countryData.slug}/${c.slug}" style="display:flex;align-items:center;gap:8px;padding:12px 16px;border:1px solid var(--border);border-radius:var(--radius);text-decoration:none;color:var(--text);transition:border-color 0.2s;">
            <span style="font-weight:600;">${c.name}</span>
            <span style="color:var(--text-light);font-size:0.85rem;margin-left:auto;">${c.agency_count || 0} agencies</span>
          </a>
        `).join('')}
      </div>
    </div>`;
  container.insertAdjacentHTML('beforeend', html);
}

async function renderRelatedBlogPosts(cityName, countryName, countrySlug) {
  const container = document.querySelector('.agency-list') || document.querySelector('main .container');
  if (!container) return;

  // Fetch published blog posts and match by city/country name in title or content
  const { data: posts } = await sb.from('raf_blog_posts')
    .select('title, slug, meta_description, published_at')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(50);

  if (!posts || posts.length === 0) return;

  // Filter to posts relevant to this city or country
  const searchTerms = [cityName, countryName].filter(Boolean).map(t => t.toLowerCase());
  const relevant = posts.filter(p => {
    const titleLower = p.title.toLowerCase();
    return searchTerms.some(term => titleLower.includes(term));
  }).slice(0, 4);

  if (relevant.length === 0) return;

  const html = `
    <div class="related-section" style="margin-top:32px;padding-top:24px;border-top:1px solid var(--border);">
      <h2 style="font-size:1.3rem;margin-bottom:16px;">Rental Guides</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;">
        ${relevant.map(p => `
          <a href="/blog/${p.slug}" style="display:block;padding:16px 20px;border:1px solid var(--border);border-radius:var(--radius);text-decoration:none;color:var(--text);transition:border-color 0.2s;">
            <h3 style="font-size:1rem;margin-bottom:6px;color:var(--primary);">${p.title}</h3>
            <p style="font-size:0.85rem;color:var(--text-light);line-height:1.5;margin:0;">${(p.meta_description || '').substring(0, 100)}${p.meta_description && p.meta_description.length > 100 ? '...' : ''}</p>
          </a>
        `).join('')}
      </div>
    </div>`;
  container.insertAdjacentHTML('beforeend', html);
}

function updatePageHeader(countryName, cityName, countryFlag, countrySlug, citySlug, type, countryData, cityData) {
  const titleEl = document.getElementById('pageTitle');
  const descEl = document.getElementById('pageDesc');
  const breadEl = document.getElementById('breadcrumb');
  const typeLabel = type ? type.replace('_', '-') : null;

  // Build title and description, preferring DB seo fields
  let title = 'Browse Rental Agencies Across Europe';
  let desc = 'Find and compare rental agencies in 36 countries and 64 cities';
  let seoIntro = '';

  if (cityName && countryName) {
    title = (cityData && cityData.seo_title) ? cityData.seo_title
      : typeLabel ? `${capitalize(typeLabel)} Rental Agencies in ${cityName}, ${countryName}`
      : `Rental Agencies in ${cityName}, ${countryName}`;
    desc = (cityData && cityData.seo_description) ? cityData.seo_description
      : `${totalAgencies} ${typeLabel || ''} rental agencies in ${cityName}. Compare, read reviews, and find the right agency for your rental needs.`;
    seoIntro = (cityData && cityData.seo_intro) ? cityData.seo_intro : '';
  } else if (countryName) {
    title = (countryData && countryData.seo_title) ? countryData.seo_title
      : typeLabel ? `${capitalize(typeLabel)} Rental Agencies in ${countryName}`
      : `${countryFlag} Rental Agencies in ${countryName}`;
    desc = (countryData && countryData.seo_description) ? countryData.seo_description
      : `${totalAgencies} ${typeLabel || ''} rental agencies across ${countryName}. Browse by city, read reviews, and compare.`;
    seoIntro = (countryData && countryData.seo_intro) ? countryData.seo_intro : '';
  } else if (typeLabel) {
    title = `${capitalize(typeLabel)} Rental Agencies in Europe`;
    desc = `Browse ${totalAgencies} ${typeLabel} rental agencies across Europe.`;
  }

  if (titleEl) titleEl.textContent = title;
  if (descEl) descEl.textContent = desc.trim();
  document.title = `${title} | Rental Agency Finder`;

  // Update meta description
  let metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content', desc.trim());

  // Render SEO intro paragraph
  let introEl = document.getElementById('seoIntro');
  if (!introEl && seoIntro) {
    introEl = document.createElement('p');
    introEl.id = 'seoIntro';
    introEl.className = 'seo-intro';
    introEl.style.cssText = 'max-width:800px;margin:0 auto 24px;font-size:15px;line-height:1.7;color:#555;text-align:center;';
    const headerSection = document.querySelector('.page-header .container') || descEl?.parentElement;
    if (headerSection) headerSection.appendChild(introEl);
  }
  if (introEl) introEl.textContent = seoIntro || '';

  // Build breadcrumb
  if (breadEl) {
    let crumbs = '<a href="/">Home</a> / <a href="/agencies">Agencies</a>';
    if (countryName) crumbs += ` / <a href="/agencies/${countrySlug}">${countryName}</a>`;
    if (cityName) crumbs += ` / <a href="/agencies/${countrySlug}/${citySlug}">${cityName}</a>`;
    if (typeLabel) crumbs += ` / <span>${capitalize(typeLabel)}</span>`;
    else if (!cityName && !countryName) crumbs = '<a href="/">Home</a> / <span>Agencies</span>';
    breadEl.innerHTML = crumbs;
  }

  // Render FAQ section if city has FAQ data
  if (cityData && cityData.faq_json && Array.isArray(cityData.faq_json) && cityData.faq_json.length > 0) {
    let faqEl = document.getElementById('cityFaq');
    if (!faqEl) {
      faqEl = document.createElement('div');
      faqEl.id = 'cityFaq';
      faqEl.style.cssText = 'max-width:800px;margin:0 auto 32px;text-align:left;';
      const headerSection = document.querySelector('.page-header .container') || descEl?.parentElement;
      if (headerSection) headerSection.appendChild(faqEl);
    }
    faqEl.innerHTML = `
      <h2 style="font-size:1.2rem;margin-bottom:16px;color:var(--text);">Frequently Asked Questions About Renting in ${cityName}</h2>
      ${cityData.faq_json.map(faq => `
        <details style="margin-bottom:12px;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;">
          <summary style="padding:14px 18px;cursor:pointer;font-weight:600;font-size:0.95rem;background:var(--bg-light,#f9fafb);list-style:none;display:flex;align-items:center;justify-content:space-between;">
            ${faq.q}
            <span style="font-size:1.2rem;transition:transform 0.2s;">+</span>
          </summary>
          <div style="padding:14px 18px;font-size:0.9rem;line-height:1.7;color:var(--text-light);">${faq.a}</div>
        </details>
      `).join('')}
    `;

    // Inject FAQPage JSON-LD
    const faqLd = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": cityData.faq_json.map(faq => ({
        "@type": "Question",
        "name": faq.q,
        "acceptedAnswer": { "@type": "Answer", "text": faq.a }
      }))
    };
    const faqScript = document.createElement('script');
    faqScript.type = 'application/ld+json';
    faqScript.setAttribute('data-raf-jsonld', 'true');
    faqScript.textContent = JSON.stringify(faqLd);
    document.head.appendChild(faqScript);
  }

  // Inject CollectionPage + BreadcrumbList JSON-LD
  if (countryName || cityName) {
    const pageUrl = citySlug
      ? `https://www.rentalagencyfinder.com/agencies/${countrySlug}/${citySlug}`
      : `https://www.rentalagencyfinder.com/agencies/${countrySlug}`;
    const breadcrumbItems = [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.rentalagencyfinder.com/" },
      { "@type": "ListItem", "position": 2, "name": "Agencies", "item": "https://www.rentalagencyfinder.com/agencies" }
    ];
    if (countryName) {
      breadcrumbItems.push({ "@type": "ListItem", "position": 3, "name": countryName, "item": `https://www.rentalagencyfinder.com/agencies/${countrySlug}` });
    }
    if (cityName) {
      breadcrumbItems.push({ "@type": "ListItem", "position": 4, "name": cityName, "item": pageUrl });
    }

    const jsonLd = [
      { "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": breadcrumbItems },
      { "@context": "https://schema.org", "@type": "CollectionPage", "name": title, "description": desc.trim(), "url": pageUrl,
        "numberOfItems": totalAgencies,
        "isPartOf": { "@type": "WebSite", "name": "Rental Agency Finder", "url": "https://www.rentalagencyfinder.com/" }
      }
    ];

    // Remove previous dynamic JSON-LD if any
    document.querySelectorAll('script[data-raf-jsonld]').forEach(el => el.remove());
    jsonLd.forEach(obj => {
      const s = document.createElement('script');
      s.type = 'application/ld+json';
      s.setAttribute('data-raf-jsonld', 'true');
      s.textContent = JSON.stringify(obj);
      document.head.appendChild(s);
    });
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
  const main = document.querySelector('main');
  // Show loading state
  if (main) main.innerHTML = '<div class="container section" style="min-height:400px;"><div class="skeleton-card"><div class="skeleton-avatar" style="width:80px;height:80px;"></div><div class="skeleton-lines"><div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line"></div></div></div></div>';

  const slug = window.location.pathname.replace('/agency/', '').replace(/\/$/, '');

  try {
  const { data: agency, error } = await sb.from('raf_agencies')
    .select('*, raf_cities(name, slug), raf_countries(name, slug, flag_emoji)')
    .eq('slug', slug)
    .single();

  if (error || !agency) {
    if (main) main.innerHTML = '<div class="container section"><div class="error-state"><h3>Agency not found</h3><p>This agency may have been removed or the URL may be incorrect.</p><a href="/agencies" class="btn btn-primary" style="margin-top:16px;">Browse All Agencies</a></div></div>';
    return;
  }

  const { data: reviews } = await sb.from('raf_reviews')
    .select('*')
    .eq('agency_id', agency.id)
    .eq('status', 'approved')
    .order('created_at', { ascending: false });

  await renderAgencyDetail(agency, reviews || []);
  } catch (err) {
    console.error('Agency detail error:', err);
    renderErrorState(main, 'Unable to load agency details. Please try again.');
  }
}

async function renderAgencyDetail(agency, reviews) {
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

      <div class="agency-detail-grid" style="display:grid;grid-template-columns:1fr 320px;gap:32px;align-items:start;">
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

  // Load other agencies in the same city
  if (agency.city_id) {
    const { data: others } = await sb.from('raf_agencies')
      .select('name, slug, our_rating, our_review_count')
      .eq('city_id', agency.city_id)
      .eq('status', 'active')
      .neq('id', agency.id)
      .order('our_rating', { ascending: false, nullsFirst: false })
      .limit(6);

    if (others && others.length > 0) {
      const othersHtml = `
        <div style="margin-top:48px;padding-top:32px;border-top:1px solid var(--border);">
          <h2 style="font-size:1.3rem;margin-bottom:16px;">Other Agencies in ${agency.raf_cities?.name || 'This City'}</h2>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px;">
            ${others.map(o => `
              <a href="/agency/${o.slug}" style="display:flex;align-items:center;gap:12px;padding:12px 16px;border:1px solid var(--border);border-radius:var(--radius);text-decoration:none;color:var(--text);transition:border-color 0.2s;">
                <div style="width:40px;height:40px;border-radius:var(--radius);background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;">${o.name.charAt(0)}</div>
                <div>
                  <strong>${o.name}</strong>
                  <div style="font-size:0.85rem;color:var(--text-light);">${o.our_rating ? '&#9733;'.repeat(Math.round(o.our_rating)) + ' (' + (o.our_review_count || 0) + ')' : 'No ratings'}</div>
                </div>
              </a>
            `).join('')}
          </div>
          <a href="/agencies/${agency.raf_countries?.slug}/${agency.raf_cities?.slug}" style="display:inline-block;margin-top:16px;color:var(--primary);text-decoration:none;font-weight:500;">View all agencies in ${agency.raf_cities?.name || 'this city'} &rarr;</a>
        </div>`;
      main.querySelector('.container').insertAdjacentHTML('beforeend', othersHtml);
    }
  }

  // Related blog posts for agency detail
  if (agency.raf_cities?.name || agency.raf_countries?.name) {
    const { data: blogPosts } = await sb.from('raf_blog_posts')
      .select('title, slug, meta_description')
      .eq('status', 'published')
      .limit(50);

    if (blogPosts && blogPosts.length > 0) {
      const agencyCityName = (agency.raf_cities?.name || '').toLowerCase();
      const agencyCountryName = (agency.raf_countries?.name || '').toLowerCase();
      const matched = blogPosts.filter(p => {
        const t = p.title.toLowerCase();
        return (agencyCityName && t.includes(agencyCityName)) || (agencyCountryName && t.includes(agencyCountryName));
      }).slice(0, 3);

      if (matched.length > 0) {
        const blogHtml = `
          <div style="margin-top:32px;padding-top:24px;border-top:1px solid var(--border);">
            <h2 style="font-size:1.3rem;margin-bottom:16px;">Rental Guides</h2>
            ${matched.map(p => `
              <a href="/blog/${p.slug}" style="display:block;padding:12px 16px;margin-bottom:8px;border:1px solid var(--border);border-radius:var(--radius);text-decoration:none;color:var(--text);transition:border-color 0.2s;">
                <strong style="color:var(--primary);">${p.title}</strong>
                <p style="font-size:0.85rem;color:var(--text-light);margin:4px 0 0;">${(p.meta_description || '').substring(0, 120)}</p>
              </a>
            `).join('')}
          </div>`;
        main.querySelector('.container').insertAdjacentHTML('beforeend', blogHtml);
      }
    }
  }

  // Inject LocalBusiness JSON-LD
  const cityName = agency.raf_cities?.name || '';
  const countryName = agency.raf_countries?.name || '';
  const localBiz = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": agency.name,
    "url": agency.website || `https://www.rentalagencyfinder.com/agency/${agency.slug}`,
    "description": agency.description || `Rental agency in ${cityName}, ${countryName}`,
    "address": {
      "@type": "PostalAddress",
      "addressLocality": cityName,
      "addressCountry": countryName
    }
  };
  if (agency.address) localBiz.address.streetAddress = agency.address;
  if (agency.phone) localBiz.telephone = agency.phone;
  if (agency.email) localBiz.email = agency.email;
  if (agency.our_rating) {
    localBiz.aggregateRating = {
      "@type": "AggregateRating",
      "ratingValue": agency.our_rating,
      "reviewCount": agency.our_review_count || 1,
      "bestRating": 5,
      "worstRating": 1
    };
  }
  if (agency.year_founded) localBiz.foundingDate = String(agency.year_founded);

  // BreadcrumbList for detail page
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.rentalagencyfinder.com/" },
      { "@type": "ListItem", "position": 2, "name": "Agencies", "item": "https://www.rentalagencyfinder.com/agencies" }
    ]
  };
  if (agency.raf_countries) {
    breadcrumbLd.itemListElement.push({ "@type": "ListItem", "position": 3, "name": countryName, "item": `https://www.rentalagencyfinder.com/agencies/${agency.raf_countries.slug}` });
  }
  if (agency.raf_cities) {
    breadcrumbLd.itemListElement.push({ "@type": "ListItem", "position": 4, "name": cityName, "item": `https://www.rentalagencyfinder.com/agencies/${agency.raf_countries?.slug}/${agency.raf_cities.slug}` });
  }
  breadcrumbLd.itemListElement.push({ "@type": "ListItem", "position": breadcrumbLd.itemListElement.length + 1, "name": agency.name, "item": `https://www.rentalagencyfinder.com/agency/${agency.slug}` });

  document.querySelectorAll('script[data-raf-jsonld]').forEach(el => el.remove());
  [localBiz, breadcrumbLd].forEach(obj => {
    const s = document.createElement('script');
    s.type = 'application/ld+json';
    s.setAttribute('data-raf-jsonld', 'true');
    s.textContent = JSON.stringify(obj);
    document.head.appendChild(s);
  });

  // Update meta description for agency page
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) {
    metaDesc.setAttribute('content', `${agency.name} in ${cityName}, ${countryName}. Read reviews, compare ratings, and get contact details. ${agency.description ? agency.description.substring(0, 120) : ''}`);
  }
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
    // Always store submitted names for moderation matching
    review.agency_name_submitted = agencyName;
    review.city_submitted = cityName;

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

    // Upsert user: check if exists first to increment count
    const { data: existingUser } = await sb.from('raf_users')
      .select('reviews_submitted')
      .eq('email', email)
      .single();

    const newCount = (existingUser?.reviews_submitted || 0) + 1;
    await sb.from('raf_users').upsert({
      email: email,
      name: review.reviewer_name,
      reviews_submitted: newCount,
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

// === BACK TO TOP ===
function initBackToTop() {
  const btn = document.createElement('button');
  btn.className = 'back-to-top';
  btn.innerHTML = '&#9650;';
  btn.setAttribute('aria-label', 'Back to top');
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  document.body.appendChild(btn);

  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 400);
  }, { passive: true });
}

// === LOADING SKELETON ===
function renderLoadingSkeleton(container, count) {
  if (!container) return;
  container.innerHTML = Array.from({ length: count }, () => `
    <div class="skeleton-card">
      <div class="skeleton-avatar"></div>
      <div class="skeleton-lines">
        <div class="skeleton-line"></div>
        <div class="skeleton-line"></div>
        <div class="skeleton-line"></div>
      </div>
    </div>
  `).join('');
}

// === ERROR STATE ===
function renderErrorState(container, message) {
  if (!container) return;
  container.innerHTML = `
    <div class="error-state">
      <h3>Something went wrong</h3>
      <p>${message || 'Unable to load data. Please try again.'}</p>
      <button class="btn btn-primary" onclick="window.location.reload()">Try Again</button>
    </div>`;
}
