import { useEffect, useState } from 'react';
import { collection, documentId, onSnapshot, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { DEFAULT_COMPANY_ID, type CatalogRow } from './catalog';

// Fetch only customization documents referenced by the company's inventory.
export function useCatalogExtensions(inventory: CatalogRow[], companyId: string) {
  const idsKey = JSON.stringify(inventory.map(row => row.docId).sort());
  const scope = JSON.stringify([companyId, idsKey]);
  const [state, setState] = useState<{ scope: string; rows: CatalogRow[]; loading: boolean; error: string }>({ scope: '', rows: [], loading: false, error: '' });
  useEffect(() => {
    let active = true;
    const ids: string[] = JSON.parse(idsKey);
    const groups: string[][] = [];
    for (let i = 0; i < ids.length; i += 30) groups.push(ids.slice(i, i + 30));
    const snapshots = new Map<number, CatalogRow[]>();
    setState({ scope, rows: [], loading: !!groups.length, error: '' });
    const unsubscribers = groups.map((group, index) => onSnapshot(query(collection(db, 'product_extensions'), where(documentId(), 'in', group)), snapshot => {
      if (!active) return;
      snapshots.set(index, snapshot.docs.map(d => ({ ...d.data(), docId: d.id } as CatalogRow)).filter(row => (row.companyId || DEFAULT_COMPANY_ID) === companyId));
      setState(previous => previous.error ? previous : { scope, rows: [...snapshots.values()].flat(), loading: snapshots.size !== groups.length, error: '' });
    }, error => {
      if (!active) return;
      console.error('Error loading product details:', error);
      setState({ scope, rows: [], loading: false, error: 'No pudimos cargar los detalles del catálogo. Intenta nuevamente más tarde.' });
    }));
    return () => { active = false; unsubscribers.forEach(unsubscribe => unsubscribe()); };
  }, [companyId, idsKey, scope]);
  return {
    rows: state.scope === scope ? state.rows : [],
    loading: idsKey !== '[]' && (state.scope !== scope || state.loading),
    error: state.scope === scope ? state.error : '',
  };
}
