export type PlotStatus = 'Свободен' | 'Забронирован' | 'Продан';

export interface Plot {
  id: string;
  settlement: string;
  area: string;
  status: PlotStatus;
  price: string;
}

export interface Feature {
  title: string;
  text: string;
  icon: string;
}
