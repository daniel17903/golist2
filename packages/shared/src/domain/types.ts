/**
 * What a list is for. It drives the list's UI and check-off behavior:
 * `shopping` lists show the icon grid (checking an item off deletes it and it
 * comes back as a suggestion); `todo` lists show rows with due dates,
 * assignees, points and recurrence (checking a todo off sets `completedAt`).
 * Both types share the same items table and sync code. Lists without a type
 * (older clients, the API without `listType`) are `shopping`.
 */
export type ListType = "shopping" | "todo";

export const listTypes: readonly ListType[] = ["shopping", "todo"];

export const defaultListType: ListType = "shopping";

/** Upper bound for todo `points` (validated by the API; well inside the Postgres INTEGER range). */
export const maxTodoPoints = 1000;

export const isListType = (value: unknown): value is ListType => value === "shopping" || value === "todo";

export type SharedList = {
  id: string;
  name: string;
  /** Missing on lists stored before list types existed; read it via `resolveListType`. */
  listType?: ListType;
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
  createdByDeviceId?: string;
  createdAt: number;
  updatedAt: number;
} & TodoFields<number>;

export const resolveListType = (list: { listType?: ListType } | undefined | null): ListType =>
  list?.listType ?? defaultListType;

/**
 * Todo-only item fields. They are optional on every item: shopping items
 * leave them unset, and switching a list's type keeps them (they are just
 * not shown for shopping lists). Timestamps are epoch millis locally and ISO
 * strings in the REST API.
 */
export type TodoFields<TTimestamp> = {
  description?: string;
  /** Effort points (>= 1) used by the todo stats; unset means 1. */
  points?: number;
  completedAt?: TTimestamp;
  dueDate?: TTimestamp;
  assignedTo?: string;
  /** JSON-encoded recurrence rule (see apps/web/src/domain/recurrence.ts). */
  recurrence?: string;
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
  createdByDeviceId?: string;
  createdAt: string;
  updatedAt: string;
} & TodoFields<string>;

export type ApiListDocument = {
  listId: string;
  name: string;
  /** Always sent by the current backend; treated as `shopping` when missing. */
  listType?: ListType;
  createdAt: string;
  updatedAt: string;
  items: ApiListItem[];
};


export type ApiListUpsertRequest = {
  name: string;
  listType?: ListType;
  updatedAt?: string;
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
