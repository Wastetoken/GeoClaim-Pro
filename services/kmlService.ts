
import { MineLocation, LocalityType, CoordStatus } from '../types';

const KML_URL = 'https://pub-90f3d40bb40d44ab8aeb9563e62f17ec.r2.dev/localities_USA.kml';

const detectType = (name: string, desc: string): LocalityType => {
  const full = (name + desc).toLowerCase();
  
  // High-priority Mindat Classification parsing
  if (full.includes('locality type: mine') || full.includes('past producer') || full.includes('active producer')) return 'mine';
  if (full.includes('locality type: prospect')) return 'prospect';
  if (full.includes('locality type: occurrence') || full.includes('mineral occurrence')) return 'occurrence';
  if (full.includes('locality type: plant') || full.includes('locality type: facility')) return 'facility';

  // Specific data source detection
  if (full.includes('paleobiodb') || full.includes('pbdb')) return 'paleobiodb';
  
  // General feature detection for non-mindat sources
  if (full.includes('museum')) return 'museum';
  if (full.includes('meteorite')) return 'meteorite';
  if (full.includes('park') || full.includes('reserve') || full.includes('forest')) return 'protected';
  if (full.includes('settlement') || full.includes('town')) return 'settlement';
  if (full.includes('mine') || full.includes('quarry') || full.includes('shaft')) return 'mine';
  if (full.includes('formation') || full.includes('outcrop') || full.includes('unit')) return 'geology';
  if (full.includes('mountain') || full.includes('peak')) return 'geography';
  
  return 'other';
};

const detectMiningInfo = (name: string, desc: string) => {
  const full = (name + desc).toLowerCase();
  let method = "Not Specified";
  let deposit = "In Situ Locality";

  if (full.includes('placer') || full.includes('alluvial')) {
    deposit = "Placer/Alluvial";
    method = "Sluicing/Panning";
  } else if (full.includes('shaft') || full.includes('lode') || full.includes('underground')) {
    deposit = "Lode/Vein";
    method = "Underground Mining";
  } else if (full.includes('pit') || full.includes('quarry')) {
    method = "Open-Pit/Quarry";
    deposit = "Surface Deposit";
  }
  return { method, deposit };
};

export const fetchAndParseKml = async (): Promise<MineLocation[]> => {
  try {
    const response = await fetch(KML_URL);
    if (!response.ok) throw new Error(`Fetch Failed: ${response.status}`);
    const kmlText = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(kmlText, 'text/xml');
    
    const placemarks = xmlDoc.getElementsByTagName('Placemark');
    const locations: MineLocation[] = [];

    for (let i = 0; i < placemarks.length; i++) {
      const p = placemarks[i];
      const name = p.getElementsByTagName('name')[0]?.textContent || `Locality ${i}`;
      let description = '';
      const descNode = p.getElementsByTagName('description')[0];
      if (descNode) description = descNode.textContent || descNode.innerHTML || '';
      
      const coordsNode = p.getElementsByTagName('coordinates')[0];
      if (coordsNode) {
        const coordsText = coordsNode.textContent?.trim();
        if (coordsText) {
          const parts = coordsText.split(/\s+/)[0].split(',');
          if (parts.length >= 2) {
            const lng = parseFloat(parts[0]);
            const lat = parseFloat(parts[1]);
            if (!isNaN(lat) && !isNaN(lng)) {
              const { method, deposit } = detectMiningInfo(name, description);
              locations.push({
                id: `loc-usa-${i}`,
                name: name.trim(),
                description: description.trim(),
                coordinates: { lat, lng },
                type: detectType(name, description),
                status: 'direct',
                miningMethod: method,
                depositType: deposit
              });
            }
          }
        }
      }
    }
    return locations;
  } catch (error) {
    console.error('KML Processing Error:', error);
    return [];
  }
};
