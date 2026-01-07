
import { MineLocation, LocalityType, CoordStatus } from '../types';

const KML_URL = 'https://pub-90f3d40bb40d44ab8aeb9563e62f17ec.r2.dev/localities_USA.kml';

const detectType = (name: string, desc: string): LocalityType => {
  const full = (name + desc).toLowerCase();
  if (full.includes('mine') || full.includes('prospect') || full.includes('quarry') || full.includes('shaft')) return 'mine';
  if (full.includes('museum')) return 'museum';
  if (full.includes('settlement') || full.includes('town') || full.includes('city')) return 'settlement';
  if (full.includes('park') || full.includes('reserve') || full.includes('forest')) return 'protected';
  if (full.includes('meteorite')) return 'meteorite';
  if (full.includes('erratic') || full.includes('boulder')) return 'erratic';
  if (full.includes('moon') || full.includes('mars') || full.includes('extraterrestrial')) return 'extraterrestrial';
  if (full.includes('formation') || full.includes('outcrop') || full.includes('geology')) return 'geology';
  if (full.includes('mountain') || full.includes('peak') || full.includes('valley') || full.includes('creek')) return 'geography';
  if (full.includes('dam') || full.includes('factory') || full.includes('bridge')) return 'artificial';
  if (full.includes('paleo') || full.includes('fossil') || full.includes('dinosaur')) return 'paleobiodb';
  if (full.includes('county') || full.includes('district') || full.includes('state')) return 'admin';
  return 'other';
};

const detectMiningInfo = (name: string, desc: string) => {
  const full = (name + desc).toLowerCase();
  let method = "Surface Mining";
  let deposit = "Lode Mining (Hard Rock)";

  if (full.includes('placer') || full.includes('panning') || full.includes('sluice') || full.includes('dredge') || full.includes('gravel') || full.includes('stream') || full.includes('river')) {
    deposit = "Placer Mining";
  } else if (full.includes('lode') || full.includes('hard rock') || full.includes('vein') || full.includes('quartz') || full.includes('shaft')) {
    deposit = "Lode Mining (Hard Rock)";
  }

  if (full.includes('dredge')) {
    method = "Dredging";
  } else if (full.includes('open pit') || full.includes('quarry') || full.includes('open-cast') || full.includes('pit')) {
    method = "Open-Pit/Open-Cast";
  } else if (full.includes('underground') || full.includes('shaft') || full.includes('adit') || full.includes('tunnel') || full.includes('stope')) {
    method = "Underground Mining";
    if (full.includes('room and pillar') || full.includes('room-and-pillar')) method = "Room-and-Pillar";
    if (full.includes('longwall')) method = "Longwall Mining";
    if (full.includes('block caving')) method = "Block Caving";
  } else if (full.includes('strip')) {
    method = "Strip Mining";
  } else if (full.includes('mountaintop')) {
    method = "Mountaintop Removal";
  } else if (full.includes('solution') || full.includes('in-situ') || full.includes('leach') || full.includes('isrl')) {
    method = "In-Situ (Solution) Mining";
  }

  return { method, deposit };
};

export const fetchAndParseKml = async (): Promise<MineLocation[]> => {
  try {
    const response = await fetch(KML_URL);
    if (!response.ok) throw new Error('KML Fetch Failed');
    const kmlText = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(kmlText, 'text/xml');
    
    const placemarks = xmlDoc.getElementsByTagName('Placemark');
    const locations: MineLocation[] = [];

    for (let i = 0; i < placemarks.length; i++) {
      const p = placemarks[i];
      const name = p.getElementsByTagName('name')[0]?.textContent || `Locality ${i}`;
      const description = p.getElementsByTagName('description')[0]?.textContent || '';
      const coordinatesStr = p.getElementsByTagName('coordinates')[0]?.textContent?.trim() || '';
      
      if (coordinatesStr) {
        const parts = coordinatesStr.split(',');
        const lng = parseFloat(parts[0]);
        const lat = parseFloat(parts[1]);
        
        if (!isNaN(lat) && !isNaN(lng)) {
          let status: CoordStatus = 'direct';
          if (description.toLowerCase().includes('estimated')) {
            status = 'estimated';
          }
          
          const { method, deposit } = detectMiningInfo(name, description);
          
          locations.push({
            id: `mine-${i}`,
            name,
            description,
            coordinates: { lat, lng },
            type: detectType(name, description),
            status: status,
            miningMethod: method,
            depositType: deposit
          });
        }
      }
    }
    return locations;
  } catch (error) {
    console.error('Error loading KML:', error);
    return [];
  }
};
