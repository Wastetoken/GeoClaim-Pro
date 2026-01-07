
export type LocalityType = 
  | 'mine' 
  | 'geography' 
  | 'geology' 
  | 'admin' 
  | 'settlement' 
  | 'protected' 
  | 'meteorite' 
  | 'erratic' 
  | 'extraterrestrial' 
  | 'artificial' 
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

export interface KmlData {
  localities: MineLocation[];
}
