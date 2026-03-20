/* ============================================================
   NEXORA — CHICAGO HUB  |  VADMP-Inspired Finance Intelligence Map
   Live data: OpenStreetMap Overpass · Divvy GBFS · Chicago Data Portal CTA
   Analytics: recharts spending charts · AI Advisor (Ana) · Street View
   ============================================================ */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Zap, ChevronLeft, Search, X, Layers, Sun, Moon,
  Plus, Minus, LocateFixed, Star, ExternalLink, Camera,
  Navigation, CheckCircle2, Loader2, RefreshCw,
  BarChart2, MessageSquare, Download, Send, Bot,
} from 'lucide-react';
import {
  MapContainer, TileLayer, Popup, CircleMarker,
  Polyline, Marker, useMap,
} from 'react-leaflet';
import L from 'leaflet';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { cn, formatCurrency } from '../lib/utils';

delete (L.Icon.Default.prototype as any)._getIconUrl;

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
type Category =
  | 'restaurant' | 'coffee' | 'bar' | 'parking' | 'cta'
  | 'metra' | 'cowork' | 'financial' | 'landmark' | 'grocery'
  | 'divvy' | 'fitness' | 'pharmacy';

interface Place {
  id: string; name: string; category: Category;
  lat: number; lng: number;
  rating: number; reviews: number; price: 1 | 2 | 3 | 4;
  address: string; hours: string; openNow: boolean;
  avgVisit: number; monthlySpend: number;
  tags: string[]; phone?: string;
  source?: 'osm' | 'divvy' | 'cta' | 'static';
}

type LeftTab = 'places' | 'analytics' | 'advisor';
interface ChatMessage { role: 'user' | 'assistant'; content: string; }

// ─────────────────────────────────────────────
// CATEGORY CONFIG
// ─────────────────────────────────────────────
const CAT: Record<Category, { label: string; color: string; markerColor: string; emoji: string }> = {
  restaurant: { label: 'Dining',    color: '#ef4444', markerColor: '#ef4444', emoji: '🍽️' },
  coffee:     { label: 'Coffee',    color: '#b45309', markerColor: '#f59e0b', emoji: '☕' },
  bar:        { label: 'Bars',      color: '#7c3aed', markerColor: '#8b5cf6', emoji: '🍸' },
  parking:    { label: 'Parking',   color: '#1d4ed8', markerColor: '#3b82f6', emoji: '🅿️' },
  cta:        { label: 'CTA',       color: '#b45309', markerColor: '#f59e0b', emoji: '🚊' },
  metra:      { label: 'Metra',     color: '#c2410c', markerColor: '#f97316', emoji: '🚂' },
  cowork:     { label: 'Co-Work',   color: '#5b21b6', markerColor: '#8b5cf6', emoji: '💼' },
  financial:  { label: 'Finance',   color: '#065f46', markerColor: '#10b981', emoji: '📈' },
  landmark:   { label: 'Landmarks', color: '#0e7490', markerColor: '#06b6d4', emoji: '⭐' },
  grocery:    { label: 'Grocery',   color: '#14532d', markerColor: '#22c55e', emoji: '🛒' },
  divvy:      { label: 'Divvy',     color: '#3f6212', markerColor: '#84cc16', emoji: '🚲' },
  fitness:    { label: 'Fitness',   color: '#9d174d', markerColor: '#ec4899', emoji: '🏋️' },
  pharmacy:   { label: 'Pharmacy',  color: '#075985', markerColor: '#38bdf8', emoji: '💊' },
};

// ─────────────────────────────────────────────
// RELIABLE IMAGES  (picsum.photos — seed-based, always loads)
// ─────────────────────────────────────────────
const img = (id: string, idx = 0, w = 700, h = 320) =>
  `https://picsum.photos/seed/${encodeURIComponent(id)}-${idx}/${w}/${h}`;

const thumb = (id: string, idx = 0) => img(id, idx, 120, 120);

