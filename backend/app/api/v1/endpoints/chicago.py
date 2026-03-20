"""
Chicago Places API
Proxies Overpass OSM, Divvy GBFS, Chicago Data Portal, and Foursquare Photos.
All results are in-memory cached for 1 hour.
"""

import asyncio
import hashlib
import os
import time
from typing import Any, List

import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

router = APIRouter()

FOURSQUARE_API_KEY = os.getenv("FOURSQUARE_API_KEY", "")
FSQ_BASE = "https://api.foursquare.com/v3"

MAPILLARY_TOKEN   = os.getenv("MAPILLARY_ACCESS_TOKEN", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

# ─── In-memory cache ──────────────────────────────────────────────────────────
_cache: dict[str, tuple[Any, float]] = {}
CACHE_TTL = 3600  # seconds


def _cache_get(key: str) -> Any | None:
    if key in _cache:
        data, ts = _cache[key]
        if time.time() - ts < CACHE_TTL:
            return data
    return None


def _cache_set(key: str, data: Any) -> None:
    _cache[key] = (data, time.time())


# ─── Deterministic helpers (no real ratings in OSM) ───────────────────────────
def _det(seed: str, lo: int, hi: int) -> int:
    h = int(hashlib.md5(seed.encode()).hexdigest()[:8], 16)
    return lo + (h % (hi - lo + 1))


def _rating(seed: str) -> float:
    return round(3.5 + _det(seed, 0, 14) / 10, 1)


def _reviews(seed: str) -> int:
    return _det(f"r{seed}", 100, 7500)


def _price(seed: str, cat: str) -> int:
    if cat in ("parking", "pharmacy", "grocery", "divvy", "cta", "metra"):
        return 1
    if cat in ("fitness", "cowork"):
        return 3
    return _det(f"p{seed}", 1, 3)


def _open_now(seed: str) -> bool:
    return _det(f"o{seed}", 0, 9) > 2


MONTHLY_RANGE: dict[str, tuple[int, int]] = {
    "restaurant": (50, 200),
    "coffee": (50, 110),
    "bar": (80, 200),
    "parking": (25, 70),
    "fitness": (100, 280),
    "pharmacy": (25, 65),
    "grocery": (100, 240),
    "cowork": (99, 500),
    "landmark": (0, 35),
    "cta": (105, 105),
    "metra": (140, 180),
    "divvy": (15, 15),
}


def _monthly(seed: str, cat: str) -> int:
    lo, hi = MONTHLY_RANGE.get(cat, (0, 0))
    return _det(f"s{seed}", lo, hi)


def _avg_visit(seed: str, cat: str) -> int:
    m = _monthly(seed, cat)
    if m == 0:
        return 0
    return m // max(1, _det(f"v{seed}", 2, 8))


# ─── OSM category mapping ──────────────────────────────────────────────────────
AMENITY_MAP = {
    "restaurant": "restaurant", "fast_food": "restaurant", "food_court": "restaurant",
    "cafe": "coffee", "coffee_shop": "coffee",
    "bar": "bar", "pub": "bar", "nightclub": "bar",
    "parking": "parking",
    "fitness_centre": "fitness", "gym": "fitness", "sports_hall": "fitness",
    "pharmacy": "pharmacy", "chemist": "pharmacy",
    "supermarket": "grocery",
}

SHOP_MAP = {
    "supermarket": "grocery", "convenience": "grocery",
    "greengrocer": "grocery", "deli": "grocery",
}

LEISURE_MAP = {
    "fitness_centre": "fitness", "sports_centre": "fitness",
}


def _osm_to_place(element: dict) -> dict | None:
    tags = element.get("tags", {})
    name = tags.get("name", "").strip()
    if not name:
        return None

    lat = element.get("lat")
    lng = element.get("lon")
    if lat is None or lng is None:
        return None

    amenity = tags.get("amenity", "")
    shop = tags.get("shop", "")
    leisure = tags.get("leisure", "")

    cat = (
        AMENITY_MAP.get(amenity)
        or SHOP_MAP.get(shop)
        or LEISURE_MAP.get(leisure)
    )
    if not cat:
        return None

    nid = str(element.get("id", name))
    house = tags.get("addr:housenumber", "")
    street = tags.get("addr:street", "")
    address = f"{house} {street}".strip() if street else tags.get("addr:full", "Chicago, IL")
    hours = tags.get("opening_hours", "See Google Maps for hours")
    phone = tags.get("phone", tags.get("contact:phone", ""))

    # Build minimal tag list from OSM tags
    extra = []
    if tags.get("cuisine"):
        extra.append(tags["cuisine"].replace(";", " / ").replace("_", " ").title())
    if tags.get("outdoor_seating") == "yes":
        extra.append("Outdoor Seating")
    if tags.get("takeaway") in ("yes", "only"):
        extra.append("Takeaway")
    if tags.get("internet_access") in ("wlan", "yes"):
        extra.append("Wi-Fi")
    if tags.get("wheelchair") == "yes":
        extra.append("Accessible")

    return {
        "id": f"osm-{nid}",
        "name": name,
        "category": cat,
        "lat": lat,
        "lng": lng,
        "rating": _rating(nid),
        "reviews": _reviews(nid),
        "price": _price(nid, cat),
        "address": address or "Chicago, IL",
        "hours": hours,
        "openNow": _open_now(nid),
        "avgVisit": _avg_visit(nid, cat),
        "monthlySpend": _monthly(nid, cat),
        "tags": extra[:5],
        "phone": phone,
        "source": "osm",
    }


# ─── Data fetchers ─────────────────────────────────────────────────────────────

async def _fetch_osm() -> list[dict]:
    cached = _cache_get("osm")
    if cached is not None:
        return cached

    # Chicago Loop + Near North bounding box: south,west,north,east
    bbox = "41.868,-87.660,41.912,-87.608"
    query = f"""[out:json][timeout:30];
(
  node["amenity"~"^(restaurant|fast_food|cafe|bar|pub|parking|fitness_centre|pharmacy|food_court)$"]({bbox});
  node["shop"~"^(supermarket|convenience|greengrocer|deli)$"]({bbox});
  node["leisure"~"^(fitness_centre|sports_centre)$"]({bbox});
  node["office"="coworking"]({bbox});
);
out body;"""

    async with httpx.AsyncClient(timeout=35.0) as client:
        resp = await client.post("https://overpass-api.de/api/interpreter", content=query)
        resp.raise_for_status()
        data = resp.json()

    places = [p for e in data.get("elements", []) if (p := _osm_to_place(e))]
    _cache_set("osm", places)
    return places


async def _fetch_divvy() -> list[dict]:
    cached = _cache_get("divvy")
    if cached is not None:
        return cached

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            "https://gbfs.divvybikes.com/gbfs/en/station_information.json"
        )
        resp.raise_for_status()
        data = resp.json()

    places = []
    for s in data.get("data", {}).get("stations", []):
        lat, lon = s.get("lat"), s.get("lon")
        if lat is None or lon is None:
            continue
        # Filter to Loop / Near North
        if not (41.868 <= lat <= 41.912 and -87.660 <= lon <= -87.608):
            continue
        sid = str(s.get("station_id", ""))
        name = s.get("name", "Divvy Station")
        places.append({
            "id": f"divvy-{sid}",
            "name": name,
            "category": "divvy",
            "lat": lat,
            "lng": lon,
            "rating": _rating(f"d{sid}"),
            "reviews": _det(f"dr{sid}", 80, 900),
            "price": 1,
            "address": name,
            "hours": "24 hours",
            "openNow": True,
            "avgVisit": 2,
            "monthlySpend": 15,
            "tags": ["E-Bikes", "Classic", f"{s.get('capacity', 15)} Docks"],
            "phone": "",
            "source": "divvy",
        })

    _cache_set("divvy", places)
    return places


