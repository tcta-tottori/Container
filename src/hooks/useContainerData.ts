'use client';

import { useReducer, useCallback } from 'react';
import { Container, ContainerItem } from '@/lib/types';

interface OriginalValues {
  totalQty: number;
  palletCount: number;
  caseCount: number;
}

export interface ContainerState {
  containers: Container[];
  selectedContainerIdx: number;
  items: ContainerItem[];
  currentItemIdx: number;
  originalValues: Map<string, OriginalValues>;
  modifiedValues: Map<string, Partial<OriginalValues>>;
  itemStartTime: number | null;
  autoAnnounce: boolean;
}

export type Action =
  | { type: 'LOAD_DATA'; containers: Container[] }
  | { type: 'SELECT_CONTAINER'; idx: number }
  | { type: 'SELECT_ITEM'; idx: number }
  | { type: 'MOVE_NEXT' }
  | { type: 'MOVE_PREV' }
  | { type: 'INCREASE_QTY' }
  | { type: 'DECREASE_QTY' }
  | { type: 'DELETE_CURRENT' }
  | { type: 'TOGGLE_AUTO_ANNOUNCE' };

const initialState: ContainerState = {
  containers: [],
  selectedContainerIdx: 0,
  items: [],
  currentItemIdx: 0,
  originalValues: new Map(),
  modifiedValues: new Map(),
  itemStartTime: null,
  autoAnnounce: true,
};

function buildOriginalValues(items: ContainerItem[]): Map<string, OriginalValues> {
  const map = new Map<string, OriginalValues>();
  for (const item of items) {
    map.set(item.id, {
      totalQty: item.totalQty,
      palletCount: item.palletCount,
      caseCount: item.caseCount,
    });
  }
  return map;
}

function reducer(state: ContainerState, action: Action): ContainerState {
  switch (action.type) {
    case 'LOAD_DATA': {
      const containers = action.containers;
      if (containers.length === 0) return { ...state, containers };
      const items = [...containers[0].items];
      return {
        ...state,
        containers,
        selectedContainerIdx: 0,
        items,
        currentItemIdx: 0,
        originalValues: buildOriginalValues(items),
        modifiedValues: new Map(),
        itemStartTime: Date.now(),
      };
    }

    case 'SELECT_CONTAINER': {
      const idx = action.idx;
      if (idx < 0 || idx >= state.containers.length) return state;
      const items = [...state.containers[idx].items];
      return {
        ...state,
        selectedContainerIdx: idx,
        items,
        currentItemIdx: 0,
        originalValues: buildOriginalValues(items),
        modifiedValues: new Map(),
        itemStartTime: Date.now(),
      };
    }

    case 'SELECT_ITEM': {
      const idx = action.idx;
      if (idx < 0 || idx >= state.items.length) return state;
      return {
        ...state,
        currentItemIdx: idx,
        itemStartTime: Date.now(),
      };
    }

    case 'MOVE_NEXT': {
      if (state.items.length === 0) return state;
      const next = (state.currentItemIdx + 1) % state.items.length;
      return {
        ...state,
        currentItemIdx: next,
        itemStartTime: Date.now(),
      };
    }

    case 'MOVE_PREV': {
      if (state.items.length === 0) return state;
      const prev =
        (state.currentItemIdx - 1 + state.items.length) % state.items.length;
      return {
        ...state,
        currentItemIdx: prev,
        itemStartTime: Date.now(),
      };
    }

    case 'INCREASE_QTY': {
      if (state.items.length === 0) return state;
      const item = state.items[state.currentItemIdx];
      const original = state.originalValues.get(item.id);
      if (!original || item.qtyPerPallet === 0) return state;

      const newPallet = item.palletCount + 1;
      const newTotal = item.totalQty + item.qtyPerPallet;

      // 上限チェック
      if (newPallet > original.palletCount) return state;
      if (newTotal > original.totalQty) return state;

      const newItems = [...state.items];
      newItems[state.currentItemIdx] = {
        ...item,
        palletCount: newPallet,
        totalQty: newTotal,
      };

      const modified = new Map(state.modifiedValues);
      modified.set(item.id, {
        palletCount: newPallet,
        totalQty: newTotal,
      });

      return { ...state, items: newItems, modifiedValues: modified };
    }

    case 'DECREASE_QTY': {
      if (state.items.length === 0) return state;
      const item = state.items[state.currentItemIdx];
      if (item.qtyPerPallet === 0) return state;

      const newPallet = item.palletCount - 1;
      const newTotal = item.totalQty - item.qtyPerPallet;

      // 下限チェック
      if (newPallet < 0 || newTotal < 0) return state;

      const newItems = [...state.items];
      newItems[state.currentItemIdx] = {
        ...item,
        palletCount: newPallet,
        totalQty: newTotal,
      };

      const modified = new Map(state.modifiedValues);
      modified.set(item.id, {
        palletCount: newPallet,
        totalQty: newTotal,
      });

      return { ...state, items: newItems, modifiedValues: modified };
    }

    case 'DELETE_CURRENT': {
      if (state.items.length === 0) return state;
      const newItems = state.items.filter(
        (_, i) => i !== state.currentItemIdx
      );
      const newIdx =
        newItems.length === 0
          ? 0
          : Math.min(state.currentItemIdx, newItems.length - 1);
      return {
        ...state,
        items: newItems,
        currentItemIdx: newIdx,
        itemStartTime: newItems.length > 0 ? Date.now() : null,
      };
    }

    case 'TOGGLE_AUTO_ANNOUNCE':
      return { ...state, autoAnnounce: !state.autoAnnounce };

    default:
      return state;
  }
}

export function useContainerData() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const currentItem: ContainerItem | null =
    state.items.length > 0 ? state.items[state.currentItemIdx] : null;

  const currentContainer: Container | null =
    state.containers.length > 0
      ? state.containers[state.selectedContainerIdx]
      : null;

  const relatedItems = currentItem
    ? state.items
        .filter(
          (it) =>
            it.type === currentItem.type && it.id !== currentItem.id
        )
        .slice(0, 4)
    : [];

  const loadData = useCallback(
    (containers: Container[]) => dispatch({ type: 'LOAD_DATA', containers }),
    []
  );
  const selectContainer = useCallback(
    (idx: number) => dispatch({ type: 'SELECT_CONTAINER', idx }),
    []
  );
  const selectItem = useCallback(
    (idx: number) => dispatch({ type: 'SELECT_ITEM', idx }),
    []
  );
  const moveNext = useCallback(() => dispatch({ type: 'MOVE_NEXT' }), []);
  const movePrev = useCallback(() => dispatch({ type: 'MOVE_PREV' }), []);
  const increaseQty = useCallback(
    () => dispatch({ type: 'INCREASE_QTY' }),
    []
  );
  const decreaseQty = useCallback(
    () => dispatch({ type: 'DECREASE_QTY' }),
    []
  );
  const deleteCurrent = useCallback(
    () => dispatch({ type: 'DELETE_CURRENT' }),
    []
  );
  const toggleAutoAnnounce = useCallback(
    () => dispatch({ type: 'TOGGLE_AUTO_ANNOUNCE' }),
    []
  );

  return {
    state,
    currentItem,
    currentContainer,
    relatedItems,
    loadData,
    selectContainer,
    selectItem,
    moveNext,
    movePrev,
    increaseQty,
    decreaseQty,
    deleteCurrent,
    toggleAutoAnnounce,
  };
}
