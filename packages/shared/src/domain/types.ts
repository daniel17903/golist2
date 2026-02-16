export type SharedList = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
};

export type SharedItem = {
  id: string;
  listId: string;
  name: string;
  quantityOrUnit?: string;
  category: string;
  deleted: boolean;
  createdAt: number;
  updatedAt: number;
};

export type List = SharedList;

export type Item = SharedItem & {
  checked: boolean;
};

export type AppMetadata = {
  id: string;
  deviceId: string;
  appVersion: string;
  lastOpenedAt: number;
};

export type ShareTokenRecord = {
  tokenId: string;
  listId: string;
  createdAt: string;
};

export type ApiListItem = {
  id: string;
  listId: string;
  name: string;
  quantityOrUnit?: string;
  category: string;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ApiListDocument = {
  listId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  items: ApiListItem[];
};

export type ApiListUpsertRequest = {
  listId: string;
  name: string;
};

export type ApiListUpsertResponse = {
  listId: string;
  shareToken: string;
};

export type ApiItemUpsertRequest = {
  name: string;
  quantityOrUnit?: string;
  category: string;
  deleted: boolean;
  updatedAt: string;
};
