
import React, { useState, useEffect, useRef } from 'react';
import { MineLocation, ChatMode, Message, LocalityType, CoordStatus } from './types';
import { fetchAndParseKml } from './services/kmlService';
import { GeminiService } from './services/geminiService';

declare const L: any;

const BASE_LAYERS_CONFIG = {
  osm: { name: "OpenStreetMap", url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" },
  osmDe: { name: "OpenStreetMap.de", url: "https://{s}.tile.openstreetmap.de/tiles/osmde/{z}/{x}/{y}.png" },
  esriTopo: { name: "Esri WorldTopo", url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}" },
  esriNatGeo: { name: "Esri NatGeo", url: "https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}" },
  esriDeLorme: { name: "Esri DeLorme", url: "https://server.arcgisonline.com/ArcGIS/rest/services/Specialty/DeLorme_World_Base_Map/MapServer/tile/{z}/{y}/{x}" },
  openTopo: { name: "OpenTopoMap", url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png" },
  esriOcean: { name: "Esri Ocean", url: "https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}" },
  geoportailSat: { name: "Geoportail France Sat", url: "https://wxs.ign.fr/choisirgeoportail/geoportail/wmts?REQUEST=GetTile&SERVICE=WMTS&VERSION=1.0.0&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/jpeg&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}" },
  esriSat: { name: "Esri Satellite", url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" },
  usgsTopo: { name: "USGS Topo", url: "https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}" },
  nasaNight: { name: "NASA Earth at Night", url: "https://map1.vis.earthdata.nasa.gov/wmts-webmerc/VIIRS_CityLights_2012/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg" },
};

const OVERLAYS_CONFIG = {
  blm: { name: "BLM Land Status", url: "https://tiles.arcgis.com/tiles/v01bP9833re8Fv9B/arcgis/rest/services/Surface_Management_Agency/MapServer/tile/{z}/{y}/{x}" },
  macrostrat: { name: "Macrostrat Geology", url: "https://tiles.macrostrat.org/carto/{z}/{x}/{y}.png" },
  hikeBike: { name: "HikeBike HillShading", url: "https://tiles.wmflabs.org/hillshading/{z}/{x}/{y}.png" },
  volcanoes: { name: "GVP Volcanoes", url: "https://tiles.arcgis.com/tiles/C8EMgrsFcRFL6LrL/arcgis/rest/services/Global_Volcanism_Program_Volcanoes/MapServer/tile/{z}/{y}/{x}" },
  museums: { name: "Museum Locations (OSM)", url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", opacity: 0.5 }
};

const LEGEND_ITEMS: { type: LocalityType; label: string; glyph: string }[] = [
  { type: 'mine', label: 'Mines & Prospects', glyph: 'fa-hammer' },
  { type: 'geography', label: 'Geography', glyph: 'fa-mountain' },
  { type: 'geology', label: 'Geology', glyph: 'fa-gem' },
  { type: 'admin', label: 'Admin', glyph: 'fa-shield-halved' },
  { type: 'settlement', label: 'Settlement', glyph: 'fa-house-chimney' },
  { type: 'protected', label: 'Protected Area', glyph: 'fa-tree' },
  { type: 'meteorite', label: 'Meteorite Site', glyph: 'fa-meteor' },
  { type: 'erratic', label: 'Glacial Erratic', glyph: 'fa-cube' },
  { type: 'extraterrestrial', label: 'Space Locality', glyph: 'fa-user-astronaut' },
  { type: 'artificial', label: 'Industrial Site', glyph: 'fa-industry' },
  { type: 'paleobiodb', label: 'Research/Fossil', glyph: 'fa-microscope' },
  { type: 'museum', label: 'Museum', glyph: 'fa-landmark' }
];

const getLocalityIcon = (type: LocalityType, status: CoordStatus) => {
  const colors = { direct: '#ef4444', estimated: '#22c55e', highlight: '#ffffff' };
  const item = LEGEND_ITEMS.find(i => i.type === type);
  const glyph = item ? item.glyph : 'fa-location-dot';
  const color = colors[status] || colors.direct;

  const html = `
    <div style="position:relative; width:34px; height:34px; display:flex; align-items:center; justify-content:center;">
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="position:absolute; width:100%; height:100%;">
        <path d="M50 5 L93.3 30 L93.3 70 L50 95 L6.7 70 L6.7 30 Z" fill="${color}" stroke="#000" stroke-width="6"/>
      </svg>
      <i class="fa-solid ${glyph}" style="position:relative; z-index:10; color:${status === 'highlight' ? '#000' : '#fff'}; font-size:14px; display: flex !important; align-items: center; justify-content: center;"></i>
    </div>
  `;
  return L.divIcon({ html, className: 'custom-mine-icon', iconSize: [34, 34], iconAnchor: [17, 17] });
};

const ElevationProfile: React.FC<{ lat: number; lng: number }> = ({ lat, lng }) => {
  const [elev, setElev] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    fetch(`https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lng}`)
      .then(res => res.json())
      .then(data => { if(active && data.results) setElev(data.results[0].elevation); })
      .catch(() => setElev(null));
    return () => { active = false; };
  }, [lat, lng]);

  return (
    <div className="bg-slate-900 border-2 border-slate-700 rounded-xl p-3 w-full shadow-2xl">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Altimetry</span>
        <span className="text-[11px] text-amber-400 font-mono font-black">{elev !== null ? `${elev.toLocaleString()}m MSL` : 'FETCHING...'}</span>
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
        <div className="h-full bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.6)] transition-all duration-1000" style={{ width: elev ? '100%' : '10%' }}></div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [locations, setLocations] = useState<MineLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<MineLocation | null>(null);
  const [showLegend, setShowLegend] = useState(false);
  const [activeBase, setActiveBase] = useState('osm');
  const [activeOverlays, setActiveOverlays] = useState<Record<string, boolean>>({ blm: true });
  const [isChatVisible, setIsChatVisible] = useState(false);
  const [isLayersVisible, setIsLayersVisible] = useState(false);
  const [isCheckingLand, setIsCheckingLand] = useState(false);
  const [landStatusResult, setLandStatusResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const mapRef = useRef<any>(null);
  const layersRef = useRef<Record<string, any>>({});
  const markerClusterRef = useRef<any>(null);
  const geminiRef = useRef<GeminiService | null>(null);

  useEffect(() => {
    geminiRef.current = new GeminiService();
    const initialize = async () => {
      try {
        const data = await fetchAndParseKml();
        setLocations(data);
      } finally {
        setTimeout(() => setIsLoading(false), 1500);
      }
    };
    initialize();

    if (!mapRef.current) {
      mapRef.current = L.map('map-container', { zoomControl: false }).setView([39.8, -98.5], 4);
      L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);
      
      // Initialize Layers
      Object.entries(BASE_LAYERS_CONFIG).forEach(([key, cfg]) => {
        layersRef.current[key] = L.tileLayer(cfg.url, { maxZoom: 19, attribution: '© GeoClaim' });
      });
      layersRef.current[activeBase].addTo(mapRef.current);

      Object.entries(OVERLAYS_CONFIG).forEach(([key, cfg]) => {
        layersRef.current[key] = L.tileLayer(cfg.url, { zIndex: 10, opacity: (cfg as any).opacity || 0.7 });
      });
      
      Object.keys(activeOverlays).forEach(k => { 
        if (activeOverlays[k]) layersRef.current[k].addTo(mapRef.current); 
      });

      markerClusterRef.current = L.markerClusterGroup({ 
        maxClusterRadius: 45,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true
      }).addTo(mapRef.current);
    }
  }, []);

  // Robust Layer management
  useEffect(() => {
    if (!mapRef.current) return;
    
    // Handle Base Layers
    Object.keys(BASE_LAYERS_CONFIG).forEach(k => {
      if (k === activeBase) {
        if (!mapRef.current.hasLayer(layersRef.current[k])) {
          mapRef.current.addLayer(layersRef.current[k]);
        }
      } else {
        if (mapRef.current.hasLayer(layersRef.current[k])) {
          mapRef.current.removeLayer(layersRef.current[k]);
        }
      }
    });

    // Handle Overlays
    Object.keys(OVERLAYS_CONFIG).forEach(k => {
      if (activeOverlays[k]) {
        if (!mapRef.current.hasLayer(layersRef.current[k])) {
          mapRef.current.addLayer(layersRef.current[k]);
        }
      } else {
        if (mapRef.current.hasLayer(layersRef.current[k])) {
          mapRef.current.removeLayer(layersRef.current[k]);
        }
      }
    });
  }, [activeBase, activeOverlays]);

  useEffect(() => {
    if (!markerClusterRef.current) return;
    markerClusterRef.current.clearLayers();
    const markers = locations.map(loc => {
      const m = L.marker([loc.coordinates.lat, loc.coordinates.lng], { icon: getLocalityIcon(loc.type, loc.status) });
      m.on('click', (e: any) => { 
        L.DomEvent.stopPropagation(e);
        setSelectedLocation(loc); 
        setLandStatusResult(null); 
        setIsCheckingLand(false);
      });
      return m;
    });
    markerClusterRef.current.addLayers(markers);
  }, [locations]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || isGenerating || !geminiRef.current) return;

    const userMsg: Message = { role: 'user', text: inputText };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsGenerating(true);

    try {
      const history = messages.map(m => ({ role: m.role, parts: [{ text: m.text }] }));
      const response = await geminiRef.current.generateChatResponse(inputText, ChatMode.SEARCH, history);
      setMessages(prev => [...prev, { role: 'model', text: response.text, groundingLinks: response.links }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'model', text: "Geological terminal connection failure. Retry query." }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGlobalSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || isSearching || !geminiRef.current) return;
    setIsSearching(true);
    
    try {
      // Local KML search (USA-wide)
      const localMatch = locations.find(loc => loc.name.toLowerCase().includes(searchQuery.toLowerCase()));
      if (localMatch) {
        mapRef.current.flyTo([localMatch.coordinates.lat, localMatch.coordinates.lng], 15);
        setSelectedLocation(localMatch);
        setIsSearching(false);
        return;
      }

      // USA-wide Global Search via Gemini
      const response = await geminiRef.current.generateChatResponse(
        `Identify the location for "${searchQuery}" in the USA. If it's a mine, town, or county, provide its coordinates and a brief description. Respond strictly with a JSON object: {"lat": number, "lng": number, "name": "string", "description": "string", "type": "mine|settlement|admin"}`,
        ChatMode.LITE
      );
      
      const jsonStr = response.text.match(/\{[\s\S]*\}/)?.[0];
      if (jsonStr) {
        const data = JSON.parse(jsonStr);
        if (data.lat && data.lng) {
          mapRef.current.flyTo([data.lat, data.lng], 14);
          const virtualLoc: MineLocation = {
            id: 'search-' + Date.now(),
            name: data.name || searchQuery,
            coordinates: { lat: data.lat, lng: data.lng },
            description: data.description || "Research result for " + searchQuery,
            type: (data.type as LocalityType) || 'mine',
            status: 'highlight'
          };
          setSelectedLocation(virtualLoc);
          setIsSearching(false);
          return;
        }
      }

      // Fallback Geocoder
      const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery + " USA")}`);
      const geoData = await geoRes.json();
      if (geoData && geoData[0]) {
        mapRef.current.flyTo([parseFloat(geoData[0].lat), parseFloat(geoData[0].lon)], 13);
      }
    } catch (err) {
      console.error("Search failure", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleVerifyAgency = async () => {
    if (!selectedLocation || isCheckingLand || !geminiRef.current) return;
    setIsCheckingLand(true);
    setLandStatusResult(null);
    try {
      const query = `Provide current land ownership status for '${selectedLocation.name}' at coordinates ${selectedLocation.coordinates.lat}, ${selectedLocation.coordinates.lng}. Cross-reference BLM Surface Management Agency (SMA) data and state records. Determine if it is Federal, State, or Private property. Cite your sources.`;
      const response = await geminiRef.current.generateChatResponse(query, ChatMode.SEARCH);
      setLandStatusResult(response.text);
    } catch (err) {
      setLandStatusResult("Research interrupted. Check the BLM Overlay or search grounding manually.");
    } finally {
      setIsCheckingLand(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 font-sans selection:bg-amber-500/40 antialiased overflow-hidden">
      
      {/* Global Loading */}
      {isLoading && (
        <div className="fixed inset-0 z-[2000] bg-slate-950 flex flex-col items-center justify-center space-y-8 animate-in fade-in duration-700">
          <div className="relative">
            <div className="absolute inset-0 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin w-40 h-40 -m-10"></div>
            <div className="w-20 h-20 bg-gradient-to-br from-amber-200 via-amber-500 to-amber-800 rounded-2xl rotate-45 shadow-[0_0_80px_rgba(245,158,11,0.8)] animate-pulse border-2 border-amber-400 flex items-center justify-center">
               <i className="fa-solid fa-gem text-amber-950 text-3xl drop-shadow-xl -rotate-45"></i>
            </div>
          </div>
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-black uppercase tracking-[0.5em] text-amber-500">GeoClaim</h2>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400 animate-pulse">Synchronizing USA Locality Databases...</p>
          </div>
        </div>
      )}

      {/* Header with Search */}
      <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 h-16 flex items-center justify-between px-3 md:px-6 z-[100] shadow-2xl shrink-0">
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
            <div className="bg-amber-500 p-1.5 rounded-lg shadow-lg">
              <i className="fa-solid fa-earth-americas text-slate-950 text-xl"></i>
            </div>
            <h1 className="text-xs md:text-sm font-black uppercase tracking-tighter hidden sm:block">GeoClaim <span className="text-slate-500 opacity-60">PRO</span></h1>
        </div>

        <form onSubmit={handleGlobalSearch} className="flex-1 max-w-xl mx-4 relative group">
          <input 
            type="text" 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search USA: County, State, Mine, or Town..."
            className="w-full bg-slate-950/80 border border-slate-700 text-white rounded-xl py-2 px-4 pl-10 text-xs md:text-sm focus:outline-none focus:border-amber-500 transition-all placeholder-slate-500 font-bold shadow-inner"
          />
          <i className={`fa-solid ${isSearching ? 'fa-circle-notch fa-spin text-amber-500' : 'fa-magnifying-glass text-slate-500'} absolute left-3 top-1/2 -translate-y-1/2`}></i>
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"><i className="fa-solid fa-xmark"></i></button>
          )}
        </form>

        <div className="flex gap-1.5 md:gap-2 shrink-0">
            <button onClick={() => setIsLayersVisible(!isLayersVisible)} className={`p-2.5 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all shadow-lg border ${isLayersVisible ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'}`}>
                <i className="fa-solid fa-layer-group text-sm"></i><span className="hidden lg:inline ml-2">Layers</span>
            </button>
            <button onClick={() => setShowLegend(!showLegend)} className={`p-2.5 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all shadow-lg border ${showLegend ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'}`}>
                <i className="fa-solid fa-list text-sm"></i>
            </button>
            <button onClick={() => setIsChatVisible(!isChatVisible)} className={`px-3 lg:px-4 py-2.5 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all shadow-xl border-b-2 ${isChatVisible ? 'bg-amber-400 text-slate-950 border-amber-600' : 'bg-amber-500 text-slate-950 border-amber-600 hover:bg-amber-400'}`}>
                <i className="fa-solid fa-robot text-sm md:mr-2"></i><span className="hidden lg:inline">Research</span>
            </button>
        </div>
      </header>

      <main className="flex-1 relative overflow-hidden">
        <div id="map-container" className="absolute inset-0 z-10" />

        {/* Legend */}
        {showLegend && (
            <div className="absolute inset-0 z-[500] bg-slate-950/90 backdrop-blur-lg flex items-center justify-center p-4">
                <div className="bg-white text-slate-950 w-full max-w-2xl rounded-[2.5rem] shadow-2xl p-6 md:p-10 overflow-y-auto max-h-[90vh] animate-in zoom-in-95 duration-200">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-5 mb-8">
                        <div className="flex items-center gap-3">
                            <i className="fa-solid fa-map-pin text-amber-500 text-xl"></i>
                            <h3 className="font-black uppercase tracking-widest text-lg">Locality Symbols</h3>
                        </div>
                        <button onClick={() => setShowLegend(false)} className="text-slate-300 hover:text-red-500 text-3xl transition-colors"><i className="fa-solid fa-circle-xmark"></i></button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-10 mb-10">
                        {LEGEND_ITEMS.map((item) => (
                            <div key={item.type} className="flex flex-col items-center gap-3 text-center group">
                                <div className="w-14 h-14 relative flex items-center justify-center transform group-hover:scale-110 transition-transform duration-300">
                                    <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-xl">
                                        <path d="M50 5 L93.3 30 L93.3 70 L50 95 L6.7 70 L6.7 30 Z" fill="#f8fafc" stroke="#000" strokeWidth="4"/>
                                    </svg>
                                    <i className={`fa-solid ${item.glyph} absolute text-slate-800 text-2xl`}></i>
                                </div>
                                <span className="text-[10px] md:text-[11px] font-black uppercase tracking-tighter text-slate-500 leading-tight">{item.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {/* Layer Controls - Scrollable */}
        <div className={`absolute top-0 right-0 h-full w-full sm:w-80 bg-slate-900/98 backdrop-blur-2xl border-l border-slate-800 z-[150] p-6 shadow-2xl transition-transform duration-500 ease-out transform ${isLayersVisible ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}>
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-amber-500">Mapping Stack</h3>
                <button onClick={() => setIsLayersVisible(false)} className="text-white bg-slate-800 p-2.5 rounded-xl hover:text-amber-500 transition-all shadow-inner"><i className="fa-solid fa-xmark"></i></button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-8">
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">Base Maps</h4>
                  <div className="space-y-2">
                      {Object.entries(BASE_LAYERS_CONFIG).map(([key, cfg]) => (
                          <button key={key} onClick={() => setActiveBase(key)} className={`w-full text-left px-5 py-4 rounded-2xl text-[11px] font-black uppercase transition-all flex items-center justify-between group ${activeBase === key ? 'bg-amber-500 text-slate-950 shadow-xl' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                              <span>{cfg.name}</span>
                              <div className={`w-3 h-3 rounded-full border-2 border-current transition-all ${activeBase === key ? 'bg-slate-950 scale-125' : 'bg-transparent'}`}></div>
                          </button>
                      ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">Overlay Systems</h4>
                  <div className="space-y-4">
                      {Object.entries(OVERLAYS_CONFIG).map(([key, cfg]) => (
                          <label key={key} className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer group ${activeOverlays[key] ? 'bg-slate-800 border-amber-500/50 shadow-2xl' : 'bg-slate-800/40 border-slate-700 hover:border-slate-600'}`}>
                              <span className={`text-[11px] font-black uppercase tracking-tight transition-colors ${activeOverlays[key] ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>{cfg.name}</span>
                              <input type="checkbox" checked={activeOverlays[key] || false} onChange={e => setActiveOverlays(p => ({...p, [key]: e.target.checked}))} className="hidden" />
                              <div className={`w-12 h-6 rounded-full relative transition-all duration-300 ${activeOverlays[key] ? 'bg-amber-500 shadow-lg shadow-amber-500/30' : 'bg-slate-700'}`}>
                                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 ${activeOverlays[key] ? 'left-7' : 'left-1'}`}></div>
                              </div>
                          </label>
                      ))}
                  </div>
                </div>
            </div>
        </div>

        {/* Selected Locality Details */}
        {selectedLocation && (
            <div className="absolute bottom-0 left-0 w-full z-[140] p-4 md:p-8 pointer-events-none flex justify-center">
                <div className="bg-slate-900 border-2 border-slate-700 p-6 md:p-10 rounded-[2.5rem] shadow-[0_30px_100px_rgba(0,0,0,0.9)] pointer-events-auto w-full max-w-5xl flex flex-col gap-6 relative overflow-hidden animate-in slide-in-from-bottom duration-500 overflow-y-auto max-h-[85vh] ring-1 ring-white/5">
                    
                    {/* RESEARCHING OVERLAY */}
                    {isCheckingLand && (
                      <div className="absolute inset-0 z-50 bg-slate-950/85 backdrop-blur-xl flex flex-col items-center justify-center p-10 text-center space-y-8 animate-in fade-in duration-300">
                        <div className="relative">
                          <div className="w-28 h-28 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin"></div>
                          <i className="fa-solid fa-satellite-dish absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-4xl text-amber-500 animate-pulse"></i>
                        </div>
                        <div className="space-y-3">
                          <h4 className="text-2xl font-black uppercase tracking-[0.3em] text-white">Verification Engine Active</h4>
                          <p className="text-sm font-bold text-amber-500 uppercase tracking-widest animate-bounce">Querying USGS, BLM, & Federal Land Repositories...</p>
                        </div>
                        <div className="w-full max-w-lg h-2 bg-slate-800 rounded-full overflow-hidden shadow-inner">
                          <div className="h-full bg-amber-500 animate-[loading_1.2s_ease-in-out_infinite] shadow-[0_0_20px_rgba(245,158,11,0.8)]"></div>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col md:flex-row gap-8 relative z-10">
                        <div className="flex-1 space-y-6">
                            <div className="flex items-center gap-4">
                                <div className={`w-5 h-5 rounded-full border-2 border-slate-950 shadow-xl ${selectedLocation.status === 'direct' ? 'bg-red-500' : selectedLocation.status === 'estimated' ? 'bg-green-500' : 'bg-white'}`}></div>
                                <span className="text-slate-400 text-[11px] font-black uppercase tracking-[0.3em]">{selectedLocation.status} DATA RECORD • {selectedLocation.type}</span>
                            </div>
                            <h3 className="text-2xl md:text-5xl font-black uppercase text-amber-400 tracking-tight leading-tight antialiased drop-shadow-2xl">{selectedLocation.name}</h3>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="p-6 bg-slate-950 border-2 border-slate-800 rounded-3xl space-y-5 shadow-2xl ring-1 ring-white/5">
                                    <h4 className="text-[12px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-4">
                                        <i className="fa-solid fa-gears text-xl"></i> Operation Specs
                                    </h4>
                                    <div className="space-y-3 text-[12px] font-black uppercase">
                                        <div className="flex justify-between border-b border-slate-800 pb-2"><span className="text-slate-500">Method:</span><span className="text-white">{selectedLocation.miningMethod || 'Historical'}</span></div>
                                        <div className="flex justify-between border-b border-slate-800 pb-2"><span className="text-slate-500">Geology:</span><span className="text-white">{selectedLocation.depositType || 'Undefined'}</span></div>
                                    </div>
                                    <p className="text-[13px] text-slate-100 font-bold leading-relaxed bg-slate-900/60 p-4 rounded-2xl border border-slate-800 italic shadow-inner">
                                        Spatial Data: Terrain methodology classified under US-Regional {selectedLocation.miningMethod?.toLowerCase() || 'historical legacy'} data sets.
                                    </p>
                                </div>

                                <div className="p-6 bg-slate-950 border-2 border-slate-800 rounded-3xl space-y-5 shadow-2xl ring-1 ring-white/5">
                                    <div className="flex justify-between items-center">
                                        <h4 className="text-[12px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-4">
                                            <i className="fa-solid fa-landmark-flag text-xl"></i> Claim Status
                                        </h4>
                                        {!landStatusResult && (
                                            <button onClick={handleVerifyAgency} className="text-[10px] bg-amber-500 text-slate-950 px-5 py-2 rounded-full font-black uppercase tracking-widest hover:bg-amber-400 shadow-xl transition-all active:scale-90 border-b-2 border-amber-600">
                                                VERIFY CLAIM
                                            </button>
                                        )}
                                    </div>
                                    <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 min-h-[120px] flex items-start overflow-y-auto max-h-48 custom-scrollbar">
                                        {landStatusResult ? (
                                            <p className="text-[13px] text-white font-bold leading-relaxed italic antialiased">{landStatusResult}</p>
                                        ) : (
                                            <p className="text-[11px] font-black uppercase tracking-widest leading-relaxed text-slate-400 opacity-70">
                                                Initiate Grounding Search to cross-reference Federal SMA boundaries and real-time property records for these coordinates.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="w-full md:w-80 flex flex-col gap-4 justify-center">
                            <ElevationProfile lat={selectedLocation.coordinates.lat} lng={selectedLocation.coordinates.lng} />
                            <div className="flex gap-3">
                                <button onClick={() => mapRef.current.flyTo([selectedLocation.coordinates.lat, selectedLocation.coordinates.lng], 17)} className="flex-1 bg-amber-500 text-slate-950 py-4 rounded-2xl text-[12px] font-black uppercase shadow-2xl active:scale-95 transition-all border-b-4 border-amber-600 hover:bg-amber-400">FOCUS PIN</button>
                                <button onClick={() => setSelectedLocation(null)} className="px-6 lg:px-10 bg-slate-800 text-slate-100 py-4 rounded-2xl text-[12px] font-black uppercase border-2 border-slate-700 hover:bg-slate-700 transition-all shadow-xl shadow-black/40">CLOSE</button>
                            </div>
                            <a href={`https://www.google.com/maps/search/?api=1&query=${selectedLocation.coordinates.lat},${selectedLocation.coordinates.lng}`} target="_blank" className="w-full bg-slate-800/80 text-white py-4 rounded-2xl text-[11px] font-black uppercase text-center flex items-center justify-center gap-3 hover:bg-slate-700 transition-all border-2 border-slate-700 shadow-2xl group"><i className="fa-solid fa-earth-americas group-hover:rotate-12 transition-transform"></i> SATELLITE ANALYSIS</a>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Sidebar - AI Research Chat */}
        <div className={`absolute top-0 left-0 h-full w-full sm:w-[480px] bg-slate-950 z-[160] border-r border-slate-800 shadow-[40px_0_100px_rgba(0,0,0,0.8)] transition-transform duration-500 ease-out transform ${isChatVisible ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
            <div className="p-6 md:p-8 border-b border-slate-800 flex justify-between items-center bg-slate-900 shadow-xl">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                      <i className="fa-solid fa-robot text-slate-950 text-xl"></i>
                    </div>
                    <div>
                      <h2 className="text-[12px] font-black uppercase tracking-[0.3em] text-white">Geological Terminal</h2>
                      <p className="text-[9px] font-bold text-amber-500 uppercase tracking-widest">Grounding Engine v4.0 Active</p>
                    </div>
                </div>
                <button onClick={() => setIsChatVisible(false)} className="text-white bg-slate-800 hover:bg-red-600 w-11 h-11 rounded-2xl flex items-center justify-center transition-all shadow-inner border border-slate-700"><i className="fa-solid fa-xmark text-xl"></i></button>
            </div>
            
            <div className="flex-1 p-6 md:p-8 overflow-y-auto custom-scrollbar space-y-8 bg-slate-950">
                {messages.length === 0 && (
                    <div className="bg-slate-900/50 border-2 border-amber-500/30 p-8 rounded-[2.5rem] shadow-2xl ring-1 ring-amber-500/10">
                        <p className="text-[13px] text-amber-400 font-black uppercase mb-5 flex items-center gap-4 tracking-widest">
                            <i className="fa-solid fa-bolt-lightning text-2xl"></i> USA Intelligence Active
                        </p>
                        <p className="text-[16px] text-white leading-relaxed font-bold antialiased opacity-90">
                            Ask about mine histories, mineralogy, or regional safety across all 50 states. I use <span className="text-amber-500 underline decoration-2 underline-offset-4">Google Search Grounding</span> for verified records.
                        </p>
                    </div>
                )}

                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} space-y-3`}>
                        <div className={`max-w-[90%] p-5 md:p-6 rounded-3xl text-[14px] md:text-[15px] font-bold antialiased shadow-2xl ${msg.role === 'user' ? 'bg-amber-500 text-slate-950 rounded-tr-none border-b-4 border-amber-600' : 'bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700'}`}>
                            {msg.text}
                        </div>
                        {msg.groundingLinks && msg.groundingLinks.length > 0 && (
                            <div className="flex flex-col gap-2.5 w-full mt-2 pl-5 border-l-2 border-amber-500/50">
                                <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1 flex items-center gap-2"><i className="fa-solid fa-clipboard-check"></i> Citations:</p>
                                {msg.groundingLinks.map((link, lIdx) => (
                                    <a key={lIdx} href={link.uri} target="_blank" className="text-[11px] text-amber-500 hover:text-amber-400 font-bold underline decoration-amber-500/30 underline-offset-2 truncate max-w-full block">
                                        <i className="fa-solid fa-link mr-2 text-[10px]"></i> {link.title}
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
                {isGenerating && (
                    <div className="flex items-center gap-3 p-5 bg-slate-800/40 rounded-[2rem] animate-pulse max-w-[150px] border border-slate-800 shadow-inner">
                        <div className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-bounce shadow-lg shadow-amber-500/50"></div>
                        <div className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-bounce [animation-delay:-.3s] shadow-lg shadow-amber-500/50"></div>
                        <div className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-bounce [animation-delay:-.5s] shadow-lg shadow-amber-500/50"></div>
                    </div>
                )}
                <div ref={chatEndRef} />
            </div>

            <div className="p-6 md:p-10 border-t border-slate-800 bg-slate-900 shadow-2xl">
                <form onSubmit={handleSendMessage} className="relative group">
                    <input 
                        type="text" 
                        value={inputText}
                        onChange={e => setInputText(e.target.value)}
                        placeholder="Query USA locality intelligence..."
                        className="w-full bg-slate-950 text-white p-5 rounded-[2.5rem] border-2 border-slate-800 text-[15px] font-bold placeholder-slate-600 focus:outline-none focus:border-amber-500 shadow-2xl transition-all"
                    />
                    <button 
                        type="submit"
                        disabled={isGenerating || !inputText.trim()}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 bg-amber-500 text-slate-950 rounded-full flex items-center justify-center hover:bg-amber-400 transition-all shadow-xl active:scale-90 disabled:opacity-30 border-b-4 border-amber-600"
                    >
                        <i className="fa-solid fa-paper-plane text-xl"></i>
                    </button>
                </form>
            </div>
        </div>
      </main>
      
      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .leaflet-marker-icon i {
          display: flex !important;
          align-items: center;
          justify-content: center;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.1);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
};

export default App;
