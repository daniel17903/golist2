import type { SyncItemSnapshot } from '@golist/shared/domain/sync'
import type { Item, TodoFields } from '@golist/shared/domain/types'

import type { ListItemRecord } from './list-repository.js'

const toMillis = (value: string | undefined): number | undefined =>
  value === undefined ? undefined : Date.parse(value)

/** Converts the ISO-timestamp todo fields of a record or upsert input to the epoch-millis sync form. */
export const todoFieldsToMillis = (fields: TodoFields<string>): TodoFields<number> => ({
  description: fields.description,
  points: fields.points,
  completedAt: toMillis(fields.completedAt),
  dueDate: toMillis(fields.dueDate),
  assignedTo: fields.assignedTo,
  recurrence: fields.recurrence,
})

/** Converts epoch-millis todo fields from a sync patch to the ISO form the repositories store. */
export const todoFieldsToIso = (fields: TodoFields<number>): TodoFields<string> => ({
  description: fields.description,
  points: fields.points,
  completedAt: fields.completedAt === undefined ? undefined : new Date(fields.completedAt).toISOString(),
  dueDate: fields.dueDate === undefined ? undefined : new Date(fields.dueDate).toISOString(),
  assignedTo: fields.assignedTo,
  recurrence: fields.recurrence,
})

/** The snapshot both repositories hash for the last-write-wins tie-break. */
export const toItemSnapshot = (
  itemId: string,
  listId: string,
  fields: Omit<ListItemRecord, 'id' | 'listId' | 'createdAt'>,
): SyncItemSnapshot => ({
  id: itemId,
  listId,
  name: fields.name,
  iconName: fields.iconName,
  quantityOrUnit: fields.quantityOrUnit,
  category: fields.category,
  deleted: fields.deleted,
  updatedAt: Date.parse(fields.updatedAt),
  ...todoFieldsToMillis(fields),
})

/** The WebSocket sync representation of a stored item. */
export const toSyncItem = (item: ListItemRecord): Item => ({
  ...toItemSnapshot(item.id, item.listId, item),
  createdAt: Date.parse(item.createdAt),
})
