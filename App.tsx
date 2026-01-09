
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MineLocation, ChatMode, Message, LocalityType } from './types';
import { fetchAndParseKml } from './services/kmlService';
import { GeminiService } from './services/geminiService';
import { MineralService } from './services/mineralService';
import { Type } from '@google/genai';

declare const L: any;

const BASE_LAYERS = {
  osm: { name: "OpenStreetMap", url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: '&copy; OpenStreetMap contributors' },
  osmDe: { name: "OpenStreetMap.de", url: "https://{s}.tile.openstreetmap.de/{z}/{x}/{y}.png", attribution: '&copy; OpenStreetMap contributors' },
  esriTopo: { name: "Esri WorldTopo", url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}", attribution: 'Tiles &copy; Esri' },
  esriNatGeo: { name: "Esri NatGeo", url: "https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}", attribution: 'Tiles &copy; Esri &mdash; National Geographic' },
  openTopo: { name: "OpenTopoMap", url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", attribution: 'Map data: &copy; OSM contributors, SRTM | Map style: &copy; OpenTopoMap' },
  franceSat: { name: "GeoportailFrance Satellite", url: "https://wxs.ign.fr/choisirgeoportail/geoportail/wmts?REQUEST=GetTile&SERVICE=WMTS&VERSION=1.0.0&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/jpeg&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}", attribution: '&copy; IGN' },
  esriSat: { name: "Esri Satellite", url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attribution: 'Tiles &copy; Esri' },
  esriHistoric: { name: "Esri Historic", url: "https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/46505/{z}/{y}/{x}", attribution: 'Tiles &copy; Esri' },
  usgsTopo: { name: "USGS Topo", url: "https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}", attribution: 'USGS' }
};

const OVERLAYS = {
  hillshading: { name: "HikeBike HillShading", url: "https://tiles.wmflabs.org/hillshading/{z}/{x}/{y}.png", attribution: 'Hike & Bike' },
  geology: { name: "Macrostrat Geology", url: "https://tiles.macrostrat.org/carto/{z}/{x}/{y}.png", attribution: 'Macrostrat' },
  geonames: { name: "GeoNames Labels", url: "https://stamen-tiles-{s}.a.ssl.fastly.net/terrain-labels/{z}/{x}/{y}.png", attribution: 'Stamen' },
  blm: { name: "BLM Land Status", url: "https://tiles.arcgis.com/tiles/v01bP9833re8Fv9B/arcgis/rest/services/Surface_Management_Agency/MapServer/tile/{z}/{y}/{x}", attribution: 'BLM' }
};

const LEGEND_ITEMS: { type: LocalityType; label: string; glyph: string; color: string }[] = [
  { type: 'mine', label: 'Mindat.org Localities', glyph: 'fa-hammer', color: '#ef4444' },
  { type: 'paleobiodb', label: 'PBDB Localities', glyph: 'fa-shrimp', color: '#3b82f6' },
  { type: 'geology', label: 'Geology Features', glyph: 'fa-gem', color: '#8b5cf6' },
  { type: 'protected', label: 'Parks/Protected', glyph: 'fa-tree', color: '#22c55e' },
  { type: 'meteorite', label: 'Meteorite Sites', glyph: 'fa-meteor', color: '#f59e0b' },
  { type: 'settlement', label: 'Settlements', glyph: 'fa-house-chimney', color: '#ec4899' },
  { type: 'museum', label: 'Museums', glyph: 'fa-landmark', color: '#14b8a6' },
  { type: 'other', label: 'Other Locality', glyph: 'fa-location-dot', color: '#64748b' }
];

interface MineralSpecimen {
  name: string;
  description: string;
  imageUrl?: string;
}

const ElevationWidget: React.FC<{ lat: number; lng: number }> = ({ lat, lng }) => {
  const [elevation, setElevation] = useState<number | null>(null);
  useEffect(() => {
    setElevation(null);
    fetch(`https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lng}`)
      .then(res => res.json())
      .then(data => data.results && setElevation(data.results[0].elevation))
      .catch(() => {});
  }, [lat, lng]);

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-2xl">
      <div className="flex justify-between items-center text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
        <span>Site Elevation</span>
        <span className="text-amber-500">{elevation !== null ? `${elevation}m MSL` : 'Scanning...'}</span>
      </div>
      <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
        <div className="h-full bg-amber-500 transition-all duration-1000 shadow-[0_0_10px_rgba(245,158,11,0.5)]" style={{ width: elevation ? '100%' : '15%' }}></div>
      </div>
    </div>
  );
};

