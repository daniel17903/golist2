import crypto from 'node:crypto'

import { berlinDateOf, berlinMidnight, formatCalendarDate, parseCalendarDate } from '@golist/shared/domain/berlin-time'
import {
  defaultCategoryLanguage,
  detectCategoryLanguageForNames,
  getCategoryAndIconForItemName,
  supportedCategoryLanguages,
  type CategoryLanguage,
} from '@golist/shared/domain/item-category-mapping'
import { computeNextDueDate, nextOccurrenceId, parseRecurrence } from '@golist/shared/domain/recurrence'
import { listTypes, maxTodoPoints, type ListType } from '@golist/shared/domain/types'
import { McpServer, type CallToolResult } from '@modelcontextprotocol/server'
import { z } from 'zod'

import { toSyncItem } from '../repositories/item-snapshot.js'
import {
  type ItemBatchUpsertEntry,
  type ItemUpsertInput,
  type ListItemRecord,
  type ListRecord,
  type ListRepository,
} from '../repositories/list-repository.js'
import { type ListBroadcaster } from '../sync/list-broadcaster.js'
import { type ListSyncCache } from '../sync/list-sync-cache.js'

export type McpToolDeps = {
  listRepository: ListRepository
  listSyncCache: ListSyncCache
  broadcaster: ListBroadcaster
  /** Origin of the web app; share links point here. */
  appUrl: string
  /** Test seam for the clock (epoch millis). */
  now?: () => number
}

/** A failure the assistant should read (bad id, wrong list type, ...). */
class ToolError extends Error {}

const instructions = `GoList holds the user's shopping lists and todo lists.
- Call list_lists first and pick lists by name. When talking to the user, refer to lists and items by name, never by id.
- Shopping lists: add_items puts items on the list (an item that is already open gets its quantity updated instead of a duplicate); complete_items checks items off.
- Todo lists: items are todos with an optional description, due date (YYYY-MM-DD, Europe/Berlin calendar day), assignee, points and recurrence. complete_items marks todos done and creates the next occurrence of a recurring todo.
- Only pass quantityOrUnit when the user gave a quantity or unit.
- A list created with create_list or joined with join_list only shows up in the user's app once they open the share link the tool returns, so always give them that link.`

const listIdSchema = z.uuid().describe('The list id from list_lists.')
const itemIdsSchema = z.array(z.uuid()).min(1).max(100).describe('Item ids from get_list.')
const dueDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('Calendar day, YYYY-MM-DD.')
const recurrenceSchema = z
  .object({
    every: z.number().int().min(1).max(99),
    unit: z.enum(['day', 'week', 'month']),
    weekday: z
      .enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])
      .optional()
      .describe('Only for unit "week": move the next due date forward to this weekday.'),
    anchor: z
      .enum(['from_due_date', 'from_completion'])
      .describe('Count the interval from the previous due date or from the day the todo was completed.'),
  })
  .describe('Repeats the todo when it is completed. Needs a due date.')
const todoFieldsShape = {
  description: z.string().min(1).max(2000).optional().describe('Todo lists only.'),
  dueDate: dueDateSchema.optional().describe('Todo lists only. Calendar day, YYYY-MM-DD.'),
  points: z.number().int().min(1).max(maxTodoPoints).optional().describe('Todo lists only. Effort points (default 1).'),
  assignedTo: z.string().min(1).max(100).optional().describe('Todo lists only. Who should do it.'),
  recurrence: recurrenceSchema.optional().describe('Todo lists only. Repeats the todo when it is completed; needs a due date.'),
}

const toDueDateIso = (value: string): string => {
  const date = parseCalendarDate(value)
  if (!date) {
    throw new ToolError(`"${value}" is not a valid calendar day (YYYY-MM-DD).`)
  }
  return new Date(berlinMidnight(date)).toISOString()
}

const toRecurrenceJson = (rule: z.infer<typeof recurrenceSchema>): string =>
  // Same shape and key order the app's recurrence input writes.
  JSON.stringify({
    every: rule.every,
    unit: rule.unit,
    anchor: rule.anchor,
    ...(rule.unit === 'week' && rule.weekday ? { weekday: rule.weekday } : {}),
  })

