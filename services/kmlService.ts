
import { MineLocation, LocalityType, CoordStatus } from '../types';

// Using the full USA localities dataset as requested
const KML_URL = 'https://pub-90f3d40bb40d44ab8aeb9563e62f17ec.r2.dev/localities_USA.kml';

const detectType = (name: string, desc: string): LocalityType => {
  const full = (name + desc).toLowerCase();
  
  // Specific data source detection
  if (full.includes('mindat')) return 'mine';
  if (full.includes('paleobiodb') || full.includes('pbdb')) return 'paleobiodb';
  
  // General feature detection
  if (full.includes('mine') || full.includes('prospect') || full.includes('quarry') || full.includes('shaft')) return 'mine';
  if (full.includes('museum')) return 'museum';
  if (full.includes('settlement') || full.includes('town')) return 'settlement';
  if (full.includes('park') || full.includes('reserve') || full.includes('forest')) return 'protected';
  if (full.includes('meteorite')) return 'meteorite';
  if (full.includes('erratic')) return 'erratic';
  if (full.includes('formation') || full.includes('outcrop') || full.includes('unit')) return 'geology';
  if (full.includes('mountain') || full.includes('peak') || full.includes('ridge')) return 'geography';
  
  return 'other';
};

const detectMiningInfo = (name: string, desc: string) => {
  const full = (name + desc).toLowerCase();
  let method = "Not Specified";
  let deposit = "In Situ Locality";

  if (full.includes('placer') || full.includes('alluvial') || full.includes('gravel')) {
    deposit = "Placer/Alluvial";
    method = "Sluicing/Panning/Dredging";
  } else if (full.includes('shaft') || full.includes('lode') || full.includes('vein')) {
    deposit = "Lode/Vein";
    method = "Hardrock/Underground";
  } else if (full.includes('pit') || full.includes('quarry') || full.includes('surface')) {
    method = "Open-Pit/Quarry";
    deposit = "Bulk Surface Deposit";
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
      
      // Attempt to get full description, checking for CDATA or plain text
      let description = '';
      const descNode = p.getElementsByTagName('description')[0];
      if (descNode) {
        description = descNode.textContent || descNode.innerHTML || '';
      }
      
      const coordsNode = p.getElementsByTagName('coordinates')[0];
      
      if (coordsNode) {
        const coordsText = coordsNode.textContent?.trim();
        if (coordsText) {
          // KML coordinates are typically Lng,Lat,Alt
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
