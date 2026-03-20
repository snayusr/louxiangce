export interface Category {
  id: number;
  name: string;
  parent_id?: number | null;
}

export interface MediaItem {
  id?: number;
  album_id?: number;
  url: string;
  type: 'image' | 'video';
}

export interface AlbumEntry {
  id: number;
  category_id: number;
  category_name?: string;
  title: string;
  description: string;
  media: MediaItem[];
  lat: number | null;
  lng: number | null;
  location_name: string | null;
  sort_order: number;
  created_at: string;
}

export interface Location {
  lat: number;
  lng: number;
}