const toItemView = (item: ListItemRecord, listType: ListType) => ({
  itemId: item.id,
  name: item.name,
  quantityOrUnit: item.quantityOrUnit,
  ...(listType === 'shopping'
    ? { category: item.category }
    : {
        description: item.description,
        dueDate: item.dueDate ? formatCalendarDate(berlinDateOf(Date.parse(item.dueDate))) : undefined,
        points: item.points,
        assignedTo: item.assignedTo,
        recurrence: item.recurrence ? (parseRecurrence(item.recurrence) ?? undefined) : undefined,
        completedAt: item.completedAt,
      }),
})

const inputFromRecord = (item: ListItemRecord): Omit<ItemUpsertInput, 'updatedAt'> => ({
  name: item.name,
  iconName: item.iconName,
  quantityOrUnit: item.quantityOrUnit,
  category: item.category,
  deleted: item.deleted,
  description: item.description,
  points: item.points,
  completedAt: item.completedAt,
  dueDate: item.dueDate,
  assignedTo: item.assignedTo,
  recurrence: item.recurrence,
})

const ok = (data: object): CallToolResult => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] })

async function runTool(work: () => Promise<object>): Promise<CallToolResult> {
  try {
    return ok(await work())
  } catch (error) {
    if (error instanceof ToolError) {
      return { content: [{ type: 'text', text: error.message }], isError: true }
    }
    throw error
  }
}

/**
 * The MCP server for one connector: every tool reads and writes as the
 * connector's own device, so it reaches exactly the lists
 * `ListRepository.hasListAccess` allows for that device.
 */