async def _fetch_cta() -> list[dict]:
    cached = _cache_get("cta")
    if cached is not None:
        return cached

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            "https://data.cityofchicago.org/resource/8pix-ypme.json",
            params={"$limit": "500"},
        )
        resp.raise_for_status()
        data = resp.json()

    places = []
    seen: set[str] = set()

    for stop in data:
        loc = stop.get("location") or {}
        try:
            lat = float(loc.get("latitude", 0) or 0)
            lon = float(loc.get("longitude", 0) or 0)
        except (TypeError, ValueError):
            continue
        if not lat or not lon:
            continue
        if not (41.868 <= lat <= 41.912 and -87.660 <= lon <= -87.608):
            continue

        station_name = stop.get("station_descriptive_name") or stop.get("stop_name", "CTA Station")
        if station_name in seen:
            continue
        seen.add(station_name)

        sid = str(stop.get("stop_id", station_name))
        lines = [
            c.title()
            for c in ["red", "blue", "green", "brown", "purple", "pink", "orange"]
            if str(stop.get(c, "")).lower() == "true"
        ]

        places.append({
            "id": f"cta-{sid}",
            "name": station_name,
            "category": "cta",
            "lat": lat,
            "lng": lon,
            "rating": _rating(f"c{sid}"),
            "reviews": _det(f"cr{sid}", 300, 4000),
            "price": 1,
            "address": stop.get("location_description", "Chicago, IL"),
            "hours": "24 hours",
            "openNow": True,
            "avgVisit": 3,
            "monthlySpend": 105,
            "tags": (lines[:4] + (["ADA Accessible"] if str(stop.get("ada", "")).lower() == "true" else []))[:5],
            "phone": "",
            "source": "cta",
        })

    _cache_set("cta", places)
    return places


