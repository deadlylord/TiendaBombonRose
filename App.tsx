import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Product, Category, Banner, StoreConfig, CartItem, Order, ToastMessage, ProductVariantDetail, ProductColorVariantDetail, ProductVariants, User } from './types';
import { db, storage, auth } from './services/firebase';
import { doc, getDoc, onSnapshot, setDoc, collection, addDoc, updateDoc, deleteDoc, runTransaction } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, User as FirebaseUser } from 'firebase/auth';

import {
  CartIcon, ChevronLeftIcon, ChevronRightIcon, CloseIcon, InstagramIcon, MenuIcon,
  SearchIcon, TikTokIcon, WhatsAppIcon, TrashIcon, PlusIcon, MinusIcon,
  PencilIcon, UploadIcon
} from './components/Icons';

// --- MOCK DATA (Initial values for Firestore) ---
const initialConfig: StoreConfig = {
    logoUrl: 'https://i.ibb.co/3Y7f0fM/bombon-logo.png',
    contact: { name: 'Bombon Store', phone: '573001234567', schedule: 'Lunes a Sábado, 9am - 7pm' },
    social: { instagram: 'https://instagram.com', tiktok: 'https://tiktok.com', whatsapp: '573001234567' },
    paymentMethodsImageUrl: 'https://i.ibb.co/QPDWf6s/medios-de-pago.png'
};

const initialBanners: Banner[] = [
    { id: 1, imageUrl: 'https://i.ibb.co/tCg3r0X/banner1.jpg', title: 'Colección Esencia', subtitle: 'Descubre tu estilo, define tu esencia.', link: '#productos' },
    { id: 2, imageUrl: 'https://i.ibb.co/FnyhY2j/banner2.jpg', title: 'Vibra con el Color', subtitle: 'Piezas únicas para un look inolvidable.', link: '#productos' },
    { id: 3, imageUrl: 'https://i.ibb.co/P9M5dcD/banner3.jpg', title: 'Pantalones con Estilo', subtitle: 'Comodidad y elegancia en cada paso.', link: 'category:Pantalones' }
];

const initialCategories: Category[] = ['Blusas', 'Vestidos', 'Pantalones', 'Accesorios', 'Chaquetas', 'Bolsos'];

const initialProducts: Product[] = [
    {
        id: 'prod1', name: 'Blusa de Seda "Aurora"', description: 'Elegante blusa de seda con un corte clásico y un tacto suave.',
        price: 180000, category: 'Blusas', imageUrl: 'https://i.ibb.co/f2sN19v/blusa-rosa.jpg', available: true,
        discountPercentage: 20,
        variants: {
            hasSizes: true, sizes: { 'S': { available: true }, 'M': { available: true }, 'L': { available: false } },
            hasColors: true, colors: {
                'Rosa Pastel': { available: true, imageUrl: 'https://i.ibb.co/f2sN19v/blusa-rosa.jpg' },
                'Blanco Crudo': { available: true, imageUrl: 'https://i.ibb.co/GvxB2SK/blusa-blanca.jpg' }
            }
        }
    },
    {
        id: 'prod2', name: 'Vestido "Verano Eterno"', description: 'Vestido floral perfecto para un día soleado, ligero y fresco.',
        price: 250000, category: 'Vestidos', imageUrl: 'https://i.ibb.co/jLDhQ8T/vestido-verano.jpg', available: true,
        variants: {
            hasSizes: true, sizes: { 'S': { available: true }, 'M': { available: true }, 'L': { available: true } },
            hasColors: false, colors: {}
        }
    },
    {
        id: 'prod3', name: 'Pantalón Palazzo "Elegancia"', description: 'Pantalón de pierna ancha que estiliza la figura.',
        price: 220000, category: 'Pantalones', imageUrl: 'https://i.ibb.co/jWw9y1J/pantalon-negro.jpg', available: true,
        discountPercentage: 15,
        variants: {
            hasSizes: true, sizes: { '34': { available: true }, '36': { available: true }, '38': { available: true } },
            hasColors: true, colors: {
                'Negro': { available: true, imageUrl: 'https://i.ibb.co/jWw9y1J/pantalon-negro.jpg' },
                'Beige': { available: false, imageUrl: 'https://i.ibb.co/vYJkKx6/pantalon-beige.jpg' }
            }
        }
    },
    {
        id: 'prod4', name: 'Bolso "Tote" de Cuero', description: 'Un bolso espacioso y chic para llevar todo lo que necesitas.',
        price: 350000, category: 'Bolsos', imageUrl: 'https://i.ibb.co/WcWz30D/bolso-marron.jpg', available: true,
        variants: {
            hasSizes: false, sizes: {},
            hasColors: true, colors: {
                'Marrón': { available: true, imageUrl: 'https://i.ibb.co/WcWz30D/bolso-marron.jpg' },
                'Negro': { available: true, imageUrl: 'https://i.ibb.co/PchL1P5/bolso-negro.jpg' }
            }
        }
    },
    {
        id: 'prod5', name: 'Falda Midi "Parisina"', description: 'Falda con pliegues y un estampado chic.',
        price: 190000, category: 'Vestidos', imageUrl: 'https://i.ibb.co/4T7vQd4/falda-midi.jpg', available: false, // Out of stock
        variants: {
            hasSizes: true, sizes: { 'S': { available: true }, 'M': { available: false } },
            hasColors: false, colors: {}
        }
    },
    {
        id: 'prod6', name: 'Aretes "Gota de Oro"', description: 'Aretes delicados para un toque de brillo.',
        price: 95000, category: 'Accesorios', imageUrl: 'https://i.ibb.co/mBkwfV2/aretes-oro.jpg', available: true,
        variants: {
            hasSizes: false, sizes: {},
            hasColors: false, colors: {}
        }
    },
    {
        id: 'prod7', name: 'Chaqueta Denim "Urbana"', description: 'Chaqueta de jean clásica, un básico indispensable.',
        price: 280000, category: 'Chaquetas', imageUrl: 'https://i.ibb.co/mGg8BMR/chaqueta-denim.jpg', available: true,
        variants: {
            hasSizes: true, sizes: { 'S': { available: true }, 'M': { available: true } },
            hasColors: false, colors: {}
        }
    },
     {
        id: 'prod8', name: 'Top Corto de Lino', description: 'Top fresco y versátil, ideal para combinar.',
        price: 130000, category: 'Blusas', imageUrl: 'https://i.ibb.co/tYtK6B0/top-lino.jpg', available: true,
        variants: {
            hasSizes: true, sizes: { 'XS': { available: true }, 'S': { available: true }, 'M': { available: true } },
            hasColors: false, colors: {}
        }
    }
];

// --- Helper Functions ---
const useBrowserStorage = <T,>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading from localStorage for key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue: React.Dispatch<React.SetStateAction<T>> = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      
      try {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      } catch (error) {
        if (error instanceof DOMException && (error.name === 'QuotaExceededError' || error.code === 22)) {
          console.warn(
            `LocalStorage quota exceeded when trying to save key "${key}". ` +
            `The latest changes will not be persisted across sessions.`
          );
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error(`Error in useBrowserStorage setValue for key "${key}":`, error);
    }
  };

  return [storedValue, setValue];
};

const useFirestoreDocSync = <T extends object>(collectionName: string, docId: string, initialValue: T): [T, (value: T) => void, boolean] => {
    const [data, setData] = useState<T>(initialValue);
    const [isLoading, setIsLoading] = useState(true);
    const docRef = useMemo(() => doc(db, collectionName, docId), [collectionName, docId]);

    useEffect(() => {
        const unsubscribe = onSnapshot(docRef,
            (docSnap) => {
                if (docSnap.exists()) {
                    setData(docSnap.data() as T);
                } else {
                    setDoc(docRef, initialValue).catch(error => console.error(`Firestore initial setDoc error for ${collectionName}/${docId}:`, error));
                }
                setIsLoading(false);
            },
            (error) => {
                console.error(`Firestore onSnapshot error for ${collectionName}/${docId}:`, error);
                setIsLoading(false);
            }
        );

        return () => unsubscribe();
    }, [docRef, JSON.stringify(initialValue)]);

    const setValue = useCallback((value: T) => {
        try {
            setDoc(docRef, value, { merge: true });
        } catch (error) {
            console.error(`Firestore setDoc error for ${collectionName}/${docId}:`, error);
        }
    }, [docRef]);

    return [data, setValue, isLoading];
};

