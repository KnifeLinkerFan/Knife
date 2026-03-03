export type IconType = 'default' | 'dna' | 'rna' | 'protein' | 'plasmid' | 'seed';
export type BoxCategory = 'general' | 'cells' | 'bacteria' | 'virus' | 'plant' | 'chemicals' | 'blood' | 'custom';

export interface Sample {
  id: string;
  name: string;
  date: string;
  concentration: string;
  purpose: string;
  notes: string;
  iconType?: IconType;
  position: { row: number; col: number }; // 0-indexed
}

export interface CryoBox {
  id: string;
  name: string;
  size: number; // e.g., 9 for 9x9
  category: BoxCategory;
  samples: Sample[];
  createdAt: number;
}