// ─────────────────────────────────────────────
// STATIC PLACES  (curated, always shown + API data merges on top)
// ─────────────────────────────────────────────
const STATIC_PLACES: Place[] = [
  // RESTAURANTS
  { id:'r1',  name:'Girl & the Goat',        category:'restaurant', lat:41.8836,lng:-87.6484, rating:4.7,reviews:4820,price:3, address:'809 W Randolph St',  hours:'Mon–Fri 4pm–11pm',   openNow:true,  avgVisit:95,  monthlySpend:190, tags:['American','Celebrity Chef','Award-Winning'], source:'static' },
  { id:'r2',  name:'Au Cheval',              category:'restaurant', lat:41.8830,lng:-87.6487, rating:4.8,reviews:6100,price:2, address:'800 W Randolph St',  hours:'Mon–Sun 10am–2am',   openNow:true,  avgVisit:55,  monthlySpend:110, tags:['Burgers','Diner','Late Night'],             source:'static' },
  { id:'r3',  name:'RPM Italian',            category:'restaurant', lat:41.8919,lng:-87.6310, rating:4.6,reviews:3200,price:3, address:'52 W Illinois St',   hours:'Mon–Sun 11:30am–10pm',openNow:true, avgVisit:85,  monthlySpend:170, tags:['Italian','River North','Power Lunch'],       source:'static' },
  { id:'r4',  name:"Joe's Seafood",          category:'restaurant', lat:41.8820,lng:-87.6306, rating:4.5,reviews:2800,price:3, address:'60 E Grand Ave',     hours:'Mon–Sun 11:30am–10pm',openNow:true, avgVisit:90,  monthlySpend:180, tags:['Seafood','Steakhouse','Business Dining'],    source:'static' },
  { id:'r5',  name:'The Purple Pig',         category:'restaurant', lat:41.8903,lng:-87.6279, rating:4.6,reviews:5100,price:2, address:'500 N Michigan Ave', hours:'Mon–Sun 11:30am–12am',openNow:true, avgVisit:55,  monthlySpend:110, tags:['Mediterranean','Cheese','Wine'],             source:'static' },
  { id:'r6',  name:'Sweetgreen Loop',        category:'restaurant', lat:41.8822,lng:-87.6302, rating:4.2,reviews:890, price:1, address:'30 W Monroe St',     hours:'Mon–Fri 10:30am–9pm', openNow:true,  avgVisit:18,  monthlySpend:80,  tags:['Salads','Healthy','Fast Casual'],            source:'static' },
  { id:'r7',  name:"Portillo's",             category:'restaurant', lat:41.8827,lng:-87.6262, rating:4.4,reviews:7300,price:1, address:'100 W Ontario St',   hours:'Mon–Sun 10am–11pm',   openNow:true,  avgVisit:15,  monthlySpend:60,  tags:['Hot Dogs','Chicago Classic','Fast Food'],   source:'static' },
  { id:'r8',  name:'Avec',                   category:'restaurant', lat:41.8832,lng:-87.6483, rating:4.7,reviews:2900,price:2, address:'615 W Randolph St',  hours:'Mon–Sun 3:30pm–11pm', openNow:false, avgVisit:65,  monthlySpend:130, tags:['Mediterranean','Wine Bar','Charcuterie'],   source:'static' },
  { id:'r9',  name:'Eataly Chicago',         category:'restaurant', lat:41.8838,lng:-87.6260, rating:4.5,reviews:4200,price:2, address:'43 E Ohio St',       hours:'Mon–Sun 11am–10pm',   openNow:true,  avgVisit:70,  monthlySpend:140, tags:['Italian Market','Multiple Concepts','Wine'], source:'static' },
  { id:'r10', name:"Cindy's Rooftop",        category:'restaurant', lat:41.8827,lng:-87.6270, rating:4.4,reviews:3100,price:3, address:'12 S Michigan Ave',  hours:'Mon–Sun 11am–Midnight',openNow:true, avgVisit:80,  monthlySpend:160, tags:['Rooftop','Brunch','Skyline Views'],          source:'static' },
  // COFFEE
  { id:'c1',  name:'Intelligentsia Coffee',  category:'coffee', lat:41.8858,lng:-87.6236, rating:4.6,reviews:2100,price:2, address:'53 W Jackson Blvd',  hours:'Mon–Fri 6am–7pm',  openNow:true,  avgVisit:9,  monthlySpend:85,  tags:['Specialty','Direct Trade','Pour Over'],    source:'static' },
  { id:'c2',  name:'Colectivo Coffee',       category:'coffee', lat:41.8831,lng:-87.6300, rating:4.5,reviews:980, price:1, address:'151 N Michigan Ave', hours:'Mon–Fri 6am–8pm',  openNow:true,  avgVisit:7,  monthlySpend:60,  tags:['Local Roaster','Wi-Fi','Pastries'],         source:'static' },
  { id:'c3',  name:'Blue Bottle Coffee',     category:'coffee', lat:41.8920,lng:-87.6290, rating:4.4,reviews:1200,price:2, address:'400 N Orleans St',   hours:'Mon–Fri 7am–7pm',  openNow:true,  avgVisit:8,  monthlySpend:70,  tags:['Third Wave','Single Origin','Minimalist'],  source:'static' },
  { id:'c4',  name:'Starbucks Reserve',      category:'coffee', lat:41.8948,lng:-87.6238, rating:4.3,reviews:3400,price:2, address:'646 N Michigan Ave', hours:'Mon–Sun 6am–10pm', openNow:true,  avgVisit:10, monthlySpend:90,  tags:['Reserve','Premium','Michigan Ave'],         source:'static' },
  { id:'c5',  name:'Lavazza Loop',           category:'coffee', lat:41.8799,lng:-87.6290, rating:4.2,reviews:560, price:1, address:'100 S Wacker Dr',    hours:'Mon–Fri 7am–4pm',  openNow:true,  avgVisit:6,  monthlySpend:50,  tags:['Italian Espresso','Quick','CBD'],           source:'static' },
  // BARS
  { id:'b1',  name:'The Aviary',             category:'bar', lat:41.8841,lng:-87.6483, rating:4.8,reviews:1800,price:4, address:'955 W Fulton Market', hours:'Tue–Sun 6pm–1am', openNow:false, avgVisit:120,monthlySpend:240, tags:['Craft Cocktails','Michelin-starred','Upscale'],  source:'static' },
  { id:'b2',  name:'Three Dots and a Dash',  category:'bar', lat:41.8904,lng:-87.6315, rating:4.6,reviews:2200,price:2, address:'435 N Clark St',      hours:'Mon–Sun 5pm–2am', openNow:true,  avgVisit:55, monthlySpend:110, tags:['Tiki Bar','Underground','River North'],          source:'static' },
  { id:'b3',  name:'Signature Lounge 96F',   category:'bar', lat:41.8978,lng:-87.6236, rating:4.4,reviews:3800,price:3, address:'875 N Michigan Ave',  hours:'Mon–Sun 11am–1am',openNow:true,  avgVisit:70, monthlySpend:140, tags:['Skyline Views','96th Floor','John Hancock'],     source:'static' },
  { id:'b4',  name:'Celeste Bar',            category:'bar', lat:41.8886,lng:-87.6340, rating:4.3,reviews:1100,price:2, address:'111 W Huron St',      hours:'Mon–Sun 4pm–2am', openNow:true,  avgVisit:50, monthlySpend:100, tags:['Rooftop','Cocktails','River North'],             source:'static' },
  // PARKING
  { id:'p1',  name:'Millennium Park Garage', category:'parking', lat:41.8826,lng:-87.6234, rating:4.1,reviews:430, price:3, address:'5 S Columbus Dr',    hours:'24 hours', openNow:true, avgVisit:35, monthlySpend:70, tags:['Indoor','Event Parking','Millennium Park'],  source:'static' },
  { id:'p2',  name:'Grant Park N Garage',    category:'parking', lat:41.8793,lng:-87.6243, rating:4.0,reviews:310, price:3, address:'25 N Michigan Ave',  hours:'24 hours', openNow:true, avgVisit:30, monthlySpend:60, tags:['Outdoor','Museum Campus','Event'],           source:'static' },
  { id:'p3',  name:'55 E Monroe InterPark',  category:'parking', lat:41.8810,lng:-87.6260, rating:3.9,reviews:510, price:2, address:'55 E Monroe St',     hours:'Mon–Fri 6am–12am', openNow:true, avgVisit:25, monthlySpend:50, tags:['Covered','Near Millennium','Validated'],    source:'static' },
  { id:'p4',  name:'SpotHero 55 E Ohio',     category:'parking', lat:41.8922,lng:-87.6289, rating:4.0,reviews:190, price:2, address:'55 E Ohio St',       hours:'24 hours', openNow:true, avgVisit:28, monthlySpend:56, tags:['River North','App Booking','SpotHero'],      source:'static' },
  // CTA STATIONS
  { id:'t1',  name:'Clark/Lake (L Transfer)',category:'cta', lat:41.8857,lng:-87.6312, rating:3.9,reviews:1200,price:1, address:'100 W Lake St',       hours:'24 hours', openNow:true, avgVisit:3, monthlySpend:105, tags:['Blue/Brown/Green/Orange/Pink/Purple','Busiest Loop Stop'], source:'static' },
  { id:'t2',  name:'Washington/Wabash',      category:'cta', lat:41.8832,lng:-87.6259, rating:4.0,reviews:890, price:1, address:'1 N Wabash Ave',       hours:'24 hours', openNow:true, avgVisit:3, monthlySpend:105, tags:['All Lines','Central Loop','Elevated'],              source:'static' },
  { id:'t3',  name:'Monroe/State (Red)',      category:'cta', lat:41.8806,lng:-87.6278, rating:3.8,reviews:640, price:1, address:'State & Monroe',       hours:'24 hours', openNow:true, avgVisit:3, monthlySpend:105, tags:['Red Line','Underground','State St'],                source:'static' },
  { id:'t4',  name:'Quincy/Wells',           category:'cta', lat:41.8784,lng:-87.6374, rating:3.9,reviews:410, price:1, address:'220 S Wells St',       hours:'24 hours', openNow:true, avgVisit:3, monthlySpend:105, tags:['Brown/Orange/Pink','Historic Station'],                source:'static' },
  { id:'t5',  name:'Merchandise Mart',       category:'cta', lat:41.8884,lng:-87.6356, rating:4.1,reviews:720, price:1, address:'222 Merchandise Mart', hours:'24 hours', openNow:true, avgVisit:3, monthlySpend:105, tags:['Brown/Purple','River North'],                          source:'static' },
  // METRA
  { id:'m1',  name:'Union Station (Metra)',  category:'metra', lat:41.8786,lng:-87.6403, rating:4.0,reviews:2100,price:2, address:'225 S Canal St',    hours:'Daily 5am–11:30pm',openNow:true, avgVisit:8, monthlySpend:160, tags:['BNSF/Heritage/SWS','Amtrak','Great Hall'], source:'static' },
  { id:'m2',  name:'Ogilvie Center (Metra)', category:'metra', lat:41.8843,lng:-87.6401, rating:3.9,reviews:1800,price:2, address:'500 W Madison St',  hours:'Daily 5am–10pm',   openNow:true, avgVisit:8, monthlySpend:160, tags:['Union Pacific Lines','Food Court'],         source:'static' },
  { id:'m3',  name:'Millennium Station',     category:'metra', lat:41.8832,lng:-87.6241, rating:4.1,reviews:980, price:1, address:'151 E Randolph St', hours:'Daily 4:30am–11pm',openNow:true, avgVisit:5, monthlySpend:100, tags:['Metra Electric','South Shore','Lakefront'],  source:'static' },
  // CO-WORKING
  { id:'w1',  name:'1871 @ Merch. Mart',    category:'cowork', lat:41.8884,lng:-87.6358, rating:4.8,reviews:620, price:2, address:'222 Merchandise Mart',hours:'Mon–Fri 8am–8pm', openNow:true, avgVisit:20, monthlySpend:175, tags:['Tech Hub','3,500 Members','Events'],   source:'static' },
  { id:'w2',  name:'WeWork West Loop',       category:'cowork', lat:41.8830,lng:-87.6490, rating:4.5,reviews:380, price:3, address:'20 W Kinzie St',      hours:'24/7 Members',    openNow:true, avgVisit:20, monthlySpend:520, tags:['Private Offices','Amenities'],         source:'static' },
  { id:'w3',  name:'Industrious River N.',   category:'cowork', lat:41.8945,lng:-87.6325, rating:4.7,reviews:290, price:3, address:'321 N Clark St',      hours:'Mon–Fri 8am–6pm', openNow:true, avgVisit:20, monthlySpend:460, tags:['Premium','Fast Wi-Fi'],                source:'static' },
  // FINANCIAL
  { id:'f1',  name:'Chicago Board of Trade', category:'financial', lat:41.8784,lng:-87.6337, rating:4.5,reviews:820, price:1, address:'141 W Jackson Blvd', hours:'Mon–Fri 8am–3:15pm', openNow:true, avgVisit:0, monthlySpend:0, tags:['Futures','Options','Historic'], source:'static' },
  { id:'f2',  name:'Federal Reserve Bank',   category:'financial', lat:41.8788,lng:-87.6274, rating:4.3,reviews:540, price:1, address:'230 S LaSalle St',    hours:'Mon–Fri 8am–5pm',    openNow:true, avgVisit:0, monthlySpend:0, tags:['Money Museum','Tours'],          source:'static' },
  { id:'f3',  name:'CME Group HQ',           category:'financial', lat:41.8787,lng:-87.6345, rating:4.2,reviews:380, price:1, address:'20 S Wacker Dr',      hours:'Mon–Fri 7am–6pm',    openNow:true, avgVisit:0, monthlySpend:0, tags:['Commodities','Derivatives'],      source:'static' },
  // LANDMARKS
  { id:'l1',  name:'Willis Tower SkyDeck',   category:'landmark', lat:41.8789,lng:-87.6359, rating:4.6,reviews:34000,price:3, address:'233 S Wacker Dr',   hours:'Daily 9am–10pm',    openNow:true, avgVisit:35, monthlySpend:35,  tags:['103rd Floor','Skydeck','The Ledge'],   source:'static' },
  { id:'l2',  name:'Cloud Gate (The Bean)',  category:'landmark', lat:41.8826,lng:-87.6233, rating:4.9,reviews:51000,price:1, address:'201 E Millennium',   hours:'Always Open',        openNow:true, avgVisit:0,  monthlySpend:0,   tags:['Free','Iconic','Millennium Park'],      source:'static' },
  { id:'l3',  name:'Chicago Riverwalk',      category:'landmark', lat:41.8878,lng:-87.6270, rating:4.7,reviews:12000,price:1, address:'Riverwalk, Chicago', hours:'Daily 6am–11pm',    openNow:true, avgVisit:25, monthlySpend:50,  tags:['Outdoor Dining','Scenic','Events'],    source:'static' },
  { id:'l4',  name:'Art Institute Chicago',  category:'landmark', lat:41.8796,lng:-87.6237, rating:4.8,reviews:28000,price:2, address:'111 S Michigan Ave', hours:'Daily 11am–5pm',    openNow:true, avgVisit:25, monthlySpend:25,  tags:['World-Class Art','Grant Park'],        source:'static' },
  // GROCERY
  { id:'g1',  name:'Whole Foods Market',     category:'grocery', lat:41.8819,lng:-87.6280, rating:4.3,reviews:1600,price:3, address:'30 W Huron St',     hours:'Daily 7am–10pm',    openNow:true, avgVisit:45, monthlySpend:180, tags:['Organic','Hot Bar','Prepared Foods'],  source:'static' },
  { id:'g2',  name:'Target Express Loop',    category:'grocery', lat:41.8808,lng:-87.6270, rating:4.0,reviews:840, price:2, address:'1 S State St',      hours:'Daily 8am–10pm',    openNow:true, avgVisit:30, monthlySpend:120, tags:['Convenience','Grab & Go','Pharmacy'],  source:'static' },
  { id:'g3',  name:"Mariano's River N.",     category:'grocery', lat:41.8965,lng:-87.6255, rating:4.5,reviews:2100,price:2, address:'333 E Benton Pl',   hours:'Daily 6am–Midnight', openNow:true, avgVisit:55, monthlySpend:220, tags:['Full-Service','Sushi Bar','Wine'],     source:'static' },
  // DIVVY
  { id:'d1',  name:'Divvy: State/Randolph',  category:'divvy', lat:41.8847,lng:-87.6278, rating:4.2,reviews:320, price:1, address:'State St & Randolph',hours:'24 hours', openNow:true, avgVisit:2, monthlySpend:15, tags:['E-Bikes','Classic','High Volume'], source:'static' },
  { id:'d2',  name:'Divvy: Michigan/Wacker', category:'divvy', lat:41.8876,lng:-87.6240, rating:4.3,reviews:410, price:1, address:'N Michigan & Wacker', hours:'24 hours', openNow:true, avgVisit:2, monthlySpend:15, tags:['Riverwalk Access','Scenic'],       source:'static' },
  // FITNESS
  { id:'fi1', name:'Equinox River North',    category:'fitness', lat:41.8920,lng:-87.6305, rating:4.7,reviews:980, price:4, address:'900 N Michigan Ave', hours:'Mon–Fri 5am–11pm', openNow:true, avgVisit:30, monthlySpend:260, tags:['Premium','Rooftop Pool'],  source:'static' },
  { id:'fi2', name:'Life Time Athletic Loop',category:'fitness', lat:41.8857,lng:-87.6296, rating:4.6,reviews:720, price:3, address:'1 E Erie St',        hours:'Mon–Fri 5am–10pm', openNow:true, avgVisit:25, monthlySpend:159, tags:['Full-Facility','Spa'],      source:'static' },
  // PHARMACY
  { id:'ph1', name:'CVS Pharmacy Loop',      category:'pharmacy', lat:41.8843,lng:-87.6293, rating:3.8,reviews:480, price:1, address:'1 S Dearborn St',    hours:'Mon–Fri 7am–9pm',  openNow:true, avgVisit:15, monthlySpend:45, tags:['Prescriptions','MinuteClinic'], source:'static' },
  { id:'ph2', name:'Walgreens Michigan Ave', category:'pharmacy', lat:41.8893,lng:-87.6241, rating:3.9,reviews:720, price:1, address:'757 N Michigan Ave',  hours:'Mon–Sun 7am–10pm', openNow:true, avgVisit:15, monthlySpend:45, tags:['Michigan Ave','Travel Essentials'], source:'static' },
];

