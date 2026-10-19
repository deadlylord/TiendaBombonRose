

import './styles.css';
import React, { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from "motion/react";
import { Product, Category, Banner, StoreConfig, CartItem, Order, ToastMessage, User, StoreBranch } from './types';
import { db, auth } from './services/firebase';
import { usePosCatalog } from './services/usePosCatalog';
import { useCatalogExtensions } from './services/useCatalogExtensions';
import { buildCatalog, catalogCompany, DEFAULT_COMPANY_ID, validateCart } from './services/catalog';
import { initializeApp, deleteApp } from 'firebase/app';
import { doc, getDoc, onSnapshot, setDoc, collection, updateDoc, deleteDoc, runTransaction, query, where, QueryConstraint } from 'firebase/firestore';
import { onAuthStateChanged, getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, User as FirebaseUser } from 'firebase/auth';

import {
  CartIcon, ChevronLeftIcon, ChevronRightIcon, CloseIcon, InstagramIcon, MenuIcon,
  SearchIcon, TikTokIcon, WhatsAppIcon, TrashIcon, PlusIcon, MinusIcon,
  PencilIcon, HeartIcon, ShoppingBagIcon, ArrowLeftIcon
} from './components/Icons';

import { revealStorefront } from './services/startupScreen';
import BannerCarousel from './components/BannerCarousel';
import ProductDetails from './components/ProductDetails';
import { publishedCollections, collectionProducts, collectionPath, collectionIdFromPath } from './services/storeCollections';
import StoreLogo from './components/StoreLogo';
import CategoryNav from './components/CategoryNav';
import CatalogControls from './components/CatalogControls';
import ProductImage from './components/ProductImage';
import { searchCatalog, availableVariantOptions, CatalogFilters, CatalogSort } from './services/catalogSearch';
import { orderCategories, isMensCategory } from './services/categoryOrder';
import { createStoreNavigation } from './services/storeNavigation';
import AdminInput from './components/AdminInput';
import BranchesSection from './components/BranchesSection';
import { generateProductDescription } from './services/productTools';
import DeferredPanelBoundary from './components/DeferredPanelBoundary';

const AdminPanel = lazy(() => import('./components/AdminPanel'));

// --- MOCK DATA (Initial values for Firestore) ---
const initialConfig: StoreConfig = {
    inventoryCompanyId: DEFAULT_COMPANY_ID,
    logoUrl: 'https://i.ibb.co/3Y7f0fM/bombon-logo.png',
    secondLogoUrl: 'https://i.ibb.co/9GZ9m3z/street-legends-logo.png',
    contact: { name: 'Bombon Store', phone: '573001234567', schedule: 'Lunes a Sábado, 9am - 7pm' },
    social: { instagram: 'https://instagram.com/bombonrosecol', tiktok: 'https://tiktok.com/@bombonrosecol', whatsapp: '573001234567' },
    paymentMethodsImageUrl: '/medios-pago-bombon.png',
    announcements: [
        '✨ ¡Envío GRATIS por compras superiores a $200.000! 🇨🇴',
        '⚡ Nueva Colección Street Legends disponible ya'
    ],
    showAnnouncements: true,
    shippingCostAmount: 10000,
    shippingCostBogota: 10000,
    shippingCostNational: 15000,
    freeShippingThreshold: 200000
};

const initialBanners: Banner[] = [
    { id: 1, imageUrl: 'https://i.ibb.co/tCg3r0X/banner1.jpg', title: 'Colección Esencia', subtitle: 'Descubre tu estilo, define tu esencia.', link: '#productos' },
    { id: 2, imageUrl: 'https://i.ibb.co/FnyhY2j/banner2.jpg', title: 'Vibra con el Color', subtitle: 'Piezas únicas para un look inolvidable.', link: '#productos' },
    { id: 3, imageUrl: 'https://i.ibb.co/P9M5dcD/banner3.jpg', title: 'Pantalones con Estilo', subtitle: 'Comodidad y elegancia en cada paso.', link: 'category:Pantalones' }
];


// --- Helper Functions ---
const safeJsonStringify = (val: any): string => {
    try {
        return JSON.stringify(val);
    } catch (err) {
        try {
            const seen = new WeakSet();
            return JSON.stringify(val, (_key, value) => {
                if (typeof value === 'object' && value !== null) {
                    if (seen.has(value)) {
                        return undefined;
                    }
                    seen.add(value);
                }
                return value;
            });
        } catch (innerErr) {
            console.error("Critical error stringifying circular structure:", innerErr);
            return "[]";
        }
    }
};

const useBrowserStorage = <T,>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] => {
  const read = () => {
    try { const item = window.localStorage.getItem(key); return item ? JSON.parse(item) as T : initialValue; }
    catch { return initialValue; }
  };
  const [state, setState] = useState(() => ({ key, value: read() }));
  const value = state.key === key ? state.value : read();
  const setValue: React.Dispatch<React.SetStateAction<T>> = update => {
    const next = typeof update === 'function' ? (update as (previous: T) => T)(value) : update;
    setState({ key, value: next });
    try { window.localStorage.setItem(key, safeJsonStringify(next)); }
    catch (error) { console.error('Could not persist cart:', error); }
  };
  return [value, setValue];
};

const useFirestoreDocSync = <T extends object>(collectionName: string, docId: string, initialValue: T): [T, (value: T) => Promise<void>, boolean] => {
    const [data, setData] = useState<T>(initialValue);
    const [isLoading, setIsLoading] = useState(true);
    const docRef = useMemo(() => doc(db, collectionName, docId), [collectionName, docId]);

    useEffect(() => {
        const unsubscribe = onSnapshot(docRef,
            (docSnap) => {
                if (docSnap.exists()) {
                    setData({ ...initialValue, ...docSnap.data() } as T);
                } else {
                    setData(initialValue);
                }
                setIsLoading(false);
            },
            (error) => {
                console.error(`Firestore onSnapshot error for ${collectionName}/${docId}:`, error);
                setIsLoading(false);
            }
        );

        return () => unsubscribe();
    }, [docRef]);

    const setValue = useCallback(async (value: T) => {
        try {
            await setDoc(docRef, value, { merge: true });
        } catch (error) {
            console.error(`Firestore setDoc error for ${collectionName}/${docId}:`, error);
            throw error;
        }
    }, [docRef, collectionName, docId]);

    return [data, setValue, isLoading];
};

const useFirestoreCollectionSync = <T extends {docId: string}>(collectionName: string, enabled = true, scope = '', constraints: QueryConstraint[] = []): [T[], boolean] => {
    const [state, setState] = useState<{ key: string; data: T[]; loading: boolean }>({ key: '', data: [], loading: true });
    const key = JSON.stringify([collectionName, scope, enabled]);
    useEffect(() => {
        if (!enabled) return;
        let active = true;
        setState({ key, data: [], loading: true });
        const unsubscribe = onSnapshot(query(collection(db, collectionName), ...constraints), snapshot => {
            if (active) setState({ key, data: snapshot.docs.map(d => ({ ...d.data(), docId: d.id } as T)), loading: false });
        }, error => {
            console.error(`Firestore error for ${collectionName}:`, error);
            if (active) setState({ key, data: [], loading: false });
        });
        return () => { active = false; unsubscribe(); };
    }, [key]);
    return [enabled && state.key === key ? state.data : [], enabled && (state.key !== key || state.loading)];
};

