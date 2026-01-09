
export type LocalityType = 
  | 'mine' 
  | 'prospect'
  | 'occurrence'
  | 'facility'
  | 'geography' 
  | 'geology' 
  | 'admin' 
  | 'settlement' 
  | 'protected' 
  | 'meteorite' 
  | 'erratic' 
  | 'paleobiodb' 
  | 'museum' 
  | 'other';

export type CoordStatus = 'direct' | 'estimated' | 'highlight';

export interface MineLocation {
  id: string;
  name: string;
  coordinates: { lat: number; lng: number };
  description: string;
  type: LocalityType;
  status: CoordStatus;
  miningMethod?: string;
  depositType?: string;
}

export enum ChatMode {
  NORMAL = 'Normal',
  THINKING = 'Thinking',
  SEARCH = 'Search',
  MAPS = 'Maps',
  LITE = 'Fast'
}

export interface Message {
  role: 'user' | 'model';
  text: string;
  mode?: ChatMode;
  image?: string;
  groundingLinks?: { title: string; uri: string }[];
}

export interface SiteSafety {
  hazardLevel: 'Low' | 'Moderate' | 'High' | 'Extreme';
  hazards: string[];
  emergencyServices: string;
}

export interface SiteWeather {
  current: string;
  forecast: string;
  bestVisitTime: string;
}

export interface SiteVideo {
  title: string;
  url: string;
  thumbnail?: string;
}