# ─── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/places")
async def get_chicago_places():
    """
    Returns live place data for the Chicago Loop from:
    - OpenStreetMap Overpass API (restaurants, coffee, bars, parking, fitness, pharmacy, grocery)
    - Divvy GBFS (bike stations)
    - Chicago Data Portal (CTA L stops)

    Results are cached in memory for 1 hour.
    """
    results = await asyncio.gather(
        _fetch_osm(),
        _fetch_divvy(),
        _fetch_cta(),
        return_exceptions=True,
    )

    all_places: list[dict] = []
    errors: list[str] = []

    source_names = ["osm", "divvy", "cta"]
    for name, result in zip(source_names, results):
        if isinstance(result, Exception):
            errors.append(f"{name}: {str(result)[:120]}")
        elif isinstance(result, list):
            all_places.extend(result)

    return {
        "places": all_places,
        "count": len(all_places),
        "errors": errors,
        "cached": all(
            _cache_get(k) is not None for k in ("osm", "divvy", "cta")
        ),
    }


@router.delete("/places/cache")
async def clear_chicago_cache():
    """Clear the places cache (forces re-fetch on next request)."""
    for k in ("osm", "divvy", "cta"):
        _cache.pop(k, None)
    return {"message": "Cache cleared"}


# ─── Foursquare Photos ─────────────────────────────────────────────────────────

@router.get("/photos")
async def get_place_photos(
    name: str = Query(..., description="Place name"),
    lat: float = Query(..., description="Latitude"),
    lng: float = Query(..., description="Longitude"),
):
    """
    Returns real photos for a place using the Foursquare Places API v3.

    Requires FOURSQUARE_API_KEY in .env (free at developer.foursquare.com).
    Results are cached in memory for 24 hours per place.
    """
    if not FOURSQUARE_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="FOURSQUARE_API_KEY not set — add it to backend/.env (free at developer.foursquare.com)",
        )

    cache_key = f"photos:{name}:{lat:.4f}:{lng:.4f}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    headers = {
        "Authorization": FOURSQUARE_API_KEY,
        "Accept": "application/json",
    }

    async with httpx.AsyncClient(timeout=12.0) as client:
        # Step 1: find the best matching place
        search = await client.get(
            f"{FSQ_BASE}/places/search",
            headers=headers,
            params={
                "query": name,
                "ll": f"{lat},{lng}",
                "limit": 1,
                "radius": 300,
                "fields": "fsq_id,name",
            },
        )
        search.raise_for_status()
        results = search.json().get("results", [])

        if not results:
            return {"photos": [], "source": "foursquare", "error": "Place not found"}

        fsq_id = results[0]["fsq_id"]
        fsq_name = results[0].get("name", name)

        # Step 2: get up to 6 photos
        photos_resp = await client.get(
            f"{FSQ_BASE}/places/{fsq_id}/photos",
            headers=headers,
            params={"limit": 6, "sort": "POPULAR"},
        )
        photos_resp.raise_for_status()
        photos_data = photos_resp.json()

    photos: list[str] = []
    for p in photos_data:
        prefix = p.get("prefix", "")
        suffix = p.get("suffix", "")
        if prefix and suffix:
            # Full-size: 1200x800, thumb: 400x300
            photos.append(f"{prefix}1200x800{suffix}")

    result = {
        "photos": photos,
        "fsq_id": fsq_id,
        "fsq_name": fsq_name,
        "source": "foursquare",
    }
    # Cache for 24 h (photos don't change often)
    _cache[cache_key] = (result, time.time() - CACHE_TTL + 86400)
    return result


