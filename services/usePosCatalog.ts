import { useEffect, useState } from 'react';
import { collection, documentId, onSnapshot, query, where } from 'firebase/firestore';
import { posDb } from './posFirebase';
import { DEFAULT_COMPANY_ID, ORIGINAL_STORE_IDS, inventoryBelongsToCompany, categoryBelongsToCompany, type CatalogRow } from './catalog';

export function usePosCatalog(companyId: string, enabled: boolean) {
  const [inventory, setInventory] = useState<{ scope: string; rows: CatalogRow[]; loading: boolean; error: string }>({ scope: '', rows: [], loading: true, error: '' });
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const snapshots = new Map<number, CatalogRow[]>();
    const sources = [query(collection(posDb, 'inventory'), where('companyId', '==', companyId))];
    if (companyId === DEFAULT_COMPANY_ID) {
      sources.push(query(collection(posDb, 'inventory'), where('storeId', 'in', ORIGINAL_STORE_IDS)));
    }
    setInventory({ scope: companyId, rows: [], loading: true, error: '' });
    const unsubscribers = sources.map((source, index) => onSnapshot(source, snapshot => {
      if (!active) return;
      snapshots.set(index, snapshot.docs.map(d => ({ ...d.data(), docId: d.id })));
      const rows = new Map<string, CatalogRow>();
      snapshots.forEach(items => items.forEach(row => {
        if (inventoryBelongsToCompany(row, companyId)) rows.set(row.docId, row);
      }));
      setInventory(previous => previous.error ? previous : { scope: companyId, rows: [...rows.values()], loading: snapshots.size !== sources.length, error: '' });
    }, error => {
      if (!active) return;
      console.error('Error loading company catalog:', error);
      setInventory({ scope: companyId, rows: [], loading: false, error: 'No pudimos cargar los productos de la empresa seleccionada. Intenta de nuevo más tarde.' });
    }));
    return () => { active = false; unsubscribers.forEach(unsubscribe => unsubscribe()); };
  }, [companyId, enabled]);
  const rows = enabled && inventory.scope === companyId && !inventory.loading ? inventory.rows : [];
  const categoryIds = JSON.stringify([...new Set(rows.map(row => row.categoryId).filter(Boolean))].sort());
  const categoryScope = JSON.stringify([companyId, categoryIds]);
  const [categories, setCategories] = useState<{ scope: string; rows: CatalogRow[]; loading: boolean; error: string }>({ scope: '', rows: [], loading: false, error: '' });
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const ids: string[] = JSON.parse(categoryIds);
    const groups: string[][] = [];
    for (let index = 0; index < ids.length; index += 30) groups.push(ids.slice(index, index + 30));
    const snapshots = new Map<number, CatalogRow[]>();
    setCategories({ scope: categoryScope, rows: [], loading: !!groups.length, error: '' });
    const unsubscribers = groups.map((group, index) => onSnapshot(query(collection(posDb, 'categories'), where(documentId(), 'in', group)), snapshot => {
      if (!active) return;
      snapshots.set(index, snapshot.docs.map(d => ({ ...d.data(), docId: d.id })).filter(row => categoryBelongsToCompany(row, companyId)));
      setCategories(previous => previous.error ? previous : { scope: categoryScope, rows: [...snapshots.values()].flat(), loading: snapshots.size !== groups.length, error: '' });
    }, error => {
      if (!active) return;
      console.error('Error loading catalog categories:', error);
      setCategories({ scope: categoryScope, rows: [], loading: false, error: 'No pudimos cargar las categorías de esta empresa.' });
    }));
    return () => { active = false; unsubscribers.forEach(unsubscribe => unsubscribe()); };
  }, [companyId, categoryIds, categoryScope, enabled]);
  return {
    inventory: rows,
    categories: categories.scope === categoryScope && enabled ? categories.rows : [],
    loading: enabled && (inventory.scope !== companyId || inventory.loading || (categoryIds !== '[]' && (categories.scope !== categoryScope || categories.loading))),
    error: (inventory.scope === companyId ? inventory.error : '') || (categories.scope === categoryScope ? categories.error : ''),
  };
}
