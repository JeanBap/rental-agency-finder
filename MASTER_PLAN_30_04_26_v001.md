# Rental Agency Finder - Master Execution Plan
## rentalagencyfinder.com
### Created: 30/04/2026 | Version: v001

---

## 1. VISION & POSITIONING

**What it is:** The first European-wide directory that helps renters find, compare, and review rental agencies (not properties) across short-term, mid-term, and long-term rentals.

**The gap:** Every competitor (Flatio, Homvero, Spotahome, Nestpick, Kyero, Properstar) lists properties. Nobody aggregates and reviews the *agencies* themselves. RateMyAgent does agent reviews but is US/Australia-focused and targets sales agents, not rental agencies.

**Revenue model:** Freemium SaaS for agencies (4 tiers) + review-gating for users (submit a review to unlock contact details).

**Tech stack:** Static site (HTML/CSS/JS) on Vercel, Supabase backend (GCM project `dciiqcoinlaradmjnkxv`), Stripe for payments, domain: rentalagencyfinder.com.

---

## 2. COMPETITOR ANALYSIS

| Competitor | What they do | Gap we exploit |
|---|---|---|
| Flatio | Short/mid/long term direct listings | Lists properties, not agencies |
| Homvero | Aggregator from verified agents, 30+ countries | Property-focused, no agency reviews |
| Spotahome | Visits properties, online booking | Property portal, no agency comparison |
| Nestpick | Mid/long term portal | Property listings only |
| Kyero | Overseas buyer journey (ES/PT/FR/IT) | Buyer-focused, not renter agency reviews |
| Properstar | Multi-country aggregator | Property search, no agency directory |
| RateMyAgent | Agent review platform | US/Australia focus, sales not rentals, not EU |
| european.realestate | Directory of EU real estate sites | Lists websites, not agencies with reviews |
| Rightmove/ImmoScout24 | Country-specific property portals | Single-country, property-focused |

**Our competitive edge:**
- Agency-level reviews (not property reviews)
- Pan-European coverage (30+ countries)
- Review-gating creates UGC flywheel
- SEO-first architecture targeting "rental agency in [city]" long-tail
- AI-optimized content for LLM search results (AEO)
- Agency services generate recurring revenue

---

## 3. DATABASE SCHEMA (Supabase - GCM project)

### Tables to create:

