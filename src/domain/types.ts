export type List = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
};

export type Item = {
  id: string;
  listId: string;
  name: string;
  quantityOrUnit?: string;
  checked: boolean;
  createdAt: number;
  updatedAt: number;
};

export type AppMetadata = {
  lastOpenedAt: number;
};