const getLocalityIcon = (type: LocalityType) => {
  const item = LEGEND_ITEMS.find(i => i.type === type) || LEGEND_ITEMS[7];
  const html = `
    <div style="width:34px; height:34px; display:flex; align-items:center; justify-content:center; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.6));">
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="position:absolute; width:100%; height:100%;">
        <path d="M50 5 L93.3 30 L93.3 70 L50 95 L6.7 70 L6.7 30 Z" fill="${item.color}" stroke="#000" stroke-width="6"/>
      </svg>
      <i class="fa-solid ${item.glyph}" style="position:relative; z-index:10; color:#fff; font-size:14px;"></i>
    </div>
  `;
  return L.divIcon({ html, className: 'marker-icon', iconSize: [34, 34], iconAnchor: [17, 17] });
};

const App: React.FC = () => {
  const [locations, setLocations] = useState<MineLocation[]>([]);
  const [selected, setSelected] = useState<MineLocation | null>(null);
  const [activeBase, setActiveBase] = useState('osm');
  const [activeOverlays, setActiveOverlays] = useState<Record<string, boolean>>({ geology: true, hillshading: false, blm: true, geonames: true });
  const [overlayOpacities, setOverlayOpacities] = useState<Record<string, number>>({ geology: 0.6, hillshading: 0.6, blm: 0.6, geonames: 0.8 });
  const [visibleCategories, setVisibleCategories] = useState<Record<string, boolean>>({
    mine: true, paleobiodb: true, geology: true, protected: true, meteorite: true, settlement: true, museum: true, other: true
  });
  
  const [isChat, setIsChat] = useState(false);
  const [isLayers, setIsLayers] = useState(false);
  const [isLegendOpen, setIsLegendOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [siteMinerals, setSiteMinerals] = useState<MineralSpecimen[]>([]);
  const [isFetchingMinerals, setIsFetchingMinerals] = useState(false);
  const [search, setSearch] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const mapRef = useRef<any>(null);
  const layersRef = useRef<Record<string, any>>({});
  const clusterRef = useRef<any>(null);
  const geminiRef = useRef<GeminiService | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const mineralService = MineralService.getInstance();

  useEffect(() => {
    geminiRef.current = new GeminiService();
    const initialize = async () => {
      try {
        await mineralService.loadMineralList();
        const data = await fetchAndParseKml();
        setLocations(data);
      } catch (err) {
        console.error("Initialization Failed", err);
      } finally {
        setIsLoading(false);
      }
    };
    initialize();

    if (!mapRef.current) {
      mapRef.current = L.map('map-container', { 
        zoomControl: false,
        maxZoom: 19,
        minZoom: 2
      }).setView([39.8283, -98.5795], 4);
      
      L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);
      
      Object.entries(BASE_LAYERS).forEach(([k, v]) => {
        layersRef.current[k] = L.tileLayer(v.url, { 
          maxZoom: 19, 
          attribution: (v as any).attribution 
        });
      });
      Object.entries(OVERLAYS).forEach(([k, v]) => {
        layersRef.current[k] = L.tileLayer(v.url, { 
          opacity: overlayOpacities[k], 
          maxZoom: 19,
          attribution: (v as any).attribution
        });
      });

      clusterRef.current = L.markerClusterGroup({ 
        maxClusterRadius: 45,
        disableClusteringAtZoom: 16
      }).addTo(mapRef.current);
    }
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    Object.keys(BASE_LAYERS).forEach(k => {
      if (k === activeBase) {
        if (!mapRef.current.hasLayer(layersRef.current[k])) {
          mapRef.current.addLayer(layersRef.current[k]);
        }
      } else {
        mapRef.current.removeLayer(layersRef.current[k]);
      }
    });
    
    Object.keys(OVERLAYS).forEach(k => {
      const layer = layersRef.current[k];
      if (activeOverlays[k]) {
        if (!mapRef.current.hasLayer(layer)) mapRef.current.addLayer(layer);
        layer.setOpacity(overlayOpacities[k]);
      } else {
        mapRef.current.removeLayer(layer);
      }
    });
  }, [activeBase, activeOverlays, overlayOpacities]);

  useEffect(() => {
    if (!clusterRef.current) return;
    clusterRef.current.clearLayers();
    const filtered = locations.filter(loc => visibleCategories[loc.type] !== false);
    
    filtered.forEach(loc => {
      const m = L.marker([loc.coordinates.lat, loc.coordinates.lng], { icon: getLocalityIcon(loc.type) });
      m.on('click', () => setSelected(loc));
      clusterRef.current.addLayer(m);
    });
  }, [locations, visibleCategories]);

  useEffect(() => {
    if (selected && geminiRef.current) {
      setSiteMinerals([]);
      setIsFetchingMinerals(true);
      const prompt = `Identify 4 major minerals or fossils at the site: "${selected.name}". Data context: ${selected.description.substring(0, 500)}. JSON array with 'name' and 'description' properties.`;
      const schema = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: { name: { type: Type.STRING }, description: { type: Type.STRING } },
          required: ["name", "description"]
        }
      };
      geminiRef.current.generateStructuredResponse(prompt, schema).then(res => {
        setSiteMinerals(res.map((s: any) => ({ ...s, imageUrl: mineralService.getImageUrl(s.name) || undefined })));
      }).catch(() => setSiteMinerals([])).finally(() => setIsFetchingMinerals(false));
      
      // Clear messages when changing locality context to ensure clean audits
      setMessages([]);
    }
  }, [selected]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isBusy) return;
    const txt = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: txt }]);
    setIsBusy(true);

    // Pass 'selected' as context to Gemini Service
    const history = messages.map(m => ({ role: m.role, parts: [{ text: m.text }] }));
    const res = await geminiRef.current!.generateChatResponse(
      txt, 
      ChatMode.SEARCH, 
      history, 
      selected || undefined
    );

    setMessages(prev => [...prev, { role: 'model', text: res.text, groundingLinks: res.links }]);
    setIsBusy(false);
  };

  useEffect(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages]);

  const handleOpacityChange = (key: string, val: number) => {
    setOverlayOpacities(prev => ({ ...prev, [key]: val }));
  };

  const toggleCategory = (cat: string) => {
    setVisibleCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const openAuditTerminal = () => {
    setIsChat(true);
    // Visual header or first message can be adjusted here if needed
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans select-none">
      
      {isLoading && (
        <div className="fixed inset-0 z-[5000] bg-slate-950 flex flex-col items-center justify-center space-y-6">
          <div className="w-20 h-20 border-4 border-amber-500/10 border-t-amber-500 rounded-full animate-spin shadow-[0_0_40px_rgba(245,158,11,0.2)]"></div>
          <div className="text-center">
            <h2 className="text-sm font-black uppercase tracking-[0.5em] text-white">GeoClaim PRO</h2>
            <p className="text-[10px] font-bold text-slate-500 uppercase mt-3">Syncing US Localities Data Stack</p>
          </div>
        </div>
      )}

      <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 z-[200] shadow-[0_10px_40px_rgba(0,0,0,0.5)] shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center shadow-[0_0_25px_rgba(245,158,11,0.4)] transition-transform hover:scale-110">
            <i className="fa-solid fa-earth-americas text-slate-950 text-xl"></i>
          </div>
          <h1 className="text-sm font-black uppercase tracking-tight">GeoClaim <span className="text-amber-500">PRO</span></h1>
        </div>

        <form onSubmit={e => { e.preventDefault(); fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${search}`).then(r => r.json()).then(d => d[0] && mapRef.current.flyTo([d[0].lat, d[0].lon], 12)); }} className="flex-1 max-w-xl mx-8 relative hidden md:block">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Navigate to any US locality..." className="w-full bg-slate-950 border border-slate-700 rounded-2xl py-2.5 px-5 pl-12 text-xs focus:border-amber-500 outline-none transition-all shadow-inner" />
          <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"></i>
        </form>

        <div className="flex gap-3">
          <button onClick={() => setIsLayers(!isLayers)} className={`p-3 border rounded-2xl transition-all shadow-lg ${isLayers ? 'bg-amber-500 border-amber-500 text-slate-950' : 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-white'}`}>
            <i className="fa-solid fa-layer-group text-lg"></i>
          </button>
          <button onClick={() => setIsChat(!isChat)} className={`px-6 py-3 rounded-2xl text-xs font-black uppercase transition-all shadow-xl active:scale-95 ${isChat ? 'bg-amber-500 text-slate-950' : 'bg-white text-slate-950'}`}>Audit Log</button>
        </div>
      </header>

      <main className="flex-1 relative overflow-hidden">
        <div id="map-container" className="absolute inset-0 z-10" />

        <div className={`absolute top-6 left-6 z-[100] transition-all duration-500 ${isLegendOpen ? 'w-64 opacity-100' : 'w-12 opacity-80'}`}>
          <div className="bg-slate-900/95 backdrop-blur-3xl border border-slate-800 rounded-3xl p-5 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
            <div className="flex justify-between items-center mb-5 border-b border-slate-800 pb-3">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">{isLegendOpen ? 'Data Categories' : ''}</span>
              <button onClick={() => setIsLegendOpen(!isLegendOpen)} className="text-amber-500 hover:scale-125 transition-transform">
                <i className={`fa-solid ${isLegendOpen ? 'fa-minus' : 'fa-list-ul'}`}></i>
              </button>
            </div>
            {isLegendOpen && (
              <div className="space-y-3.5 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                {LEGEND_ITEMS.map(l => (
                  <button key={l.type} onClick={() => toggleCategory(l.type)} className={`flex items-center gap-4 group w-full text-left transition-all ${visibleCategories[l.type] !== false ? 'opacity-100' : 'opacity-30 grayscale'}`}>
                    <div className="w-6 h-6 flex items-center justify-center rounded-lg shadow-xl" style={{ backgroundColor: l.color }}>
                      <i className={`fa-solid ${l.glyph} text-[10px] text-white`}></i>
                    </div>
                    <span className="text-[11px] font-black uppercase text-slate-300 tracking-tight group-hover:text-white">{l.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {selected && (
          <div className="absolute bottom-0 left-0 w-full z-[300] p-0 sm:p-6 pointer-events-none">
            <div className="bg-slate-900 border-t sm:border border-slate-700 rounded-t-[3rem] sm:rounded-[3.5rem] shadow-[0_-30px_120px_rgba(0,0,0,0.95)] w-full max-w-7xl mx-auto pointer-events-auto max-h-[85vh] sm:max-h-[85vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-700">
              <div className="h-2 w-20 bg-slate-800 rounded-full mx-auto my-5 sm:hidden shrink-0"></div>
              
              <div className="overflow-y-auto custom-scrollbar p-8 sm:p-12 flex-1">
                <div className="flex flex-col lg:flex-row gap-12">
                  <div className="flex-1 space-y-10">
                    <div className="flex justify-between items-start">
                      <div className="pr-12">
                        <div className="flex items-center gap-3 mb-3 flex-wrap">
                          <span className="bg-amber-500 text-slate-950 text-[10px] font-black uppercase px-3 py-1.5 rounded-xl border border-amber-500/20">{selected.type}</span>
                          <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                            <i className="fa-solid fa-id-card"></i> Locality Entry
                          </span>
                        </div>
                        <h2 className="text-5xl sm:text-7xl font-black uppercase text-white leading-[0.8] break-words drop-shadow-2xl">{selected.name}</h2>
                      </div>
                      <button onClick={() => setSelected(null)} className="p-4 text-slate-500 hover:text-white transition-all bg-slate-950 rounded-full border border-slate-800 shrink-0 shadow-2xl hover:rotate-90">
                        <i className="fa-solid fa-xmark text-4xl"></i>
                      </button>
                    </div>

                    <div className="bg-slate-950 p-8 rounded-[2.5rem] border border-slate-800 shadow-inner">
                      <h3 className="text-[11px] font-black text-slate-600 uppercase mb-4 tracking-widest flex items-center gap-2 border-b border-slate-800 pb-2">
                        <i className="fa-solid fa-info-circle text-amber-500"></i> Locality Information
                      </h3>
                      <div 
                        className="text-sm font-bold text-slate-300 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto custom-scrollbar"
                        dangerouslySetInnerHTML={{ __html: selected.description || "No specific locality metadata provided in dataset." }}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="bg-slate-950 p-8 rounded-[2.5rem] border border-slate-800 shadow-inner group hover:border-amber-500/30 transition-all duration-500">
                        <div className="text-[11px] font-black text-slate-600 uppercase mb-3 tracking-[0.2em] flex items-center gap-2">
                          <i className="fa-solid fa-layer-group text-amber-500"></i> Geology/Deposit
                        </div>
                        <div className="text-lg font-black text-slate-100">{selected.depositType}</div>
                      </div>
                      <div className="bg-slate-950 p-8 rounded-[2.5rem] border border-slate-800 shadow-inner group hover:border-amber-500/30 transition-all duration-500">
                        <div className="text-[11px] font-black text-slate-600 uppercase mb-3 tracking-[0.2em] flex items-center gap-2">
                          <i className="fa-solid fa-trowel text-amber-500"></i> Extraction Method
                        </div>
                        <div className="text-lg font-black text-slate-100">{selected.miningMethod}</div>
                      </div>
                    </div>

                    <div className="space-y-8">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                        <h3 className="text-sm font-black text-white uppercase tracking-[0.3em] flex items-center gap-3">
                          <i className="fa-solid fa-gem text-amber-500"></i> Minerals & Fossil Catalog
                        </h3>
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                        {isFetchingMinerals ? [...Array(4)].map((_, i) => <div key={i} className="h-60 bg-slate-800/20 rounded-[2.5rem] animate-pulse"></div>) :
                          siteMinerals.map((m, i) => (
                            <div key={i} className="bg-slate-950 rounded-[2.5rem] border border-slate-800 overflow-hidden group hover:border-amber-500 transition-all shadow-2xl flex flex-col hover:-translate-y-2 duration-500">
                              <div className="h-44 bg-slate-900 flex items-center justify-center relative overflow-hidden shrink-0">
                                {m.imageUrl ? (
                                  <img src={m.imageUrl} alt={m.name} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-110 transition-all duration-1000" />
                                ) : (
                                  <div className="flex flex-col items-center gap-3 text-slate-800 opacity-40">
                                    <i className="fa-solid fa-microscope text-5xl"></i>
                                    <span className="text-[9px] font-black uppercase tracking-widest">No Image</span>
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-transparent to-transparent"></div>
                                <div className="absolute bottom-4 left-5 right-5">
                                  <h4 className="text-[12px] font-black uppercase text-amber-500 truncate drop-shadow-md">{m.name}</h4>
                                </div>
                              </div>
                              <div className="p-6 flex-1">
                                <p className="text-[11px] text-slate-500 font-bold leading-relaxed line-clamp-4">{m.description}</p>
                              </div>
                            </div>
                          ))
                        }
                      </div>
                    </div>
                  </div>

                  <div className="w-full lg:w-96 space-y-8 shrink-0">
                    <button onClick={openAuditTerminal} className="w-full bg-amber-500 py-8 rounded-[2.5rem] text-slate-950 font-black uppercase text-sm flex items-center justify-center gap-3 shadow-2xl hover:bg-amber-400 active:scale-95 transition-all">
                      <i className="fa-solid fa-search-location text-2xl"></i> Run Geological Audit
                    </button>
                    <ElevationWidget lat={selected.coordinates.lat} lng={selected.coordinates.lng} />
                    <div className="bg-slate-950 p-8 rounded-[2.5rem] border border-slate-800 space-y-6 shadow-inner">
                      <div className="flex justify-between items-center text-[11px] font-black text-slate-600 uppercase border-b border-slate-800 pb-4 tracking-widest">
                        <span>Spatial Geodesy</span>
                        <i className="fa-solid fa-crosshairs text-amber-500"></i>
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded-2xl">
                          <span className="text-[10px] font-black text-slate-500">LATITUDE</span>
                          <span className="text-sm font-mono font-black text-white">{selected.coordinates.lat.toFixed(6)}</span>
                        </div>
                        <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded-2xl">
                          <span className="text-[10px] font-black text-slate-500">LONGITUDE</span>
                          <span className="text-sm font-mono font-black text-white">{selected.coordinates.lng.toFixed(6)}</span>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setSelected(null)} className="w-full bg-slate-800 text-slate-400 py-5 rounded-[2rem] text-[11px] font-black uppercase border border-slate-700 hover:text-white hover:bg-slate-700 transition-all">Collapse Report</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className={`fixed inset-0 sm:inset-auto sm:top-0 sm:right-0 sm:h-full w-full sm:w-96 bg-slate-900/98 backdrop-blur-3xl border-l border-slate-800 z-[450] flex flex-col transition-transform duration-700 shadow-[-30px_0_120px_rgba(0,0,0,1)] ${isLayers ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="p-8 border-b border-slate-800 bg-slate-900/90 flex justify-between items-center shrink-0">
            <h3 className="text-xs font-black uppercase tracking-[0.5em] text-amber-500">Cartography Suite</h3>
            <button onClick={() => setIsLayers(false)} className="text-slate-500 hover:text-white transition-colors"><i className="fa-solid fa-xmark text-4xl"></i></button>
          </div>
          <div className="flex-1 overflow-y-auto p-8 space-y-12 custom-scrollbar">
            
            <section>
              <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-6 border-l-4 border-amber-500 pl-4">Map Engines</h4>
              <div className="grid grid-cols-1 gap-2.5">
                {Object.entries(BASE_LAYERS).map(([k, v]) => (
                  <button key={k} onClick={() => setActiveBase(k)} className={`w-full text-left p-4 rounded-xl text-[11px] font-black uppercase transition-all flex justify-between items-center ${activeBase === k ? 'bg-amber-500 text-slate-950 shadow-2xl' : 'bg-slate-950 text-slate-400 border border-slate-800 hover:bg-slate-800 hover:text-slate-200'}`}>
                    <span>{v.name}</span>
                    {activeBase === k && <i className="fa-solid fa-check-circle"></i>}
                  </button>
                ))}
              </div>
            </section>
            
            <section>
              <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-6 border-l-4 border-amber-500 pl-4">Geospatial Overlays</h4>
              <div className="space-y-6">
                {Object.entries(OVERLAYS).map(([k, v]) => (
                  <div key={k} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 shadow-xl">
                    <div className="flex justify-between items-center mb-3">
                      <button onClick={() => setActiveOverlays(p => ({ ...p, [k]: !p[k] }))} className={`flex items-center gap-3 text-[11px] font-black uppercase ${activeOverlays[k] ? 'text-amber-500' : 'text-slate-600'}`}>
                        <i className={`fa-solid ${activeOverlays[k] ? 'fa-check-square' : 'fa-square opacity-20'}`}></i>
                        {v.name}
                      </button>
                      <span className="text-[9px] font-bold text-slate-600 tracking-widest">{Math.round(overlayOpacities[k] * 100)}%</span>
                    </div>
                    <input 
                      type="range" min="0" max="1" step="0.05" 
                      value={overlayOpacities[k]} 
                      onChange={(e) => handleOpacityChange(k, parseFloat(e.target.value))} 
                      className="w-full accent-amber-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-6 border-l-4 border-amber-500 pl-4">Registry Filtering</h4>
              <div className="grid grid-cols-2 gap-2">
                {LEGEND_ITEMS.map(l => (
                  <button key={l.type} onClick={() => toggleCategory(l.type)} className={`flex items-center gap-3 p-3 rounded-xl border text-[9px] font-black uppercase transition-all ${visibleCategories[l.type] !== false ? 'bg-slate-800 border-amber-500 text-white shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-700'}`}>
                    <i className={`fa-solid ${l.glyph}`} style={{ color: visibleCategories[l.type] !== false ? l.color : '#334155' }}></i>
                    <span className="truncate">{l.label.split('.')[0]}</span>
                  </button>
                ))}
              </div>
            </section>

            <div className="pt-6 border-t border-slate-800 opacity-40">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-relaxed">
                DATA SOURCES: MINDAT, PBDB, USGS, ESRI GIS, IGN FRANCE, MACROSTRAT.
              </p>
            </div>
          </div>
        </div>

        <div className={`fixed inset-0 sm:inset-auto sm:top-0 sm:left-0 sm:h-full w-full sm:w-[600px] bg-slate-950 z-[460] border-r border-slate-800 shadow-2xl transition-transform duration-700 flex flex-col ${isChat ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="p-8 border-b border-slate-800 bg-slate-900/90 backdrop-blur-2xl flex justify-between items-center shrink-0 shadow-lg">
            <div className="flex items-center gap-4">
              <i className="fa-solid fa-satellite-dish text-amber-500 text-2xl"></i>
              <div className="flex flex-col">
                <h2 className="text-[12px] font-black uppercase tracking-[0.5em] text-white">Geological Intelligence</h2>
                {selected && (
                   <span className="text-[9px] font-black uppercase text-amber-500 tracking-widest animate-pulse mt-1">Target: {selected.name}</span>
                )}
              </div>
            </div>
            <button onClick={() => setIsChat(false)} className="text-slate-400 hover:text-white transition-colors"><i className="fa-solid fa-xmark text-4xl"></i></button>
          </div>
          <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.04),transparent)]">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-8 opacity-40 grayscale">
                <i className="fa-solid fa-microscope text-9xl text-amber-500 animate-pulse"></i>
                <div className="space-y-3">
                  <p className="text-[14px] font-black uppercase tracking-[0.2em]">Audit Terminal Online</p>
                  <p className="text-[11px] font-bold text-slate-600 max-w-[320px]">
                    {selected 
                      ? `Researching ownership and historical records for ${selected.name}...` 
                      : "Input coordinates or site names for historical geological analysis."}
                  </p>
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[95%] p-8 rounded-[3rem] text-[15px] font-bold leading-relaxed shadow-2xl relative ${m.role === 'user' ? 'bg-amber-500 text-slate-950 rounded-tr-none' : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none'}`}>
                  {m.text}
                  {m.role === 'model' && (
                    <button onClick={() => geminiRef.current?.speakText(m.text)} className="absolute -top-4 -right-4 w-12 h-12 bg-slate-800 border-2 border-slate-700 rounded-full flex items-center justify-center text-amber-500 hover:scale-110 active:scale-90 transition-all shadow-2xl">
                      <i className="fa-solid fa-ear-listen text-lg"></i>
                    </button>
                  )}
                  {m.groundingLinks && m.groundingLinks.length > 0 && (
                    <div className="mt-8 pt-8 border-t border-slate-800/50 space-y-4">
                      <div className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-3">
                        <i className="fa-solid fa-link text-amber-500"></i> Citations
                      </div>
                      <div className="flex flex-col gap-3">
                        {m.groundingLinks.map((l, li) => (
                          <a key={li} href={l.uri} target="_blank" className="flex items-center gap-4 text-amber-500 hover:text-amber-400 underline text-[11px] transition-all group">
                            <i className="fa-solid fa-external-link-alt text-[9px] group-hover:rotate-45"></i>
                            <span className="truncate">{l.title}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isBusy && <div className="text-amber-500 animate-pulse text-[11px] font-black tracking-[0.5em] uppercase pl-4 flex items-center gap-4"><i className="fa-solid fa-spinner animate-spin"></i> GROUNDING DATA...</div>}
            <div ref={chatEndRef} />
          </div>
          <div className="p-8 border-t border-slate-800 bg-slate-900/98 shrink-0 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
            <form onSubmit={handleSend} className="relative">
              <input value={input} onChange={e => setInput(e.target.value)} placeholder={selected ? `Inquire about ${selected.name}...` : "Analyze geological record..."} className="w-full bg-slate-950 border border-slate-800 rounded-[2.5rem] py-7 px-10 pr-24 text-[13px] text-white focus:border-amber-500 outline-none shadow-2xl transition-all" />
              <button disabled={isBusy || !input.trim()} className="absolute right-8 top-1/2 -translate-y-1/2 text-amber-500 hover:scale-125 active:scale-90 disabled:opacity-20 transition-all">
                <i className="fa-solid fa-bolt text-3xl"></i>
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