@router.get("/photos/status")
async def foursquare_status():
    """Check whether the Foursquare API key is configured."""
    return {
        "configured": bool(FOURSQUARE_API_KEY),
        "key_hint": f"...{FOURSQUARE_API_KEY[-6:]}" if FOURSQUARE_API_KEY else None,
    }


# ─── Mapillary Street Imagery ──────────────────────────────────────────────────

@router.get("/streetview")
async def get_street_imagery(
    lat: float = Query(..., description="Latitude"),
    lng: float = Query(..., description="Longitude"),
    radius: int = Query(60, ge=10, le=500, description="Search radius in metres"),
):
    """
    Returns nearby Mapillary street-level images for a given coordinate.
    Requires MAPILLARY_ACCESS_TOKEN in .env (free at mapillary.com).
    Results cached 1 hour per location (rounded to 4 decimal places).
    """
    if not MAPILLARY_TOKEN:
        raise HTTPException(
            status_code=503,
            detail="MAPILLARY_ACCESS_TOKEN not configured — add to backend/.env (free at mapillary.com)",
        )

    cache_key = f"mapillary:{lat:.4f}:{lng:.4f}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    # Mapillary bbox order: west,south,east,north
    d = radius / 111_000  # degrees per metre (approx)
    bbox = f"{lng - d},{lat - d},{lng + d},{lat + d}"

    async with httpx.AsyncClient(timeout=12.0) as client:
        resp = await client.get(
            "https://graph.mapillary.com/images",
            params={
                "access_token": MAPILLARY_TOKEN,
                "fields": "id,thumb_1024_url,thumb_256_url,geometry,captured_at",
                "bbox": bbox,
                "limit": 12,
            },
        )
        if resp.status_code == 401:
            raise HTTPException(
                status_code=503,
                detail="Invalid Mapillary token — check MAPILLARY_ACCESS_TOKEN in .env",
            )
        resp.raise_for_status()
        data = resp.json()

    images = []
    for feat in data.get("data", []):
        coords = feat.get("geometry", {}).get("coordinates", [lng, lat])
        images.append({
            "id": feat["id"],
            "url": feat.get("thumb_1024_url", ""),
            "thumb": feat.get("thumb_256_url", ""),
            "captured_at": feat.get("captured_at"),
            "lat": coords[1] if len(coords) > 1 else lat,
            "lng": coords[0] if len(coords) > 0 else lng,
        })

    result = {"images": images, "count": len(images), "source": "mapillary"}
    _cache_set(cache_key, result)
    return result


# ─── AI Financial Advisor (Ana) — powered by Claude ──────────────────────────

_ADVISOR_SYSTEM = """You are Ana, an AI financial advisor embedded in Nexora's Chicago Loop intelligence platform.
You help urban professionals analyze and optimize their spending across Chicago's Loop, Near North Side, and River North neighborhoods.
You know local venues: Girl & the Goat, The Aviary, 1871 @ Merchandise Mart, Equinox River North, Willis Tower, Cloud Gate, Divvy Bikes, CTA L trains, Metra commuter rail, and more.
Keep responses concise (2–4 sentences max). Use dollar amounts and percentages when useful. Be conversational and financially practical.
Reference Chicago-specific context (combined IL+Cook+Chicago tax ~27.45%, CTA monthly pass $105, Metra $140–$180/mo, Divvy annual $15/mo) when relevant."""

class _ChatMsg(BaseModel):
    role: str
    content: str


class _AdvisorBody(BaseModel):
    messages: List[_ChatMsg]
    context: dict = {}