const useFirestoreCollectionSync = <T extends {docId: string}>(collectionName: string): [T[], boolean] => {
    const [data, setData] = useState<T[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const collectionRef = useMemo(() => collection(db, collectionName), [collectionName]);

    useEffect(() => {
        const unsubscribe = onSnapshot(collectionRef,
            (querySnapshot) => {
                const items = querySnapshot.docs.map(doc => ({ ...doc.data(), docId: doc.id } as T));
                setData(items);
                setIsLoading(false);
            },
            (error) => {
                console.error(`Firestore onSnapshot error for collection ${collectionName}:`, error);
                setIsLoading(false);
            }
        );
        return () => unsubscribe();
    }, [collectionRef]);

    return [data, isLoading];
};

const uploadImageToStorage = async (file: File): Promise<string> => {
    const fileName = `images/${Date.now()}-${file.name}`;
    const storageRef = ref(storage, fileName);
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
};

const App: React.FC = () => {
    // Global State
    const [config, setConfig, isConfigLoading] = useFirestoreDocSync<StoreConfig>('store', 'config', initialConfig);
    const [{ list: banners }, setBannersDoc, areBannersLoading] = useFirestoreDocSync<{list: Banner[]}>('store', 'banners', { list: initialBanners });
    const [{ list: products }, setProductsDoc, areProductsLoading] = useFirestoreDocSync<{list: Product[]}>('store', 'products', { list: initialProducts });
    const [{ list: categories }, setCategoriesDoc, areCategoriesLoading] = useFirestoreDocSync<{list: Category[]}>('store', 'categories', { list: initialCategories });
    const [orders, areOrdersLoading] = useFirestoreCollectionSync<Order>('orders');
    const [users, areUsersLoading] = useFirestoreCollectionSync<User>('users');
    const [cart, setCart] = useBrowserStorage<CartItem[]>('storeCart', []);
    
    // Auth State
    const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
    const [userData, setUserData] = useState<User | null>(null);
    const [isAuthLoading, setAuthLoading] = useState(true);
    
    // UI State
    const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isCartOpen, setCartOpen] = useState(false);
    const [isAdminOpen, setAdminOpen] = useState(false);
    const [isSearchModalOpen, setSearchModalOpen] = useState(false);
    const [isInvoiceModalOpen, setInvoiceModalOpen] = useState(false);
    const [isAddUserModalOpen, setAddUserModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [productToEdit, setProductToEdit] = useState<Product | null>(null);
    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    const [isProductDetailFromCart, setProductDetailFromCart] = useState(false);
    
    // Search & Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<Category | 'All' | 'On Sale'>('All');

    // Admin State
    const [editMode, setEditMode] = useState(false);
    
    const isAppLoading = isConfigLoading || areBannersLoading || areProductsLoading || areCategoriesLoading || areOrdersLoading || isAuthLoading || areUsersLoading;
    
    // --- BROWSER HISTORY / BACK BUTTON MODAL HANDLING ---
    const modalHistoryActive = useRef(false);

    useEffect(() => {
        const handlePopState = () => {
            if (modalHistoryActive.current) {
                setSelectedProduct(null);
                setCartOpen(false);
                setAdminOpen(false);
                setInvoiceModalOpen(false);
                setAddUserModalOpen(false);
                setSearchModalOpen(false);
                modalHistoryActive.current = false;
            }
        };
        window.addEventListener('popstate', handlePopState);
        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, []);

    const closeModal = () => {
        if (modalHistoryActive.current) {
            window.history.back();
        } else {
            setSelectedProduct(null);
            setCartOpen(false);
            setAdminOpen(false);
            setInvoiceModalOpen(false);
            setAddUserModalOpen(false);
            setSearchModalOpen(false);
        }
        setProductDetailFromCart(false);
    };

    const openPrimaryModal = (setter: React.Dispatch<React.SetStateAction<any>>, value: any) => {
        if (!modalHistoryActive.current) {
            window.history.pushState({ modal: true }, '');
            modalHistoryActive.current = true;
        }
        setter(value);
    };

    const handleOpenProductDetails = (product: Product) => {
        openPrimaryModal(setSelectedProduct, product);
    };

    const handleOpenCart = () => {
        openPrimaryModal(setCartOpen, true);
    };

    const handleOpenAdmin = () => {
        openPrimaryModal(setAdminOpen, true);
    };
    
    const handleOpenSearchModal = () => {
        openPrimaryModal(setSearchModalOpen, true);
    };


    // --- AUTH EFFECT ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);
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
            setAuthLoading(false);
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
            setAdminOpen(false);
        } catch (error) {
            console.error("Error signing out: ", error);
            showToast("Error al cerrar sesión.", "error");
        }
    };

    // --- DERIVED STATE & MEMOS ---
    const cartItemCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
    const cartSubtotal = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);
    
    const filteredProducts = useMemo(() => {
        return (products || []).filter(product => {
            let matchesCategory = true;
            if (selectedCategory === 'On Sale') {
                matchesCategory = product.discountPercentage != null && product.discountPercentage > 0;
            } else if (selectedCategory !== 'All') {
                matchesCategory = product.category === selectedCategory;
            }
            
            const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesCategory && matchesSearch;
        });
    }, [products, selectedCategory, searchTerm]);

    const newArrivals = useMemo(() => [...(products || [])].sort((a,b) => b.id.localeCompare(a.id)).slice(0, 6), [products]);
    const bestSellers = useMemo(() => {
        return [...(products || [])].sort(() => Math.random() - 0.5).slice(0, 4);
    }, [products]);

    // --- EVENT HANDLERS ---
    const handleAddToCart = (product: Product, quantity: number, size?: string, color?: string) => {
        const cartItemId = `${product.id}${size ? `-${size}` : ''}${color ? `-${color}` : ''}`;
        const existingItem = cart.find(item => item.id === cartItemId);

        const hasDiscount = product.discountPercentage != null && product.discountPercentage > 0;
        const finalPrice = hasDiscount
            ? product.price * (1 - product.discountPercentage / 100)
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
        setSelectedProduct(null);
        if (!isProductDetailFromCart) {
            if (modalHistoryActive.current) window.history.back();
        }
        setProductDetailFromCart(false);
    };
    
    const handleQuickAddToCart = (product: Product) => {
      const hasDefinedSizes = !!(product.variants?.hasSizes && product.variants.sizes && Object.keys(product.variants.sizes).length > 0);
      const hasDefinedColors = !!(product.variants?.hasColors && product.variants.colors && Object.keys(product.variants.colors).length > 0);

      if (hasDefinedSizes || hasDefinedColors) {
        setProductDetailFromCart(false);
        handleOpenProductDetails(product);
      } else {
        handleAddToCart(product, 1);
      }
    };
    
    const handleQuickAddFromCart = (product: Product) => {
      const hasDefinedSizes = !!(product.variants?.hasSizes && product.variants.sizes && Object.keys(product.variants.sizes).length > 0);
      const hasDefinedColors = !!(product.variants?.hasColors && product.variants.colors && Object.keys(product.variants.colors).length > 0);

      if (hasDefinedSizes || hasDefinedColors) {
        setProductDetailFromCart(true);
        handleOpenProductDetails(product);
      } else {
        const cartItemId = `${product.id}`;
        const existingItem = cart.find(item => item.id === cartItemId);

        const hasDiscount = product.discountPercentage != null && product.discountPercentage > 0;
        const finalPrice = hasDiscount
            ? product.price * (1 - product.discountPercentage / 100)
            : product.price;
        
        if (existingItem) {
            setCart(cart.map(item => item.id === cartItemId ? { ...item, quantity: item.quantity + 1 } : item));
        } else {
            const newItem: CartItem = {
                id: cartItemId,
                productId: product.id,
                name: product.name,
                price: finalPrice,
                quantity: 1,
                imageUrl: product.imageUrl,
            };
            setCart([...cart, newItem]);
        }
        showToast(`${product.name} agregado al carrito!`);
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
        setCart(cart.map(item => item.id === cartItemId ? { ...item, quantity: newQuantity } : item));
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
        setSelectedCategory(category);
        setMobileMenuOpen(false);
        const element = document.getElementById('productos');
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    };
    
    const handleCategoryButtonClick = (category: Category | 'All') => {
      setSelectedCategory(category);
      const element = document.getElementById('productos');
      if (element) {
        // A slight delay might help if there are rendering issues, but smooth is better
        element.scrollIntoView({ behavior: 'smooth' });
      }
    };
    
    const handleSearchAndNavigate = (term: string = '', category: Category | 'All' | 'On Sale' = 'All') => {
        setSearchTerm(term);
        setSelectedCategory(category);
        closeModal();
        const element = document.getElementById('productos');
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    };
    
    // --- ADMIN CRUD HANDLERS ---
    const handleUpdateConfig = (newConfig: StoreConfig) => { setConfig(newConfig); showToast("Configuración general guardada."); };
    const handleSaveBanners = (newBanners: Banner[]) => { setBannersDoc({ list: newBanners }); showToast("Banners guardados."); };
    const handleSaveCategories = (newCategories: Category[]) => { setCategoriesDoc({ list: newCategories }); showToast("Categorías guardadas."); };
    
    const handleAddProduct = (newProduct: Product) => {
      const updatedProducts = [newProduct, ...(products || [])];
      setProductsDoc({ list: updatedProducts });
      showToast("Producto agregado exitosamente.");
    };

    const handleUpdateProduct = (updatedProduct: Product) => {
      const updatedProducts = (products || []).map(p => p.id === updatedProduct.id ? updatedProduct : p);
      setProductsDoc({ list: updatedProducts });
      showToast("Producto actualizado exitosamente.");
    };
    
    const handleDeleteProduct = (productId: string) => {
        if (window.confirm("¿Estás seguro de que quieres eliminar este producto? Esta acción no se puede deshacer.")) {
            const updatedProducts = (products || []).filter(p => p.id !== productId);
            setProductsDoc({ list: updatedProducts });
            showToast("Producto eliminado.", "error");
        }
    };
    
    const handleNewOrder = async (orderData: Omit<Order, 'docId' | 'orderNumber' | 'status' | 'date'>) => {
        const orderCounterRef = doc(db, 'store', 'orderCounter');

        try {
            const newOrderNumber = await runTransaction(db, async (transaction) => {
                const counterDoc = await transaction.get(orderCounterRef);
                let nextNumber = 1001;
                if (counterDoc.exists()) {
                    nextNumber = (counterDoc.data()?.currentNumber || 1000) + 1;
                }
                transaction.set(orderCounterRef, { currentNumber: nextNumber }, { merge: true });
                return nextNumber;
            });

            const orderNumber = `BMB-${newOrderNumber}`;

            const newOrder: Omit<Order, 'docId'> = {
                ...orderData,
                orderNumber,
                status: 'Pendiente',
                date: new Date().toISOString(),
            };
            
            const messageItems = newOrder.items.map(item => `- ${item.quantity}x ${item.name} ${item.size ? `(Talla: ${item.size})` : ''} ${item.color ? `(Color: ${item.color})` : ''} - ${formatCurrency(item.price * item.quantity)}`).join('\n');
            const message = `¡Hola ${config.contact.name}! 👋 Quiero hacer un pedido:\n\n*Número de Orden:* ${orderNumber}\n\n*Productos:*\n${messageItems}\n\n*Subtotal:* ${formatCurrency(newOrder.subtotal)}\n*Envío:* ${formatCurrency(newOrder.shippingCost)}\n*TOTAL:* ${formatCurrency(newOrder.total)}\n\n*Datos del Cliente:*\n- Nombre: ${newOrder.customerName}\n- Teléfono: ${newOrder.customerPhone}\n\n*Entrega:* ${newOrder.deliveryMethod}\n${newOrder.deliveryMethod === 'Envío a Domicilio' && newOrder.address ? `- Dirección: ${newOrder.address}\n` : ''}*Medio de Pago:* ${newOrder.paymentMethod}\n\n¡Gracias! 😊`;
            
            window.open(`https://wa.me/${config.social.whatsapp}?text=${encodeURIComponent(message)}`, '_blank');
            
            await addDoc(collection(db, 'orders'), newOrder);

            setCart([]);
            closeModal();
            showToast("¡Pedido enviado por WhatsApp!");

        } catch (error) {
            console.error("Error creating order with transaction:", error);
            showToast("Error al procesar el pedido. Inténtalo de nuevo.", "error");
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
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
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
        }
    };

    const handleUpdateUserRole = async (userDocId: string, newRole: User['role']) => {
        try {
            await updateDoc(doc(db, 'users', userDocId), { role: newRole });
            showToast("Rol de usuario actualizado.");
        } catch (error) {
            console.error("Error updating user role:", error);
            showToast("Error al cambiar el rol.", "error");
        }
    };
    
    const handleDeleteUser = async (userDocId: string) => {
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

    if (isAppLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-background">
                <div className="flex flex-col items-center">
                   <svg className="animate-spin h-10 w-10 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 2000/svg">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="mt-4 text-on-surface">Cargando la magia de Bombon...</p>
                </div>
            </div>
        );
    }
    
    // --- UI COMPONENTS ---
    const ToastContainer = () => (
        <div className="fixed top-5 right-5 z-[100] space-y-2">
            {toasts.map(toast => (
                <div key={toast.id} className={`px-4 py-2 rounded-md shadow-lg text-white ${toast.type === 'success' ? 'bg-primary' : 'bg-red-500'}`}>
                    {toast.message}
                </div>
            ))}
        </div>
    );
    
    const ProductCard: React.FC<{ product: Product }> = ({ product }) => {
        const hasDiscount = product.discountPercentage != null && product.discountPercentage > 0;
        const discountedPrice = hasDiscount ? product.price * (1 - product.discountPercentage! / 100) : product.price;

        return (
            <div className="relative group bg-white rounded-lg shadow-md overflow-hidden flex flex-col h-full cursor-pointer" onClick={() => handleOpenProductDetails(product)}>
                <div className="relative aspect-[4/5] w-full overflow-hidden">
                    <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    {!product.available && (
                        <div className="absolute top-2 left-2 bg-on-surface text-background text-xs font-bold px-2 py-1 rounded">AGOTADO</div>
                    )}
                    {hasDiscount && (
                        <div className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">{product.discountPercentage}% OFF</div>
                    )}
                    <div className="absolute bottom-2 right-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleQuickAddToCart(product); }}
                          className="bg-white/80 backdrop-blur-sm text-primary rounded-full p-2 shadow-md hover:bg-white transition-all scale-0 group-hover:scale-100 disabled:opacity-50"
                          aria-label="Agregar al carrito"
                          disabled={!product.available}
                        >
                          <PlusIcon className="w-5 h-5" />
                        </button>
                    </div>
                     {editMode && (userData?.role === 'admin' || userData?.role === 'vendedor') && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => {e.stopPropagation(); handleOpenProductEdit(product);}} className="bg-white text-on-surface px-3 py-1 rounded text-sm font-semibold flex items-center space-x-1">
                          <PencilIcon className="w-4 h-4"/>
                          <span>Editar</span>
                        </button>
                      </div>
                    )}
                </div>
                <div className="p-4 flex flex-col flex-grow">
                    <h3 className="font-semibold text-sm truncate">{product.name}</h3>
                    <div className="flex items-baseline gap-2 mt-1">
                        {hasDiscount && (
                           <span className="text-gray-500 line-through text-sm">{formatCurrency(product.price)}</span>
                        )}
                        <span className="text-primary font-bold text-base">{formatCurrency(discountedPrice)}</span>
                    </div>
                </div>
            </div>
        );
    };

    const ProductCarousel = ({ title, products: carouselProducts }: { title: string, products: Product[] }) => (
      <section className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-serif text-center mb-8 text-on-surface">{title}</h2>
          <div className="relative">
              <div className="flex overflow-x-auto space-x-6 pb-4 -mx-4 px-4 scrollbar-hide">
                  {carouselProducts.map(product => (
                      <div key={product.id} className="flex-shrink-0 w-64 sm:w-72">
                          <ProductCard product={product} />
                      </div>
                  ))}
              </div>
          </div>
        </div>
      </section>
    );
    
    // --- RENDER ADMIN OR LOGIN VIEW ---
    const renderAdminView = () => {
        if (!isAdminOpen) return null;
        
        if (isAuthLoading) {
             return (
                <div className="fixed inset-0 bg-black/60 z-[90] flex items-center justify-center">
                    <svg className="animate-spin h-10 w-10 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 2000/svg">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                </div>
             );
        }

        if (!currentUser || !userData) {
            return <LoginPage showToast={showToast} onClose={closeModal} />;
        }
        
        return (
            <AdminPanel
                user={userData}
                onClose={closeModal}
                editMode={editMode}
                setEditMode={setEditMode}
                store={{ config, banners, products, categories, orders, users }}
                onUpdateConfig={handleUpdateConfig}
                onSaveBanners={handleSaveBanners}
                onSaveCategories={handleSaveCategories}
                onAddProduct={handleAddProduct}
                onUpdateProduct={handleUpdateProduct}
                onDeleteProduct={handleDeleteProduct}
                formatCurrency={formatCurrency}
                productToEdit={productToEdit}
                onDeleteOrder={handleDeleteOrder}
                onUpdateOrder={handleUpdateOrder}
                onLogout={handleLogout}
                onAddUser={() => setAddUserModalOpen(true)}
                onUpdateUserRole={handleUpdateUserRole}
                onDeleteUser={handleDeleteUser}
            />
        );
    }

    // --- MAIN RENDER ---
    return (
        <div className="bg-background min-h-screen">
            <ToastContainer />
            <Header
                logoUrl={config.logoUrl}
                cartItemCount={cartItemCount}
                onCartClick={handleOpenCart}
                isMobileMenuOpen={isMobileMenuOpen}
                setMobileMenuOpen={setMobileMenuOpen}
                categories={categories}
                onSelectCategory={handleNavigateToCategory}
                selectedCategory={selectedCategory}
                currentUser={currentUser}
                onAdminClick={handleOpenAdmin}
                onSearchClick={handleOpenSearchModal}
            />
            
            <CategoryNav
              categories={categories}
              selectedCategory={selectedCategory}
              onSelectCategory={handleCategoryButtonClick}
            />

            <main className="pt-12">
                <BannerCarousel banners={banners} onNavigateToCategory={(cat) => handleCategoryButtonClick(cat as Category)} />
                
                {selectedCategory === 'All' && (
                  <>
                    <ProductCarousel title="Lo Nuevo" products={newArrivals} />
                    <ProductCarousel title="Más Vendidos" products={bestSellers} />
                  </>
                )}
                
                <section id="productos" className="py-12 bg-surface">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <h2 className="text-3xl font-serif text-center mb-8 text-on-surface">
                           {selectedCategory === 'All' ? 'Todo Nuestro Catálogo' : selectedCategory}
                        </h2>
                         <div className="flex justify-center mb-8">
                            <div className="relative w-full md:w-1/2">
                               <input 
                                   type="text" 
                                   placeholder="Buscar productos por nombre..." 
                                   value={searchTerm}
                                   onChange={e => setSearchTerm(e.target.value)}
                                   className="w-full bg-white border border-gray-300 rounded-full pl-10 pr-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
                                />
                               <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                           </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 md:gap-6">
                            {filteredProducts.map(product => <ProductCard key={product.id} product={product} />)}
                        </div>
                        {filteredProducts.length === 0 && <p className="text-center col-span-full mt-8">No se encontraron productos que coincidan con tu búsqueda.</p>}
                    </div>
                </section>
                
            </main>
            
            <Footer contact={config.contact} social={config.social} onAdminClick={handleOpenAdmin} />

            {isCartOpen && <CartPanel onClose={closeModal} cart={cart} subtotal={cartSubtotal} onUpdateQuantity={handleUpdateCartQuantity} onRemoveItem={handleRemoveFromCart} onCheckout={() => { setCartOpen(false); setInvoiceModalOpen(true); }} formatCurrency={formatCurrency} suggestedProducts={bestSellers} onAddSuggestedProduct={handleQuickAddFromCart} paymentMethodsImageUrl={config.paymentMethodsImageUrl} />}
            {renderAdminView()}
            {selectedProduct && <ProductDetailModal product={selectedProduct} onClose={closeModal} onAddToCart={handleAddToCart} formatCurrency={formatCurrency} />}
            {isInvoiceModalOpen && <InvoiceModal onClose={closeModal} cart={cart} subtotal={cartSubtotal} onSubmitOrder={handleNewOrder} config={config} formatCurrency={formatCurrency} />}
            {isAddUserModalOpen && <AddUserModal onClose={() => setAddUserModalOpen(false)} onCreateUser={handleCreateUser} />}
            {isSearchModalOpen && <SearchModal 
                onClose={closeModal} 
                onSearch={(term) => handleSearchAndNavigate(term, 'All')} 
                onSelectCategory={(category) => handleSearchAndNavigate('', category)} 
            />}


            <a
              href={`https://wa.me/${config.social.whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="fixed bottom-5 right-5 z-40 bg-primary text-white p-4 rounded-full shadow-lg hover:bg-primary-dark hover:scale-110 transition-transform duration-300"
              aria-label="Contáctanos por WhatsApp"
            >
              <WhatsAppIcon className="w-8 h-8" />
            </a>
        </div>
    );
};

// --- SUB-COMPONENTS ---

const SearchModal: React.FC<{
  onClose: () => void;
  onSearch: (term: string) => void;
  onSelectCategory: (category: Category | 'All' | 'On Sale') => void;
}> = ({ onClose, onSearch, onSelectCategory }) => {
  const [term, setTerm] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  
  const suggestions = [
    { emoji: '👗', text: 'Vestidos', category: 'Vestidos' },
    { emoji: '👖', text: 'Pantalones', category: 'Pantalones' },
    { emoji: '👚', text: 'Blusas', category: 'Blusas' },
    { emoji: '✨', text: 'Accesorios', category: 'Accesorios' },
    { emoji: '👜', text: 'Bolsos', category: 'Bolsos' },
    { emoji: '🧥', text: 'Chaquetas', category: 'Chaquetas' },
    { emoji: '🔥', text: 'Ofertas', category: 'On Sale' },
  ];
  
  const handleSuggestionClick = (category: Category | 'All' | 'On Sale') => {
    onSelectCategory(category);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(term);
  };
  
  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex justify-center items-start pt-20 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <form onSubmit={handleSearchSubmit}>
          <div className="relative p-4">
            <input 
              ref={inputRef}
              type="text" 
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="¿Qué estás buscando hoy?"
              className="w-full bg-surface border-2 border-gray-300 rounded-full pl-12 pr-4 py-3 focus:ring-2 focus:ring-primary focus:border-primary"
            />
            <SearchIcon className="absolute left-8 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
            <button type="submit" className="hidden">Buscar</button>
          </div>
        </form>
        <div className="p-4 pt-0">
          <h3 className="font-semibold mb-3 text-gray-600">Sugerencias de Búsqueda</h3>
          <div className="flex flex-wrap gap-3">
            {suggestions.map(s => (
              <button 
                key={s.text} 
                onClick={() => handleSuggestionClick(s.category as any)}
                className="flex items-center space-x-2 bg-gray-100 hover:bg-pink-100 text-on-surface hover:text-primary px-4 py-2 rounded-full transition-colors"
              >
                <span>{s.emoji}</span>
                <span className="font-medium">{s.text}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
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

        const isDemoUser = email === 'admin@bombon.com' || email === 'vendedor@bombon.com';
        const isCorrectDemoPassword = password === 'bombon123';
        
        if (isDemoUser && isCorrectDemoPassword && (authError.code === 'auth/invalid-credential' || authError.code === 'auth/user-not-found')) {
            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                if (!user) throw new Error("Demo user creation failed.");
                const role = email === 'admin@bombon.com' ? 'admin' : 'vendedor';
                
                await setDoc(doc(db, "users", user.uid), {
                    uid: user.uid,
                    email: user.email,
                    role: role
                });
                
                showToast(`Cuenta de ${role} creada. ¡Bienvenido/a!`);
                return;
            } catch (creationError: any) {
                console.error("Error creating demo user:", creationError);
                setError('Error al configurar la cuenta de demostración.');
                setIsLoading(false);
                return;
            }
        }

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
    onSearchClick: () => void
}> = ({ logoUrl, cartItemCount, onCartClick, isMobileMenuOpen, setMobileMenuOpen, categories, onSelectCategory, selectedCategory, currentUser, onAdminClick, onSearchClick }) => {
    
    const baseLinkClasses = 'block text-lg px-4 py-3 rounded-md transition-colors';
    const activeLinkClasses = 'bg-pink-100 text-primary font-semibold';
    const inactiveLinkClasses = 'hover:bg-pink-100 hover:text-primary';

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
        setMobileMenuOpen(false); // Closes mobile menu if it was open
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    };

    return (
        <>
            <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm shadow-md h-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
                    <div className="flex items-center justify-between h-full">
                        <div className="flex-1 flex justify-start">
                            <button className="md:hidden text-on-surface" onClick={() => setMobileMenuOpen(true)}>
                                <MenuIcon className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="flex-shrink-0">
                           <a href="#" onClick={handleLogoClick} aria-label="Volver al inicio">
                                <img src={logoUrl} alt="Bombon Logo" className="h-14 w-auto cursor-pointer" />
                            </a>
                        </div>

                        <div className="flex-1 flex justify-end items-center">
                            <button onClick={onSearchClick} className="relative text-on-surface hover:text-primary p-2" aria-label="Buscar productos">
                                <SearchIcon className="w-6 h-6" />
                            </button>
                            <button onClick={onCartClick} className="relative text-on-surface hover:text-primary p-2" aria-label="Ver carrito de compras">
                                <CartIcon className="w-6 h-6" />
                                {cartItemCount > 0 && <span className="absolute -top-1 -right-1 bg-primary text-white text-xs rounded-full h-5 w-5 flex items-center justify-center" aria-label={`${cartItemCount} productos en el carrito`}>{cartItemCount}</span>}
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
                className={`fixed top-0 left-0 h-full w-80 max-w-[80vw] bg-white shadow-xl flex flex-col z-[60] transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="mobile-menu-title"
            >
                <div className="flex justify-between items-center p-4 border-b">
                     <a href="#" onClick={handleLogoClick} aria-label="Volver al inicio">
                        <img src={logoUrl} alt="Bombon Logo" className="h-10 w-auto" id="mobile-menu-title" />
                    </a>
                    <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-on-surface rounded-full hover:bg-gray-100" aria-label="Cerrar menú">
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
                    <div className="border-t my-4"></div>
                    <a href="#contacto" onClick={handleContactClick} className="block text-lg px-4 py-3 rounded-md hover:bg-pink-100 hover:text-primary transition-colors">
                        Contacto
                    </a>
                    <a href="#" onClick={(e) => {
                        e.preventDefault();
                        setMobileMenuOpen(false);
                        onAdminClick();
                    }} className="block text-lg px-4 py-3 rounded-md hover:bg-pink-100 hover:text-primary transition-colors">
                        {currentUser ? 'Administrar Tienda' : 'Iniciar Sesión'}
                    </a>
                </nav>
            </div>
        </>
    );
};

