import type { CategoryLanguage } from './item-category-mapping';

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
  iconName: string;
  quantityOrUnit?: string;
  category: string;
  deleted: boolean;
  createdAt: number;
  updatedAt: number;
};

export type List = SharedList;
export type Item = SharedItem;

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
  name: string;
  iconName: string;
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
  name: string;
};

export type ApiListUpsertResponse = {
  listId: string;
};

export type ApiShareTokenCreateResponse = {
  tokenId: string;
  listId: string;
  createdAt: string;
  shareToken: string;
};

export type ApiShareTokenRedeemResponse = {
  listId: string;
};

export type ApiItemUpsertRequest = {
  name: string;
  iconName?: string;
  quantityOrUnit?: string;
  category?: string;
  language?: CategoryLanguage;
  deleted: boolean;
  updatedAt: string;
};