const App: React.FC = () => {
    // Authentication gates every private collection subscription.
    const [isAdminOpen, setAdminOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
    const [userData, setUserData] = useState<User | null>(null);
    const [isAuthLoading, setAuthLoading] = useState(true);
    const [config, setConfig, isConfigLoading] = useFirestoreDocSync<StoreConfig>('store', 'config', initialConfig);
    const companyId = catalogCompany(config);
    const privateEnabled = isAdminOpen && !!currentUser && !!userData;
    const [{ list: banners }, setBannersDoc, areBannersLoading] = useFirestoreDocSync<{list: Banner[]}>('store', 'banners', { list: initialBanners });
    const [{ list: menBanners }, setMenBannersDoc] = useFirestoreDocSync<{list: Banner[]}>('store', 'menBanners', { list: initialBanners });
    const { inventory: posInventory, categories: posCategories, loading: areProductsLoading, error: posCatalogError } = usePosCatalog(companyId, !isConfigLoading);
    const companyConstraints = companyId === DEFAULT_COMPANY_ID ? [] : [where('companyId', '==', companyId)];
    const { rows: productExtensions, loading: areExtensionsLoading, error: extensionsError } = useCatalogExtensions(posInventory, companyId);
    const catalogError = posCatalogError || extensionsError;
    const setCategoriesDoc = (value: { list: Category[] }) => setDoc(doc(db, 'store', 'categories'), value, { merge: true });
    const [allOrders, areOrdersLoading] = useFirestoreCollectionSync<Order>('orders', privateEnabled, companyId, companyConstraints);
    const orders = allOrders.filter(order => (order.companyId || DEFAULT_COMPANY_ID) === companyId);
    const [branches, _areBranchesLoading] = useFirestoreCollectionSync<StoreBranch>('branches');
    const [users, areUsersLoading] = useFirestoreCollectionSync<User>('users', privateEnabled && userData?.role === 'admin', currentUser?.uid);
    const [cart, setCart] = useBrowserStorage<CartItem[]>(`storeCart:${companyId}`, []);
    const isCatalogLoading = isConfigLoading || areProductsLoading || areExtensionsLoading;
    const builtProducts = useMemo(() => buildCatalog(posInventory, posCategories, productExtensions, companyId), [posInventory, posCategories, productExtensions, companyId]);
    const lastCompleteCatalog = useRef<{ companyId: string; products: Product[] } | null>(null);
    if (!isCatalogLoading) lastCompleteCatalog.current = { companyId, products: builtProducts };
    const products = !isCatalogLoading ? builtProducts : lastCompleteCatalog.current?.companyId === companyId ? lastCompleteCatalog.current.products : [];

    const collections = useMemo(() => publishedCollections(config, companyId), [config, companyId]);
    const [activeCollectionId, setActiveCollectionId] = useState<string | null>(() => collectionIdFromPath(window.location.pathname));
    const activeCollection = collections.find(collection => collection.id === activeCollectionId);
    const collectionItems = useMemo(() => activeCollection ? collectionProducts(activeCollection, products, companyId) : [], [activeCollection, products, companyId]);

    // Only show populated categories; local aliases must not add empty categories.
    const categories = useMemo(() => orderCategories(products.map(product => product.category)), [products]);
    // UI State
    const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isCartOpen, setCartOpen] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [isInvoiceModalOpen, setInvoiceModalOpen] = useState(false);
    const [isOrdering, setOrdering] = useState(false);
    const orderingLock = useRef(false);
    const pendingOrderRef = useRef<ReturnType<typeof doc> | null>(null);
    const [isAddUserModalOpen, setAddUserModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [productToEdit, setProductToEdit] = useState<Product | null>(null);
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    // Theme State
    const [isMenTheme, setIsMenTheme] = useState(false);

    // Search & Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSizeFilter, setSelectedSizeFilter] = useState('');
    const [selectedColorFilter, setSelectedColorFilter] = useState('');
    const [catalogSort, setCatalogSort] = useState<CatalogSort>('recent');
    const [selectedCategory, setSelectedCategory] = useState<Category | 'All' | 'On Sale'>('All');

    // Admin State
    const [editMode, setEditMode] = useState(false);

    const previousCompany = useRef(companyId);
    useEffect(() => {
        if (previousCompany.current !== companyId) {
            previousCompany.current = companyId;
            setSelectedProduct(null);
            setActiveCollectionId(null);
            setProductToEdit(null);
            setInvoiceModalOpen(false);
            setSelectedCategory('All');
            setSearchTerm('');
            setSelectedSizeFilter('');
            setSelectedColorFilter('');
            pendingOrderRef.current = null;
        }
    }, [companyId]);

    // Theme Effect
    useEffect(() => {
        const root = document.documentElement;
        if (isMenTheme) {
            root.setAttribute('data-theme', 'men');
        } else {
            root.removeAttribute('data-theme');
        }
    }, [isMenTheme]);

    // --- ROUTING LOGIC ---
    const [currentPath, setCurrentPath] = useState(window.location.pathname);

    const navigation = useRef<ReturnType<typeof createStoreNavigation> | null>(null);
    useEffect(() => {
        navigation.current = createStoreNavigation(window, setCurrentPath);
        return () => { navigation.current?.dispose(); navigation.current = null; };
    }, []);

    useEffect(() => {
        const route = currentPath;
        const collectionId = collectionIdFromPath(route);
        if (collectionId) { setActiveCollectionId(collectionId); setIsSearching(false); }
        else if (route === '/' || route === '/search') setActiveCollectionId(null);

        const productMatch = route.match(/^\/product\/([^/]+)/);
        const isAdminRoute = route === '/admin';
        const isCartRoute = route === '/cart';
        const isCheckoutRoute = route === '/checkout';
        const isSearchRoute = route === '/search';

        // Close secondary (non-routed) modals if a primary one is opening
        if (productMatch || isAdminRoute || isCartRoute || isCheckoutRoute || isSearchRoute) {
            if (isSearchRoute) setIsSearching(true);
            setAddUserModalOpen(false);
        }

        if (route === '/') setIsSearching(false);

        // Handle Product Detail Modal
        if (productMatch) {
            let productId = productMatch[1];
            try { productId = decodeURIComponent(productId); } catch { /* Preserve malformed paths for the not-found flow. */ }
            const product = (products || []).find(p => p.id === productId);
            if (product) {
                setSelectedProduct(product);
            } else if (!isCatalogLoading) {
                navigate('/'); // Product not found
            }
        } else {
            setSelectedProduct(null);
        }

        // Handle Admin Panel
        setAdminOpen(isAdminRoute);

        // Handle Cart Panel
        setCartOpen(isCartRoute);

        // Handle Checkout/Invoice Modal
        setInvoiceModalOpen(isCheckoutRoute);
    }, [currentPath, products, isCatalogLoading]);

    const navigate = (path: string) => navigation.current?.navigate(path);
    const closeModal = () => navigation.current?.close();
    const openCollection = (id: string) => {
        setActiveCollectionId(id); setIsSearching(false); setIsMenTheme(false);
        navigate(collectionPath(id)); window.scrollTo({ top: 0, behavior: 'instant' });
    };

    const handleOpenProductDetails = (product: Product) => {
        navigate(`/product/${encodeURIComponent(product.id)}`);
    };

    const handleOpenCart = () => {
        navigate('/cart');
    };

    const handleOpenAdmin = () => {
        navigate('/admin');
    };

    // --- AUTH EFFECT ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);
            setUserData(null);
            try {
            if (user) {
                const userDocRef = doc(db, 'users', user.uid);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                    setUserData({ ...userDocSnap.data(), docId: userDocSnap.id } as User);
                } else {
                    console.warn(`No user data found in Firestore for UID: ${user.uid}`);
                    setUserData(null);
                }
            } else {
                setUserData(null);
            }
            } catch (error) {
                console.error('Error loading user permissions:', error);
                setUserData(null);
            } finally { setAuthLoading(false); }
        });
        return () => unsubscribe();
    }, []);

    // --- UTILS ---
    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
            showToast("Sesión cerrada exitosamente.");
            closeModal();
        } catch (error) {
            console.error("Error signing out: ", error);
            showToast("Error al cerrar sesión.", "error");
        }
    };

    // --- DERIVED STATE & MEMOS ---
    const cartItemCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
    const cartSubtotal = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);

    const catalogFilters: CatalogFilters = { term: searchTerm, category: selectedCategory, size: selectedSizeFilter, color: selectedColorFilter, sort: catalogSort };
    const filteredProducts = useMemo(() => searchCatalog(products, { term: searchTerm, category: selectedCategory, size: selectedSizeFilter, color: selectedColorFilter, sort: catalogSort }), [products, selectedCategory, searchTerm, selectedSizeFilter, selectedColorFilter, catalogSort]);
    const sizeOptions = useMemo(() => availableVariantOptions(products, 'sizes'), [products]);
    const colorOptions = useMemo(() => availableVariantOptions(products, 'colors'), [products]);
    const handleCatalogFilters = (filters: CatalogFilters) => {
        setSearchTerm(filters.term);
        setSelectedCategory(filters.category);
        setSelectedSizeFilter(filters.size);
        setSelectedColorFilter(filters.color);
        setCatalogSort(filters.sort);
        setIsMenTheme(isMensCategory(filters.category));
        if (currentPath !== '/search') navigate('/search');
    };
    const catalogControls = <CatalogControls filters={catalogFilters} categories={categories} sizes={sizeOptions} colors={colorOptions} count={filteredProducts.length} onChange={handleCatalogFilters} />;

    const newArrivals = useMemo(() => {
        return [...(products || [])]
            .sort((a, b) => {
                if (a.isNewArrival && !b.isNewArrival) return -1;
                if (!a.isNewArrival && b.isNewArrival) return 1;
                const dateA = a.updatedAt || a.createdAt || 0;
                const dateB = b.updatedAt || b.createdAt || 0;
                return dateB - dateA;
            })
            .slice(0, 6);
    }, [products]);
    const bestSellers = useMemo(() => {
        return [...(products || [])]
            .filter(p => p.available)
            .sort((a, b) => {
                if (a.isFeatured && !b.isFeatured) return -1;
                if (!a.isFeatured && b.isFeatured) return 1;
                return Math.random() - 0.5;
            })
            .slice(0, 8);
    }, [products]);

    const handleBulkGenerateDescriptions = async (category: string) => {
        const productsToUpdate = products.filter(p => p.category === category);
        if (productsToUpdate.length === 0) {
            showToast(`No hay productos en la categoría ${category}.`, 'error');
            return;
        }

        if (!window.confirm(`¿Estás seguro de que quieres generar descripciones con IA para los ${productsToUpdate.length} productos de la categoría "${category}"? Esto sobrescribirá las descripciones actuales.`)) {
            return;
        }

        showToast(`Iniciando generación masiva para ${productsToUpdate.length} productos...`);

        let successCount = 0;
        let lastError = '';
        for (const product of productsToUpdate) {
            try {
                const result = await generateProductDescription(product.name, product.imageUrl);
                if (result && typeof result === 'object') {
                    const updatedProduct = { ...product, description: result.description, name: result.name };
                    // We call handleUpdateProduct directly to persist each one
                    const extension = {
                        companyId,
                        nameOverride: updatedProduct.name,
                        descriptionOverride: updatedProduct.description,
                        imageUrlOverride: updatedProduct.imageUrl,
                        additionalImages: (updatedProduct.additionalImages || []).map(image => image.trim()).filter(Boolean),
                        sizeGuideText: updatedProduct.sizeGuideText || '',
                        priceOverride: updatedProduct.price,
                        discountPercentage: updatedProduct.discountPercentage || 0,
                        variants: updatedProduct.variants,
                        madeInColombia: updatedProduct.madeInColombia || false
                    };
                    await setDoc(doc(db, 'product_extensions', updatedProduct.id), extension, { merge: true });
                    successCount++;
                } else if (typeof result === 'string' && result.startsWith('Error')) {
                    lastError = result;
                }
            } catch (err: any) {
                console.error(`Error en producto ${product.name}:`, err);
                lastError = err.message || 'Error desconocido';
            }
        }

        if (successCount > 0) {
            showToast(`¡Proceso completado! Se generaron ${successCount} descripciones.`);
        } else if (lastError) {
            alert(`No se pudo generar ninguna descripción. Último error:\n${lastError}`);
        } else {
            showToast('No se generaron descripciones.', 'error');
        }
    };

    // --- EVENT HANDLERS ---
    useEffect(() => {
        if (config.logoUrl) {
            let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
            if (!link) {
                link = document.createElement('link');
                link.rel = 'icon';
                document.getElementsByTagName('head')[0].appendChild(link);
            }
            link.href = config.logoUrl;
        }
    }, [config.logoUrl]);

    const handleAddToCart = (product: Product, quantity: number, size?: string, color?: string) => {
        const cartItemId = `${product.id}${size ? `-${size}` : ''}${color ? `-${color}` : ''}`;
        const existingItem = cart.find(item => item.id === cartItemId);
        const currentQuantity = cart.filter(item => item.productId === product.id).reduce((sum, item) => sum + item.quantity, 0);

        if (product.stock !== undefined && (currentQuantity + quantity) > product.stock) {
            showToast(`No hay suficiente stock disponible. (Máx: ${product.stock})`, "error");
            return;
        }

        const hasDiscount = product.discountPercentage != null && product.discountPercentage > 0;
        const finalPrice = hasDiscount
            ? product.price * (1 - (product.discountPercentage || 0) / 100)
            : product.price;

        if (existingItem) {
            setCart(cart.map(item => item.id === cartItemId ? { ...item, quantity: item.quantity + quantity } : item));
        } else {
            const newItem: CartItem = {
                id: cartItemId,
                productId: product.id,
                name: product.name,
                price: finalPrice,
                quantity,
                imageUrl: (color && product.variants?.colors?.[color]?.imageUrl) || product.imageUrl,
                size,
                color,
            };
            setCart([...cart, newItem]);
        }
        showToast(`${product.name} agregado al carrito!`);

        if (currentPath.startsWith('/product/')) closeModal();
    };

    const handleQuickAddToCart = (product: Product) => {
      const hasDefinedSizes = !!(product.variants?.hasSizes && product.variants.sizes && Object.keys(product.variants.sizes).length > 0);
      const hasDefinedColors = !!(product.variants?.hasColors && product.variants.colors && Object.keys(product.variants.colors).length > 0);

      if (hasDefinedSizes || hasDefinedColors) {
        handleOpenProductDetails(product);
      } else {
        handleAddToCart(product, 1);
      }
    };

    const handleQuickAddFromCart = (product: Product) => {
      const hasDefinedSizes = !!(product.variants?.hasSizes && product.variants.sizes && Object.keys(product.variants.sizes).length > 0);
      const hasDefinedColors = !!(product.variants?.hasColors && product.variants.colors && Object.keys(product.variants.colors).length > 0);

      if (hasDefinedSizes || hasDefinedColors) {
        handleOpenProductDetails(product);
      } else {
        handleAddToCart(product, 1);
      }
    };

    const handleRemoveFromCart = (cartItemId: string) => {
        setCart(cart.filter(item => item.id !== cartItemId));
        showToast("Producto eliminado del carrito.", "error");
    };

    const handleUpdateCartQuantity = (cartItemId: string, newQuantity: number) => {
        if (newQuantity <= 0) {
            handleRemoveFromCart(cartItemId);
            return;
        }
        const updated = cart.map(item => item.id === cartItemId ? { ...item, quantity: newQuantity } : item);
        try { validateCart(updated, products); setCart(updated); }
        catch (error) { showToast(error instanceof Error ? error.message : 'Revisa el carrito.', 'error'); }
    };

    const handleClearCart = () => {
        setCart([]);
        showToast("Carrito vaciado.", "error");
    };

    const handleOpenProductEdit = (product: Product) => {
        setProductToEdit(product);
        handleOpenAdmin();
    };

    useEffect(() => {
        if (!isAdminOpen) {
            setProductToEdit(null);
        }
    }, [isAdminOpen]);

    const handleNavigateToCategory = (e: React.MouseEvent<HTMLAnchorElement>, category: Category | 'All') => {
        e.preventDefault();
        if (activeCollectionId) { setActiveCollectionId(null); navigate('/'); }
        setSelectedCategory(category);
        setMobileMenuOpen(false);

        // Update theme based on category
        if (category === 'All') {
            setIsMenTheme(false);
        } else {
            setIsMenTheme(isMensCategory(category));
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCategoryButtonClick = (category: Category | 'All') => {
      if (activeCollectionId) { setActiveCollectionId(null); navigate('/'); }
      setSelectedCategory(category);

      // Update theme based on category
      if (category === 'All') {
          setIsMenTheme(false);
      } else {
          setIsMenTheme(isMensCategory(category));
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSearchAndNavigate = (term: string, category?: Category | 'All' | 'On Sale') => {
        setSearchTerm(term);
        if (category !== undefined) {
            setSelectedCategory(category);

            // Update theme based on category
            if (category === 'All' || category === 'On Sale') {
                setIsMenTheme(false);
            } else {
                setIsMenTheme(isMensCategory(category));
            }
        }

        if (term === '' && category === undefined) {
            // Back button case
            setSelectedCategory('All');
            setSelectedSizeFilter('');
            setSelectedColorFilter('');
            setIsSearching(false);
            navigate('/');
        } else if (currentPath !== '/search') {
            setIsSearching(false);
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // --- ADMIN CRUD HANDLERS ---
    const handleUpdateConfig = async (newConfig: StoreConfig) => {
        try {
            if (userData?.role !== 'admin') throw new Error('Solo un administrador puede cambiar la configuración.');
            const inventoryCompanyId = catalogCompany(newConfig);
            if (!/^[A-Za-z0-9_-]{1,128}$/.test(inventoryCompanyId)) throw new Error('El identificador de empresa no es válido.');
            await setConfig({ ...newConfig, inventoryCompanyId });
            showToast("¡Configuración guardada con éxito!");
        } catch (error) {
            console.error("Error updating config:", error);
            showToast(error instanceof Error ? error.message : 'Error al guardar la configuración.', 'error');
            throw error;
        }
    };
    const handleSaveBanners = async (newBanners: Banner[]) => {
        await setBannersDoc({ list: newBanners }); showToast("Banners principales guardados.");
    };
    const handleSaveMenBanners = async (newBanners: Banner[]) => {
        await setMenBannersDoc({ list: newBanners }); showToast("Banners de hombre guardados.");
    };
    const handleSaveCategories = (newCategories: Category[]) => { setCategoriesDoc({ list: newCategories }); showToast("Categorías guardadas."); };

    const handleAddProduct = async (newProduct: Product) => {
      try {
          // In this setup, we don't add products to POS from here usually,
          // but if we do, we save the extension part locally.
          const extension = {
              companyId,
              nameOverride: newProduct.name,
              descriptionOverride: newProduct.description,
              imageUrlOverride: newProduct.imageUrl,
              additionalImages: (newProduct.additionalImages || []).map(image => image.trim()).filter(Boolean),
              sizeGuideText: newProduct.sizeGuideText || '',
              priceOverride: newProduct.price,
              discountPercentage: newProduct.discountPercentage || 0,
              variants: newProduct.variants,
              isFeatured: newProduct.isFeatured || false,
              isNewArrival: newProduct.isNewArrival || false,
              updatedAt: Date.now()
          };
          await setDoc(doc(db, 'product_extensions', newProduct.id), extension, { merge: true });
          showToast("Producto configurado localmente.");
          return true;
      } catch (error) {
          console.error(error);
          showToast('No se pudo guardar el producto. Intenta nuevamente.', 'error');
          return false;
      }
    };

    const handleUpdateProduct = async (updatedProduct: Product) => {
      try {
          const extension = {
              companyId,
              nameOverride: updatedProduct.name,
              descriptionOverride: updatedProduct.description,
              imageUrlOverride: updatedProduct.imageUrl,
              additionalImages: (updatedProduct.additionalImages || []).map(image => image.trim()).filter(Boolean),
              sizeGuideText: updatedProduct.sizeGuideText || '',
              priceOverride: updatedProduct.price,
              discountPercentage: updatedProduct.discountPercentage || 0,
              variants: updatedProduct.variants,
              madeInColombia: updatedProduct.madeInColombia || false,
              isFeatured: updatedProduct.isFeatured || false,
              isNewArrival: updatedProduct.isNewArrival || false,
              updatedAt: Date.now()
          };
          await setDoc(doc(db, 'product_extensions', updatedProduct.id), extension, { merge: true });
          showToast("Producto actualizado localmente.");
          return true;
      } catch (error) {
          console.error(error);
          showToast('No se pudo guardar el producto. Intenta nuevamente.', 'error');
          return false;
      }
    };

    const handleDeleteProduct = (productId: string) => {
        if (window.confirm("¿Estás seguro de que quieres eliminar la configuración local de este producto? El producto seguirá existiendo en el POS.")) {
            deleteDoc(doc(db, 'product_extensions', productId));
            showToast("Configuración local eliminada.", "error");
        }
    };

    const handleNewOrder = async (orderData: Omit<Order, 'docId' | 'orderNumber' | 'status' | 'date'>) => {
        if (orderingLock.current) return;
        orderingLock.current = true;
        setOrdering(true);
        // Open during the click so mobile browsers don't block WhatsApp after saving.
        const popup = window.open('about:blank', '_blank');
        if (popup) popup.opener = null;
        try {
            if (catalogError || isCatalogLoading) throw new Error('Espera a que se actualice el catálogo.');
            const items = validateCart(orderData.items, products);
            const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
            if (Math.abs(subtotal - orderData.subtotal) > 0.01) throw new Error('Cambió el precio de una prenda. Vuelve al carrito y agrégala nuevamente para revisar el total.');
            if (!/^[0-9]{10,15}$/.test(orderData.customerPhone.replace(/\D/g, ''))) throw new Error('Revisa tu número de WhatsApp.');
            if (!/^[0-9]{10,15}$/.test(config.social.whatsapp) || config.social.whatsapp === '573001234567') throw new Error('La tienda debe configurar su número real de WhatsApp antes de recibir pedidos.');
            if (orderData.deliveryMethod === 'Recoger en Tienda' && !branches.some(branch => branch.docId === orderData.pickupBranchId)) throw new Error('Selecciona la sede donde recogerás el pedido.');
            const orderRef = pendingOrderRef.current || doc(collection(db, 'orders'));
            pendingOrderRef.current = orderRef;
            const orderCounterRef = doc(db, 'store', 'orderCounter');
            const newOrder = await runTransaction(db, async transaction => {
                const existingOrder = await transaction.get(orderRef);
                if (existingOrder.exists()) return existingOrder.data() as Omit<Order, 'docId'>;
                const counter = await transaction.get(orderCounterRef);
                const nextNumber = (counter.data()?.currentNumber || 1000) + 1;
                const order: Omit<Order, 'docId'> = {
                    ...orderData, items, subtotal, total: subtotal + orderData.shippingCost,
                    companyId, orderNumber: `BMB-${nextNumber}`, status: 'Pendiente', date: new Date().toISOString(),
                };
                transaction.set(orderCounterRef, { currentNumber: nextNumber }, { merge: true });
                transaction.set(orderRef, order);
                return order;
            });
            const messageItems = newOrder.items.map(item => `- ${item.quantity}x ${item.name} ${item.size ? `(Talla: ${item.size})` : ''} ${item.color ? `(Color: ${item.color})` : ''} - ${formatCurrency(item.price * item.quantity)}`).join('\n');
            const message = `¡Hola ${config.contact.name}! 👋 Quiero hacer un pedido:\n\n*Número de Orden:* ${newOrder.orderNumber}\n\n*Productos:*\n${messageItems}\n\n*Subtotal:* ${formatCurrency(newOrder.subtotal)}\n*Envío:* ${formatCurrency(newOrder.shippingCost)}\n*TOTAL:* ${formatCurrency(newOrder.total)}\n\n*Datos del Cliente:*\n- Nombre: ${newOrder.customerName}\n- Teléfono: ${newOrder.customerPhone}\n\n*Entrega:* ${newOrder.deliveryMethod}\n${newOrder.pickupBranchName ? `- Sede: ${newOrder.pickupBranchName}\n` : ''}${newOrder.address ? `- Dirección: ${newOrder.address}\n` : ''}*Medio de Pago:* ${newOrder.paymentMethod}\n\n¡Gracias! 😊`;
            const whatsappUrl = `https://wa.me/${config.social.whatsapp}?text=${encodeURIComponent(message)}`;
            // The order and its number are saved atomically before handing off to WhatsApp.
            setCart([]);
            pendingOrderRef.current = null;
            navigate('/');
            showToast('Pedido guardado. Confirma el mensaje en WhatsApp.');
            if (popup && !popup.closed) popup.location.href = whatsappUrl;
            else window.location.assign(whatsappUrl);
        } catch (error) {
            popup?.close();
            console.error('Error creating order:', error);
            showToast(error instanceof Error ? error.message : 'No se pudo guardar el pedido. Tu carrito se conserva.', 'error');
        } finally {
            orderingLock.current = false;
            setOrdering(false);
        }
    };

    const handleDeleteOrder = async (orderDocId: string) => {
        if (window.confirm("¿Estás seguro de que quieres eliminar este pedido? Esta acción no se puede deshacer.")) {
            try {
                await deleteDoc(doc(db, 'orders', orderDocId));
                showToast("Pedido eliminado.", "error");
            } catch (error) {
                console.error("Error deleting order:", error);
                showToast("Error al eliminar el pedido.", "error");
            }
        }
    };

    const handleUpdateOrder = async (orderDocId: string, dataToUpdate: Partial<Order>) => {
        try {
            await updateDoc(doc(db, 'orders', orderDocId), dataToUpdate);
            showToast("Pedido actualizado.");
        } catch (error) {
            console.error("Error updating order:", error);
            showToast("Error al actualizar el pedido.", "error");
        }
    };

    const handleCreateUser = async (email: string, password: string, role: User['role']) => {
        if (userData?.role !== 'admin') { showToast('Solo un administrador puede crear usuarios.', 'error'); return; }
        const creationApp = initializeApp(auth.app.options, `user-creation-${Date.now()}`);
        const creationAuth = getAuth(creationApp);
        try {
            const userCredential = await createUserWithEmailAndPassword(creationAuth, email, password);
            const user = userCredential.user;
            if (!user) throw new Error("User creation failed.");
            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                email: user.email,
                role: role
            });
            showToast("Usuario creado exitosamente.");
            setAddUserModalOpen(false);
        } catch (error: any) {
            console.error("Error creating user:", error);
            let errorMessage = "Error al crear el usuario.";
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = "El correo electrónico ya está en uso.";
            } else if (error.code === 'auth/weak-password') {
                errorMessage = "La contraseña debe tener al menos 6 caracteres.";
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = "El correo electrónico no es válido.";
            }
            showToast(errorMessage, "error");
            throw error; // Rethrow to allow modal to handle loading state
        } finally {
            await signOut(creationAuth);
            await deleteApp(creationApp);
        }
    };

    const handleUpdateUserRole = async (userDocId: string, newRole: User['role']) => {
        if (userData?.role !== 'admin') return;
        try {
            await updateDoc(doc(db, 'users', userDocId), { role: newRole });
            showToast("Rol de usuario actualizado.");
        } catch (error) {
            console.error("Error updating user role:", error);
            showToast("Error al cambiar el rol.", "error");
        }
    };

    const handleDeleteUser = async (userDocId: string) => {
        if (userData?.role !== 'admin') return;
        if (window.confirm("¿Seguro que quieres eliminar a este usuario? Perderá el acceso al panel. Esta acción no se puede deshacer.")) {
            try {
                // This deletes the user's role document, effectively revoking access.
                // Deleting from Firebase Auth requires a backend function for security.
                await deleteDoc(doc(db, 'users', userDocId));
                showToast("Usuario eliminado del panel.", "error");
            } catch (error) {
                console.error("Error deleting user document:", error);
                showToast("Error al eliminar el usuario.", "error");
            }
        }
    };

    useEffect(() => {
        if (!isConfigLoading && currentPath !== '/' && (!currentPath.startsWith('/product/') || !isCatalogLoading)) revealStorefront();
    }, [isConfigLoading, currentPath, isCatalogLoading]);

    if (isConfigLoading) return null;

    // --- UI COMPONENTS ---
    const ToastContainer = () => (
        <div className="fixed bottom-5 right-5 md:bottom-8 md:right-8 z-[100] space-y-2 pointer-events-none">
            {toasts.map(toast => (
                <motion.div
                    key={toast.id}
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className={`pointer-events-auto px-5 py-3.5 rounded-2xl shadow-2xl font-semibold ${
                        toast.type === 'success'
                        ? 'bg-white/90 text-primary border border-primary/30'
                        : 'bg-red-500/95 text-white border border-white/10'
                    } flex items-center gap-3 max-w-sm backdrop-blur-md`}
                >
                    <span className="text-lg">{toast.type === 'success' ? '✨' : '⚠️'}</span>
                    <span className="text-sm tracking-wide">{toast.message}</span>
                </motion.div>
            ))}
        </div>
    );

    // --- RENDER ADMIN OR LOGIN VIEW ---
    const renderAdminView = () => {
        if (!isAdminOpen) return null;

        if (isAuthLoading) {
             return (
                <div className="fixed inset-0 bg-black/60 z-[90] flex items-center justify-center">
                    <svg className="animate-spin h-10 w-10 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                </div>
             );
        }

        if (!currentUser || !userData) {
            return <LoginPage showToast={showToast} onClose={closeModal} />;
        }

        if (areOrdersLoading || areUsersLoading) return <div className="fixed inset-0 z-[90] bg-white flex items-center justify-center">Cargando administración…</div>;
        return (
            <DeferredPanelBoundary><Suspense fallback={<div className="fixed inset-0 z-[90] bg-white flex items-center justify-center">Abriendo administración…</div>}><AdminPanel
                user={userData}
                onClose={closeModal}
                editMode={editMode}
                setEditMode={setEditMode}
                store={{ config, banners, menBanners, products, categories, orders, users, branches }}
                onUpdateConfig={handleUpdateConfig}
                onSaveBanners={handleSaveBanners}
                onSaveMenBanners={handleSaveMenBanners}
                onSaveCategories={handleSaveCategories}
                onAddProduct={handleAddProduct}
                onUpdateProduct={handleUpdateProduct}
                onDeleteProduct={handleDeleteProduct}
                onBulkGenerateDescriptions={handleBulkGenerateDescriptions}
                formatCurrency={formatCurrency}
                productToEdit={productToEdit}
                onDeleteOrder={handleDeleteOrder}
                onUpdateOrder={handleUpdateOrder}
                onLogout={handleLogout}
                onAddUser={() => setAddUserModalOpen(true)}
                onUpdateUserRole={handleUpdateUserRole}
                onDeleteUser={handleDeleteUser}
                branches={branches}
            /></Suspense></DeferredPanelBoundary>
        );
    }

    // --- MAIN RENDER ---
    const hasAnnouncements = config?.showAnnouncements !== false && config?.announcements && config.announcements.some(ann => ann.trim() !== '');

    return (
        <div className="bg-background min-h-screen">
            <ToastContainer />
            <Header
                logoUrl={isMenTheme ? (config.secondLogoUrl || 'https://i.ibb.co/9GZ9m3z/street-legends-logo.png') : config.logoUrl}
                cartItemCount={cartItemCount}
                onCartClick={handleOpenCart}
                isMobileMenuOpen={isMobileMenuOpen}
                setMobileMenuOpen={setMobileMenuOpen}
                categories={categories}
                onSelectCategory={handleNavigateToCategory}
                selectedCategory={selectedCategory}
                currentUser={currentUser}
                onAdminClick={handleOpenAdmin}
                onHomeClick={() => {
                    setActiveCollectionId(null);
                    setSelectedCategory('All');
                    setSearchTerm('');
                    setSelectedSizeFilter('');
                    setSelectedColorFilter('');
                    setIsSearching(false);
                    setIsMenTheme(false);
                    navigate('/');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                onSearchClick={() => navigate('/search')}
                isMenTheme={isMenTheme}
                config={config}
            />

            <div className={`transition-all ${hasAnnouncements ? 'h-28 sm:h-32' : 'h-20 sm:h-24'}`} />
            {catalogError && <div role="alert" className="mx-auto max-w-3xl my-6 p-4 bg-rose-50 text-rose-900 rounded-lg text-center">{catalogError}</div>}

            <main>
              {!activeCollectionId && (isSearching || selectedCategory !== 'All') && <CategoryNav
                categories={categories} products={products} selectedCategory={selectedCategory}
                images={config.categoryImagesByCompany?.[companyId]}
                onSelectCategory={handleCategoryButtonClick}
              />}
              <AnimatePresence initial={false} mode="wait">
                {activeCollectionId ? (
                  <section key={`collection:${activeCollectionId}`} className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-10">
                    <button type="button" onClick={() => { setActiveCollectionId(null); setSelectedCategory('All'); navigate('/'); window.scrollTo({ top: 0, behavior: 'instant' }); }} className="mb-5 flex items-center gap-2 text-sm text-pink-800"><ArrowLeftIcon className="h-4 w-4" />Volver a la tienda</button>
                    {activeCollection ? <>
                      <header className="mb-8 overflow-hidden rounded-2xl border border-pink-100 bg-[#fff8fb] sm:mb-10 sm:rounded-3xl">
                        {activeCollection.imageUrl && <ProductImage src={activeCollection.imageUrl} alt={activeCollection.name} className="block h-auto max-h-[78svh] w-full object-contain" eager />}
                        <div className="px-5 py-7 text-center sm:px-10 sm:py-10"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-pink-700">Colección</p><h1 className="mt-3 break-words font-serif text-4xl text-[#880E4F] sm:text-5xl lg:text-6xl">{activeCollection.name}</h1>{activeCollection.description && <p className="mx-auto mt-4 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-gray-600 sm:text-base">{activeCollection.description}</p>}<p className="mt-4 text-xs text-gray-500 sm:text-sm">{collectionItems.length} prendas disponibles</p></div>
                      </header>
                      {collectionItems.length === 0 && !isCatalogLoading ? <p className="py-12 text-center text-sm text-gray-500">Por ahora no hay prendas disponibles en esta colección.</p> : <ProductGrid loading={isCatalogLoading && collectionItems.length === 0} products={collectionItems} resultKey={`collection:${activeCollection.id}`} onOpenDetails={handleOpenProductDetails} onQuickAdd={handleQuickAddToCart} editMode={editMode} userRole={userData?.role} onOpenEdit={handleOpenProductEdit} formatCurrency={formatCurrency} />}
                    </> : <div className="py-12 text-center"><h1 className="font-serif text-2xl">Esta colección no está disponible</h1><p className="mt-3 text-sm text-gray-500">Puedes seguir viendo las prendas del catálogo.</p></div>}
                  </section>
                ) : isSearching ? (
                  <motion.section
                    key="search"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="py-12 bg-surface min-h-screen"
                  >
                    <div className="max-w-7xl 2xl:max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex items-center gap-4 mb-8">
                            <button
                                onClick={() => handleSearchAndNavigate('')}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                            >
                                <ArrowLeftIcon className="w-6 h-6 text-gray-600" />
                            </button>
                            <h1 className="text-3xl font-serif text-on-surface cyber-text">
                                Búsqueda de Productos
                            </h1>
                        </div>

                        <div className="flex justify-center mb-12">
                            <form
                                className="w-full md:w-2/3"
                                onSubmit={(e) => e.preventDefault()}
                            >
                               <div className="relative w-full group">
                                   <input
                                       autoFocus
                                       type="text"
                                       placeholder="¿Qué estás buscando hoy?"
                                       value={searchTerm}
                                       onChange={(e) => setSearchTerm(e.target.value)}
                                       className="w-full bg-white border-2 border-primary/30 rounded-full pl-14 pr-6 py-4 text-lg focus:ring-4 focus:ring-primary/20 focus:border-primary shadow-lg transition-all duration-300"
                                    />
                                   <SearchIcon className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-primary" />
                               </div>
                            </form>
                        </div>

                        <div className="mb-8">
                            <h3 className="font-semibold mb-6 text-gray-600 flex items-center gap-2 text-lg">
                              <span className="w-1.5 h-8 bg-primary rounded-full"></span>
                              {searchTerm.trim() ? `Resultados para "${searchTerm}"` : 'Explora nuestros productos'}
                            </h3>

                            {catalogControls}
                            <ProductGrid loading={isCatalogLoading && products.length === 0}
                                products={filteredProducts}
                                resultKey={JSON.stringify(catalogFilters)}
                                onOpenDetails={handleOpenProductDetails}
                                onQuickAdd={handleQuickAddToCart}
                                editMode={editMode}
                                userRole={userData?.role}
                                onOpenEdit={handleOpenProductEdit}
                                formatCurrency={formatCurrency}
                            />


                        </div>
                    </div>
                  </motion.section>
                ) : selectedCategory === 'All' ? (
                  <motion.div
                    key="all"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <BannerCarousel
                        onInitialReady={revealStorefront}
                        banners={areBannersLoading ? [] : isMenTheme ? menBanners : banners}
                        loading={areBannersLoading}
                        onNavigateToCategory={category => handleCatalogFilters({ term: '', category, size: '', color: '', sort: 'recent' })}
                        onNavigateToProduct={id => navigate(`/product/${encodeURIComponent(id)}`)}
                        onNavigateToCollection={openCollection}
                        onViewCatalog={() => handleCatalogFilters({ term: '', category: 'All', size: '', color: '', sort: 'recent' })}
                        isMenTheme={isMenTheme}
                    />

                    {collections.length > 0 && <section id="colecciones" className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
                      <h2 className="mb-5 font-serif text-2xl text-[#880E4F]">Nuestras colecciones</h2>
                      <div className={`grid grid-cols-1 gap-6 ${collections.length > 1 ? 'md:grid-cols-2' : ''}`}>{collections.map(collection => {
                        const items = collectionProducts(collection, products, companyId);
                        return <a key={collection.id} href={collectionPath(collection.id)} onClick={event => { if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); openCollection(collection.id); } }} className="overflow-hidden rounded-2xl border border-pink-100 bg-white">
                          {(collection.imageUrl || items[0]?.imageUrl) && <ProductImage src={collection.imageUrl || items[0]?.imageUrl} alt={collection.name} className="block h-auto max-h-[65svh] w-full bg-[#fff8fb] object-contain" />}
                          <div className="p-5 text-center sm:p-7"><h3 className="font-serif text-2xl text-pink-900 sm:text-3xl">{collection.name}</h3><p className="mt-1 text-xs text-gray-500">{items.length} prendas disponibles</p><span className="mt-3 inline-block text-xs font-semibold text-pink-700">Ver colección →</span></div>
                        </a>;
                      })}</div>
                    </section>}

                    {isCatalogLoading && products.length === 0 ? <div role="status" className="mx-auto flex h-64 max-w-7xl items-center justify-center p-8 text-center text-sm text-gray-500">Cargando las prendas…</div> : <CategoryNav
                        categories={categories} products={products} selectedCategory={selectedCategory}
                        images={config.categoryImagesByCompany?.[companyId]}
                        onSelectCategory={handleCategoryButtonClick}
                    />}

                    <ProductCarousel onOpenDetails={handleOpenProductDetails} onQuickAdd={handleQuickAddToCart} editMode={editMode} userRole={userData?.role} onOpenEdit={handleOpenProductEdit} formatCurrency={formatCurrency} title="Recién llegados ✨🆕" products={newArrivals} />
                    <ProductCarousel onOpenDetails={handleOpenProductDetails} onQuickAdd={handleQuickAddToCart} editMode={editMode} userRole={userData?.role} onOpenEdit={handleOpenProductEdit} formatCurrency={formatCurrency} title="En tendencia 🔥📱" products={bestSellers} />
                    <div className="pb-12 text-center"><button type="button" className="rounded-full bg-primary px-8 py-4 font-semibold text-white hover:bg-primary-dark" onClick={() => handleCatalogFilters({ term: '', category: 'All', size: '', color: '', sort: 'recent' })}>Ver todos los productos</button></div>
                  </motion.div>
                ) : (
                  <motion.section
                    key={selectedCategory}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.02 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="py-12 bg-surface min-h-screen"
                  >
                    <div className="max-w-7xl 2xl:max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
                        {/* Category Header */}
                        <motion.div
                            initial={{ y: -20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.2, duration: 0.5 }}
                            className="mb-12 text-center"
                        >
                            <h1 className="text-4xl md:text-5xl font-serif font-bold mb-4 text-on-surface cyber-text uppercase tracking-widest">
                                {selectedCategory}
                            </h1>
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: 96 }}
                                transition={{ delay: 0.4, duration: 0.6 }}
                                className="h-1 bg-primary mx-auto rounded-full"
                            />
                        </motion.div>

                        {/* Product Grid */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.4, duration: 0.5 }}
                        >
                            {catalogControls}
                            <ProductGrid loading={isCatalogLoading && products.length === 0}
                                products={filteredProducts}
                                resultKey={JSON.stringify(catalogFilters)}
                                onOpenDetails={handleOpenProductDetails}
                                onQuickAdd={handleQuickAddToCart}
                                editMode={editMode}
                                userRole={userData?.role}
                                onOpenEdit={handleOpenProductEdit}
                                formatCurrency={formatCurrency}
                            />
                        </motion.div>


                    </div>
                  </motion.section>
                )}
              </AnimatePresence>
            </main>

            <BranchesSection branches={branches} />
            <Footer contact={config.contact} social={config.social} onAdminClick={handleOpenAdmin} />

            {isCartOpen && <CartPanel
                onClose={closeModal}
                cart={cart}
                subtotal={cartSubtotal}
                onUpdateQuantity={handleUpdateCartQuantity}
                onRemoveItem={handleRemoveFromCart}
                onCheckout={() => navigate('/checkout')}
                formatCurrency={formatCurrency}
                suggestedProducts={bestSellers}
                onAddSuggestedProduct={handleQuickAddFromCart}
                onClearCart={handleClearCart}
                onContinueShopping={closeModal}
                isMenTheme={isMenTheme}
                config={config}
            />}
            {renderAdminView()}
            {selectedProduct && selectedProduct.companyId === companyId && <ProductDetails key={selectedProduct.id} product={selectedProduct} onClose={closeModal} onAddToCart={handleAddToCart} formatCurrency={formatCurrency} showToast={showToast} allProducts={products} config={config} onSelectProduct={handleOpenProductDetails} />}
            {isInvoiceModalOpen && <InvoiceModal onClose={closeModal} cart={cart} subtotal={cartSubtotal} onSubmitOrder={handleNewOrder} isSubmitting={isOrdering} branches={branches} config={config} formatCurrency={formatCurrency} />}
            {isAddUserModalOpen && <AddUserModal onClose={() => setAddUserModalOpen(false)} onCreateUser={handleCreateUser} />}


            <a
              href={`https://wa.me/${config.social.whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="fixed bottom-5 right-5 z-40 bg-primary text-white p-4 rounded-full shadow-lg hover:bg-primary-dark hover:scale-110 transition-transform duration-300 cyber-gradient-bg"
              aria-label="Contáctanos por WhatsApp"
            >
              <WhatsAppIcon className="w-8 h-8" />
            </a>
        </div>
    );
};

// --- SUB-COMPONENTS ---

const ProductCarousel: React.FC<Omit<React.ComponentProps<typeof ProductCard>, 'product'> & { title: string; products: Product[] }> = ({ title, products: carouselProducts, ...cardProps }) => {
        const scrollContainerRef = useRef<HTMLDivElement>(null);
        const intervalRef = useRef<number | null>(null);

        const manualScroll = (direction: 'left' | 'right') => {
            if (scrollContainerRef.current) {
                const scrollAmount = scrollContainerRef.current.offsetWidth * 0.8;
                scrollContainerRef.current.scrollBy({
                    left: direction === 'left' ? -scrollAmount : scrollAmount,
                    behavior: 'smooth'
                });
            }
        };

        const stopAutoScroll = () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };

        const startAutoScroll = useCallback(() => {
            stopAutoScroll();
            if (scrollContainerRef.current && scrollContainerRef.current.scrollWidth > scrollContainerRef.current.clientWidth) {
                intervalRef.current = window.setInterval(() => {
                    if (scrollContainerRef.current) {
                        const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
                        if (scrollLeft + clientWidth >= scrollWidth - 1) {
                            scrollContainerRef.current.scrollTo({ left: 0, behavior: 'smooth' });
                        } else {
                            scrollContainerRef.current.scrollBy({ left: clientWidth * 0.8, behavior: 'smooth' });
                        }
                    }
                }, 4000);
            }
        }, [carouselProducts]);

        useEffect(() => {
            const timer = setTimeout(() => startAutoScroll(), 500);
            return () => {
                clearTimeout(timer);
                stopAutoScroll();
            }
        }, [startAutoScroll]);

        if (!carouselProducts || carouselProducts.length === 0) return null;

        return (
          <section className="py-12 bg-white">
            <div className="max-w-7xl 2xl:max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="text-3xl font-serif text-center mb-8 text-on-surface">{title}</h2>
              <div
                className="relative group/carousel"
                onMouseEnter={stopAutoScroll}
                onMouseLeave={startAutoScroll}
              >
                  <button onClick={() => manualScroll('left')} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/80 backdrop-blur-sm rounded-full p-2 shadow-md hover:bg-white transition-all opacity-0 group-hover/carousel:opacity-100 disabled:opacity-0" aria-label="Anterior">
                      <ChevronLeftIcon className="w-6 h-6 text-on-surface" />
                  </button>
                  <div ref={scrollContainerRef} className="flex overflow-x-auto space-x-6 pb-4 -mx-4 px-4 scrollbar-hide">
                      {carouselProducts.map(product => (
                          <div key={product.id} className="flex-shrink-0 w-64 sm:w-72">
                              <ProductCard
                                  product={product}
                                  {...cardProps}
                              />
                          </div>
                      ))}
                  </div>
                  <button onClick={() => manualScroll('right')} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/80 backdrop-blur-sm rounded-full p-2 shadow-md hover:bg-white transition-all opacity-0 group-hover/carousel:opacity-100 disabled:opacity-0" aria-label="Siguiente">
                      <ChevronRightIcon className="w-6 h-6 text-on-surface" />
                  </button>
              </div>
            </div>
          </section>
        );
    };

const ProductCard: React.FC<{
    product: Product;
    onOpenDetails: (p: Product) => void;
    onQuickAdd: (p: Product) => void;
    editMode: boolean;
    userRole?: string;
    onOpenEdit: (p: Product) => void;
    formatCurrency: (n: number) => string;
}> = ({ product, onOpenDetails, onQuickAdd, editMode, userRole, onOpenEdit, formatCurrency }) => {
    const hasDiscount = product.discountPercentage != null && product.discountPercentage > 0;
    const discountedPrice = hasDiscount ? product.price * (1 - product.discountPercentage! / 100) : product.price;

    return (
        <div role="button" tabIndex={0} aria-label={`Ver ${product.name}`} onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onOpenDetails(product); } }} className="relative group bg-surface rounded-lg shadow-md overflow-hidden flex flex-col h-full cursor-pointer cyber-border" onClick={() => onOpenDetails(product)}>
            <div className="relative aspect-[3/4] w-full overflow-hidden bg-surface/50">
                <ProductImage src={product.imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                {!product.available && (
                    <div className="absolute top-2 left-2 bg-on-surface text-background text-xs font-bold px-2 py-1 rounded">AGOTADO</div>
                )}
                {hasDiscount && (
                    <div className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">{product.discountPercentage}% OFF</div>
                )}
                <div className="absolute bottom-2 right-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); onQuickAdd(product); }}
                      className="bg-[#E91E8C] text-white rounded-full p-2 shadow-md ring-2 ring-white/80 hover:bg-[#c91875] transition-transform scale-100 hover:scale-110 active:scale-95 disabled:opacity-50"
                      aria-label="Agregar al carrito"
                      disabled={!product.available}
                    >
                      <PlusIcon className="w-5 h-5 text-white" />
                    </button>
                </div>
                 {editMode && (userRole === 'admin' || userRole === 'vendedor') && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center space-y-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {product.provider && (
                        <div className="text-center px-2">
                            <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Proveedor</span>
                            <p className="text-white font-semibold text-sm truncate">{product.provider}</p>
                        </div>
                    )}
                    <button onClick={(e) => {e.stopPropagation(); onOpenEdit(product);}} className="bg-surface text-on-surface px-3 py-1 rounded text-sm font-semibold flex items-center space-x-1">
                      <PencilIcon className="w-4 h-4"/>
                      <span>Editar</span>
                    </button>
                  </div>
                )}
            </div>
            <div className="p-4 flex flex-col flex-grow">
                <h3 className="font-semibold text-sm truncate cyber-text">{product.name}</h3>
                <div className="flex items-baseline gap-2 mt-1">
                    {hasDiscount && (
                       <span className="text-gray-500 line-through text-sm">{formatCurrency(product.price)}</span>
                    )}
                    <span className="text-primary font-bold text-base cyber-text">{formatCurrency(discountedPrice)}</span>
                </div>
            </div>
        </div>
    );
};


const ProductGrid: React.FC<{
    loading?: boolean;
    products: Product[];
    resultKey: string;
    onOpenDetails: (p: Product) => void;
    onQuickAdd: (p: Product) => void;
    editMode: boolean;
    userRole?: string;
    onOpenEdit: (p: Product) => void;
    formatCurrency: (n: number) => string;
}> = ({ loading, products, resultKey, onOpenDetails, onQuickAdd, editMode, userRole, onOpenEdit, formatCurrency }) => {
    const [page, setPage] = useState({ key: resultKey, count: 24 });
    const visibleCount = page.key === resultKey ? page.count : 24;
    if (loading) return <div role="status" className="py-16 text-center text-gray-500">Cargando las prendas…</div>;
    if (products.length === 0) {
        return (
            <div className="col-span-full py-20 text-center">
                <SearchIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-600">No se encontraron productos</h3>
                <p className="text-gray-400 mt-2">Intenta con otros términos de búsqueda o selecciona otra categoría.</p>
            </div>
        );
    }

    return (
        <div><div className="w-full grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 md:gap-6">
            {products.slice(0, visibleCount).map(product => (
                <ProductCard
                    key={product.id}
                    product={product}
                    onOpenDetails={onOpenDetails}
                    onQuickAdd={onQuickAdd}
                    editMode={editMode}
                    userRole={userRole}
                    onOpenEdit={onOpenEdit}
                    formatCurrency={formatCurrency}
                />
            ))}
        </div>
        {visibleCount < products.length && <div className="mt-8 text-center"><button type="button" className="rounded-full border-2 border-primary px-8 py-3 font-semibold text-primary hover:bg-primary/5" onClick={() => setPage({ key: resultKey, count: visibleCount + 24 })}>Mostrar más ({Math.min(visibleCount, products.length)} de {products.length})</button></div>}
        </div>
    );
};

const AddUserModal: React.FC<{
    onClose: () => void;
    onCreateUser: (email: string, password: string, role: User['role']) => Promise<void>;
}> = ({ onClose, onCreateUser }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<User['role']>('vendedor');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const emailInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      emailInputRef.current?.focus();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) {
            setError('Por favor, completa todos los campos.');
            return;
        }
        setError('');
        setIsLoading(true);
        try {
            await onCreateUser(email, password, role);
            // The parent component will close the modal on success
        } catch (err: any) {
            setError(err.message || 'Ocurrió un error al crear el usuario.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[95] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-sm relative" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-2 right-2 p-2 text-gray-500 hover:text-gray-800">
                    <CloseIcon className="w-6 h-6"/>
                </button>
                <form onSubmit={handleSubmit} className="p-8">
                    <div className="text-center mb-6">
                         <h2 className="text-2xl font-bold font-serif text-on-surface">Agregar Nuevo Usuario</h2>
                         <p className="text-sm text-gray-600 mt-1">Crea una cuenta para un nuevo miembro del equipo.</p>
                    </div>

                    <div className="space-y-4">
                        <AdminInput
                            ref={emailInputRef}
                            label="Correo Electrónico"
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                        />
                        <AdminInput
                            label="Contraseña Temporal"
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                            placeholder="Mínimo 6 caracteres"
                        />
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                            <select value={role} onChange={(e) => setRole(e.target.value as User['role'])} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm">
                                <option value="vendedor">Vendedor</option>
                                <option value="admin">Administrador</option>
                            </select>
                        </div>
                    </div>

                    {error && <p className="text-red-500 text-sm mt-4 text-center w-full">{error}</p>}

                    <button type="submit" disabled={isLoading} className="mt-6 w-full bg-primary text-white py-2 rounded-md hover:bg-primary-dark transition-colors disabled:bg-primary-light disabled:cursor-wait">
                        {isLoading ? 'Creando...' : 'Crear Usuario'}
                    </button>
                </form>
            </div>
        </div>
    );
};


const LoginPage: React.FC<{
  onClose: () => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}> = ({ onClose, showToast }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailInputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
        await signInWithEmailAndPassword(auth, email, password);
        showToast("¡Bienvenido/a de nuevo!");
    } catch (authError: any) {
        console.error("Firebase Auth Error:", authError);

        if (authError.code === 'auth/invalid-credential' || authError.code === 'auth/user-not-found' || authError.code === 'auth/wrong-password') {
             setError('El correo o la contraseña son incorrectos.');
        } else if (authError.code === 'auth/invalid-email') {
            setError('El formato del correo electrónico no es válido.');
        } else {
            setError('Ocurrió un error. Por favor, inténtalo de nuevo.');
        }
        setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[90] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-2 right-2 p-2 text-gray-500 hover:text-gray-800">
            <CloseIcon className="w-6 h-6"/>
        </button>
        <form onSubmit={handleSubmit} className="p-8">
            <div className="text-center mb-6">
                 <h2 className="text-2xl font-bold font-serif text-on-surface">Iniciar Sesión</h2>
                 <p className="text-sm text-gray-600 mt-1">Ingresa tus credenciales para continuar.</p>
            </div>

            <div className="space-y-4">
                <AdminInput
                    ref={emailInputRef}
                    label="Correo Electrónico"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                />
                <AdminInput
                    label="Contraseña"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                />
            </div>

            {error && <p className="text-red-500 text-sm mt-4 text-center w-full">{error}</p>}

            <button type="submit" disabled={isLoading} className="mt-6 w-full bg-primary text-white py-2 rounded-md hover:bg-primary-dark transition-colors disabled:bg-primary-light disabled:cursor-wait">
                {isLoading ? 'Ingresando...' : 'Entrar'}
            </button>
        </form>
      </div>
    </div>
  );
};

const Header: React.FC<{
    logoUrl: string, cartItemCount: number, onCartClick: () => void,
    isMobileMenuOpen: boolean, setMobileMenuOpen: (isOpen: boolean) => void,
    categories: Category[], onSelectCategory: (e: React.MouseEvent<HTMLAnchorElement>, category: Category | 'All') => void,
    selectedCategory: string,
    currentUser: FirebaseUser | null,
    onAdminClick: () => void,
    onSearchClick: () => void,
    onHomeClick: () => void,
    isMenTheme?: boolean,
    config?: StoreConfig
}> = ({ logoUrl, cartItemCount, onCartClick, isMobileMenuOpen, setMobileMenuOpen, categories, onSelectCategory, selectedCategory, currentUser, onAdminClick, onSearchClick, onHomeClick, isMenTheme, config }) => {

    const baseLinkClasses = 'block text-lg px-4 py-3 rounded-md transition-colors';
    const activeLinkClasses = `font-semibold cyber-text ${isMenTheme ? 'cyber-gradient-bg text-white' : 'bg-primary/20 text-primary'}`;
    const inactiveLinkClasses = 'hover:bg-primary/10 hover:text-primary';

    const handleContactClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        setMobileMenuOpen(false);
        const contactElement = document.getElementById('contacto');
        if (contactElement) {
            contactElement.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const handleLogoClick = (e: React.MouseEvent) => {
        e.preventDefault();
        setMobileMenuOpen(false);
        onHomeClick();
    };

    const hasAnnouncements = config?.showAnnouncements !== false && config?.announcements && config.announcements.some(ann => ann.trim() !== '');

    return (
        <>
            <header className={`fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm shadow-md transition-all flex flex-col ${hasAnnouncements ? 'h-28 sm:h-32' : 'h-20 sm:h-24'}`}>
                {hasAnnouncements && (
                    <AnnouncementBar announcements={config.announcements || []} isMenTheme={isMenTheme} />
                )}
                <div className="max-w-7xl 2xl:max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 w-full h-20 sm:h-24 shrink-0">
                    <div className="grid grid-cols-[84px_minmax(0,1fr)_84px] items-center gap-1 h-full">
                        <div className="flex-1 flex justify-start">
                            <button
                                className="text-on-surface hover:text-primary p-2 rounded-full hover:bg-gray-100/50 transition-all active:scale-90"
                                onClick={() => setMobileMenuOpen(true)}
                                aria-label="Abrir menú"
                            >
                                <MenuIcon className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="min-w-0 flex justify-center">
                            <a href="#" onClick={handleLogoClick} aria-label="Volver al inicio" className="w-full max-w-[220px] sm:max-w-[260px] flex flex-col items-center">
                                <StoreLogo src={logoUrl} alt={isMenTheme ? 'Street Legends' : 'Bombón'} className="h-16 sm:h-[72px] w-full object-contain" />
                            </a>
                        </div>

                        <div className="flex-1 flex justify-end items-center gap-1">
                            <button onClick={onSearchClick} className="relative text-on-surface hover:text-primary p-2 rounded-full hover:bg-gray-100/50 transition-all active:scale-90" aria-label="Buscar productos">
                                <SearchIcon className="w-6 h-6" />
                            </button>
                            <button onClick={onCartClick} className="relative text-on-surface hover:text-primary p-2 rounded-full hover:bg-gray-100/50 transition-all active:scale-95 flex items-center justify-center min-w-10 min-h-10" aria-label="Ver carrito de compras">
                                <motion.div
                                    key={cartItemCount}
                                    animate={cartItemCount > 0 ? { rotate: [-10, 10, -5, 5, 0], scale: [1, 1.15, 1] } : {}}
                                    transition={{ duration: 0.45, ease: "easeInOut" }}
                                >
                                    <CartIcon className="w-6 h-6" />
                                </motion.div>
                                {cartItemCount > 0 && (
                                    <motion.span
                                        key={`badge-${cartItemCount}`}
                                        initial={{ scale: 0.5, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ type: "spring", stiffness: 500, damping: 15 }}
                                        className="absolute top-1.5 right-1.5 bg-primary text-white text-[10px] font-black rounded-full h-5 w-5 flex items-center justify-center shadow-lg shadow-primary/30"
                                        aria-label={`${cartItemCount} productos en el carrito`}
                                    >
                                        {cartItemCount}
                                    </motion.span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Mobile Menu Overlay */}
            <div
                className={`fixed inset-0 bg-black/60 z-[55] transition-opacity duration-300 ease-in-out ${isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={() => setMobileMenuOpen(false)}
                aria-hidden={!isMobileMenuOpen}
            />

            {/* Mobile Menu Panel */}
            <div
                className={`fixed top-0 left-0 h-full w-80 max-w-[80vw] bg-surface shadow-xl flex flex-col z-[60] transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="mobile-menu-title"
            >
                <div className="flex justify-between items-center p-4 border-b border-gray-200">
                     <a href="#" onClick={handleLogoClick} aria-label="Volver al inicio" className="min-w-0 flex-1 max-w-[220px]">
                        <StoreLogo src={logoUrl} alt={isMenTheme ? 'Street Legends' : 'Bombón'} className="h-16 w-full object-contain" id="mobile-menu-title" />
                    </a>
                    <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-on-surface rounded-full hover:bg-surface" aria-label="Cerrar menú">
                        <CloseIcon className="w-6 h-6" />
                    </button>
                </div>
                <nav className="flex-grow p-4 flex flex-col space-y-1 overflow-y-auto">
                    <h3 className="font-semibold px-4 mb-2 text-gray-500 text-sm uppercase tracking-wider">Categorías</h3>
                    <a href="#productos" onClick={(e) => onSelectCategory(e, 'All')} className={`${baseLinkClasses} ${selectedCategory === 'All' ? activeLinkClasses : inactiveLinkClasses}`}>
                        Todas
                    </a>
                    {(categories || []).map(cat => (
                        <a key={cat} href="#productos" onClick={(e) => onSelectCategory(e, cat)} className={`${baseLinkClasses} ${selectedCategory === cat ? activeLinkClasses : inactiveLinkClasses}`}>
                            {cat}
                        </a>
                    ))}
                    <div className="border-t border-gray-200 my-4"></div>
                    <a href="#contacto" onClick={handleContactClick} className="block text-lg px-4 py-3 rounded-md hover:bg-primary/10 hover:text-primary transition-colors">
                        Contacto
                    </a>
                    <a href="#" onClick={(e) => {
                        e.preventDefault();
                        setMobileMenuOpen(false);
                        onAdminClick();
                    }} className="block text-lg px-4 py-3 rounded-md hover:bg-primary/10 hover:text-primary transition-colors">
                        {currentUser ? 'Administrar Tienda' : 'Iniciar Sesión'}
                    </a>
                </nav>
            </div>
        </>
    );
};

const AnnouncementBar: React.FC<{ announcements: string[]; isMenTheme?: boolean }> = ({ announcements, isMenTheme }) => {
    const [currentIndex, setCurrentIndex] = useState(0);

    const validAnnouncements = useMemo(() => {
        return (announcements || []).filter(ann => ann && typeof ann === 'string' && ann.trim() !== '');
    }, [announcements]);

    useEffect(() => {
        if (!validAnnouncements || validAnnouncements.length <= 1) return;
        const timer = setInterval(() => {
            setCurrentIndex(prev => (prev + 1) % validAnnouncements.length);
        }, 4000);
        return () => clearInterval(timer);
    }, [validAnnouncements]);

    if (validAnnouncements.length === 0) return null;

    return (
        <div className={`w-full h-8 flex items-center justify-center font-bold text-xs text-center px-4 overflow-hidden relative select-none ${
            isMenTheme
            ? 'cyber-gradient-bg text-white tracking-widest uppercase text-[9px]'
            : 'bg-primary text-white tracking-[0.2em] text-[9px] uppercase'
        }`} id="top-announcement-bar">
            {validAnnouncements.length === 1 ? (
                <span className="truncate">{validAnnouncements[0]}</span>
            ) : (
                <div className="relative w-full h-full flex items-center justify-center">
                    {validAnnouncements.map((ann, idx) => (
                        <div
                            key={idx}
                            className={`absolute inset-0 flex items-center justify-center transition-all duration-700 ease-in-out ${
                                idx === currentIndex
                                    ? 'opacity-100 transform translate-y-0'
                                    : 'opacity-0 transform translate-y-2 pointer-events-none'
                            }`}
                        >
                            <span className="truncate px-4">{ann}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const CartPanel: React.FC<{
    onClose: () => void;
    cart: CartItem[];
    subtotal: number;
    onUpdateQuantity: (id: string, qty: number) => void;
    onRemoveItem: (id: string) => void;
    onCheckout: () => void;
    formatCurrency: (amount: number) => string;
    suggestedProducts: Product[];
    onAddSuggestedProduct: (product: Product) => void;
    onClearCart: () => void;
    onContinueShopping: () => void;
    isMenTheme?: boolean;
    config?: StoreConfig;
}> = ({ onClose, cart, subtotal, onUpdateQuantity, onRemoveItem, onCheckout, formatCurrency, suggestedProducts, onAddSuggestedProduct, onClearCart, onContinueShopping, isMenTheme, config }) => {
    const FREE_SHIPPING_THRESHOLD = config?.freeShippingThreshold !== undefined ? Number(config.freeShippingThreshold) : 200000;
    const missingForFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
    const progressPercentage = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);

    const finalSuggestions = useMemo(() => {
        const cartProductIds = new Set(cart.map(item => item.productId));
        return suggestedProducts.filter(p => !cartProductIds.has(p.id) && p.available);
    }, [cart, suggestedProducts]);

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const intervalRef = useRef<number | null>(null);

    const manualScroll = (direction: 'left' | 'right') => {
        if (scrollContainerRef.current) {
            const cardWidth = 200; // Approximate width of a suggestion card
            scrollContainerRef.current.scrollBy({
                left: direction === 'left' ? -cardWidth : cardWidth,
                behavior: 'smooth'
            });
        }
    };

    const stopAutoScroll = () => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    };

    const startAutoScroll = useCallback(() => {
        stopAutoScroll();
        if (scrollContainerRef.current && scrollContainerRef.current.scrollWidth > scrollContainerRef.current.clientWidth) {
            intervalRef.current = window.setInterval(() => {
                if (scrollContainerRef.current) {
                    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
                    const cardWidth = 176; // w-40 + space-x-4
                    if (scrollLeft + clientWidth >= scrollWidth - 1) {
                        scrollContainerRef.current.scrollTo({ left: 0, behavior: 'smooth' });
                    } else {
                        scrollContainerRef.current.scrollBy({ left: cardWidth, behavior: 'smooth' });
                    }
                }
            }, 4000);
        }
    }, [finalSuggestions]);

    useEffect(() => {
        const timer = setTimeout(() => startAutoScroll(), 500);
        return () => {
            clearTimeout(timer);
            stopAutoScroll();
        };
    }, [startAutoScroll]);

    const handleEmptyCart = () => {
        if(window.confirm('¿Estás seguro de que quieres vaciar tu carrito?')) {
            onClearCart();
        }
    }

    return (
        <div className="fixed inset-0 bg-black/60 z-[60]" onClick={onClose}>
            <div className={`fixed top-0 right-0 h-full w-full max-w-md shadow-xl flex flex-col ${isMenTheme ? 'bg-surface text-white' : 'bg-surface text-on-surface'}`} onClick={e => e.stopPropagation()}>
                <div className={`flex justify-between items-center p-4 border-b ${isMenTheme ? 'bg-black border-gray-800' : 'bg-white border-gray-200'}`}>
                    <div className="flex items-center space-x-2">
                        <ShoppingBagIcon className={`w-6 h-6 ${isMenTheme ? 'cyber-gradient-text' : 'text-primary'}`}/>
                        <h2 className="text-lg font-bold uppercase tracking-wide">CARRITO</h2>
                    </div>
                    <button onClick={onClose} className={`p-1 rounded-full ${isMenTheme ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}><CloseIcon className="w-6 h-6" /></button>
                </div>

                {cart.length === 0 ? (
                    <div className={`flex-grow flex flex-col items-center justify-center text-center p-4 ${isMenTheme ? 'bg-black' : 'bg-white'}`}>
                        <ShoppingBagIcon className="w-24 h-24 text-gray-300" />
                        <p className="mt-4 text-gray-500">Tu carrito está vacío.</p>
                        <button onClick={onClose} className={`mt-6 py-2 px-6 rounded-md transition-colors ${isMenTheme ? 'cyber-gradient-bg text-white' : 'bg-primary text-white hover:bg-primary-dark'}`}>
                            Seguir comprando
                        </button>
                    </div>
                ) : (
                    <>
                    <div className="flex-grow overflow-y-auto">
                        <div className={`p-4 ${isMenTheme ? 'bg-black' : 'bg-white'}`}>
                            <p className="text-sm text-center mb-1">
                                {missingForFreeShipping > 0
                                    ? `¡Te falta ${formatCurrency(missingForFreeShipping)} para obtener tu envío gratis!`
                                    : "¡Felicidades! Tienes envío gratis."}
                            </p>
                            <div className={`w-full rounded-full h-2.5 ${isMenTheme ? 'bg-gray-800' : 'bg-pink-100'}`}>
                                <div className={`h-2.5 rounded-full transition-all duration-500 ${isMenTheme ? 'cyber-gradient-bg' : 'bg-primary'}`} style={{ width: `${progressPercentage}%` }}></div>
                            </div>
                             <div className={`flex justify-between text-xs mt-1 ${isMenTheme ? 'text-gray-400' : 'text-gray-600'}`}>
                                <span>{formatCurrency(subtotal)}</span>
                                <span>{formatCurrency(FREE_SHIPPING_THRESHOLD)}</span>
                            </div>
                        </div>

                        <div className={`py-4 space-y-4 mt-2 ${isMenTheme ? 'bg-black' : 'bg-white'}`}>
                            {cart.map(item => (
                                <div key={item.id} className="flex items-start space-x-4 px-4">
                                    <img src={item.imageUrl} alt={item.name} className="w-20 h-24 object-cover"/>
                                    <div className="flex-grow">
                                        <h3 className="font-semibold text-sm uppercase">{item.name}</h3>
                                        <p className={`text-sm ${isMenTheme ? 'text-gray-400' : 'text-gray-500'}`}>Precio: {formatCurrency(item.price)}</p>
                                        <div className={`flex items-center mt-2 border w-fit ${isMenTheme ? 'border-gray-700' : 'border-gray-300'}`}>
                                            <button onClick={() => onUpdateQuantity(item.id, item.quantity - 1)} className="px-2 py-1"><MinusIcon className="w-3 h-3"/></button>
                                            <span className="px-3 text-sm font-semibold">{item.quantity}</span>
                                            <button onClick={() => onUpdateQuantity(item.id, item.quantity + 1)} className="px-2 py-1"><PlusIcon className="w-3 h-3"/></button>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end justify-between h-24">
                                        <div className="flex space-x-2">
                                            <button><HeartIcon className={`w-5 h-5 transition-colors ${isMenTheme ? 'text-gray-600 hover:text-primary' : 'text-gray-400 hover:text-primary'}`}/></button>
                                            <button onClick={() => onRemoveItem(item.id)}><TrashIcon className={`w-5 h-5 transition-colors ${isMenTheme ? 'text-gray-600 hover:text-primary' : 'text-gray-400 hover:text-primary'}`}/></button>
                                        </div>
                                        <p className="font-semibold text-sm">{formatCurrency(item.price * item.quantity)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {finalSuggestions.length > 0 && (
                            <div className={`py-6 mt-2 ${isMenTheme ? 'bg-surface' : 'bg-surface'}`}>
                                <h3 className="font-serif text-center text-xl mb-4">Productos que te podrían gustar</h3>
                                <div
                                    className="relative group/suggestions"
                                    onMouseEnter={stopAutoScroll}
                                    onMouseLeave={startAutoScroll}
                                >
                                    <button onClick={() => manualScroll('left')} className="absolute -left-2 top-1/2 -translate-y-1/2 z-10 bg-white rounded-full p-1 shadow-md hover:bg-gray-200 transition-all opacity-0 group-hover/suggestions:opacity-100" aria-label="Anterior">
                                        <ChevronLeftIcon className="w-5 h-5 text-on-surface" />
                                    </button>
                                    <div ref={scrollContainerRef} className="flex overflow-x-auto space-x-4 pb-2 -mx-4 px-6 scrollbar-hide">
                                        {finalSuggestions.map(product => (
                                            <div key={product.id} className={`flex-shrink-0 w-40 p-2 rounded-lg shadow-sm border ${isMenTheme ? 'bg-black border-gray-800' : 'bg-white border-gray-100'}`}>
                                                <img src={product.imageUrl} alt={product.name} className="w-full h-40 object-cover" />
                                                <div className="text-center mt-2">
                                                    <p className="text-xs font-bold uppercase truncate">{product.name}</p>
                                                    <p className={`text-sm font-semibold ${isMenTheme ? 'cyber-gradient-text' : 'text-primary'}`}>{formatCurrency(product.price)}</p>
                                                    <button
                                                        onClick={() => onAddSuggestedProduct(product)}
                                                        className={`w-full mt-2 text-xs font-bold py-2 px-1 transition-colors ${isMenTheme ? 'cyber-gradient-bg text-white' : 'bg-primary text-white hover:bg-primary-dark'}`}
                                                    >
                                                        AGREGAR
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                     <button onClick={() => manualScroll('right')} className="absolute -right-2 top-1/2 -translate-y-1/2 z-10 bg-white rounded-full p-1 shadow-md hover:bg-gray-200 transition-all opacity-0 group-hover/suggestions:opacity-100" aria-label="Siguiente">
                                        <ChevronRightIcon className="w-5 h-5 text-on-surface" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className={`p-4 border-t space-y-3 ${isMenTheme ? 'bg-black border-gray-800' : 'bg-white border-gray-200'}`}>
                         <button onClick={handleEmptyCart} className={`text-center w-full text-sm transition-colors ${isMenTheme ? 'text-gray-400 hover:text-primary' : 'text-gray-600 hover:text-primary hover:underline'}`}>Vaciar Carrito</button>
                         <div className={`flex justify-between font-bold text-lg border-t border-dashed pt-3 ${isMenTheme ? 'border-gray-700' : 'border-gray-200'}`}>
                            <span>Total</span>
                            <span>{formatCurrency(subtotal)}</span>
                        </div>
                        <p className={`text-xs text-center ${isMenTheme ? 'text-gray-500' : 'text-gray-500'}`}>Podrás ver el costo del envío al finalizar la compra.</p>

                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={onClose} className={`w-full py-3 text-sm font-bold border transition-colors ${isMenTheme ? 'bg-black text-white border-gray-700 hover:bg-gray-900' : 'bg-white text-primary border-primary hover:bg-pink-50'}`}>
                                VER CARRITO
                            </button>
                            <button onClick={onContinueShopping} className={`w-full py-3 text-sm font-bold border transition-colors ${isMenTheme ? 'bg-black text-white border-gray-700 hover:bg-gray-900' : 'bg-white text-primary border-primary hover:bg-pink-50'}`}>
                                SEGUIR COMPRANDO
                            </button>
                        </div>
                        <button onClick={onCheckout} className={`w-full py-3 font-bold transition-all shadow-lg hover:scale-[1.02] active:scale-[0.98] ${isMenTheme ? 'cyber-gradient-bg text-white' : 'bg-primary text-white hover:bg-primary-dark'}`}>
                            FINALIZAR COMPRA
                        </button>
                    </div>
                    </>
                )}
            </div>
        </div>
    );
};

const InvoiceModal: React.FC<{
    onClose: () => void, cart: CartItem[], subtotal: number,
    onSubmitOrder: (order: Omit<Order, 'docId' | 'orderNumber' | 'status' | 'date'>) => Promise<void>, config: StoreConfig,
    isSubmitting: boolean, branches: StoreBranch[],
    formatCurrency: (amount: number) => string
}> = ({ onClose, cart, subtotal, onSubmitOrder, config, formatCurrency, isSubmitting, branches }) => {
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [deliveryMethod, setDeliveryMethod] = useState<'Recoger en Tienda' | 'Envío a Domicilio'>('Recoger en Tienda');
    const [shippingDestination, setShippingDestination] = useState<'Bogotá' | 'Nacional'>('Bogotá');
    const [address, setAddress] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('Nequi');
    const [pickupBranchId, setPickupBranchId] = useState('');

    const paymentOptions = ['Nequi', 'Daviplata', 'Tarjeta', 'Addi', 'Sistecredito'];
    const FREE_SHIPPING_THRESHOLD = config?.freeShippingThreshold !== undefined ? Number(config.freeShippingThreshold) : 200000;
    const SHIPPING_COST_BOGOTA = config?.shippingCostBogota !== undefined ? Number(config.shippingCostBogota) : (config?.shippingCostAmount !== undefined ? Number(config.shippingCostAmount) : 10000);
    const SHIPPING_COST_NATIONAL = config?.shippingCostNational !== undefined ? Number(config.shippingCostNational) : 15000;

    const baseShippingCost = shippingDestination === 'Bogotá' ? SHIPPING_COST_BOGOTA : SHIPPING_COST_NATIONAL;
    const shippingCost = deliveryMethod === 'Envío a Domicilio' && subtotal < FREE_SHIPPING_THRESHOLD ? baseShippingCost : 0;
    const total = subtotal + shippingCost;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;
        if (!customerName || !customerPhone) {
            alert("Por favor, completa tu nombre y teléfono.");
            return;
        }
        if (deliveryMethod === 'Envío a Domicilio' && !address) {
            alert("Por favor, ingresa tu dirección de envío.");
            return;
        }

        const sanitizedCartItems = cart.map(item => {
            const { size, color, ...rest } = item;
            const sanitizedItem: any = { ...rest };
            if (size) sanitizedItem.size = size;
            if (color) sanitizedItem.color = color;
            return sanitizedItem as CartItem;
        });

        const newOrderData: Omit<Order, 'docId' | 'orderNumber' | 'status' | 'date'> = {
            customerName: customerName.trim(),
            customerPhone: customerPhone.replace(/\D/g, ''),
            items: sanitizedCartItems,
            subtotal,
            shippingCost,
            total,
            deliveryMethod,
            ...(deliveryMethod === 'Recoger en Tienda' && { pickupBranchId, pickupBranchName: branches.find(branch => branch.docId === pickupBranchId)?.name || '' }),
            ...(deliveryMethod === 'Envío a Domicilio' && { address: `${address} (${shippingDestination})` }),
            paymentMethod,
        };

        onSubmitOrder(newOrderData);
    };

    return (
         <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4" onClick={onClose}>
            <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-semibold">Finalizar Compra</h2>
                    <button type="button" onClick={onClose}><CloseIcon className="w-6 h-6" /></button>
                </div>
                <div className="p-6 overflow-y-auto space-y-4 scrollbar-hide">
                    <h3 className="font-semibold text-lg border-b pb-2">Tus Datos</h3>
                     <div>
                        <label className="block text-sm font-medium mb-1">Nombre Completo</label>
                        <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} required className="w-full bg-surface border border-gray-300 rounded-md px-3 py-2 focus:ring-primary focus:border-primary" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium mb-1">Teléfono (WhatsApp)</label>
                        <input type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} required className="w-full bg-surface border border-gray-300 rounded-md px-3 py-2 focus:ring-primary focus:border-primary" />
                    </div>
                    <h3 className="font-semibold text-lg border-b pb-2 pt-4">Método de Entrega</h3>
                     <div className="space-y-2">
                        <label className="flex items-center p-3 border rounded-md has-[:checked]:border-primary has-[:checked]:bg-pink-50">
                          <input type="radio" name="delivery" value="Recoger en Tienda" checked={deliveryMethod === 'Recoger en Tienda'} onChange={() => setDeliveryMethod('Recoger en Tienda')} className="h-4 w-4 text-primary focus:ring-primary"/>
                          <span className="ml-3 text-sm font-medium">Recoger en Tienda</span>
                        </label>
                        <label className="flex items-center p-3 border rounded-md has-[:checked]:border-primary has-[:checked]:bg-pink-50">
                          <input type="radio" name="delivery" value="Envío a Domicilio" checked={deliveryMethod === 'Envío a Domicilio'} onChange={() => setDeliveryMethod('Envío a Domicilio')} className="h-4 w-4 text-primary focus:ring-primary"/>
                           <span className="ml-3 text-sm font-medium">Envío a Domicilio</span>
                        </label>
                     </div>
                     {deliveryMethod === 'Recoger en Tienda' && (
                        <div>
                            <label className="block text-sm font-medium mb-1" htmlFor="pickup-branch">Sede para recoger tu pedido</label>
                            <select id="pickup-branch" required value={pickupBranchId} onChange={e => setPickupBranchId(e.target.value)} className="w-full border rounded-md px-3 py-2">
                                <option value="">Selecciona una sede</option>
                                {branches.map(branch => <option key={branch.docId} value={branch.docId}>{branch.name}</option>)}
                            </select>
                        </div>
                     )}
                     {deliveryMethod === 'Envío a Domicilio' && (
                        <div className="space-y-3">
                            <div>
                               <label className="block text-sm font-medium mb-1">Dirección Completa</label>
                               <input type="text" value={address} onChange={e => setAddress(e.target.value)} required className="w-full bg-surface border border-gray-300 rounded-md px-3 py-2 focus:ring-primary focus:border-primary" />
                            </div>
                            <div>
                               <label className="block text-sm font-medium mb-1">Destino de Envío</label>
                               <select
                                   value={shippingDestination}
                                   onChange={e => setShippingDestination(e.target.value as 'Bogotá' | 'Nacional')}
                                   className="w-full bg-surface border border-gray-300 rounded-md px-3 py-2 focus:ring-primary focus:border-primary"
                               >
                                   <option value="Bogotá">Bogotá — {formatCurrency(SHIPPING_COST_BOGOTA)}</option>
                                   <option value="Nacional">Nivel Nacional — {formatCurrency(SHIPPING_COST_NATIONAL)}</option>
                               </select>
                            </div>
                        </div>
                     )}
                     <h3 className="font-semibold text-lg border-b pb-2 pt-4">Medio de Pago</h3>
                     <div>
                        <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full bg-surface border border-gray-300 rounded-md px-3 py-2 focus:ring-primary focus:border-primary">
                            {paymentOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                     </div>
                     <div className="bg-surface p-4 rounded-lg space-y-2 mt-4">
                        <div className="flex justify-between text-sm"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                        <div className="flex justify-between text-sm"><span>Costo de Envío</span><span>{formatCurrency(shippingCost)}</span></div>
                        <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2"><span>Total</span><span>{formatCurrency(total)}</span></div>
                     </div>
                </div>
                <div className="p-4 border-t bg-gray-50">
                    <button type="submit" disabled={isSubmitting || !cart.length} className="disabled:opacity-50 w-full bg-green-500 text-white py-3 rounded-md hover:bg-green-600 flex items-center justify-center space-x-2 font-semibold">
                        <WhatsAppIcon className="w-5 h-5" />
                        <span>{isSubmitting ? 'Guardando pedido…' : 'Enviar Pedido por WhatsApp'}</span>
                    </button>
                </div>
            </form>
        </div>
    )
}

const Footer: React.FC<{ contact: StoreConfig['contact'], social: StoreConfig['social'], onAdminClick: () => void }> = ({ contact, social, onAdminClick }) => (
    <footer id="contacto" className="bg-gray-800 text-white">
        <div className="max-w-7xl 2xl:max-w-screen-2xl mx-auto py-12 px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
                <h3 className="font-serif text-lg">Bombon</h3>
            </div>
            <div>
                <h3 className="font-semibold">Contacto</h3>
                <ul className="mt-2 space-y-1 text-gray-400">
                    <li>{contact.name}</li>
                    <li>Tel: {contact.phone}</li>
                    <li>{contact.schedule}</li>
                </ul>
            </div>
            <div>
                 <h3 className="font-semibold">Síguenos</h3>
                 <div className="flex items-center space-x-4 mt-2">
                    <a href={social.instagram} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white"><InstagramIcon className="w-6 h-6" /></a>
                    <a href={social.tiktok} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white"><TikTokIcon className="w-6 h-6" /></a>
                    <a href={`https://wa.me/${social.whatsapp}`} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white"><WhatsAppIcon className="w-6 h-6" /></a>
                </div>
            </div>
        </div>
        <div className="bg-gray-900 py-4">
             <div className="text-center text-gray-500 text-sm">
                <span>&copy; {new Date().getFullYear()} Bombon. Todos los derechos reservados.</span>
                <button onClick={onAdminClick} className="ml-4 text-gray-600 hover:text-gray-400 text-xs">Admin</button>
            </div>
        </div>
    </footer>
);

// --- ADMIN PANEL COMPONENTS ---

export default App;