const CategoryNav: React.FC<{
    categories: Category[];
    selectedCategory: string;
    onSelectCategory: (category: Category | 'All') => void;
}> = ({ categories, selectedCategory, onSelectCategory }) => {
    return (
        <nav className="bg-surface border-b border-gray-200 sticky top-20 z-40">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center space-x-2 overflow-x-auto scrollbar-hide py-3 md:justify-center">
                    <button
                        onClick={() => onSelectCategory('All')}
                        className={`px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors duration-200 ${selectedCategory === 'All' ? 'bg-primary text-white' : 'bg-gray-200 text-on-surface hover:bg-pink-100'}`}
                    >
                        Todas
                    </button>
                    {(categories || []).map(cat => (
                        <button
                            key={cat}
                            onClick={() => onSelectCategory(cat)}
                            className={`px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors duration-200 ${selectedCategory === cat ? 'bg-primary text-white' : 'bg-gray-200 text-on-surface hover:bg-pink-100'}`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>
        </nav>
    );
};

const BannerCarousel: React.FC<{ banners: Banner[]; onNavigateToCategory: (category: Category) => void; }> = ({ banners, onNavigateToCategory }) => {
    const [currentIndex, setCurrentIndex] = useState(0);

    const nextBanner = useCallback(() => {
        if (!banners || banners.length === 0) return;
        setCurrentIndex(prev => (prev + 1) % banners.length);
    }, [banners]);

    const prevBanner = () => {
        if (!banners || banners.length === 0) return;
        setCurrentIndex(prev => (prev - 1 + banners.length) % banners.length);
    };

    useEffect(() => {
        if(!banners || banners.length <= 1) return;
        const timer = setInterval(nextBanner, 5000);
        return () => clearInterval(timer);
    }, [nextBanner, banners]);

    const handleBannerClick = (e: React.MouseEvent<HTMLAnchorElement>, banner: Banner) => {
        if (banner.link.startsWith('category:')) {
            e.preventDefault();
            const category = banner.link.split(':')[1];
            onNavigateToCategory(category as Category);
        }
    };

    if (!banners || banners.length === 0) {
        return <div className="h-96 md:h-[500px] bg-gray-200 flex items-center justify-center text-gray-500">No hay banners para mostrar.</div>;
    }

    return (
        <div className="relative w-full h-96 md:h-[500px] overflow-hidden bg-gray-100">
            {banners.map((banner, index) => (
                <div key={banner.id} className={`absolute inset-0 transition-opacity duration-1000 ${index === currentIndex ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                    <img src={banner.imageUrl} alt={banner.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-center text-white p-4">
                        <h2 className="text-4xl md:text-6xl font-serif">{banner.title}</h2>
                        <p className="mt-2 text-lg md:text-xl">{banner.subtitle}</p>
                        <a 
                           href={banner.link.startsWith('category:') ? '#productos' : banner.link} 
                           onClick={(e) => handleBannerClick(e, banner)}
                           className="mt-6 px-8 py-3 bg-primary text-white rounded-full font-semibold hover:bg-primary-dark transition-colors duration-300 shadow-lg"
                        >
                            Ver Colección
                        </a>
                    </div>
                </div>
            ))}
            {banners.length > 1 && <>
              <button onClick={prevBanner} className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/50 text-black p-2 rounded-full hover:bg-white"><ChevronLeftIcon className="w-6 h-6" /></button>
              <button onClick={nextBanner} className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/50 text-black p-2 rounded-full hover:bg-white"><ChevronRightIcon className="w-6 h-6" /></button>
            </>}
        </div>
    );
};

const CartPanel: React.FC<{
    onClose: () => void,
    cart: CartItem[],
    subtotal: number,
    onUpdateQuantity: (id: string, qty: number) => void,
    onRemoveItem: (id: string) => void,
    onCheckout: () => void,
    formatCurrency: (amount: number) => string,
    suggestedProducts: Product[],
    onAddSuggestedProduct: (product: Product) => void,
    paymentMethodsImageUrl?: string
}> = ({ onClose, cart, subtotal, onUpdateQuantity, onRemoveItem, onCheckout, formatCurrency, suggestedProducts, onAddSuggestedProduct, paymentMethodsImageUrl }) => {
    const FREE_SHIPPING_THRESHOLD = 150000;
    const missingForFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
    const progressPercentage = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);
    
    const finalSuggestions = useMemo(() => {
        const cartProductIds = new Set(cart.map(item => item.productId));
        return suggestedProducts.filter(p => !cartProductIds.has(p.id)).slice(0, 3);
    }, [cart, suggestedProducts]);

    return (
        <div className="fixed inset-0 bg-black/60 z-[60]" onClick={onClose}>
            <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-xl flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-semibold">Carrito de Compras</h2>
                    <button onClick={onClose}><CloseIcon className="w-6 h-6" /></button>
                </div>
                {cart.length === 0 ? (
                    <div className="flex-grow flex flex-col items-center justify-center text-center p-4">
                        <CartIcon className="w-24 h-24 text-gray-300" />
                        <p className="mt-4 text-gray-500">Tu carrito está vacío.</p>
                        <button onClick={onClose} className="mt-6 bg-primary text-white py-2 px-6 rounded-md hover:bg-primary-dark transition-colors">
                            Seguir comprando
                        </button>
                    </div>
                ) : (
                    <>
                    <div className="flex-grow overflow-y-auto p-4 space-y-4">
                        {cart.map(item => (
                            <div key={item.id} className="flex items-start space-x-4">
                                <img src={item.imageUrl} alt={item.name} className="w-20 h-24 object-cover rounded-md"/>
                                <div className="flex-grow">
                                    <h3 className="font-semibold">{item.name}</h3>
                                    <p className="text-sm text-gray-500">{item.size && `Talla: ${item.size}`}{item.color && `, Color: ${item.color}`}</p>
                                    <p className="text-sm font-bold text-primary">{formatCurrency(item.price)}</p>
                                    <div className="flex items-center mt-2">
                                        <button onClick={() => onUpdateQuantity(item.id, item.quantity - 1)} className="p-1 border rounded-md"><MinusIcon className="w-4 h-4"/></button>
                                        <span className="px-3 font-semibold">{item.quantity}</span>
                                        <button onClick={() => onUpdateQuantity(item.id, item.quantity + 1)} className="p-1 border rounded-md"><PlusIcon className="w-4 h-4"/></button>
                                    </div>
                                </div>
                                <button onClick={() => onRemoveItem(item.id)}><TrashIcon className="w-5 h-5 text-gray-400 hover:text-red-500"/></button>
                            </div>
                        ))}
                    </div>
                    
                    {finalSuggestions.length > 0 && (
                        <div className="p-4 border-t bg-surface">
                            <h3 className="font-semibold text-sm mb-3">Completa tu look</h3>
                            <div className="space-y-3">
                                {finalSuggestions.map(product => (
                                    <div key={product.id} className="flex items-center space-x-3">
                                        <img src={product.imageUrl} alt={product.name} className="w-14 h-16 object-cover rounded-md flex-shrink-0" />
                                        <div className="flex-grow overflow-hidden">
                                            <p className="text-sm font-medium truncate">{product.name}</p>
                                            <p className="text-sm text-primary font-bold">{formatCurrency(product.price)}</p>
                                        </div>
                                        <button
                                            onClick={() => onAddSuggestedProduct(product)}
                                            className="bg-pink-100 text-primary rounded-full p-2 hover:bg-primary hover:text-white transition-colors flex-shrink-0"
                                            aria-label={`Agregar ${product.name} al carrito`}
                                        >
                                            <PlusIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="p-4 border-t space-y-4 bg-surface">
                         <div className="w-full">
                            <div className="bg-gray-200 rounded-full h-2.5 mb-1">
                                <div className="bg-primary h-2.5 rounded-full transition-all duration-500" style={{ width: `${progressPercentage}%` }}></div>
                            </div>
                            <p className="text-xs text-center font-medium text-gray-600">
                                {missingForFreeShipping > 0
                                    ? `¡Te faltan ${formatCurrency(missingForFreeShipping)} para el envío gratis!`
                                    : "¡Felicidades! Tienes envío gratis."}
                            </p>
                        </div>
                        <div className="flex justify-between font-bold text-lg">
                            <span>Subtotal:</span>
                            <span>{formatCurrency(subtotal)}</span>
                        </div>
                        <button onClick={onCheckout} className="w-full bg-primary text-white py-3 rounded-md hover:bg-primary-dark transition-colors font-semibold">
                            Finalizar Compra
                        </button>
                        <div className="text-center pt-2">
                            <p className="text-xs text-gray-500 mb-2">Medios de pago seguros</p>
                            <div className="flex justify-center items-center">
                                {paymentMethodsImageUrl ? (
                                    <img 
                                        src={paymentMethodsImageUrl} 
                                        alt="Medios de pago aceptados" 
                                        className="h-auto w-full max-w-xs object-contain"
                                    />
                                ) : (
                                    <p className="text-xs text-gray-400 text-center">Configura la imagen de pagos en el panel de admin.</p>
                                )}
                            </div>
                        </div>
                    </div>
                    </>
                )}
            </div>
        </div>
    );
};

const ProductDetailModal: React.FC<{
    product: Product, onClose: () => void,
    onAddToCart: (product: Product, quantity: number, size?: string, color?: string) => void,
    formatCurrency: (amount: number) => string,
}> = ({ product, onClose, onAddToCart, formatCurrency }) => {
    const [quantity, setQuantity] = useState(1);
    const [selectedSize, setSelectedSize] = useState<string | undefined>(undefined);
    const [selectedColor, setSelectedColor] = useState<string | undefined>(undefined);

    useEffect(() => {
      const sizes = product.variants?.sizes || {};
      const availableSizes = Object.entries(sizes).filter(([,d]: [string, ProductVariantDetail]) => d.available).map(([s]) => s);
      if (product.variants?.hasSizes && availableSizes.length > 0) setSelectedSize(availableSizes[0]);
      else setSelectedSize(undefined);

      const colors = product.variants?.colors || {};
      const availableColors = Object.entries(colors).filter(([,d]: [string, ProductColorVariantDetail]) => d.available).map(([c]) => c);
      if (product.variants?.hasColors && availableColors.length > 0) setSelectedColor(availableColors[0]);
      else setSelectedColor(undefined);
    }, [product]);

    const displayImage = selectedColor && product.variants?.colors?.[selectedColor]?.imageUrl
        ? product.variants.colors[selectedColor]!.imageUrl
        : product.imageUrl;
    
    const hasDiscount = product.discountPercentage != null && product.discountPercentage > 0;
    const discountedPrice = hasDiscount ? product.price * (1 - product.discountPercentage! / 100) : product.price;

    const isAddToCartDisabled = !product.available || (product.variants?.hasSizes && !selectedSize) || (product.variants?.hasColors && !selectedColor);

    return (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col md:flex-row overflow-y-auto md:overflow-hidden scrollbar-hide" onClick={e => e.stopPropagation()}>
                <div className="w-full md:w-1/2 flex-shrink-0 aspect-[4/5] md:aspect-auto bg-gray-100">
                    <img src={displayImage} alt={product.name} className="w-full h-full object-cover" />
                </div>
                <div className="w-full md:w-1/2 p-6 flex flex-col md:overflow-y-auto relative scrollbar-hide">
                    <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-black p-1 rounded-full bg-white/50 hover:bg-white z-10"><CloseIcon className="w-6 h-6"/></button>
                    <h2 className="text-2xl font-bold font-serif pr-8">{product.name}</h2>
                    <div className="flex items-baseline gap-3 my-2">
                        {hasDiscount && (
                            <span className="text-gray-500 line-through text-2xl">{formatCurrency(product.price)}</span>
                        )}
                        <span className="text-primary font-bold text-3xl">{formatCurrency(discountedPrice)}</span>
                    </div>
                    <p className="text-gray-600 text-sm mb-4">{product.description}</p>
                    
                    {product.variants?.hasSizes && (
                        <div className="mb-4">
                            <h4 className="font-semibold mb-2 text-sm">Talla: <span className="font-normal text-gray-500">{selectedSize}</span></h4>
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(product.variants?.sizes || {}).map(([size, details]: [string, ProductVariantDetail]) => (
                                    <button key={size} onClick={() => setSelectedSize(size)} disabled={!details.available}
                                        className={`px-4 py-2 border rounded-md text-sm transition-colors ${selectedSize === size ? 'bg-primary text-white border-primary' : 'bg-white'} ${!details.available ? 'text-gray-400 bg-gray-100 line-through cursor-not-allowed' : 'hover:border-primary'}`}
                                    >{size}</button>
                                ))}
                            </div>
                        </div>
                    )}

                    {product.variants?.hasColors && (
                         <div className="mb-4">
                            <h4 className="font-semibold mb-2 text-sm">Color: <span className="font-normal text-gray-500">{selectedColor}</span></h4>
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(product.variants?.colors || {}).map(([color, details]: [string, ProductColorVariantDetail]) => (
                                    <button key={color} onClick={() => setSelectedColor(color)} disabled={!details.available}
                                        className={`px-4 py-2 border rounded-md text-sm transition-colors ${selectedColor === color ? 'bg-primary text-white border-primary' : 'bg-white'} ${!details.available ? 'text-gray-400 bg-gray-100 line-through cursor-not-allowed' : 'hover:border-primary'}`}
                                    >{color}</button>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    <div className="flex items-center space-x-4 my-4">
                        <label htmlFor="quantity" className="font-semibold text-sm">Cantidad:</label>
                        <div className="flex items-center">
                            <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="p-2 border rounded-md"><MinusIcon className="w-5 h-5"/></button>
                            <span className="text-lg font-bold w-12 text-center">{quantity}</span>
                            <button onClick={() => setQuantity(q => q + 1)} className="p-2 border rounded-md"><PlusIcon className="w-5 h-5"/></button>
                        </div>
                    </div>

                    <button onClick={() => onAddToCart(product, quantity, selectedSize, selectedColor)} disabled={isAddToCartDisabled} className="w-full bg-primary text-white py-3 rounded-md hover:bg-primary-dark transition-colors mt-auto disabled:bg-gray-400 disabled:cursor-not-allowed">
                        {product.available ? 'Agregar al Carrito' : 'Agotado'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const InvoiceModal: React.FC<{
    onClose: () => void, cart: CartItem[], subtotal: number,
    onSubmitOrder: (order: Omit<Order, 'docId' | 'orderNumber' | 'status' | 'date'>) => void, config: StoreConfig,
    formatCurrency: (amount: number) => string
}> = ({ onClose, cart, subtotal, onSubmitOrder, config, formatCurrency }) => {
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [deliveryMethod, setDeliveryMethod] = useState<'Recoger en Tienda' | 'Envío a Domicilio'>('Recoger en Tienda');
    const [address, setAddress] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('Nequi');

    const paymentOptions = ['Nequi', 'Daviplata', 'Tarjeta', 'Addi', 'Sistecredito'];
    const FREE_SHIPPING_THRESHOLD = 150000;
    const SHIPPING_COST = 10000;
    const shippingCost = deliveryMethod === 'Envío a Domicilio' && subtotal < FREE_SHIPPING_THRESHOLD ? SHIPPING_COST : 0;
    const total = subtotal + shippingCost;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
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
            customerName,
            customerPhone,
            items: sanitizedCartItems,
            subtotal,
            shippingCost,
            total,
            deliveryMethod,
            ...(deliveryMethod === 'Envío a Domicilio' && { address }),
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
                     {deliveryMethod === 'Envío a Domicilio' && (
                        <div>
                           <label className="block text-sm font-medium mb-1">Dirección Completa</label>
                           <input type="text" value={address} onChange={e => setAddress(e.target.value)} required className="w-full bg-surface border border-gray-300 rounded-md px-3 py-2 focus:ring-primary focus:border-primary" />
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
                    <button type="submit" className="w-full bg-green-500 text-white py-3 rounded-md hover:bg-green-600 flex items-center justify-center space-x-2 font-semibold">
                        <WhatsAppIcon className="w-5 h-5" />
                        <span>Enviar Pedido por WhatsApp</span>
                    </button>
                </div>
            </form>
        </div>
    )
}

const Footer: React.FC<{ contact: StoreConfig['contact'], social: StoreConfig['social'], onAdminClick: () => void }> = ({ contact, social, onAdminClick }) => (
    <footer id="contacto" className="bg-gray-800 text-white">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
                <h3 className="font-serif text-lg">Bombon</h3>
                <p className="mt-2 text-gray-400">Ropa con estilo que cuenta tu historia.</p>
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

const AdminInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { label: string }>(
    ({ label, ...props }, ref) => (
    <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <input ref={ref} {...props} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm disabled:bg-gray-100" />
    </div>
));

const ImageUpload: React.FC<{
    currentImage: string;
    onImageSelect: (url: string) => void;
    label: string;
}> = ({ currentImage, onImageSelect, label }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setIsUploading(true);
            try {
                const imageUrl = await uploadImageToStorage(file);
                onImageSelect(imageUrl);
            } catch (error) {
                console.error("Error uploading image:", error);
                alert("Hubo un error al subir la imagen. Por favor, inténtalo de nuevo.");
            } finally {
                setIsUploading(false);
            }
        }
    };

    return (
        <div>
            <label className="block text-sm font-medium text-gray-700">{label}</label>
            <div className="mt-1 flex items-center space-x-4">
                <img src={currentImage || 'https://via.placeholder.com/80x100'} alt="Preview" className="w-20 h-24 rounded-md object-cover bg-gray-100" />
                <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" disabled={isUploading} />
                <button 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()} 
                  disabled={isUploading}
                  className="px-3 py-2 bg-white text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center space-x-2 disabled:bg-gray-200 disabled:cursor-wait"
                >
                   <UploadIcon className="w-4 h-4" />
                   <span>{isUploading ? 'Subiendo...' : 'Cambiar'}</span>
                </button>
            </div>
        </div>
    );
};

interface AdminPanelProps {
    user: User;
    onClose: () => void;
    editMode: boolean;
    setEditMode: (isEditing: boolean) => void;
    store: {
        config: StoreConfig;
        banners: Banner[];
        products: Product[];
        categories: Category[];
        orders: Order[];
        users: User[];
    };
    onUpdateConfig: (config: StoreConfig) => void;
    onSaveBanners: (banners: Banner[]) => void;
    onSaveCategories: (categories: Category[]) => void;
    onAddProduct: (product: Product) => void;
    onUpdateProduct: (product: Product) => void;
    onDeleteProduct: (productId: string) => void;
    formatCurrency: (amount: number) => string;
    productToEdit: Product | null;
    onDeleteOrder: (orderDocId: string) => void;
    onUpdateOrder: (orderDocId: string, data: Partial<Order>) => void;
    onLogout: () => void;
    onAddUser: () => void;
    onUpdateUserRole: (userDocId: string, newRole: User['role']) => void;
    onDeleteUser: (userDocId: string) => void;
}

const AdminPanel: React.FC<AdminPanelProps> = (props) => {
    const {
        user, onClose, editMode, setEditMode, store,
        onUpdateConfig, onSaveBanners, onSaveCategories,
        onAddProduct, onUpdateProduct, onDeleteProduct,
        formatCurrency, productToEdit, onDeleteOrder, onUpdateOrder,
        onLogout, onAddUser, onUpdateUserRole, onDeleteUser
    } = props;
    
    const isAdmin = user.role === 'admin';
    const canManageProducts = user.role === 'admin' || user.role === 'vendedor';

    const allTabs = ['Productos', 'Pedidos', 'Usuarios', 'Categorías', 'Banners', 'General'];
    const availableTabs = isAdmin ? allTabs : ['Productos', 'Pedidos'];

    const [activeTab, setActiveTab] = useState('Productos');
    
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [isAddingProduct, setIsAddingProduct] = useState(false);

    useEffect(() => {
        if(productToEdit && canManageProducts) {
            setEditingProduct(productToEdit);
            setIsAddingProduct(false);
            setActiveTab('Productos');
        }
    }, [productToEdit, canManageProducts]);

    const handleEditProduct = (product: Product) => {
        setEditingProduct(product);
        setIsAddingProduct(false);
    };
    
    const handleAddNewProduct = () => {
        const newId = `prod-${Date.now()}`;
        const newProductTemplate: Product = {
            id: newId,
            name: '',
            description: '',
            price: 0,
            category: (props.store.categories || [])[0] || '',
            imageUrl: '',
            available: true,
            discountPercentage: 0,
            variants: {
                hasSizes: false, sizes: {},
                hasColors: false, colors: {}
            }
        };
        setEditingProduct(newProductTemplate);
        setIsAddingProduct(true);
    };

    const handleCloseEditor = () => {
        setEditingProduct(null);
        setIsAddingProduct(false);
    };

    const handleSaveProduct = (productToSave: Product) => {
        if (isAddingProduct) {
            onAddProduct(productToSave);
        } else {
            onUpdateProduct(productToSave);
        }
        handleCloseEditor();
    };

    const renderContent = () => {
        if (editingProduct && canManageProducts) {
            return <ProductEditor 
                key={editingProduct.id}
                product={editingProduct}
                categories={props.store.categories}
                onSave={handleSaveProduct}
                onCancel={handleCloseEditor}
                onDelete={onDeleteProduct}
                isNewProduct={isAddingProduct}
            />;
        }

        switch (activeTab) {
            case 'Productos':
                return <AdminProductsTab 
                            products={props.store.products}
                            categories={props.store.categories}
                            onEdit={handleEditProduct}
                            onAdd={handleAddNewProduct}
                            onDelete={onDeleteProduct}
                            formatCurrency={formatCurrency}
                            canManageProducts={canManageProducts}
                        />;
            case 'Categorías':
                return isAdmin ? <AdminCategoriesTab 
                            categories={props.store.categories}
                            onSave={onSaveCategories}
                        /> : null;
            case 'Banners':
                return isAdmin ? <AdminBannersTab 
                            banners={props.store.banners}
                            onSave={onSaveBanners}
                        /> : null;
            case 'General':
                return isAdmin ? <AdminGeneralTab
                            config={props.store.config}
                            onSave={onUpdateConfig}
                        /> : null;
            case 'Pedidos':
                return <AdminOrdersTab 
                            user={user}
                            orders={props.store.orders}
                            formatCurrency={formatCurrency}
                            onDelete={onDeleteOrder}
                            onUpdate={onUpdateOrder}
                        />;
            case 'Usuarios':
                return isAdmin ? <AdminUsersTab 
                            users={props.store.users}
                            onAdd={onAddUser}
                            onUpdateRole={onUpdateUserRole}
                            onDelete={onDeleteUser}
                            currentUserId={user.uid}
                        /> : null;
            default:
                return null;
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[80] flex" onClick={onClose}>
            <div className="bg-gray-100 w-full max-w-7xl h-full flex shadow-xl" onClick={e => e.stopPropagation()}>
                <div className="w-64 bg-gray-800 text-white flex flex-col">
                    <div className="p-4 border-b border-gray-700">
                        <h2 className="text-xl font-bold">Panel de Admin</h2>
                        <p className="text-sm text-gray-400 capitalize">{user.role}</p>
                        <p className="text-xs text-gray-500 truncate">{user.email}</p>
                        {canManageProducts && (
                            <label htmlFor="editModeToggle" className="flex items-center space-x-2 mt-4 cursor-pointer">
                                <input id="editModeToggle" type="checkbox" checked={editMode} onChange={(e) => setEditMode(e.target.checked)} className="w-4 h-4 text-primary bg-gray-700 border-gray-600 rounded focus:ring-primary"/>
                                 <span className="text-sm">Edición Rápida</span>
                            </label>
                        )}
                    </div>
                    <nav className="flex-grow p-2">
                        {availableTabs.map(tab => (
                            <button
                                key={tab}
                                onClick={() => { setActiveTab(tab); handleCloseEditor(); }}
                                className={`w-full text-left px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? 'bg-primary text-white' : 'hover:bg-gray-700'}`}
                            >{tab}</button>
                        ))}
                    </nav>
                     <div className="p-4 border-t border-gray-700 space-y-2">
                        <button onClick={onLogout} className="w-full text-left px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-700">Cerrar Sesión</button>
                        <button onClick={onClose} className="w-full text-left px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-700">Cerrar Panel</button>
                    </div>
                </div>
                <div className="flex-grow h-full overflow-y-auto bg-white">{renderContent()}</div>
            </div>
        </div>
    );
};

const AdminProductsTab: React.FC<{
    products: Product[],
    categories: Category[],
    onEdit: (p: Product) => void,
    onAdd: () => void,
    onDelete: (id: string) => void,
    formatCurrency: (n: number) => string,
    canManageProducts: boolean
}> = ({ products, categories, onEdit, onAdd, onDelete, formatCurrency, canManageProducts }) => {
    const [activeFilter, setActiveFilter] = useState('All');

    const categoryCounts = useMemo(() => {
        const counts = new Map<string, number>();
        for (const cat of categories) {
            counts.set(cat, 0);
        }
        for (const product of products) {
            counts.set(product.category, (counts.get(product.category) || 0) + 1);
        }
        return counts;
    }, [products, categories]);
    
    const filteredDisplayProducts = useMemo(() => {
        if (activeFilter === 'All') {
            return products;
        }
        return products.filter(p => p.category === activeFilter);
    }, [products, activeFilter]);
    
    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-bold">Productos</h1>
                {canManageProducts && <button onClick={onAdd} className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark">Agregar Producto</button>}
            </div>
             <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-700 mb-2">Filtrar por Categoría</h3>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setActiveFilter('All')}
                        className={`px-3 py-1.5 rounded-md text-sm transition-colors ${activeFilter === 'All' ? 'bg-primary text-white font-semibold' : 'bg-white border border-gray-200 hover:bg-pink-50'}`}
                    >
                        Todos <span className="text-xs opacity-75 ml-1">({products.length})</span>
                    </button>
                    {Array.from(categoryCounts.entries()).map(([category, count]) => (
                         <button
                            key={category}
                            onClick={() => setActiveFilter(category)}
                            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${activeFilter === category ? 'bg-primary text-white font-semibold' : 'bg-white border border-gray-200 hover:bg-pink-50'}`}
                        >
                            {category} <span className="text-xs opacity-75 ml-1">({count})</span>
                        </button>
                    ))}
                </div>
            </div>
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Imagen</th>
                            <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                            <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoría</th>
                            <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio</th>
                            <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Disponibilidad</th>
                            {canManageProducts && <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                         {filteredDisplayProducts.length === 0 && (
                            <tr>
                                <td colSpan={canManageProducts ? 6 : 5} className="text-center py-8 text-gray-500">
                                    No hay productos en esta categoría.
                                </td>
                            </tr>
                        )}
                        {filteredDisplayProducts.map(p => (
                            <tr key={p.id}>
                                <td className="p-3"><img src={p.imageUrl} alt={p.name} className="w-12 h-16 object-cover rounded-md" /></td>
                                <td className="p-3 text-sm font-medium text-gray-900">{p.name}</td>
                                <td className="p-3 text-sm text-gray-500">{p.category}</td>
                                <td className="p-3 text-sm text-gray-500">{formatCurrency(p.price)}</td>
                                <td className="p-3"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${p.available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{p.available ? 'Sí' : 'No'}</span></td>
                                {canManageProducts && (
                                    <td className="p-3 text-sm space-x-2">
                                        <button onClick={() => onEdit(p)} className="text-primary hover:text-primary-dark">Editar</button>
                                        <button onClick={() => onDelete(p.id)} className="text-red-600 hover:text-red-800">Eliminar</button>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};


const AdminCategoriesTab: React.FC<{categories: Category[], onSave: (cats: Category[]) => void}> = ({ categories, onSave }) => {
    const [localCategories, setLocalCategories] = useState(categories || []);
    const [newCat, setNewCat] = useState('');
    
    useEffect(() => {
        setLocalCategories(categories || []);
    }, [categories]);

    const handleAdd = () => {
        if (newCat && !localCategories.includes(newCat)) {
            setLocalCategories([...localCategories, newCat]);
            setNewCat('');
        }
    };
    const handleRemove = (catToRemove: string) => {
        setLocalCategories(localCategories.filter(c => c !== catToRemove));
    };
    const handleSave = () => onSave(localCategories);
    
    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-6">Categorías</h1>
            <div className="bg-white rounded-lg shadow p-6 max-w-md">
                <div className="flex space-x-2 mb-4">
                    <AdminInput label="" type="text" value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="Nueva categoría" />
                    <button onClick={handleAdd} className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark whitespace-nowrap self-end">Agregar</button>
                </div>
                <div className="space-y-2">
                    {localCategories.map(cat => (
                        <div key={cat} className="flex justify-between items-center p-2 bg-gray-50 rounded-md">
                            <span>{cat}</span>
                            <button onClick={() => handleRemove(cat)} className="text-red-500 hover:text-red-700"><TrashIcon className="w-5 h-5"/></button>
                        </div>
                    ))}
                </div>
                <button onClick={handleSave} className="mt-6 w-full bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600">Guardar Cambios</button>
            </div>
        </div>
    );
};

const AdminBannersTab: React.FC<{banners: Banner[], onSave: (b: Banner[]) => void}> = ({ banners, onSave }) => {
    const [localBanners, setLocalBanners] = useState<Banner[]>(banners || []);
    
    useEffect(() => {
        setLocalBanners(banners || []);
    }, [banners]);

    const updateBanner = (id: number, field: keyof Omit<Banner, 'id'>, value: string) => {
        setLocalBanners(localBanners.map(b => b.id === id ? { ...b, [field]: value } : b));
    };
    const addBanner = () => {
        const newBanner: Banner = { id: Date.now(), imageUrl: '', title: '', subtitle: '', link: '#' };
        setLocalBanners([...localBanners, newBanner]);
    };
    const removeBanner = (id: number) => {
        setLocalBanners(localBanners.filter(b => b.id !== id));
    };

    return (
         <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Banners</h1>
                <div>
                    <button onClick={addBanner} className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 mr-2">Agregar Banner</button>
                    <button onClick={() => onSave(localBanners)} className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600">Guardar Banners</button>
                </div>
            </div>
            <div className="space-y-6">
                {localBanners.map(banner => (
                    <div key={banner.id} className="bg-white rounded-lg shadow p-4 grid grid-cols-1 md:grid-cols-3 gap-4 relative">
                        <ImageUpload label="Imagen del Banner" currentImage={banner.imageUrl} onImageSelect={url => updateBanner(banner.id, 'imageUrl', url)} />
                        <div className="md:col-span-2 space-y-4">
                            <AdminInput label="Título" value={banner.title} onChange={e => updateBanner(banner.id, 'title', e.target.value)} />
                            <AdminInput label="Subtítulo" value={banner.subtitle} onChange={e => updateBanner(banner.id, 'subtitle', e.target.value)} />
                            <AdminInput label="Enlace (Link)" value={banner.link} onChange={e => updateBanner(banner.id, 'link', e.target.value)} placeholder="Ej: #productos o category:Pantalones"/>
                        </div>
                        <button onClick={() => removeBanner(banner.id)} className="absolute top-2 right-2 text-red-500 hover:text-red-700"><TrashIcon className="w-5 h-5"/></button>
                    </div>
                ))}
            </div>
        </div>
    );
};

const AdminGeneralTab: React.FC<{config: StoreConfig, onSave: (c: StoreConfig) => void}> = ({ config, onSave }) => {
    const [localConfig, setLocalConfig] = useState(config);

    useEffect(() => {
        setLocalConfig(config);
    }, [config]);

    const handleSave = () => onSave(localConfig);
    
    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-6">Configuración General</h1>
            <div className="bg-white rounded-lg shadow p-6 max-w-2xl space-y-6">
                <ImageUpload label="Logo de la Tienda" currentImage={localConfig.logoUrl} onImageSelect={url => setLocalConfig({...localConfig, logoUrl: url})} />
                <ImageUpload 
                    label="Imagen de Medios de Pago (Carrito)" 
                    currentImage={localConfig.paymentMethodsImageUrl || ''} 
                    onImageSelect={url => setLocalConfig({...localConfig, paymentMethodsImageUrl: url})} 
                />
                <AdminInput label="Nombre de la Tienda" value={localConfig.contact.name} onChange={e => setLocalConfig({...localConfig, contact: {...localConfig.contact, name: e.target.value}})} />
                <AdminInput label="Teléfono de Contacto" value={localConfig.contact.phone} onChange={e => setLocalConfig({...localConfig, contact: {...localConfig.contact, phone: e.target.value}})} />
                <AdminInput label="Horario" value={localConfig.contact.schedule} onChange={e => setLocalConfig({...localConfig, contact: {...localConfig.contact, schedule: e.target.value}})} />
                <AdminInput label="Instagram (URL completa)" value={localConfig.social.instagram} onChange={e => setLocalConfig({...localConfig, social: {...localConfig.social, instagram: e.target.value}})} />
                <AdminInput label="TikTok (URL completa)" value={localConfig.social.tiktok} onChange={e => setLocalConfig({...localConfig, social: {...localConfig.social, tiktok: e.target.value}})} />
                <AdminInput label="Número de WhatsApp (con cód. país)" value={localConfig.social.whatsapp} onChange={e => setLocalConfig({...localConfig, social: {...localConfig.social, whatsapp: e.target.value}})} />
                <button onClick={handleSave} className="mt-4 w-full bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600">Guardar Configuración</button>
            </div>
        </div>
    );
};

const AdminUsersTab: React.FC<{
    users: User[];
    onAdd: () => void;
    onUpdateRole: (docId: string, newRole: User['role']) => void;
    onDelete: (docId: string) => void;
    currentUserId: string;
}> = ({ users, onAdd, onUpdateRole, onDelete, currentUserId }) => {
    return (
        <div className="p-6">
             <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Gestionar Usuarios</h1>
                <button onClick={onAdd} className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark">Agregar Usuario</button>
            </div>
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Correo Electrónico</th>
                            <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rol</th>
                            <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {(users || []).map(user => (
                            <tr key={user.docId}>
                                <td className="p-3 text-sm font-medium text-gray-900">{user.email}</td>
                                <td className="p-3 text-sm text-gray-500">
                                    <select
                                        value={user.role}
                                        onChange={(e) => onUpdateRole(user.docId, e.target.value as User['role'])}
                                        disabled={user.uid === currentUserId} // Admin can't change their own role
                                        className="bg-white border border-gray-300 rounded-md px-2 py-1 text-sm focus:ring-primary focus:border-primary disabled:bg-gray-100 disabled:cursor-not-allowed"
                                    >
                                        <option value="admin">Administrador</option>
                                        <option value="vendedor">Vendedor</option>
                                    </select>
                                </td>
                                <td className="p-3 text-sm">
                                    <button
                                        onClick={() => onDelete(user.docId)}
                                        disabled={user.uid === currentUserId} // Admin can't delete themselves
                                        className="text-red-600 hover:text-red-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                                    >
                                        Eliminar
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const AdminOrdersTab: React.FC<{
    user: User,
    orders: Order[],
    formatCurrency: (n: number) => string,
    onDelete: (docId: string) => void,
    onUpdate: (docId: string, data: Partial<Order>) => void,
}> = ({ user, orders, formatCurrency, onDelete, onUpdate }) => {
    const [statusFilter, setStatusFilter] = useState<'All' | Order['status']>('All');
    const [viewingOrder, setViewingOrder] = useState<Order | null>(null);

    const filteredOrders = useMemo(() => {
        const sortedOrders = [...(orders || [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        if (statusFilter === 'All') return sortedOrders;
        return sortedOrders.filter(o => o.status === statusFilter);
    }, [orders, statusFilter]);

    const salesReport = useMemo(() => {
        const reportOrders = statusFilter === 'All' ? orders : orders.filter(o => o.status === statusFilter);
        const totalRevenue = reportOrders.reduce((sum, order) => sum + order.total, 0);
        const revenueByPaymentMethod = reportOrders.reduce((acc, order) => {
            acc[order.paymentMethod] = (acc[order.paymentMethod] || 0) + order.total;
            return acc;
        }, {} as Record<string, number>);

        const productSales: { [name: string]: { name: string, quantity: number, revenue: number } } = {};
        for (const order of reportOrders) {
            for (const item of order.items) {
                if (!productSales[item.productId]) { productSales[item.productId] = { name: item.name, quantity: 0, revenue: 0 }; }
                productSales[item.productId].quantity += item.quantity;
                productSales[item.productId].revenue += item.quantity * item.price;
            }
        }
        const topSellingProducts = Object.values(productSales).sort((a, b) => b.quantity - a.quantity).slice(0, 10);

        return { totalRevenue, totalOrders: reportOrders.length, topSellingProducts, revenueByPaymentMethod };
    }, [orders, statusFilter]);

    const orderStatuses: Order['status'][] = ['Pendiente', 'En Proceso', 'Enviado', 'Completado', 'Cancelado'];
    
    return (
        <>
            <div className="p-6">
                <h1 className="text-2xl font-bold mb-6">Pedidos e Informes</h1>
                {user.role === 'admin' && (
                    <div className="mb-8 bg-gray-50 p-4 rounded-lg">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-gray-800">Informe de Ventas</h2>
                            <div className="flex items-center space-x-2">
                                <label htmlFor="statusFilter" className="text-sm font-medium">Filtrar por estado:</label>
                                <select id="statusFilter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="bg-white border border-gray-300 rounded-md px-2 py-1 text-sm focus:ring-primary focus:border-primary">
                                    <option value="All">Todos</option>
                                    {orderStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-white p-4 rounded-lg shadow"><h3 className="text-sm font-medium text-gray-500">Ingresos Totales</h3><p className="text-2xl font-bold text-gray-900">{formatCurrency(salesReport.totalRevenue)}</p></div>
                            <div className="bg-white p-4 rounded-lg shadow"><h3 className="text-sm font-medium text-gray-500">Total Pedidos</h3><p className="text-2xl font-bold text-gray-900">{salesReport.totalOrders}</p></div>
                            <div className="bg-white p-4 rounded-lg shadow md:col-span-2 lg:col-span-2"><h3 className="text-sm font-medium text-gray-500 mb-2">Ingresos por Medio de Pago</h3>
                                {Object.keys(salesReport.revenueByPaymentMethod).length > 0 ? (<div className="space-y-1">{Object.entries(salesReport.revenueByPaymentMethod).map(([method, amount]) => (<div key={method} className="flex justify-between text-sm"><span className="font-medium">{method}:</span><span>{formatCurrency(amount)}</span></div>))}</div>) : (<p className="text-sm text-gray-500">No hay datos.</p>)}
                            </div>
                            <div className="bg-white p-4 rounded-lg shadow md:col-span-2 lg:col-span-4"><h3 className="text-sm font-medium text-gray-500 mb-2">Productos Más Vendidos (Top 10)</h3>
                                {salesReport.topSellingProducts.length > 0 ? (<ul className="space-y-2 max-h-48 overflow-y-auto">{salesReport.topSellingProducts.map(p => (<li key={p.name} className="flex justify-between items-center text-sm border-b pb-1"><span className="font-medium text-gray-700">{p.name}</span><span className="text-gray-500">Vendidos: <span className="font-bold text-gray-800">{p.quantity}</span></span></li>))}</ul>) : (<p className="text-sm text-gray-500">No hay datos de productos vendidos para este filtro.</p>)}
                            </div>
                        </div>
                    </div>
                )}
                <div className="bg-white rounded-lg shadow overflow-x-auto">
                    <table className="w-full min-w-max">
                        <thead className="bg-gray-50"><tr>
                            <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID Orden</th>
                            <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                            <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                            <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                            <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                            <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                        </tr></thead>
                        <tbody className="divide-y divide-gray-200">
                            {(!filteredOrders || filteredOrders.length === 0) && <tr><td colSpan={6} className="p-4 text-center text-gray-500">No hay pedidos que coincidan con el filtro.</td></tr>}
                            {filteredOrders.map(o => (
                                <tr key={o.docId} className="hover:bg-gray-50">
                                    <td className="p-3 text-sm font-medium text-gray-900">{o.orderNumber}</td>
                                    <td className="p-3 text-sm text-gray-500">{new Date(o.date).toLocaleDateString()}</td>
                                    <td className="p-3 text-sm text-gray-500">{o.customerName}</td>
                                    <td className="p-3 text-sm text-gray-500">{formatCurrency(o.total)}</td>
                                    <td className="p-3 text-sm text-gray-500">{o.status}</td>
                                    <td className="p-3 text-sm space-x-2">
                                        <button onClick={() => setViewingOrder(o)} className="text-primary hover:text-primary-dark font-medium">Ver/Editar</button>
                                        <button onClick={() => onDelete(o.docId)} className="text-red-500 hover:text-red-700"><TrashIcon className="w-4 h-4 inline-block" /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            {viewingOrder && <OrderDetailModal order={viewingOrder} onClose={() => setViewingOrder(null)} onSave={onUpdate} formatCurrency={formatCurrency} />}
        </>
    );
};

const OrderDetailModal: React.FC<{
    order: Order;
    onClose: () => void;
    onSave: (docId: string, data: Partial<Order>) => void;
    formatCurrency: (n: number) => string;
}> = ({ order, onClose, onSave, formatCurrency }) => {
    const [editedOrder, setEditedOrder] = useState(order);
    const orderStatuses: Order['status'][] = ['Pendiente', 'En Proceso', 'Enviado', 'Completado', 'Cancelado'];
    const paymentOptions = ['Nequi', 'Daviplata', 'Tarjeta', 'Addi', 'Sistecredito'];

    const handleSave = () => {
        const changes: Partial<Order> = {};
        if (editedOrder.status !== order.status) changes.status = editedOrder.status;
        if (editedOrder.paymentMethod !== order.paymentMethod) changes.paymentMethod = editedOrder.paymentMethod;
        
        if (Object.keys(changes).length > 0) {
            onSave(order.docId, changes);
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[95] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-semibold">Detalle del Pedido: {order.orderNumber}</h2>
                    <button onClick={onClose}><CloseIcon className="w-6 h-6" /></button>
                </div>
                <div className="p-6 overflow-y-auto space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div><h3 className="font-semibold">Cliente:</h3><p>{order.customerName}</p></div>
                        <div><h3 className="font-semibold">Teléfono:</h3><p>{order.customerPhone}</p></div>
                        <div><h3 className="font-semibold">Fecha:</h3><p>{new Date(order.date).toLocaleString()}</p></div>
                        <div><h3 className="font-semibold">Entrega:</h3><p>{order.deliveryMethod}</p></div>
                        {order.address && <div className="col-span-2"><h3 className="font-semibold">Dirección:</h3><p>{order.address}</p></div>}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="block text-sm font-medium mb-1">Estado del Pedido</label>
                            <select value={editedOrder.status} onChange={e => setEditedOrder({...editedOrder, status: e.target.value as Order['status']})} className="w-full bg-surface border border-gray-300 rounded-md px-3 py-2 focus:ring-primary focus:border-primary">
                                {orderStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                         <div>
                            <label className="block text-sm font-medium mb-1">Medio de Pago</label>
                            <select value={editedOrder.paymentMethod} onChange={e => setEditedOrder({...editedOrder, paymentMethod: e.target.value})} className="w-full bg-surface border border-gray-300 rounded-md px-3 py-2 focus:ring-primary focus:border-primary">
                                {paymentOptions.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <h3 className="font-semibold border-t pt-2">Items:</h3>
                        <ul className="divide-y">
                            {order.items.map(item => (
                                <li key={item.id} className="py-2 flex justify-between">
                                    <span>{item.quantity} x {item.name} {item.size && `(${item.size})`} {item.color && `(${item.color})`}</span>
                                    <span>{formatCurrency(item.price * item.quantity)}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                     <div className="bg-surface p-4 rounded-lg space-y-2 mt-4 text-right">
                        <div className="flex justify-between text-sm"><span>Subtotal</span><span>{formatCurrency(order.subtotal)}</span></div>
                        <div className="flex justify-between text-sm"><span>Envío</span><span>{formatCurrency(order.shippingCost)}</span></div>
                        <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2"><span>Total</span><span>{formatCurrency(order.total)}</span></div>
                     </div>
                </div>
                <div className="p-4 border-t bg-gray-50 flex justify-end space-x-2">
                    <button onClick={onClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300">Cancelar</button>
                    <button onClick={handleSave} className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark">Guardar Cambios</button>
                </div>
            </div>
        </div>
    );
};

const ProductEditor: React.FC<{
    product: Product; categories: Category[]; onSave: (p: Product) => void;
    onCancel: () => void; onDelete: (id: string) => void; isNewProduct: boolean;
}> = ({ product, categories, onSave, onCancel, onDelete, isNewProduct }) => {
    const [edited, setEdited] = useState(product);
    const [newSize, setNewSize] = useState('');
    const [newColor, setNewColor] = useState('');

    const handleChange = (field: keyof Product, value: any) => {
        setEdited(p => ({ ...p, [field]: value }));
    };

    const handleVariantChange = (field: keyof ProductVariants, value: any) => {
        setEdited(p => ({
            ...p,
            variants: {
                ...(p.variants || { hasSizes: false, sizes: {}, hasColors: false, colors: {} }),
                [field]: value
            }
        }));
    };

    const handleSizeAdd = () => {
        if (newSize && !(edited.variants?.sizes || {})[newSize]) {
            const newSizes = { ...(edited.variants?.sizes || {}), [newSize]: { available: true } };
            handleVariantChange('sizes', newSizes);
            setNewSize('');
        }
    };

    const handleSizeRemove = (size: string) => {
        const { [size]: _, ...remaining } = edited.variants?.sizes || {};
        handleVariantChange('sizes', remaining);
    };

    const handleSizeAvailability = (size: string, available: boolean) => {
        const newSizes = { ...(edited.variants?.sizes || {}), [size]: { available } };
        handleVariantChange('sizes', newSizes);
    };

    const handleColorAdd = () => {
        if (newColor && !(edited.variants?.colors || {})[newColor]) {
            const newColors = { ...(edited.variants?.colors || {}), [newColor]: { available: true, imageUrl: '' } };
            handleVariantChange('colors', newColors);
            setNewColor('');
        }
    };
    
    const handleColorRemove = (color: string) => {
        const colorDetail = edited.variants?.colors?.[color];
        if (colorDetail?.imageUrl && colorDetail.imageUrl === edited.imageUrl) {
            handleChange('imageUrl', '');
        }

        const { [color]: _, ...remaining } = edited.variants?.colors || {};
        handleVariantChange('colors', remaining);
    };

    const handleColorUpdate = (color: string, field: keyof ProductColorVariantDetail, value: any) => {
        const currentColors = edited.variants?.colors || {};
        const currentColorData = currentColors[color] || { available: false, imageUrl: '' };
        const updatedColor = { ...currentColorData, [field]: value };
        const newColors = { ...currentColors, [color]: updatedColor };
        handleVariantChange('colors', newColors);

        if (field === 'imageUrl' && value && !edited.imageUrl) {
            handleChange('imageUrl', value);
        }
    };

    return (
        <div className="p-6 h-full">
            <div className="flex justify-between items-start mb-6">
                <h1 className="text-2xl font-bold">{isNewProduct ? 'Agregar Nuevo Producto' : `Editando: ${product.name}`}</h1>
                <div>
                    <button onClick={onCancel} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 mr-2">Cancelar</button>
                    <button onClick={() => onSave(edited)} className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600">Guardar Producto</button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-lg shadow p-6 space-y-4">
                    <AdminInput label="Nombre del Producto" value={edited.name} onChange={e => handleChange('name', e.target.value)} />
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                        <textarea value={edited.description} onChange={e => handleChange('description', e.target.value)} rows={4} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"/>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <AdminInput label="Precio (COP)" type="number" value={edited.price} onChange={e => handleChange('price', parseFloat(e.target.value) || 0)} />
                        <AdminInput 
                            label="Descuento (%)" 
                            type="number" 
                            value={edited.discountPercentage || ''} 
                            onChange={e => {
                                const value = Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0));
                                handleChange('discountPercentage', value);
                            }} 
                            min="0" 
                            max="100"
                            placeholder="Ej: 15"
                        />
                         <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                            <select value={edited.category} onChange={e => handleChange('category', e.target.value)} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm">
                                {(categories || []).map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>
                     <ImageUpload label="Imagen Principal" currentImage={edited.imageUrl} onImageSelect={url => handleChange('imageUrl', url)} />
                     <div className="flex items-center space-x-2">
                        <input type="checkbox" id="isAvailable" checked={edited.available} onChange={e => handleChange('available', e.target.checked)} className="h-4 w-4 text-primary rounded border-gray-300 focus:ring-primary" />
                        <label htmlFor="isAvailable" className="text-sm font-medium text-gray-700">Disponible para la venta</label>
                    </div>
                </div>

                <div className="lg:col-span-1 bg-white rounded-lg shadow p-6 space-y-6">
                    <h3 className="font-bold text-lg">Variantes</h3>
                    
                    <div className="border-t pt-4">
                        <div className="flex items-center space-x-2 mb-2">
                           <input type="checkbox" id="hasSizes" checked={edited.variants?.hasSizes || false} onChange={e => handleVariantChange('hasSizes', e.target.checked)} className="h-4 w-4 text-primary rounded border-gray-300 focus:ring-primary" />
                           <label htmlFor="hasSizes" className="text-sm font-medium text-gray-700">Tiene tallas</label>
                        </div>
                        {edited.variants?.hasSizes && (
                            <div className="pl-6 space-y-2">
                                <div className="flex space-x-2">
                                    <input type="text" value={newSize} onChange={e => setNewSize(e.target.value)} placeholder="Ej: S, M, 36" className="w-full text-sm px-2 py-1 border border-gray-300 rounded-md"/>
                                    <button onClick={handleSizeAdd} className="bg-gray-200 px-3 py-1 text-sm rounded-md">+</button>
                                </div>
                                {Object.entries(edited.variants?.sizes || {}).map(([size, detail]: [string, ProductVariantDetail]) => (
                                    <div key={size} className="flex justify-between items-center text-sm">
                                        <span>{size}</span>
                                        <div className="flex items-center space-x-2">
                                            <label className="flex items-center space-x-1 cursor-pointer"><input type="checkbox" checked={detail.available} onChange={e => handleSizeAvailability(size, e.target.checked)} className="h-3.5 w-3.5"/><span>Disp.</span></label>
                                            <button onClick={() => handleSizeRemove(size)} className="text-red-500"><TrashIcon className="w-4 h-4"/></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    
                    <div className="border-t pt-4">
                        <div className="flex items-center space-x-2 mb-2">
                           <input type="checkbox" id="hasColors" checked={edited.variants?.hasColors || false} onChange={e => handleVariantChange('hasColors', e.target.checked)} className="h-4 w-4 text-primary rounded border-gray-300 focus:ring-primary"/>
                           <label htmlFor="hasColors" className="text-sm font-medium text-gray-700">Tiene colores</label>
                        </div>
                        {edited.variants?.hasColors && (
                             <div className="pl-6 space-y-4">
                                <div className="flex space-x-2">
                                    <input type="text" value={newColor} onChange={e => setNewColor(e.target.value)} placeholder="Ej: Rojo, Azul" className="w-full text-sm px-2 py-1 border border-gray-300 rounded-md"/>
                                    <button onClick={handleColorAdd} className="bg-gray-200 px-3 py-1 text-sm rounded-md">+</button>
                                </div>
                                {Object.entries(edited.variants?.colors || {}).map(([color, detail]: [string, ProductColorVariantDetail]) => (
                                    <div key={color} className="space-y-2 p-2 border rounded-md bg-gray-50">
                                        <div className="flex justify-between items-center text-sm font-medium">
                                          <span>{color}</span>
                                          <button onClick={() => handleColorRemove(color)} className="text-red-500 hover:text-red-700"><TrashIcon className="w-4 h-4"/></button>
                                        </div>
                                        <ImageUpload label="" currentImage={detail.imageUrl || ''} onImageSelect={url => handleColorUpdate(color, 'imageUrl', url)} />
                                        {detail.imageUrl && (
                                            <button
                                                type="button"
                                                onClick={() => handleChange('imageUrl', detail.imageUrl!)}
                                                disabled={detail.imageUrl === edited.imageUrl}
                                                className="w-full text-xs py-1 px-2 rounded-md transition-colors disabled:cursor-not-allowed disabled:bg-primary disabled:text-white bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium"
                                            >
                                                {detail.imageUrl === edited.imageUrl ? '✔ Principal' : 'Usar como Principal'}
                                            </button>
                                        )}
                                        <label className="flex items-center space-x-2 cursor-pointer text-sm">
                                            <input type="checkbox" checked={detail.available} onChange={e => handleColorUpdate(color, 'available', e.target.checked)} className="h-3.5 w-3.5 text-primary focus:ring-primary border-gray-300 rounded"/>
                                            <span>Disponible</span>
                                        </label>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {!isNewProduct && (
                <div className="lg:col-span-3">
                     <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <h3 className="font-bold text-red-800">Zona de Peligro</h3>
                        <p className="text-sm text-red-600 mt-1">Esta acción no se puede deshacer. Se eliminará el producto permanentemente.</p>
                        <button onClick={() => onDelete(product.id)} className="mt-2 bg-red-600 text-white px-4 py-2 text-sm rounded-md hover:bg-red-700">Eliminar este producto</button>
                    </div>
                </div>
                )}
            </div>
        </div>
    );
};

export default App;