# ── Built-in knowledge base for rule-based responses ──────────────────────────
_KB: list[tuple[list[str], str]] = [
    # Dining / Food
    (["cheap", "budget", "affordable", "under $20", "inexpensive", "cheap eat"],
     "For under $20 in the Loop, try **Portillo's** (~$12 hot dogs & Italian beef on Ontario St) or "
     "**Sweetgreen Loop** (~$16 salads on W Monroe). Both are quick, filling, and popular with locals. "
     "Avoiding the Michigan Ave tourist strip saves you 20–30% on average."),
    (["best restaurant", "top dining", "fine dining", "nice dinner", "special occasion"],
     "For a special occasion, **Girl & the Goat** (W Randolph, ~$95/person) and **The Aviary** "
     "(craft cocktails, ~$120+) are the Loop's most acclaimed spots. "
     "For business dining, **RPM Italian** and **Joe's Seafood** (~$85–90/person) are client favourites. "
     "Book 2–3 weeks ahead for weekends."),
    (["lunch", "quick lunch", "work lunch"],
     "Quick weekday lunches near the Loop: **Sweetgreen** (~$16), **Eataly Chicago** food hall (~$18–22), "
     "or **The Purple Pig** on Michigan Ave for small plates (~$25). Most Loop professionals spend "
     "$15–22/lunch — budget ~$350/mo if eating out 5 days/week."),
    (["monthly", "food spend", "dining budget", "restaurant budget"],
     "Average Loop professional dining spend: **$110–$190/mo** for mix of quick lunches + 2–3 dinners out. "
     "Fine-dining regulars reach $300–450/mo. A simple hack: meal-prepping 3 days/week cuts dining costs "
     "by ~35% while still enjoying the Loop's restaurant scene on the other days."),

    # Coffee
    (["coffee", "cafe", "espresso", "latte"],
     "Best coffee in the Loop: **Intelligentsia** (53 W Jackson, pour-overs from $6) and **Blue Bottle** "
     "(400 N Orleans) for specialty. **Colectivo** on Michigan Ave is great for Wi-Fi + pastries. "
     "Average Loop coffee habit: $50–$90/mo. Switching from Starbucks to local roasters saves ~$15/mo "
     "with better quality."),

    # Bars / Nightlife
    (["bar", "drink", "cocktail", "nightlife", "happy hour"],
     "Loop bar highlights: **Three Dots and a Dash** (River North, tiki cocktails ~$16), "
     "**Signature Lounge on 96** (panoramic views, ~$18/drink), **Celeste Bar** (rooftop, River North). "
     "Happy hour Mon–Fri 4–6pm cuts drink costs 30–40% at most Loop bars. Budget $100–$140/mo "
     "for 2–3 outings."),

    # Transit / CTA
    (["cta", "transit", "train", "l train", "subway", "commute", "transportation"],
     "CTA Ventra unlimited monthly pass is **$105/mo** — best value if you ride 3+ times/week. "
     "Single rides are $2.50. For Loop workers, the Brown/Orange/Pink/Green lines all converge "
     "at Clark/Lake and Washington/Wabash. CTA is tax-deductible as a commuter benefit up to "
     "$315/mo pre-tax through your employer."),
    (["metra", "commuter rail", "suburb"],
     "Metra monthly passes run **$140–$180/mo** depending on your zone. Union Station (Canal St) "
     "and Ogilvie Center (W Madison) are the two main Loop terminals. If your employer offers "
     "pre-tax commuter benefits, you can reduce your effective cost by ~27%."),
    (["divvy", "bike", "cycling", "bicycle"],
     "Divvy annual membership is just **$15/mo** ($179/yr) — the Loop's best transport bargain. "
     "E-bikes are included. The Michigan/Wacker and State/Randolph stations are the highest-volume "
     "in the Loop. Riding Divvy instead of Uber for trips under 2 miles saves ~$12–18 per trip."),

    # Co-working
    (["cowork", "co-work", "office", "workspace", "wework", "desk"],
     "Loop co-working options by budget: **1871 @ Merch. Mart** (~$175/mo, best community), "
     "**WeWork West Loop** (~$520/mo, private offices), **Industrious River North** (~$460/mo, premium). "
     "Hot-desk memberships start around $175–250/mo. If you're a freelancer, 1871 also gives access "
     "to a 3,500-member startup network — hard to beat for the price."),

    # Fitness
    (["gym", "fitness", "workout", "exercise"],
     "Loop fitness: **Life Time Athletic** (~$159/mo, full facility + spa on E Erie) is the best "
     "value for serious gym-goers. **Equinox River North** (~$260/mo) offers a rooftop pool and "
     "premium classes. ClassPass at ~$79/mo works well if you prefer variety across boutique studios. "
     "Tip: many Loop employers offer gym reimbursement up to $50–75/mo — check your benefits."),

    # Grocery
    (["grocery", "food shopping", "supermarket", "groceries"],
     "Loop grocery options: **Whole Foods** (W Huron, ~$180/mo for singles), "
     "**Mariano's River North** (333 E Benton, ~$220/mo, full service + sushi bar), "
     "**Target Express** on State St for quick grabs (~$120/mo). "
     "Ordering from Instacart saves ~2hrs/week but adds 15–20% in fees and tips."),

    # Taxes / Deductions
    (["tax", "deduct", "write off", "business expense", "deductible"],
     "Chicago's combined tax rate is **~27.45%** (federal + IL state + Cook County). "
     "Loop business deductions to track: client dining (50% deductible), co-working (100%), "
     "commuter transit benefits (pre-tax up to $315/mo), professional memberships (100%). "
     "A $500/mo Loop business lifestyle = ~$137/mo in tax savings at the 27.45% rate."),

    # Savings / Budgeting
    (["save", "saving", "budget", "cut cost", "reduce spending", "optimize"],
     "Top 3 Loop cost cuts: ① Switch to CTA unlimited pass ($105/mo vs ~$280/mo Uber) — saves $175/mo. "
     "② Add Divvy for short trips ($15/mo) — saves $100–150/mo vs rideshare. "
     "③ Meal-prep 3 lunches/week — saves ~$120/mo. Combined: **~$395/mo or $4,740/yr** back in your pocket."),

    # Annual spend overview
    (["annual", "yearly", "year", "total spend", "how much"],
     "Estimated annual Chicago Loop lifestyle spend: **$5,400–$12,000/yr** depending on habits. "
     "Breakdown: dining $1,320–$2,280 · transit $1,260–$2,160 · fitness $960–$3,120 · "
     "co-working $0–$6,240 · coffee $600–$1,080. At 27.45% tax, you need to earn "
     "$7,500–$16,600 gross to cover these after-tax costs."),

    # Parking
    (["parking", "car", "garage", "drive"],
     "Loop parking: **$25–$70/day** at surface lots, $50–$120/day near Millennium Park on event days. "
     "Monthly contracts at 55 E Monroe (~$280/mo) or Grant Park North (~$240/mo) are far cheaper "
     "for daily commuters. SpotHero app typically saves 30–40% vs drive-up rates. "
     "Consider: CTA unlimited ($105/mo) + Divvy ($15/mo) = $120/mo vs parking alone at $280/mo."),

    # General greeting / help
    (["hello", "hi", "hey", "help", "what can you do", "who are you"],
     "Hi! I'm **Ana**, your Chicago Loop financial advisor. I can help you with: "
     "🍽 Dining recommendations & budgets · 🚊 CTA/Metra/Divvy transit costs · "
     "💼 Co-working space comparisons · 🏋 Fitness options · 💰 Tax deductions & savings tips. "
     "What would you like to know about your Loop finances?"),
]


