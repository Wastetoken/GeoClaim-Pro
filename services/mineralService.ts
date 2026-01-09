
const MINERAL_LIST_URL = 'services/Mineral-Image-List.txt'; 

export class MineralService {
  private static instance: MineralService;
  private mineralMap: Map<string, string> = new Map();
  private isLoaded: boolean = false;

  private constructor() {}

  public static getInstance(): MineralService {
    if (!MineralService.instance) MineralService.instance = new MineralService();
    return MineralService.instance;
  }

  public async loadMineralList(): Promise<void> {
    if (this.isLoaded) return;
    try {
      const response = await fetch(MINERAL_LIST_URL);
      if (!response.ok) throw new Error('Mineral catalog sync failed');
      const text = await response.text();
      const lines = text.split(/\r?\n/);
      
      for (const line of lines) {
        if (!line.trim()) continue;
        // Parse "Mineral Name: URL" or "URL Mineral Name"
        const urlMatch = line.match(/(https?:\/\/[^\s]+)/);
        if (urlMatch) {
          const url = urlMatch[0];
          const name = line.replace(url, '').replace(/[:;,]/g, '').trim().toLowerCase();
          if (name) {
            this.mineralMap.set(name, url);
          }
        }
      }
      this.isLoaded = true;
      console.log(`Geospatial Image Registry loaded: ${this.mineralMap.size} specimens.`);
    } catch (error) {
      console.error('Mineral List Loading Error:', error);
    }
  }

  public getImageUrl(mineralName: string): string | null {
    const search = mineralName.toLowerCase().trim();
    
    // Direct match
    if (this.mineralMap.has(search)) return this.mineralMap.get(search)!;
    
    // Fuzzy sub-string match for species varieties (e.g., "Arborescent Gold" -> "Gold")
    for (const [name, url] of this.mineralMap.entries()) {
      if (search.includes(name) || name.includes(search)) return url;
    }
    
    return null;
  }
}