```sql
-- Countries and cities
CREATE TABLE raf_countries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  code CHAR(2) UNIQUE NOT NULL, -- ISO 3166-1
  region TEXT, -- Western, Eastern, Southern, Northern, Central
  flag_emoji TEXT,
  agency_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE raf_cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  country_id UUID REFERENCES raf_countries(id),
  population INT,
  is_capital BOOLEAN DEFAULT false,
  is_major_rental_market BOOLEAN DEFAULT false,
  lat DECIMAL(10,7),
  lng DECIMAL(10,7),
  agency_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Core agency table
CREATE TABLE raf_agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  website TEXT,
  email TEXT,
  phone TEXT,
  city_id UUID REFERENCES raf_cities(id),
  country_id UUID REFERENCES raf_countries(id),
  address TEXT,
  description TEXT,
  logo_url TEXT,
  year_founded INT,
  properties_managed INT,
  rental_types TEXT[] DEFAULT '{}', -- {'short_term','mid_term','long_term'}
  languages TEXT[] DEFAULT '{}',
  google_rating DECIMAL(2,1),
  google_review_count INT DEFAULT 0,
  featured BOOLEAN DEFAULT false,
  tier TEXT DEFAULT 'free', -- free, starter, advanced, pro
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  verified BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Reviews (the core UGC engine)
CREATE TABLE raf_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES raf_agencies(id),
  reviewer_name TEXT NOT NULL,
  reviewer_email TEXT NOT NULL,
  rating INT CHECK (rating >= 1 AND rating <= 5),
  rental_type TEXT, -- short_term, mid_term, long_term
  title TEXT,
  body TEXT,
  pros TEXT,
  cons TEXT,
  would_recommend BOOLEAN,
  verified BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending', -- pending, approved, rejected
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User accounts (reviewers who unlocked contact details)
CREATE TABLE raf_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  reviews_submitted INT DEFAULT 0,
  unlocked_agencies UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Agency service tiers
CREATE TABLE raf_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES raf_agencies(id),
  tier TEXT NOT NULL, -- starter, advanced, pro
  stripe_subscription_id TEXT,
  stripe_price_id TEXT,
  status TEXT DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  referrals_this_month INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Blog posts (SEO content)
CREATE TABLE raf_blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content TEXT,
  meta_description TEXT,
  country_id UUID REFERENCES raf_countries(id),
  city_id UUID REFERENCES raf_cities(id),
  rental_type TEXT,
  tags TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Referral tracking
CREATE TABLE raf_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES raf_agencies(id),
  user_id UUID REFERENCES raf_users(id),
  type TEXT, -- click, contact_view, website_visit
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Agency claims (when an agency wants to claim their listing)
CREATE TABLE raf_agency_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES raf_agencies(id),
  claimer_email TEXT NOT NULL,
  claimer_name TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, approved, rejected
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Row Level Security (RLS):
- Public read on agencies, countries, cities, blog_posts (published only)
- Reviews: public read (approved only), authenticated insert
- Users: own-row read/update only
- Subscriptions: agency-owner read only
- Referrals: insert-only for tracking, agency-owner read for their own

---

## 4. AGENCY SERVICE TIERS

| Feature | Free | Starter (EUR 29/mo) | Advanced (EUR 79/mo) | Pro (EUR 199/mo) |
|---|---|---|---|---|
| Listed in directory | Yes | Yes | Yes | Yes |
| Agency profile page | Basic | Enhanced | Premium | Premium+ |
| Contact details visible | After user review | Always visible | Always visible | Always visible |
| Featured in city listing | No | No | Yes (top 5) | Yes (top 3) |
| Monthly referral reports | No | Basic | Detailed | Detailed + trends |
| Blog post about agency | No | No | 1 per quarter | 1 per month |
| Referral leads/month | 0 | 5 | 20 | Unlimited |
| Response to reviews | No | Yes | Yes + priority | Yes + priority |
| Badge/verification mark | No | "Listed" | "Verified" | "Premium Partner" |
| Custom landing page | No | No | No | Yes |
| API access to leads | No | No | No | Yes |
| Priority in search | No | No | +1 boost | +2 boost |

**All automated through the website:**
- Featured placement: database flag + sort order
- Blog posts: auto-generated from agency data + templated content
- Referral caps: counter in raf_referrals, checked on contact reveal
- Reports: scheduled Supabase query, emailed monthly
- Verification badge: CSS class based on tier

---

## 5. SEO STRATEGY & URL STRUCTURE

### URL Architecture:
```
/                                    -- homepage
/agencies/                           -- all agencies
/agencies/[country-slug]/            -- agencies in country
/agencies/[country-slug]/[city-slug]/ -- agencies in city
/agency/[agency-slug]/               -- individual agency page
/reviews/                            -- recent reviews
/blog/                               -- blog index
/blog/[post-slug]/                   -- individual blog post
/for-agencies/                       -- agency services page
/for-agencies/pricing/               -- pricing table
/compare/                            -- compare agencies tool
/short-term-rental-agencies/         -- rental type landing pages
/mid-term-rental-agencies/
/long-term-rental-agencies/
/about/
/contact/
```

### First 10 Blog Posts (Long-tail SEO):

1. **"Best Rental Agencies in Barcelona for Short-Term Stays (2026)"**
   Target: "rental agency Barcelona short term"

2. **"How to Find a Long-Term Rental Agency in Berlin: Complete Guide"**
   Target: "long term rental agency Berlin"

3. **"Top 15 Rental Agencies in Lisbon for Digital Nomads (Mid-Term Rentals)"**
   Target: "mid term rental agency Lisbon digital nomad"

4. **"Athens Rental Agencies Compared: Short, Mid & Long-Term Options"**
   Target: "rental agency Athens Greece"

5. **"The Complete Guide to Renting in Paris Through an Agency"**
   Target: "rental agency Paris France guide"

6. **"Milan vs Rome: Which City Has Better Rental Agencies for Expats?"**
   Target: "rental agency Milan Rome expat"

7. **"Short-Term Rental Agencies in Amsterdam: Prices, Reviews & Tips"**
   Target: "short term rental agency Amsterdam"

8. **"Finding a Rental Agency in Prague: What to Know Before Signing"**
   Target: "rental agency Prague Czech Republic"

9. **"Why Use a Rental Agency Instead of Airbnb in Europe (2026)"**
   Target: "rental agency vs Airbnb Europe"

10. **"European Rental Agency Red Flags: How to Spot a Bad Agency"**
    Target: "bad rental agency Europe warning signs"

### SEO Technical:
- JSON-LD structured data (LocalBusiness for agencies, Review, BreadcrumbList, FAQPage)
- llms.txt at root for AI search engines
- Open Graph + Twitter cards on every page
- Canonical URLs
- XML sitemap auto-generated
- hreflang tags for future multi-language support
- Internal linking between city pages, country pages, blog posts
- Schema.org AggregateRating on agency pages

---

## 6. UI/UX DESIGN

### For Users (Renters):

**Homepage:**
- Hero: "Find the Right Rental Agency in Europe" + search bar (country/city/rental type)
- Trust stats: "X agencies listed | Y reviews submitted | Z countries covered"
- Popular countries grid (flag + count)
- Recent reviews carousel
- "How it works" 3-step: Search > Read Reviews > Get Contact Details

**Search/Browse Flow:**
1. Select country → see cities
2. Select city → see agencies with avg rating, review count, rental types
3. Click agency → see full profile
4. To see contact details: must submit a review of ANY agency they've used
5. After review submitted: all contact details unlocked for 30 days

**Agency Profile Page:**
- Agency name, logo, rating stars, review count
- Rental types served (badges)
- Years in business, properties managed
- Location map
- Reviews section (sortable by date, rating, rental type)
- Contact details (gated until user submits a review)
- "Similar agencies" sidebar
- Breadcrumb: Home > Country > City > Agency

### For Agencies:

**"For Agencies" Landing Page:**
- Value prop: "Get found by renters searching for agencies in your city"
- Stats: monthly visitors, review submissions, leads delivered
- 4-tier pricing table with feature comparison
- "Claim your listing" CTA
- Testimonials (placeholder initially)
- FAQ

**Agency Dashboard (post-signup):**
- Overview: views, clicks, referrals this month
- Reviews: see and respond to reviews
- Profile editor: update description, logo, contact info
- Subscription management: upgrade/downgrade tier
- Referral reports (tier-dependent)

---

## 7. HOSTING & COST ANALYSIS

| Option | Cost | Pros | Cons |
|---|---|---|---|
| **Vercel (Free tier)** | $0 | Auto-deploy, SSL, fast CDN, serverless functions | 100GB bandwidth, 1000 serverless invocations/day on hobby |
| GitHub Pages | $0 | Free, simple | No serverless, static only, no API routes |
| Vercel Pro | $20/mo | More bandwidth, more functions | Cost |

**Decision: Vercel Free tier** - We need serverless functions for Stripe webhooks, review submission, and Supabase queries. GitHub Pages can't do this. Free tier is sufficient for launch.

**Running costs at launch:**
- Vercel: $0 (free tier)
- Supabase: $0 (using existing GCM project, free tier has 500MB)
- Stripe: 2.9% + 30c per transaction (only on paid agency subscriptions)
- Domain: Already owned
- **Total: $0/month until traffic exceeds free tiers**

---

## 8. EXECUTION PHASES

### Phase 1: Foundation (THIS SESSION)
- [x] Competitor research
- [x] Master plan document
- [ ] Create database schema in Supabase
- [ ] Seed countries + major cities data
- [ ] Build website skeleton (all pages, routing, responsive layout)
- [ ] Deploy to Vercel

### Phase 2: Core Features (THIS SESSION)
- [ ] Agency search + browse (country > city > agency)
- [ ] Agency profile pages
- [ ] Review submission form
- [ ] Review-gating logic (submit review to unlock contacts)
- [ ] "For Agencies" page with pricing table
- [ ] Stripe checkout integration for paid tiers
- [ ] JSON-LD structured data on all pages

### Phase 3: Content & Data
- [ ] Research pipeline: scrape/research agencies for top 20 cities
- [ ] Seed initial agency data (10-20 per major city)
- [ ] Write first 10 blog posts
- [ ] Create llms.txt
- [ ] Generate XML sitemap

### Phase 4: Agency Dashboard
- [ ] Agency claim flow
- [ ] Agency login/dashboard
- [ ] Review response capability
- [ ] Referral tracking + reports
- [ ] Subscription management

### Phase 5: Growth & Optimization
- [ ] Email outreach templates for agencies
- [ ] Agency onboarding automation
- [ ] SEO monitoring
- [ ] A/B test review-gating vs free access
- [ ] Multi-language support (ES, FR, DE, IT, PT, EL)

---

## 9. GOOGLE & AI SEARCH STRATEGY

### Winning in Google:
1. **Long-tail dominance:** Target "rental agency [city]" for every major European city (low competition, high intent)
2. **UGC reviews:** Google values unique, user-generated content
3. **Structured data:** Rich snippets with star ratings in search results
4. **City landing pages:** Unique, data-rich pages for each city (not thin content)
5. **Blog content:** Answer questions renters actually ask
6. **Internal linking:** Every blog post links to relevant city/country pages
7. **Page speed:** Static site + CDN = fast load times

### Winning in AI search (ChatGPT, Perplexity, Claude):
1. **llms.txt:** Machine-readable site description at root
2. **Clear, factual content:** AI models prefer well-structured, factual pages
3. **FAQ schema:** Increases chances of being cited in AI answers
4. **Unique data:** Review aggregation creates data AI can't find elsewhere
5. **Authority signals:** Comprehensive coverage across all EU countries

### vs Competitors:
- Flatio/Spotahome: We don't compete on property listings, we're the "Yelp for rental agencies"
- RateMyAgent: They're US/AU focused, sales-oriented. We're EU, rental-focused
- Homvero: Property aggregator. We aggregate agencies + reviews
- Nobody else does what we do in this space

---

## 10. DATA RESEARCH PIPELINE

### Countries to cover (30+):
Western: UK, Ireland, France, Belgium, Netherlands, Luxembourg
Southern: Spain, Portugal, Italy, Greece, Malta, Cyprus, Croatia, Slovenia
Central: Germany, Austria, Switzerland, Czech Republic, Poland, Slovakia, Hungary
Northern: Sweden, Denmark, Norway, Finland, Iceland, Estonia, Latvia, Lithuania
Eastern: Romania, Bulgaria

### Per country, research:
1. Major cities (capital + top 5 rental markets)
2. For each city: top 10-20 rental agencies
3. Per agency: name, website, email, phone, Google rating, review count, years in business, properties managed, rental types, languages

### Research methods:
- Google Maps API / scraping for agency listings
- Google search for "[city] rental agency"
- Local property portals (Idealista for ES/PT/IT, ImmoScout24 for DE, Rightmove for UK)
- Agency websites for contact details
- Companies House / local business registries for years in business

### Priority cities (Phase 1 - seed data):
Barcelona, Madrid, Lisbon, Porto, Rome, Milan, Athens, Berlin, Munich, Amsterdam, Paris, London, Prague, Budapest, Vienna, Dublin, Copenhagen, Stockholm, Zurich, Dubrovnik

---

## 11. STRIPE SETUP

### Products to create:
1. **Starter Plan** - EUR 29/month (price_starter_monthly)
2. **Advanced Plan** - EUR 79/month (price_advanced_monthly)
3. **Pro Plan** - EUR 199/month (price_pro_monthly)
4. Annual options (2 months free):
   - Starter Annual: EUR 290/year
   - Advanced Annual: EUR 790/year
   - Pro Annual: EUR 1,990/year

### Webhook events to handle:
- `checkout.session.completed` → activate subscription
- `customer.subscription.updated` → tier change
- `customer.subscription.deleted` → downgrade to free
- `invoice.payment_failed` → grace period notification

### Implementation:
- Stripe Checkout (hosted) for initial signup
- Customer Portal for management
- Webhook endpoint as Vercel serverless function

---

## NEXT STEPS (Executing Now)

1. Create Supabase tables
2. Seed countries + cities data
3. Build the website
4. Deploy to Vercel
5. Start agency research for top 20 cities
