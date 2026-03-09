export type Sale = {
  type: string
  status: "開催中" | "予告"
  startDate: string
  endDate: string
  detail: string
}

export type StoreService = "酒類取扱" | "カフェ併設" | "Tax Free"

export type Store = {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  url: string
  services: StoreService[]
  sales: Sale[]
}

export type StoresData = {
  updatedAt: string
  stores: Store[]
}