const ALL_CATEGORIES = Object.keys(CAT) as Category[];
const LOOP_CENTER: [number, number] = [41.8840, -87.6298];

const CTA_LOOP_TRACK: [number, number][] = [
  [41.8856, -87.6318],
  [41.8857, -87.6277],
  [41.8847, -87.6259],
  [41.8831, -87.6259],
  [41.8796, -87.6259],
  [41.8762, -87.6280],
  [41.8757, -87.6320],
  [41.8784, -87.6375],
  [41.8830, -87.6339],
  [41.8856, -87.6318],
];

const COMBINED_TAX = 0.2745;

// ─────────────────────────────────────────────
// MAP INTERNALS
// ─────────────────────────────────────────────
function MapCapture({ onReady }: { onReady: (m: L.Map) => void }) {
  const map = useMap();
  useEffect(() => { onReady(map); }, [map, onReady]);
  return null;
}
function FlyTo({ target }: { target: [number, number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target[0], target[1]], target[2], { duration: 1.1, easeLinearity: 0.2 });
  }, [target, map]);
  return null;
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={cn('w-3 h-3', i <= Math.round(rating) ? 'text-yellow-400 fill-yellow-400' : 'text-slate-700')} />
      ))}
    </div>
  );
}
function PriceTag({ level }: { level: 1 | 2 | 3 | 4 }) {
  return (
    <span className="text-[11px] font-semibold text-slate-400">
      {'$'.repeat(level)}<span className="opacity-30">{'$'.repeat(4 - level)}</span>
    </span>
  );
}