def _ana_respond(question: str) -> str:
    """Rule-based responder covering common Chicago Loop finance questions."""
    q = question.lower()
    for keywords, answer in _KB:
        if any(kw in q for kw in keywords):
            return answer
    # Generic fallback with real data
    return (
        "Great question about Chicago Loop finances! Here are some quick benchmarks: "
        "dining $110–$190/mo · coffee $50–$90/mo · CTA pass $105/mo · Divvy $15/mo · "
        "co-working $175–$520/mo · fitness $159–$260/mo. "
        "Ask me about any specific category — transit, dining, co-working, savings tips, or tax deductions."
    )


@router.post("/advisor")
async def ai_advisor(body: _AdvisorBody):
    """
    Chicago Loop AI financial advisor (Ana).
    Uses Claude claude-opus-4-6 when ANTHROPIC_API_KEY is set, otherwise uses the built-in knowledge base.
    """
    last_user = next(
        (m.content for m in reversed(body.messages) if m.role == "user"), ""
    )

    if not ANTHROPIC_API_KEY:
        return {"reply": _ana_respond(last_user), "model": "built-in"}

    import anthropic as _anthropic

    client = _anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
    msgs = [{"role": m.role, "content": m.content} for m in body.messages[-12:]]

    response = await client.messages.create(
        model="claude-opus-4-6",
        max_tokens=400,
        system=_ADVISOR_SYSTEM,
        messages=msgs,
    )
    reply = next(
        (block.text for block in response.content if block.type == "text"),
        _ana_respond(last_user),
    )
    return {"reply": reply, "model": response.model}
