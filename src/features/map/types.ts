export interface Sale {
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  detail: string;
}

export interface Store {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  url: string;
  services: string[];
  sales: Sale[];
}

export interface StoresData {
  updatedAt: string;
  stores: Store[];
}