// ─────────────────────────────────────────────
// PHOTO GALLERY MODAL
// ─────────────────────────────────────────────
function PhotoModal({ place, onClose, initialIdx = 0, realPhotos = [] }: {
  place: Place; onClose: () => void; initialIdx?: number; realPhotos?: string[];
}) {
  const [idx, setIdx] = useState(initialIdx);
  const count = realPhotos.length || 4;
  const heroSrc = realPhotos.length > 0
    ? realPhotos[idx % realPhotos.length]
    : img(place.id, idx, 1200, 700);
  const thumbSrc = (i: number) => realPhotos.length > 0
    ? realPhotos[i % realPhotos.length].replace('1200x800', '400x300')
    : thumb(place.id, i);

  return (
    <div className="fixed inset-0 bg-black/95 z-[9999] flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" onClick={e => e.stopPropagation()}>
        <div>
          <h3 className="text-white font-bold text-lg">{place.name}</h3>
          <p className="text-slate-400 text-sm">
            {CAT[place.category].emoji} {CAT[place.category].label}
            {realPhotos.length > 0 && <span className="ml-2 text-emerald-400 text-xs font-semibold">📸 Foursquare photos</span>}
          </p>
        </div>
        <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center px-6 min-h-0" onClick={e => e.stopPropagation()}>
        <img key={heroSrc} src={heroSrc} alt={place.name}
          className="max-h-full max-w-full rounded-2xl object-cover shadow-2xl" />
      </div>
      <div className="text-center py-2 text-slate-500 text-xs" onClick={e => e.stopPropagation()}>
        {idx + 1} / {count}
      </div>
      <div className="flex items-center justify-center gap-3 pb-6 overflow-x-auto px-6 flex-shrink-0" onClick={e => e.stopPropagation()}>
        {Array.from({ length: count }, (_, i) => (
          <button key={i} onClick={() => setIdx(i)}
            className={cn('w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all',
              i === idx ? 'border-primary-400 scale-105' : 'border-transparent opacity-60 hover:opacity-90')}>
            <img src={thumbSrc(i)} alt="" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// PLACE DETAIL VIEW
// ─────────────────────────────────────────────
function PlaceDetail({ place, onBack, onShowPhotos }: {
  place: Place; onBack: () => void;
  onShowPhotos: (idx: number, photos: string[]) => void;
}) {
  const [photoIdx, setPhotoIdx] = useState(0);
  const [realPhotos, setRealPhotos] = useState<string[]>([]);
  const [photosLoading, setPhotosLoading] = useState(true);
  const cat = CAT[place.category];

  useEffect(() => {
    setPhotosLoading(true);
    setRealPhotos([]);
    setPhotoIdx(0);
    fetch(
      `http://localhost:8000/api/v1/chicago/photos?name=${encodeURIComponent(place.name)}&lat=${place.lat}&lng=${place.lng}`
    )
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => { if (data.photos?.length) setRealPhotos(data.photos); })
      .catch(() => {})
      .finally(() => setPhotosLoading(false));
  }, [place.id, place.name, place.lat, place.lng]);

  const photoCount = realPhotos.length || 4;
  const photoUrl = (i: number, w = 700, h = 320) =>
    realPhotos.length > 0 ? realPhotos[i % realPhotos.length] : img(place.id, i, w, h);
  const thumbUrl = (i: number) =>
    realPhotos.length > 0
      ? realPhotos[i % realPhotos.length].replace('1200x800', '400x300')
      : thumb(place.id, i);

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`;
  const streetViewUrl = `https://www.google.com/maps?layer=c&cbll=${place.lat},${place.lng}`;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`;

  return (
    <div className="flex flex-col h-full">
      {/* Hero photo */}
      <div className="relative h-52 flex-shrink-0 cursor-pointer" onClick={() => onShowPhotos(photoIdx, realPhotos)}>
        <img src={photoUrl(photoIdx)} alt={place.name} className="w-full h-full object-cover" />
        {photosLoading && (
          <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0 animate-pulse" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <button onClick={e => { e.stopPropagation(); onBack(); }}
          className="absolute top-3 left-3 w-8 h-8 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/80 transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-full px-2.5 py-1.5 text-white text-[10px] font-semibold hover:bg-black/80 transition-colors"
          onClick={e => { e.stopPropagation(); onShowPhotos(photoIdx, realPhotos); }}>
          {photosLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
          {photosLoading ? 'Loading…' : `${photoCount} photos`}
        </button>
        {!photosLoading && realPhotos.length > 0 && (
          <div className="absolute top-3 left-12 flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-full px-2 py-1">
            <span className="text-[9px] text-emerald-400 font-bold">📸 Real photos</span>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-base">{cat.emoji}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{ backgroundColor: `${cat.color}40`, color: cat.markerColor }}>
              {cat.label}
            </span>
            {place.openNow
              ? <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full">Open</span>
              : <span className="text-[10px] font-bold text-red-400 bg-red-500/20 px-2 py-0.5 rounded-full">Closed</span>
            }
            {place.source && place.source !== 'static' && (
              <span className="text-[9px] font-semibold text-slate-500 bg-white/5 px-1.5 py-0.5 rounded-full uppercase tracking-wide">Live</span>
            )}
          </div>
          <h2 className="text-[17px] font-black text-white leading-tight">{place.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <Stars rating={place.rating} />
            <span className="text-[11px] font-bold text-yellow-400">{place.rating}</span>
            <span className="text-[10px] text-slate-400">({place.reviews.toLocaleString()})</span>
            <PriceTag level={place.price} />
          </div>
        </div>
      </div>

      {/* Photo strip */}
      <div className="flex gap-1.5 px-3 py-2 bg-[#060a14] flex-shrink-0 overflow-x-auto scrollbar-none">
        {(realPhotos.length > 0 ? realPhotos : [0, 1, 2, 3]).map((_, i) => (
          <button key={i} onClick={() => { setPhotoIdx(i); onShowPhotos(i, realPhotos); }}
            className={cn('w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 border transition-all hover:scale-105 bg-white/5',
              i === photoIdx ? 'border-primary-400' : 'border-transparent opacity-70 hover:opacity-100')}>
            {photosLoading
              ? <div className="w-full h-full bg-white/[0.06] animate-pulse" />
              : <img src={thumbUrl(i)} alt="" className="w-full h-full object-cover" loading="lazy" />
            }
          </button>
        ))}
        <button onClick={() => onShowPhotos(0, realPhotos)}
          className="w-14 h-14 rounded-lg bg-white/[0.04] border border-white/[0.08] flex flex-col items-center justify-center flex-shrink-0 hover:bg-white/[0.08] transition-colors text-slate-500">
          <Camera className="w-4 h-4 mb-0.5" />
          <span className="text-[8px] font-semibold">All</span>
        </button>
      </div>

      {/* Detail body */}
      <div className="flex-1 overflow-y-auto scrollbar-none">
        {/* Quick actions */}
        <div className="flex gap-2 px-3 py-3 border-b border-white/[0.05]">
          {([
            { icon: Navigation,   label: 'Directions', href: directionsUrl },
            { icon: ExternalLink, label: 'Maps',       href: mapsUrl       },
            { icon: Camera,       label: 'Street View',href: streetViewUrl  },
          ] as const).map((a, i) => (
            <a key={i} href={a.href} target="_blank" rel="noopener noreferrer"
              className="flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] transition-colors text-primary-400">
              <a.icon className="w-4 h-4" />
              <span className="text-[9px] font-semibold text-slate-400">{a.label}</span>
            </a>
          ))}
        </div>

        {/* Info rows */}
        <div className="px-4 py-3 space-y-3 border-b border-white/[0.05]">
          {[
            { icon: MapPin,      text: place.address },
            { icon: Zap,         text: place.hours   },
            ...(place.phone ? [{ icon: Navigation, text: place.phone }] : []),
          ].map((row, i) => (
            <div key={i} className="flex items-start gap-3">
              <row.icon className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
              <span className="text-[12px] text-slate-300">{row.text}</span>
            </div>
          ))}
        </div>

        {/* Tags */}
        {place.tags.length > 0 && (
          <div className="px-4 py-3 border-b border-white/[0.05]">
            <div className="flex flex-wrap gap-1.5">
              {place.tags.map((tag, i) => (
                <span key={i} className="px-2.5 py-1 bg-white/[0.04] border border-white/[0.07] rounded-full text-[10px] text-slate-400 font-medium">{tag}</span>
              ))}
            </div>
          </div>
        )}

        {/* Financial impact */}
        {place.monthlySpend > 0 && (
          <div className="px-4 py-4 border-b border-white/[0.05]">
            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mb-3">💰 Financial Impact</p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { label: 'Per Visit', value: formatCurrency(place.avgVisit),                             color: 'text-white'       },
                { label: 'Monthly',   value: formatCurrency(place.monthlySpend),                          color: 'text-primary-400' },
                { label: 'Annual',    value: formatCurrency(place.monthlySpend * 12, { compact: true }),  color: 'text-amber-400'   },
              ].map((s, i) => (
                <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-2.5 text-center">
                  <p className="text-[9px] text-slate-600 mb-0.5 uppercase tracking-wide">{s.label}</p>
                  <p className={cn('text-[13px] font-black', s.color)}>{s.value}</p>
                </div>
              ))}
            </div>
            <div className="p-2.5 bg-primary-500/8 border border-primary-500/15 rounded-xl">
              <p className="text-[10px] text-slate-400 leading-relaxed">
                <strong className="text-primary-400">Loop Tip:</strong> Track this as a business expense if client-related — deductible at {(COMBINED_TAX * 100).toFixed(0)}% combined tax rate.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// PLACE LIST VIEW
// ─────────────────────────────────────────────
function PlaceList({ places, onSelect, activeCategory, onCategoryChange, searchQuery, onSearchChange, loading, liveCount }: {
  places: Place[]; onSelect: (p: Place) => void;
  activeCategory: Category | 'all'; onCategoryChange: (c: Category | 'all') => void;
  searchQuery: string; onSearchChange: (q: string) => void;
  loading: boolean; liveCount: number;
}) {
  const filtered = places.filter(p => {
    const matchesCat = activeCategory === 'all' || p.category === activeCategory;
    const q = searchQuery.toLowerCase();
    const matchesQ = !q || p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q) || p.tags.some(t => t.toLowerCase().includes(q));
    return matchesCat && matchesQ;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-3 py-3 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-2.5 bg-white/[0.05] border border-white/[0.08] rounded-2xl px-3 py-2.5">
          <Search className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
          <input value={searchQuery} onChange={e => onSearchChange(e.target.value)}
            placeholder="Search places…"
            className="flex-1 bg-transparent text-[12px] text-white placeholder-slate-600 outline-none font-medium min-w-0" />
          {searchQuery && (
            <button onClick={() => onSearchChange('')} className="text-slate-600 hover:text-slate-400 transition-colors flex-shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Category pills */}
      <div className="flex gap-1.5 px-3 py-2 overflow-x-auto scrollbar-none border-b border-white/[0.05] flex-shrink-0">
        <button onClick={() => onCategoryChange('all')}
          className={cn('px-3 py-1.5 rounded-full text-[10px] font-bold flex-shrink-0 transition-all border',
            activeCategory === 'all' ? 'bg-primary-500 text-white border-primary-500 shadow-lg shadow-primary-500/25' : 'text-slate-400 border-white/[0.07] bg-white/[0.03] hover:border-white/[0.12]')}>
          All
        </button>
        {ALL_CATEGORIES.map(c => (
          <button key={c} onClick={() => onCategoryChange(c)}
            className={cn('px-3 py-1.5 rounded-full text-[10px] font-bold flex-shrink-0 transition-all border flex items-center gap-1',
              activeCategory === c ? 'text-white shadow-lg border-transparent' : 'text-slate-400 border-white/[0.07] bg-white/[0.03] hover:border-white/[0.12]')}
            style={activeCategory === c ? { backgroundColor: CAT[c].markerColor, boxShadow: `0 4px 16px ${CAT[c].markerColor}40` } : {}}>
            <span>{CAT[c].emoji}</span>
            <span>{CAT[c].label}</span>
          </button>
        ))}
      </div>

      {/* Status row */}
      <div className="px-4 py-2 flex items-center gap-2 flex-shrink-0">
        <p className="text-[10px] text-slate-600 font-semibold flex-1">{filtered.length} places</p>
        {loading && <Loader2 className="w-3 h-3 text-primary-400 animate-spin" />}
        {!loading && liveCount > 0 && (
          <span className="text-[9px] text-emerald-500 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full">
            +{liveCount} live
          </span>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto scrollbar-none">
        {filtered.map(p => {
          const cat = CAT[p.category];
          return (
            <button key={p.id} onClick={() => onSelect(p)}
              className="w-full flex items-start gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors border-b border-white/[0.03] text-left">
              <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-white/5">
                <img src={thumb(p.id, 0)} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                <div className="absolute bottom-0 right-0 w-5 h-5 rounded-tl-lg flex items-center justify-center text-[10px]"
                  style={{ backgroundColor: cat.markerColor + 'ee' }}>
                  {cat.emoji}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-bold text-white truncate">{p.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Stars rating={p.rating} />
                  <span className="text-[10px] text-yellow-400 font-bold">{p.rating}</span>
                  <span className="text-[9px] text-slate-600">·</span>
                  <PriceTag level={p.price} />
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5 truncate">{p.address}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={cn('text-[9px] font-bold', p.openNow ? 'text-emerald-400' : 'text-red-400')}>
                    {p.openNow ? '● Open' : '○ Closed'}
                  </span>
                  {p.monthlySpend > 0 && (
                    <>
                      <span className="text-[9px] text-slate-700">·</span>
                      <span className="text-[9px] text-primary-400 font-medium">~{formatCurrency(p.monthlySpend)}/mo</span>
                    </>
                  )}
                </div>
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center px-6">
            <Search className="w-8 h-8 text-slate-700 mb-3" />
            <p className="text-slate-500 text-sm font-medium">No places found</p>
            <p className="text-slate-700 text-xs mt-1">Try a different category or search term</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ANALYTICS TAB
// ─────────────────────────────────────────────
interface SpendRow {
  cat: Category; label: string; emoji: string; color: string;
  avgSpend: number; count: number; totalSpend: number;
}

function AnalyticsTab({ places }: { places: Place[] }) {
  const data: SpendRow[] = (Object.keys(CAT) as Category[])
    .map((cat): SpendRow | null => {
      const catPlaces = places.filter(p => p.category === cat && p.monthlySpend > 0);
      if (catPlaces.length === 0) return null;
      const avgSpend = Math.round(catPlaces.reduce((s: number, p: Place) => s + p.monthlySpend, 0) / catPlaces.length);
      return {
        cat, label: CAT[cat].label, emoji: CAT[cat].emoji, color: CAT[cat].markerColor,
        avgSpend, count: catPlaces.length,
        totalSpend: catPlaces.reduce((s: number, p: Place) => s + p.monthlySpend, 0),
      };
    })
    .filter((d): d is SpendRow => d !== null)
    .sort((a: SpendRow, b: SpendRow) => b.avgSpend - a.avgSpend);

  const totalMonthly = data.reduce((s: number, d: SpendRow) => s + d.avgSpend, 0);

  const downloadReport = () => {
    const lines = [
      'Category,Places,Avg Monthly ($),Avg Annual ($)',
      ...data.map((d: SpendRow) => `${d.label},${d.count},${d.avgSpend},${d.avgSpend * 12}`),
      `TOTAL,${places.filter(p => p.monthlySpend > 0).length},${totalMonthly},${totalMonthly * 12}`,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'chicago-loop-spending-report.csv';
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto scrollbar-none">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between flex-shrink-0">
        <div>
          <p className="text-white font-bold text-sm">Spending Analytics</p>
          <p className="text-slate-500 text-[10px]">Chicago Loop · {places.length} places analyzed</p>
        </div>
        <button onClick={downloadReport}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-500/10 border border-primary-500/30 rounded-xl text-primary-400 text-[10px] font-bold hover:bg-primary-500/20 transition-colors">
          <Download className="w-3 h-3" />
          Export CSV
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2 px-4 py-3 border-b border-white/[0.06]">
        {[
          { label: 'Monthly Est.', value: `$${totalMonthly.toLocaleString()}`, color: 'text-primary-400' },
          { label: 'Annual Est.',  value: `$${(totalMonthly * 12).toLocaleString()}`, color: 'text-amber-400' },
          { label: 'Categories',  value: `${data.length}`, color: 'text-white' },
        ].map((s, i) => (
          <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-2.5 text-center">
            <p className="text-[9px] text-slate-600 uppercase tracking-wide mb-0.5">{s.label}</p>
            <p className={cn('text-[13px] font-black', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div className="px-4 py-4 border-b border-white/[0.06]">
        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-3">Avg Monthly Spend by Category</p>
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: -22 }}>
            <XAxis dataKey="emoji" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} interval={0} />
            <YAxis tick={{ fontSize: 9, fill: '#475569' }} axisLine={false} tickLine={false}
              tickFormatter={v => `$${v}`} />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div style={{ background: '#0a0f1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '8px 12px' }}>
                    <p style={{ color: '#fff', fontWeight: 800, fontSize: 11 }}>{d.emoji} {d.label}</p>
                    <p style={{ color: '#818cf8', fontSize: 10 }}>~${d.avgSpend}/mo avg</p>
                    <p style={{ color: '#64748b', fontSize: 10 }}>{d.count} places tracked</p>
                  </div>
                );
              }}
            />
            <Bar dataKey="avgSpend" radius={[4, 4, 0, 0]}
              shape={(props: { x?: number; y?: number; width?: number; height?: number; index?: number }) => {
                const { x = 0, y = 0, width = 0, height = 0, index = 0 } = props;
                return <rect x={x} y={y} rx={4} ry={4} width={width} height={height} fill={data[index]?.color ?? '#6366f1'} fillOpacity={0.85} />;
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Breakdown table */}
      <div className="px-4 py-3">
        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2.5">Spending Breakdown</p>
        <div className="space-y-1.5">
          {data.map((d: SpendRow) => (
            <div key={d.cat} className="flex items-center gap-3 px-3 py-2 bg-white/[0.02] border border-white/[0.05] rounded-xl hover:bg-white/[0.04] transition-colors">
              <span className="text-sm flex-shrink-0">{d.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-white truncate">{d.label}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="h-1 rounded-full bg-white/[0.06] flex-1 max-w-[80px]">
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.round((d.avgSpend / data[0].avgSpend) * 100)}%`, backgroundColor: d.color, opacity: 0.8 }} />
                  </div>
                  <span className="text-[9px] text-slate-600">{d.count} places</span>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[11px] font-black text-primary-400">${d.avgSpend}/mo</p>
                <p className="text-[9px] text-slate-600">${(d.avgSpend * 12).toLocaleString()}/yr</p>
              </div>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="mt-3 p-3 bg-primary-500/10 border border-primary-500/20 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-white">Chicago Loop Total</p>
              <p className="text-[9px] text-slate-600 mt-0.5">Estimated lifestyle spend</p>
            </div>
            <div className="text-right">
              <p className="text-[14px] font-black text-primary-400">${totalMonthly.toLocaleString()}/mo</p>
              <p className="text-[10px] text-amber-400 font-bold">${(totalMonthly * 12).toLocaleString()}/yr</p>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-primary-500/20">
            <p className="text-[9px] text-slate-500 leading-relaxed">
              At {(COMBINED_TAX * 100).toFixed(1)}% combined IL tax rate, you'd need to earn ~${Math.round(totalMonthly / (1 - COMBINED_TAX)).toLocaleString()}/mo gross to cover Loop lifestyle expenses.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// AI ADVISOR TAB
// ─────────────────────────────────────────────
function AdvisorTab({ places }: { places: Place[] }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: "Hi! I'm Ana, your Chicago Loop financial advisor. I can help you analyze spending patterns, find budget-friendly options, and optimize your Loop lifestyle expenses. What would you like to know?",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    const next = [...messages, { role: 'user' as const, content: userMsg }];
    setMessages(next);
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/v1/chicago/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, context: { totalPlaces: places.length } }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I\'m having trouble connecting right now. Make sure the backend is running at localhost:8000.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    'Where should I eat for under $20?',
    'Best co-working spaces?',
    'How do I optimize my transit costs?',
    'What\'s the cheapest fitness option?',
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary-500/20 border border-primary-500/30 flex items-center justify-center">
            <Bot className="w-4 h-4 text-primary-400" />
          </div>
          <div>
            <p className="text-white font-bold text-sm">Ana — AI Advisor</p>
            <p className="text-slate-500 text-[10px]">Chicago Loop finance expert</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-none px-3 py-3 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={cn('flex gap-2 items-end', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
            <div className={cn('w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[9px] font-bold mb-0.5',
              msg.role === 'user' ? 'bg-primary-500/20 text-primary-400' : 'bg-white/10 text-slate-400')}>
              {msg.role === 'user' ? 'U' : '🤖'}
            </div>
            <div className={cn('max-w-[232px] px-3 py-2 text-[11px] leading-relaxed',
              msg.role === 'user'
                ? 'bg-primary-500/20 border border-primary-500/30 text-white rounded-2xl rounded-br-sm'
                : 'bg-white/[0.05] border border-white/[0.07] text-slate-300 rounded-2xl rounded-bl-sm')}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-2 items-end">
            <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 mb-0.5 text-[9px]">🤖</div>
            <div className="px-4 py-3 bg-white/[0.05] border border-white/[0.07] rounded-2xl rounded-bl-sm">
              <div className="flex gap-1 items-center">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick suggestions */}
      {messages.length === 1 && (
        <div className="px-3 pb-2 flex flex-wrap gap-1.5">
          {suggestions.map((s, i) => (
            <button key={i} onClick={() => { setInput(s); }}
              className="px-2.5 py-1 bg-white/[0.04] border border-white/[0.08] rounded-full text-[9px] text-slate-400 hover:text-white hover:border-white/[0.15] transition-colors">
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-3 pb-3 flex-shrink-0">
        <div className="flex gap-2 bg-white/[0.05] border border-white/[0.08] rounded-2xl px-3 py-2.5 focus-within:border-primary-500/40 transition-colors">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Ask about spending, budgets, deals…"
            className="flex-1 bg-transparent text-[11px] text-white placeholder-slate-600 outline-none min-w-0"
          />
          <button onClick={send} disabled={!input.trim() || loading}
            className={cn('w-7 h-7 rounded-xl flex items-center justify-center transition-colors flex-shrink-0',
              input.trim() && !loading ? 'bg-primary-500 text-white hover:bg-primary-400' : 'bg-white/5 text-slate-700')}>
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-center text-[9px] text-slate-700 mt-1.5">
          Built-in Loop advisor · Set ANTHROPIC_API_KEY for Claude claude-opus-4-6
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MAP LAYER CONTROLS
// ─────────────────────────────────────────────
function MapControls({ layers, onToggle, mapStyle, onStyleToggle, counts }: {
  layers: Record<string, boolean>; onToggle: (k: string) => void;
  mapStyle: 'dark' | 'light'; onStyleToggle: () => void;
  counts: Record<string, number>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col items-end gap-1.5">
      <button onClick={onStyleToggle}
        className="w-9 h-9 bg-[#050912]/95 backdrop-blur-xl border border-white/[0.09] rounded-xl shadow-2xl flex items-center justify-center text-slate-400 hover:text-white transition-colors">
        {mapStyle === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>
      <div className="relative">
        <button onClick={() => setOpen(p => !p)}
          className={cn('w-9 h-9 backdrop-blur-xl border rounded-xl shadow-2xl flex items-center justify-center transition-colors',
            open ? 'bg-primary-500/20 border-primary-500/40 text-primary-400' : 'bg-[#050912]/95 border-white/[0.09] text-slate-400 hover:text-white')}>
          <Layers className="w-4 h-4" />
        </button>
        <AnimatePresence>
          {open && (
            <motion.div initial={{ opacity: 0, scale: .92, y: -6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .92, y: -6 }}
              transition={{ duration: .15 }}
              className="absolute right-0 top-11 bg-[#050912]/98 backdrop-blur-2xl border border-white/[0.09] rounded-2xl p-3 shadow-2xl w-56 z-50">
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2.5 px-1">Layers</p>
              {[
                { k: 'ctaTrack',      l: 'CTA Loop Track',   c: '#f59e0b' },
                { k: 'neighborhoods', l: 'Spend Heatmap',    c: '#6366f1' },
                { k: 'restaurant',    l: 'Dining',           c: '#ef4444' },
                { k: 'coffee',        l: 'Coffee',           c: '#f59e0b' },
                { k: 'bar',           l: 'Bars & Nightlife', c: '#8b5cf6' },
                { k: 'parking',       l: 'Parking',          c: '#3b82f6' },
                { k: 'cta',           l: 'CTA Stations',     c: '#f59e0b' },
                { k: 'metra',         l: 'Metra Stations',   c: '#f97316' },
                { k: 'divvy',         l: 'Divvy Bikes',      c: '#84cc16' },
                { k: 'cowork',        l: 'Co-Working',       c: '#8b5cf6' },
                { k: 'financial',     l: 'Finance',          c: '#10b981' },
                { k: 'landmark',      l: 'Landmarks',        c: '#06b6d4' },
                { k: 'grocery',       l: 'Grocery',          c: '#22c55e' },
                { k: 'fitness',       l: 'Fitness',          c: '#ec4899' },
                { k: 'pharmacy',      l: 'Pharmacy',         c: '#38bdf8' },
              ].map(row => (
                <button key={row.k} onClick={() => onToggle(row.k)}
                  className="w-full flex items-center gap-3 px-2 py-1.5 rounded-xl hover:bg-white/[0.04] transition-colors">
                  <div className="w-4 h-4 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all"
                    style={layers[row.k] ? { backgroundColor: row.c, borderColor: row.c } : { borderColor: '#334155', backgroundColor: 'transparent' }}>
                    {layers[row.k] && <CheckCircle2 className="w-2.5 h-2.5 text-white" />}
                  </div>
                  <span className="text-[11px] font-medium text-white flex-1">{row.l}</span>
                  {counts[row.k] !== undefined && (
                    <span className="text-[9px] text-slate-600 font-semibold">{counts[row.k]}</span>
                  )}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────
export default function ChicagoHub() {
  const [mapInstance,    setMapInstance]    = useState<L.Map | null>(null);
  const [panelOpen,      setPanelOpen]      = useState(true);
  const [selectedPlace,  setSelectedPlace]  = useState<Place | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category | 'all'>('all');
  const [searchQuery,    setSearchQuery]    = useState('');
  const [mapStyle,       setMapStyle]       = useState<'dark' | 'light'>('dark');
  const [flyTo,          setFlyTo]          = useState<[number, number, number] | null>(null);
  const [userLoc,        setUserLoc]        = useState<[number, number] | null>(null);
  const [locating,       setLocating]       = useState(false);
  const [apiLoading,     setApiLoading]     = useState(true);
  const [livePlaces,     setLivePlaces]     = useState<Place[]>([]);
  const [apiError,       setApiError]       = useState<string | null>(null);
  const [photoModal,     setPhotoModal]     = useState<{ place: Place; startIdx: number; realPhotos: string[] } | null>(null);
  const [activeTab,      setActiveTab]      = useState<LeftTab>('places');
  const [layers, setLayers] = useState<Record<string, boolean>>({
    ctaTrack: true, neighborhoods: true,
    restaurant: true, coffee: true, bar: true, parking: true,
    cta: true, metra: true, cowork: true, financial: true,
    landmark: true, grocery: true, divvy: true, fitness: true, pharmacy: true,
  });

  // CSS injection
  useEffect(() => {
    const s = document.createElement('style'); s.id = 'nexora-hub';
    s.innerHTML = `
      @keyframes nxPulse { 0%{transform:scale(1);opacity:.9} 70%{transform:scale(2.6);opacity:0} 100%{transform:scale(2.6);opacity:0} }
      .nx-user { position:relative; width:24px; height:24px; display:flex; align-items:center; justify-content:center; }
      .nx-user .r { position:absolute; inset:0; border-radius:50%; background:rgba(59,130,246,.35); animation:nxPulse 2s ease-out infinite; }
      .nx-user .d { width:13px; height:13px; border-radius:50%; background:#3b82f6; border:2.5px solid white; box-shadow:0 0 0 3px rgba(59,130,246,.2),0 2px 8px rgba(59,130,246,.5); position:relative; z-index:1; }
      .leaflet-popup-content-wrapper { background:transparent!important; box-shadow:none!important; border-radius:0!important; padding:0!important; }
      .leaflet-popup-content { margin:0!important; }
      .leaflet-popup-tip-container,.leaflet-popup-close-button,.leaflet-control-zoom,.leaflet-control-attribution { display:none!important; }
      .scrollbar-none { scrollbar-width:none; }
      .scrollbar-none::-webkit-scrollbar { display:none; }
    `;
    if (!document.getElementById('nexora-hub')) document.head.appendChild(s);
    return () => document.getElementById('nexora-hub')?.remove();
  }, []);

  const fetchLivePlaces = useCallback(async () => {
    setApiLoading(true);
    setApiError(null);
    try {
      const res = await fetch('http://localhost:8000/api/v1/chicago/places');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const raw: any[] = data.places || [];
      const mapped: Place[] = raw
        .filter((p: any) => p.id && p.name && p.lat && p.lng && p.category && CAT[p.category as Category])
        .map((p: any): Place => ({
          id:           p.id,
          name:         p.name,
          category:     p.category as Category,
          lat:          p.lat,
          lng:          p.lng,
          rating:       p.rating ?? 4.0,
          reviews:      p.reviews ?? 100,
          price:        (p.price ?? 2) as 1 | 2 | 3 | 4,
          address:      p.address ?? 'Chicago, IL',
          hours:        p.hours ?? 'See Google Maps',
          openNow:      p.openNow ?? true,
          avgVisit:     p.avgVisit ?? 0,
          monthlySpend: p.monthlySpend ?? 0,
          tags:         Array.isArray(p.tags) ? p.tags : [],
          phone:        p.phone || undefined,
          source:       p.source ?? 'osm',
        }));
      setLivePlaces(mapped);
    } catch {
      setApiError('Live data unavailable — showing curated places');
    } finally {
      setApiLoading(false);
    }
  }, []);

  useEffect(() => { fetchLivePlaces(); }, [fetchLivePlaces]);

  const allPlaces = (() => {
    if (livePlaces.length === 0) return STATIC_PLACES;
    const live = livePlaces.filter(lp =>
      !STATIC_PLACES.some(sp => {
        const dlat = (sp.lat - lp.lat) * 111000;
        const dlng = (sp.lng - lp.lng) * 78000;
        return Math.sqrt(dlat * dlat + dlng * dlng) < 30;
      })
    );
    return [...STATIC_PLACES, ...live];
  })();

  // Layer counts for the legend
  const layerCounts: Record<string, number> = {};
  for (const p of allPlaces) layerCounts[p.category] = (layerCounts[p.category] ?? 0) + 1;

  const userIcon = L.divIcon({
    className: '',
    html: `<div class="nx-user"><div class="r"></div><div class="d"></div></div>`,
    iconSize: [24, 24], iconAnchor: [12, 12],
  });

  const handleLocate = useCallback(() => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const loc: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserLoc(loc); setFlyTo([loc[0], loc[1], 16]); setLocating(false);
      },
      () => { setFlyTo([LOOP_CENTER[0], LOOP_CENTER[1], 14]); setLocating(false); },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  const handleSelectPlace = useCallback((p: Place) => {
    setSelectedPlace(p);
    setActiveTab('places');
    setFlyTo([p.lat, p.lng, 17]);
  }, []);

  const handleToggleLayer = useCallback((k: string) => {
    setLayers(prev => ({ ...prev, [k]: !prev[k] }));
  }, []);

  const visiblePlaces = (() => {
    const layerFiltered = allPlaces.filter(p => layers[p.category]);
    if (activeCategory !== 'all') return layerFiltered.filter(p => p.category === activeCategory);
    const statics = layerFiltered.filter(p => p.source === 'static');
    const live = layerFiltered
      .filter(p => p.source !== 'static')
      .sort((a, b) => b.rating - a.rating)
      .slice(0, Math.max(0, 120 - statics.length));
    return [...statics, ...live];
  })();

  const mkPopup = (p: Place) => {
    const cat = CAT[p.category];
    return `
      <div style="background:#060a14;border:1px solid ${cat.markerColor}30;border-radius:14px;padding:10px 14px;min-width:210px;font-family:inherit;cursor:pointer">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <img src="https://picsum.photos/seed/${encodeURIComponent(p.id)}-0/80/80" style="width:44px;height:44px;border-radius:10px;object-fit:cover;flex-shrink:0"/>
          <div>
            <p style="font-weight:800;font-size:12px;color:#fff;margin:0;line-height:1.3">${p.name}</p>
            <p style="font-size:10px;color:${cat.markerColor};font-weight:700;margin:2px 0 0">${cat.emoji} ${cat.label}</p>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
          <span style="font-size:12px">⭐</span>
          <span style="font-size:11px;font-weight:800;color:#facc15">${p.rating}</span>
          <span style="font-size:10px;color:#475569">(${p.reviews.toLocaleString()})</span>
          <span style="font-size:10px;color:#475569">·</span>
          <span style="font-size:11px;font-weight:700;color:${p.openNow ? '#34d399' : '#f87171'}">${p.openNow ? '● Open' : '○ Closed'}</span>
        </div>
        <p style="font-size:10px;color:#475569;margin:0">${p.address}</p>
        ${p.monthlySpend > 0 ? `<p style="font-size:10px;color:#6366f1;margin:4px 0 0;font-weight:700">~$${p.monthlySpend}/mo spend</p>` : ''}
        <p style="font-size:9px;color:#334155;margin:6px 0 0;text-align:center">Click for details & photos</p>
      </div>`;
  };

  const TILE_DARK  = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
  const TILE_LIGHT = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

  const TAB_CONFIG = [
    { id: 'places'    as LeftTab, label: 'Places',     icon: MapPin        },
    { id: 'analytics' as LeftTab, label: 'Analytics',  icon: BarChart2     },
    { id: 'advisor'   as LeftTab, label: 'AI Advisor', icon: MessageSquare },
  ];

  return (
    <div className="flex -mx-6 -mt-6" style={{ height: 'calc(100vh - 64px)' }}>

      {/* ── LEFT PANEL ── */}
      <AnimatePresence initial={false}>
        {panelOpen && (
          <motion.div
            key="panel"
            initial={{ x: -360, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -360, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            className="flex-shrink-0 bg-[#060a14] border-r border-white/[0.06] shadow-2xl shadow-black/60 flex flex-col"
            style={{ width: 360, zIndex: 10, overflow: 'hidden' }}
          >
            {/* ── Panel header with tabs ── */}
            <div className="flex-shrink-0 border-b border-white/[0.06]">
              {/* Branding + live status */}
              <div className="px-4 pt-3 pb-0 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary-400" />
                  <span className="text-[13px] font-black text-white tracking-tight">Chicago Hub</span>
                  {!apiLoading && livePlaces.length > 0 && (
                    <span className="text-[8px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                      {allPlaces.length} places
                    </span>
                  )}
                </div>
                <span className="text-[9px] text-slate-600">Loop · Near North · River North</span>
              </div>

              {/* Tab bar */}
              <div className="flex px-3 pt-2">
                {TAB_CONFIG.map(tab => (
                  <button key={tab.id} onClick={() => { setActiveTab(tab.id); if (tab.id !== 'places') setSelectedPlace(null); }}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-bold border-b-2 transition-colors',
                      activeTab === tab.id
                        ? 'text-primary-400 border-primary-500'
                        : 'text-slate-600 border-transparent hover:text-slate-400',
                    )}>
                    <tab.icon className="w-3 h-3" />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Panel body ── */}
            <div className="flex-1 overflow-hidden">
              {activeTab === 'places' && (
                selectedPlace
                  ? <PlaceDetail
                      place={selectedPlace}
                      onBack={() => setSelectedPlace(null)}
                      onShowPhotos={(idx, photos) => setPhotoModal({ place: selectedPlace, startIdx: idx, realPhotos: photos })}
                    />
                  : <PlaceList
                      places={allPlaces}
                      onSelect={handleSelectPlace}
                      activeCategory={activeCategory}
                      onCategoryChange={setActiveCategory}
                      searchQuery={searchQuery}
                      onSearchChange={setSearchQuery}
                      loading={apiLoading}
                      liveCount={livePlaces.length}
                    />
              )}
              {activeTab === 'analytics' && <AnalyticsTab places={allPlaces} />}
              {activeTab === 'advisor'   && <AdvisorTab places={allPlaces} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Panel toggle tab */}
      <div className="flex-shrink-0 flex items-center" style={{ zIndex: 10 }}>
        <button onClick={() => setPanelOpen(p => !p)}
          className="h-20 w-5 bg-[#060a14] border border-l-0 border-white/[0.06] rounded-r-xl flex items-center justify-center text-slate-600 hover:text-slate-300 transition-colors shadow-xl">
          <ChevronLeft className={cn('w-3 h-3 transition-transform', !panelOpen && 'rotate-180')} />
        </button>
      </div>

      {/* ── MAP ── */}
      <div className="flex-1 relative overflow-hidden">
        <MapContainer center={LOOP_CENTER} zoom={14} zoomControl={false} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
          <TileLayer url={mapStyle === 'dark' ? TILE_DARK : TILE_LIGHT} attribution="" maxZoom={19} />
          <MapCapture onReady={setMapInstance} />
          <FlyTo target={flyTo} />

          {layers.ctaTrack && (
            <Polyline positions={CTA_LOOP_TRACK} pathOptions={{ color: '#f59e0b', weight: 4, opacity: .9, dashArray: '10 6' }} />
          )}

          {layers.neighborhoods && [
            { lat: 41.8827, lng: -87.6468, color: '#6366f1', r: 60 },
            { lat: 41.8939, lng: -87.6337, color: '#8b5cf6', r: 45 },
            { lat: 41.8948, lng: -87.6243, color: '#06b6d4', r: 44 },
            { lat: 41.8647, lng: -87.6244, color: '#f59e0b', r: 36 },
            { lat: 41.8827, lng: -87.6233, color: '#f43f5e', r: 30 },
          ].map((h, i) => (
            <CircleMarker key={`h${i}`} center={[h.lat, h.lng]} radius={h.r}
              pathOptions={{ color: 'transparent', fillColor: h.color, fillOpacity: .07, weight: 0 }} interactive={false} />
          ))}

          {visiblePlaces.map(p => {
            const cat = CAT[p.category];
            const isSelected = selectedPlace?.id === p.id;
            return (
              <CircleMarker key={p.id} center={[p.lat, p.lng]}
                radius={isSelected ? 11 : (p.category === 'restaurant' || p.category === 'bar') ? 8 : 7}
                pathOptions={{ color: isSelected ? '#fff' : cat.markerColor, fillColor: cat.markerColor, fillOpacity: isSelected ? 1 : 0.85, weight: isSelected ? 3 : 1.5 }}
                eventHandlers={{ click: () => handleSelectPlace(p) }}>
                <Popup>
                  <div dangerouslySetInnerHTML={{ __html: mkPopup(p) }} onClick={() => handleSelectPlace(p)} />
                </Popup>
              </CircleMarker>
            );
          })}

          {userLoc && <Marker position={userLoc} icon={userIcon} />}
        </MapContainer>

        {/* ── TOP-RIGHT: Layer controls ── */}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5" style={{ zIndex: 1000, pointerEvents: 'all' }}>
          <MapControls
            layers={layers}
            onToggle={handleToggleLayer}
            mapStyle={mapStyle}
            onStyleToggle={() => setMapStyle(p => p === 'dark' ? 'light' : 'dark')}
            counts={layerCounts}
          />
        </div>

        {/* ── BOTTOM-RIGHT: Zoom + locate ── */}
        <div className="absolute bottom-6 right-3 flex flex-col gap-1.5" style={{ zIndex: 1000, pointerEvents: 'all' }}>
          {[
            { icon: <Plus className="w-4 h-4" />,        fn: () => mapInstance?.zoomIn(),                         title: 'Zoom in'    },
            { icon: <Minus className="w-4 h-4" />,       fn: () => mapInstance?.zoomOut(),                        title: 'Zoom out'   },
            { icon: <LocateFixed className="w-4 h-4" />, fn: handleLocate,                                         title: 'My location', pulse: locating, accent: true },
            { icon: <Navigation className="w-4 h-4" />,  fn: () => setFlyTo([LOOP_CENTER[0], LOOP_CENTER[1], 14]), title: 'Reset view' },
            { icon: <RefreshCw className={cn('w-4 h-4', apiLoading && 'animate-spin')} />, fn: fetchLivePlaces,   title: 'Refresh live data' },
          ].map((b, i) => (
            <button key={i} onClick={b.fn} title={b.title}
              className={cn(
                'w-9 h-9 bg-[#050912]/95 backdrop-blur-xl border border-white/[0.09] rounded-xl flex items-center justify-center transition-colors shadow-2xl',
                b.accent ? (b.pulse ? 'text-primary-400 border-primary-500/40 animate-pulse' : 'text-primary-400 hover:text-primary-300') : 'text-slate-400 hover:text-white',
              )}>
              {b.icon}
            </button>
          ))}
        </div>

        {/* ── API Loading / error toast ── */}
        <AnimatePresence>
          {(apiLoading && livePlaces.length === 0) || apiError ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2.5 bg-[#050912]/95 backdrop-blur-xl border border-white/[0.09] rounded-2xl px-4 py-2.5 shadow-2xl"
              style={{ zIndex: 1000, pointerEvents: 'none' }}>
              {apiLoading
                ? <Loader2 className="w-3.5 h-3.5 text-primary-400 animate-spin flex-shrink-0" />
                : <span className="text-amber-400 text-xs flex-shrink-0">⚠</span>}
              <span className="text-[11px] text-slate-300 font-semibold">
                {apiError ?? 'Loading live places from OpenStreetMap, Divvy & CTA…'}
              </span>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* ── PHOTO MODAL — outside panel motion.div to escape its stacking context ── */}
      {photoModal && (
        <PhotoModal
          place={photoModal.place}
          initialIdx={photoModal.startIdx}
          realPhotos={photoModal.realPhotos}
          onClose={() => setPhotoModal(null)}
        />
      )}
    </div>
  );
}
