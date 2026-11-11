import { useCallback, useEffect, useRef, useState } from 'react';
import type { ShoppingListInfo } from '../types/recipe';
import { SHOPPING_LISTS_STORAGE_KEY, ACTIVE_SHOPPING_LIST_KEY } from './storageKeys';
import {
  broadcastLocalChange,
  subscribeToLocalChanges,
  fetchShoppingListsFromSupabase,
  pushShoppingListsToSupabase,
  deleteShoppingListFromSupabase,
  subscribeToShoppingLists,
} from '../services/realtimeSync';

function loadLists(): ShoppingListInfo[] {
  try {
    const saved = localStorage.getItem(SHOPPING_LISTS_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed.filter((l) => l && typeof l.id === 'string' && typeof l.name === 'string') : [];
  } catch {
    return [];
  }
}

function loadActiveId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_SHOPPING_LIST_KEY) || null;
  } catch {
    return null;
  }
}

/**
 * The shopping lists besides the main one: their names, shared with the household, and which
 * list is open in Inköp on this phone (null is the main list). The items themselves are in
 * the shopping list and carry the list's id as listId.
 */
export function useShoppingLists(householdId: string | undefined, isLiveSupabase: boolean) {
  const [lists, setLists] = useState<ShoppingListInfo[]>(loadLists);
  const [storedActiveId, setStoredActiveId] = useState<string | null>(loadActiveId);
  const listsRef = useRef(lists);
  listsRef.current = lists;

  // A list removed on another phone can't stay open here
  const activeListId = storedActiveId && lists.some((l) => l.id === storedActiveId) ? storedActiveId : null;

  useEffect(() => {
    try {
      localStorage.setItem(SHOPPING_LISTS_STORAGE_KEY, JSON.stringify(lists));
    } catch {
      // Stays for this visit
    }
  }, [lists]);

  const setActiveListId = useCallback((id: string | null) => {
    setStoredActiveId(id);
    try {
      if (id) localStorage.setItem(ACTIVE_SHOPPING_LIST_KEY, id);
      else localStorage.removeItem(ACTIVE_SHOPPING_LIST_KEY);
    } catch {
      // Stays for this visit
    }
  }, []);

  const commit = useCallback((next: ShoppingListInfo[]) => {
    listsRef.current = next;
    setLists(next);
    broadcastLocalChange({ type: 'SHOPPING_LISTS_UPDATE', payload: next });
  }, []);

  // Other tabs on this device
  useEffect(
    () =>
      subscribeToLocalChanges((msg) => {
        if (msg.type === 'SHOPPING_LISTS_UPDATE') setLists(msg.payload);
      }),
    []
  );

  // The household's lists, and changes from the others
  useEffect(() => {
    if (!isLiveSupabase || !householdId) return;
    let isMounted = true;
    const refresh = () => {
      fetchShoppingListsFromSupabase(householdId).then((remote) => {
        if (isMounted && remote) setLists(remote);
      });
    };
    refresh();
    const unsubscribe = subscribeToShoppingLists(householdId, refresh);
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [isLiveSupabase, householdId]);

  const createList = useCallback(
    (name: string): string => {
      const list: ShoppingListInfo = {
        id: `list-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: name.trim(),
        createdAt: new Date().toISOString(),
      };
      commit([...listsRef.current, list]);
      if (isLiveSupabase && householdId) pushShoppingListsToSupabase([list], householdId);
      return list.id;
    },
    [commit, isLiveSupabase, householdId]
  );

  const renameList = useCallback(
    (id: string, name: string) => {
      const next = listsRef.current.map((l) => (l.id === id ? { ...l, name: name.trim() } : l));
      commit(next);
      const changed = next.find((l) => l.id === id);
      if (changed && isLiveSupabase && householdId) pushShoppingListsToSupabase([changed], householdId);
    },
    [commit, isLiveSupabase, householdId]
  );

  /** Removes the list's name. Its items are removed by the caller. */
  const removeList = useCallback(
    (id: string) => {
      commit(listsRef.current.filter((l) => l.id !== id));
      if (isLiveSupabase) deleteShoppingListFromSupabase(id);
    },
    [commit, isLiveSupabase]
  );

  const resetLists = useCallback(() => {
    commit([]);
    setActiveListId(null);
  }, [commit, setActiveListId]);

  return { lists, activeListId, setActiveListId, createList, renameList, removeList, resetLists };
}