export function buildMcpServer(connectorDeviceId: string, deps: McpToolDeps): McpServer {
  const { listRepository, listSyncCache, broadcaster } = deps
  const now = deps.now ?? Date.now
  // A write must be newer than the stored version to win last-write-wins,
  // even when the device that wrote it has a clock that runs ahead.
  const nextUpdatedAt = (previous?: string) =>
    new Date(Math.max(now(), previous === undefined ? 0 : Date.parse(previous) + 1)).toISOString()
  const shareUrl = (shareToken: string) => `${deps.appUrl.replace(/\/+$/, '')}/?shareToken=${shareToken}`

  const requireList = async (listId: string): Promise<ListRecord> => {
    const list = (await listRepository.hasListAccess(listId, connectorDeviceId)) ? await listRepository.getList(listId) : null
    if (!list) {
      throw new ToolError('No list with this id is available to this connection. Call list_lists to see the available lists.')
    }
    return list
  }

  const requireItems = async (listId: string, itemIds: string[]): Promise<ListItemRecord[]> => {
    const items = await Promise.all(itemIds.map((itemId) => listRepository.getListItem(listId, itemId)))
    const missing = itemIds.filter((_, index) => !items[index] || items[index].deleted)
    if (missing.length > 0) {
      throw new ToolError(`These items are not on the list: ${missing.join(', ')}. Call get_list to see the current items.`)
    }
    return items.filter((item): item is ListItemRecord => item !== null)
  }

  /** Stores the items and pushes the accepted versions to the open apps. */
  const writeItems = async (listId: string, entries: ItemBatchUpsertEntry[]): Promise<void> => {
    if (entries.length === 0) {
      return
    }
    const results = await listRepository.upsertListItems(listId, connectorDeviceId, entries)
    if (results.some((result) => result.outcome === 'conflict')) {
      throw new ToolError('An item id belongs to another list.')
    }
    const acceptedIds = entries
      .filter((_, index) => results[index].outcome === 'created' || results[index].outcome === 'updated')
      .map((entry) => entry.itemId)
    if (acceptedIds.length === 0) {
      return
    }
    listSyncCache.invalidate(listId)
    const stored = await Promise.all(acceptedIds.map((itemId) => listRepository.getListItem(listId, itemId)))
    broadcaster.broadcastItemPatch(
      listId,
      stored.filter((item): item is ListItemRecord => item !== null).map(toSyncItem),
    )
  }

  const categoryLanguageOf = async (listId: string, requested?: CategoryLanguage) => {
    if (requested) {
      return requested
    }
    const items = await listRepository.listItems(listId)
    return detectCategoryLanguageForNames(
      items.filter((item) => !item.deleted).map((item) => item.name),
      defaultCategoryLanguage,
    )
  }

  const categoryAndIcon = (name: string, language: CategoryLanguage) => {
    const resolved = getCategoryAndIconForItemName(name, language)
    return { category: resolved.category ?? 'other', iconName: resolved.iconName ?? 'default' }
  }

  const server = new McpServer({ name: 'golist', version: '1.0.0' }, { instructions })

  server.registerTool(
    'list_lists',
    {
      title: 'List lists',
      description: 'Lists the shopping and todo lists this connection can use, with the number of open items on each.',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    () =>
      runTool(async () => {
        const lists = await listRepository.listAccessibleLists(connectorDeviceId)
        const views = await Promise.all(
          lists.map(async (list) => {
            const items = await listRepository.listItems(list.id)
            const openItems = items.filter((item) => !item.deleted && item.completedAt === undefined).length
            return { listId: list.id, name: list.name, listType: list.listType, openItems }
          }),
        )
        return { lists: views.sort((a, b) => a.name.localeCompare(b.name)) }
      }),
  )

  server.registerTool(
    'get_list',
    {
      title: 'Show list',
      description:
        'Shows a list and its open items. Todo lists can include completed todos too. ' +
        'Due dates are Europe/Berlin calendar days.',
      inputSchema: z.object({
        listId: listIdSchema,
        includeCompleted: z.boolean().optional().describe('Todo lists only: also return completed todos.'),
      }),
      annotations: { readOnlyHint: true },
    },
    ({ listId, includeCompleted }) =>
      runTool(async () => {
        const list = await requireList(listId)
        const items = (await listRepository.listItems(listId)).filter(
          (item) => !item.deleted && (includeCompleted || item.completedAt === undefined),
        )
        return {
          listId: list.id,
          name: list.name,
          listType: list.listType,
          items: items.map((item) => toItemView(item, list.listType)),
        }
      }),
  )

  server.registerTool(
    'add_items',
    {
      title: 'Add items',
      description:
        'Adds items to a shopping list or todos to a todo list. On a shopping list, an item that is already ' +
        'open is not added twice; a given quantity replaces its quantity.',
      inputSchema: z.object({
        listId: listIdSchema,
        items: z
          .array(
            z.object({
              name: z.string().trim().min(1).max(200),
              quantityOrUnit: z.string().trim().min(1).max(100).optional().describe('e.g. "2", "500 g", "1 pack".'),
              ...todoFieldsShape,
            }),
          )
          .min(1)
          .max(100),
        language: z
          .enum(supportedCategoryLanguages)
          .optional()
          .describe('Language of the item names, used to pick categories and icons. Detected from the list by default.'),
      }),
    },
    ({ listId, items, language }) =>
      runTool(async () => {
        const list = await requireList(listId)
        const categoryLanguage = await categoryLanguageOf(listId, language)
        const openByName = new Map(
          (await listRepository.listItems(listId))
            .filter((item) => !item.deleted && item.completedAt === undefined)
            .map((item) => [item.name.toLocaleLowerCase(), item]),
        )
        const entries: ItemBatchUpsertEntry[] = []
        const added: string[] = []
        const updated: string[] = []
        const alreadyOnList: string[] = []

        for (const item of items) {
          const existing = list.listType === 'shopping' ? openByName.get(item.name.toLocaleLowerCase()) : undefined
          if (existing) {
            if (item.quantityOrUnit === undefined || item.quantityOrUnit === existing.quantityOrUnit) {
              alreadyOnList.push(existing.name)
              continue
            }
            entries.push({
              itemId: existing.id,
              input: {
                ...inputFromRecord(existing),
                quantityOrUnit: item.quantityOrUnit,
                updatedAt: nextUpdatedAt(existing.updatedAt),
              },
            })
            updated.push(existing.name)
            continue
          }

          const todoFields =
            list.listType === 'todo'
              ? {
                  description: item.description,
                  dueDate: item.dueDate === undefined ? undefined : toDueDateIso(item.dueDate),
                  points: item.points !== undefined && item.points > 1 ? item.points : undefined,
                  assignedTo: item.assignedTo,
                  recurrence:
                    item.recurrence && item.dueDate !== undefined ? toRecurrenceJson(item.recurrence) : undefined,
                }
              : {}
          const itemId = crypto.randomUUID()
          entries.push({
            itemId,
            input: {
              name: item.name,
              quantityOrUnit: item.quantityOrUnit,
              ...categoryAndIcon(item.name, categoryLanguage),
              deleted: false,
              updatedAt: nextUpdatedAt(),
              ...todoFields,
            },
          })
          // Same name twice in one call: the second one updates the first.
          openByName.set(item.name.toLocaleLowerCase(), {
            id: itemId,
            listId,
            createdAt: '',
            ...entries[entries.length - 1].input,
          })
          added.push(item.name)
        }

        await writeItems(listId, entries)
        return { list: list.name, added, updated, alreadyOnList }
      }),
  )

  server.registerTool(
    'update_item',
    {
      title: 'Update item',
      description:
        'Changes an item or todo. Omitted fields stay as they are; null clears a field. ' +
        'Renaming an item also picks a new category and icon.',
      inputSchema: z.object({
        listId: listIdSchema,
        itemId: z.uuid().describe('The item id from get_list.'),
        name: z.string().trim().min(1).max(200).optional(),
        quantityOrUnit: z.string().trim().min(1).max(100).nullable().optional(),
        description: todoFieldsShape.description.unwrap().nullable().optional().describe('Todo lists only.'),
        dueDate: dueDateSchema.nullable().optional().describe('Todo lists only. Clearing it also clears the recurrence.'),
        points: todoFieldsShape.points.unwrap().nullable().optional().describe('Todo lists only.'),
        assignedTo: todoFieldsShape.assignedTo.unwrap().nullable().optional().describe('Todo lists only.'),
        recurrence: recurrenceSchema.nullable().optional().describe('Todo lists only; needs a due date.'),
      }),
    },
    (args) =>
      runTool(async () => {
        const list = await requireList(args.listId)
        const [item] = await requireItems(args.listId, [args.itemId])
        const pick = <T>(value: T | null | undefined, existing: T | undefined): T | undefined =>
          value === undefined ? existing : (value ?? undefined)
        const renamed = args.name !== undefined && args.name !== item.name
        const next: ItemUpsertInput = {
          ...inputFromRecord(item),
          name: args.name ?? item.name,
          quantityOrUnit: pick(args.quantityOrUnit, item.quantityOrUnit),
          ...(renamed ? categoryAndIcon(args.name!, await categoryLanguageOf(args.listId)) : {}),
          updatedAt: nextUpdatedAt(item.updatedAt),
        }
        if (list.listType === 'todo') {
          next.description = pick(args.description, item.description)
          next.dueDate = pick(args.dueDate && toDueDateIso(args.dueDate), item.dueDate)
          const points = pick(args.points, item.points)
          next.points = points !== undefined && points > 1 ? points : undefined
          next.assignedTo = pick(args.assignedTo, item.assignedTo)
          next.recurrence = pick(args.recurrence && toRecurrenceJson(args.recurrence), item.recurrence)
          if (next.dueDate === undefined) {
            next.recurrence = undefined
          }
        }
        await writeItems(args.listId, [{ itemId: item.id, input: next }])
        const stored = await listRepository.getListItem(args.listId, item.id)
        return { list: list.name, item: stored ? toItemView(stored, list.listType) : undefined }
      }),
  )

  server.registerTool(
    'complete_items',
    {
      title: 'Check off items',
      description:
        'Checks items off a shopping list, or marks todos as done. Completing a recurring todo creates its next ' +
        'occurrence, like the app does.',
      inputSchema: z.object({ listId: listIdSchema, itemIds: itemIdsSchema }),
    },
    ({ listId, itemIds }) =>
      runTool(async () => {
        const list = await requireList(listId)
        const items = await requireItems(listId, itemIds)
        const completedAt = new Date(now()).toISOString()
        const entries: ItemBatchUpsertEntry[] = []
        const nextOccurrences: Array<{ name: string; dueDate: string }> = []

        for (const item of items) {
          if (list.listType === 'shopping') {
            entries.push({ itemId: item.id, input: { ...inputFromRecord(item), deleted: true, updatedAt: nextUpdatedAt(item.updatedAt) } })
            continue
          }
          if (item.completedAt !== undefined) {
            continue
          }
          entries.push({ itemId: item.id, input: { ...inputFromRecord(item), completedAt, updatedAt: nextUpdatedAt(item.updatedAt) } })

          const nextDueDate =
            item.recurrence && item.dueDate !== undefined
              ? computeNextDueDate(item.recurrence, Date.parse(item.dueDate), Date.parse(completedAt))
              : null
          if (nextDueDate !== null) {
            // Same deterministic id the app uses, so a completion made here
            // and one made in the app never create two next occurrences.
            const occurrenceId = nextOccurrenceId(item.id)
            const previous = await listRepository.getListItem(listId, occurrenceId)
            entries.push({
              itemId: occurrenceId,
              input: {
                ...inputFromRecord(item),
                deleted: false,
                completedAt: undefined,
                dueDate: new Date(nextDueDate).toISOString(),
                updatedAt: nextUpdatedAt(previous?.updatedAt),
              },
            })
            nextOccurrences.push({ name: item.name, dueDate: formatCalendarDate(berlinDateOf(nextDueDate)) })
          }
        }

        await writeItems(listId, entries)
        return { list: list.name, completed: items.map((item) => item.name), nextOccurrences }
      }),
  )

  server.registerTool(
    'delete_items',
    {
      title: 'Delete items',
      description: 'Removes items or todos from a list without completing them.',
      inputSchema: z.object({ listId: listIdSchema, itemIds: itemIdsSchema }),
      annotations: { destructiveHint: true },
    },
    ({ listId, itemIds }) =>
      runTool(async () => {
        const list = await requireList(listId)
        const items = await requireItems(listId, itemIds)
        await writeItems(
          listId,
          items.map((item) => ({
            itemId: item.id,
            input: { ...inputFromRecord(item), deleted: true, updatedAt: nextUpdatedAt(item.updatedAt) },
          })),
        )
        return { list: list.name, deleted: items.map((item) => item.name) }
      }),
  )

  server.registerTool(
    'rename_list',
    {
      title: 'Rename list',
      description: 'Renames a list, or switches it between a shopping list and a todo list.',
      inputSchema: z.object({
        listId: listIdSchema,
        name: z.string().trim().min(1).max(200).optional(),
        listType: z.enum(listTypes).optional(),
      }),
    },
    ({ listId, name, listType }) =>
      runTool(async () => {
        const list = await requireList(listId)
        const nextName = name ?? list.name
        const nextType = listType ?? list.listType
        const updatedAt = nextUpdatedAt(list.updatedAt)
        const result = await listRepository.putList(listId, nextName, connectorDeviceId, updatedAt, nextType)
        if (result.outcome === 'forbidden') {
          throw new ToolError('This connection may not change this list.')
        }
        if (result.outcome === 'updated') {
          listSyncCache.invalidate(listId)
          broadcaster.broadcastListMetadataPatch(listId, { name: nextName, listType: nextType, updatedAt: Date.parse(updatedAt) })
        }
        return { listId, name: nextName, listType: nextType }
      }),
  )

  server.registerTool(
    'create_list',
    {
      title: 'Create list',
      description:
        'Creates a new list and returns its share link. The list shows up in the user\'s app only after they open ' +
        'the link, so always give it to them.',
      inputSchema: z.object({
        name: z.string().trim().min(1).max(200),
        listType: z.enum(listTypes).optional().describe('Defaults to "shopping".'),
      }),
    },
    ({ name, listType }) =>
      runTool(async () => {
        const listId = crypto.randomUUID()
        await listRepository.putList(listId, name, connectorDeviceId, nextUpdatedAt(), listType ?? 'shopping')
        const token = await listRepository.createShareToken(listId, connectorDeviceId)
        await listRepository.recordShareTokenRedemption(token.tokenId, connectorDeviceId)
        return { listId, name, listType: listType ?? 'shopping', shareUrl: shareUrl(token.tokenId) }
      }),
  )

  server.registerTool(
    'share_list',
    {
      title: 'Share list',
      description: 'Creates a share link for a list. Anyone who opens it can view and edit the list in GoList.',
      inputSchema: z.object({ listId: listIdSchema }),
    },
    ({ listId }) =>
      runTool(async () => {
        const list = await requireList(listId)
        const token = await listRepository.createShareToken(listId, connectorDeviceId)
        await listRepository.recordShareTokenRedemption(token.tokenId, connectorDeviceId)
        return { list: list.name, shareUrl: shareUrl(token.tokenId) }
      }),
  )

  server.registerTool(
    'join_list',
    {
      title: 'Join list',
      description: 'Joins a list someone shared, from its share link (or the token in it).',
      inputSchema: z.object({ shareLink: z.string().min(1).max(500).describe('The share link, or just its token.') }),
    },
    ({ shareLink }) =>
      runTool(async () => {
        const shareToken = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.exec(shareLink)?.[0]
        const token = shareToken ? await listRepository.findValidShareToken(shareToken.toLowerCase()) : null
        if (!token) {
          throw new ToolError('This share link is not valid (or no longer valid).')
        }
        await listRepository.recordShareTokenRedemption(token.tokenId, connectorDeviceId)
        const list = await requireList(token.listId)
        return { listId: list.id, name: list.name, listType: list.listType, shareUrl: shareUrl(token.tokenId) }
      }),
  )

  return server
}
