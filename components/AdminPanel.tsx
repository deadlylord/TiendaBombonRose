import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Product, Category, Banner, StoreConfig, Order, ProductVariantDetail, ProductColorVariantDetail, ProductVariants, User, StoreBranch, StoreCollection } from '../types';
import { CloseIcon, MenuIcon, SearchIcon, TrashIcon, PlusIcon, UploadIcon, ArrowLeftIcon } from './Icons';
import { db } from '../services/firebase';
import { doc, collection, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { generateProductDescription } from '../services/productTools';
import { uploadImageToStorage } from '../services/imageUploads';
import AdminInput from './AdminInput';
import BannerDestinationPicker from './BannerDestinationPicker';
import AdminCollections from './AdminCollections';
import { companyCollections } from '../services/storeCollections';
import { bannerDestination } from '../services/bannerDestinations';
import { catalogCompany, DEFAULT_COMPANY_ID } from '../services/catalog';

const ImageUpload: React.FC<{
    currentImage: string;
    onImageSelect: (url: string) => void;
    label: string;
    onUploadingChange?: (uploading: boolean) => void;
    optimizeBanner?: boolean;
}> = ({ currentImage, onImageSelect, label, onUploadingChange, optimizeBanner = false }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setIsUploading(true);
            onUploadingChange?.(true);
            try {
                const imageUrl = await uploadImageToStorage(file, optimizeBanner);
                onImageSelect(imageUrl);
            } catch (error) {
                console.error("Error uploading image:", error);
                alert("Hubo un error al subir la imagen. Por favor, inténtalo de nuevo.");
            } finally {
                setIsUploading(false);
                onUploadingChange?.(false);
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
        menBanners: Banner[];
        products: Product[];
        categories: Category[];
        orders: Order[];
        users: User[];
        branches: StoreBranch[];
    };
    onUpdateConfig: (config: StoreConfig) => Promise<void> | void;
    onSaveBanners: (banners: Banner[]) => Promise<void> | void;
    onSaveMenBanners: (banners: Banner[]) => Promise<void> | void;
    onSaveCategories: (categories: Category[]) => void;
    onAddProduct: (product: Product) => Promise<boolean>;
    onUpdateProduct: (product: Product) => Promise<boolean>;
    onDeleteProduct: (productId: string) => void;
    onBulkGenerateDescriptions: (category: string) => void;
    formatCurrency: (amount: number) => string;
    productToEdit: Product | null;
    onDeleteOrder: (orderDocId: string) => void;
    onUpdateOrder: (orderDocId: string, data: Partial<Order>) => void;
    onLogout: () => void;
    onAddUser: () => void;
    onUpdateUserRole: (userDocId: string, newRole: User['role']) => void;
    onDeleteUser: (userDocId: string) => void;
    branches: StoreBranch[];
}

const AdminPanel: React.FC<AdminPanelProps> = (props) => {
    const {
        user, onClose, editMode, setEditMode,
        onUpdateConfig, onSaveBanners, onSaveMenBanners, onSaveCategories,
        onAddProduct, onUpdateProduct, onDeleteProduct, onBulkGenerateDescriptions,
        formatCurrency, productToEdit, onDeleteOrder, onUpdateOrder,
        onLogout, onAddUser, onUpdateUserRole, onDeleteUser,
        branches
    } = props;
    
    const isAdmin = user.role === 'admin';
    const canManageProducts = user.role === 'admin' || user.role === 'vendedor';

    const allTabs = ['Productos', 'Pedidos', 'Sedes', 'Usuarios', 'Categorías', 'Colecciones', 'Banners', 'General'];
    const availableTabs = isAdmin ? allTabs : ['Productos', 'Pedidos', 'Sedes'];

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
            provider: '',
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

    const handleSaveProduct = async (productToSave: Product) => {
        const saved = await (isAddingProduct ? onAddProduct(productToSave) : onUpdateProduct(productToSave));
        if (saved) handleCloseEditor();
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
                            onBulkGenerateDescriptions={onBulkGenerateDescriptions}
                            formatCurrency={formatCurrency}
                            canManageProducts={canManageProducts}
                        />;
            case 'Categorías':
                return isAdmin ? <AdminCategoriesTab 
                            categories={props.store.categories}
                            products={props.store.products}
                            onUpdateProduct={onUpdateProduct}
                            onSave={onSaveCategories}
                            images={props.store.config.categoryImagesByCompany?.[catalogCompany(props.store.config)]}
                            onSaveImages={async images => { await onUpdateConfig({ ...props.store.config, categoryImagesByCompany: { ...props.store.config.categoryImagesByCompany, [catalogCompany(props.store.config)]: images } }); }}
                        /> : null;
            case 'Colecciones':
                return isAdmin ? <AdminCollections key={catalogCompany(props.store.config)}
                    collections={companyCollections(props.store.config, catalogCompany(props.store.config))}
                    products={props.store.products}
                    onSave={async collections => { await onUpdateConfig({ ...props.store.config, collectionsByCompany: { ...props.store.config.collectionsByCompany, [catalogCompany(props.store.config)]: collections } }); }}
                /> : null;
            case 'Banners':
                return isAdmin ? <AdminBannersTab 
                            banners={props.store.banners}
                            menBanners={props.store.menBanners}
                            categories={props.store.categories}
                            products={props.store.products}
                            collections={companyCollections(props.store.config, catalogCompany(props.store.config))}
                            onSaveBanners={onSaveBanners}
                            onSaveMenBanners={onSaveMenBanners}
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
            case 'Sedes':
                return <AdminBranchesTab branches={branches} />;
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
    onBulkGenerateDescriptions: (category: string) => void,
    formatCurrency: (n: number) => string,
    canManageProducts: boolean
}> = ({ products, categories, onEdit, onAdd, onDelete, onBulkGenerateDescriptions, formatCurrency, canManageProducts }) => {
    const [activeFilter, setActiveFilter] = useState('All');
    const [isBulkGenerating, setIsBulkGenerating] = useState(false);

    const handleBulkGenerate = async () => {
        if (activeFilter === 'All') {
            alert("Por favor, selecciona una categoría específica para generar descripciones masivas.");
            return;
        }
        setIsBulkGenerating(true);
        await onBulkGenerateDescriptions(activeFilter);
        setIsBulkGenerating(false);
    };

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
                <div className="flex gap-2">
                    {activeFilter !== 'All' && canManageProducts && (
                        <button 
                            onClick={handleBulkGenerate} 
                            disabled={isBulkGenerating}
                            className="bg-secondary text-white px-4 py-2 rounded-md hover:bg-secondary-dark disabled:opacity-50 flex items-center gap-2"
                        >
                            {isBulkGenerating ? 'Generando...' : '✨ IA: Describir Categoría'}
                        </button>
                    )}
                    {canManageProducts && <button onClick={onAdd} className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark">Agregar Producto</button>}
                </div>
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
                {/* Mobile View: Card List */}
                <div className="md:hidden divide-y divide-gray-200">
                    {filteredDisplayProducts.length === 0 && (
                        <div className="text-center py-8 text-gray-500">No hay productos en esta categoría.</div>
                    )}
                    {filteredDisplayProducts.map(p => (
                        <div key={p.id} className="p-4 space-y-3">
                            <div className="flex items-center space-x-4">
                                <img src={p.imageUrl} alt={p.name} className="w-16 h-20 object-cover rounded-md" />
                                <div className="flex-grow min-w-0">
                                    <h3 className="text-sm font-bold text-gray-900 truncate">{p.name}</h3>
                                    <p className="text-xs text-gray-500">{p.category}</p>
                                    <p className="text-sm font-semibold text-primary">{formatCurrency(p.price)}</p>
                                </div>
                                <div className="flex flex-col items-end space-y-2">
                                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${p.available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {p.available ? 'DISPONIBLE' : 'AGOTADO'}
                                    </span>
                                </div>
                            </div>
                            {canManageProducts && (
                                <div className="flex gap-2 pt-2 border-t border-gray-100">
                                    <button onClick={() => onEdit(p)} className="flex-1 bg-primary/10 text-primary font-bold py-2 rounded-md text-xs">EDITAR</button>
                                    <button onClick={() => onDelete(p.id)} className="flex-1 bg-red-50 text-red-600 font-bold py-2 rounded-md text-xs">ELIMINAR</button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Desktop View: Table */}
                <table className="hidden md:table w-full">
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


const CategoryImageEditor: React.FC<{
    categories: Category[];
    products: Product[];
    images?: Record<string, string>;
    onSave: (images: Record<string, string>) => Promise<void>;
}> = ({ categories, products, images, onSave }) => {
    const [draft, setDraft] = useState<Record<string, string>>(images || {});
    const [saving, setSaving] = useState(false);
    const [uploads, setUploads] = useState(0);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);
    useEffect(() => { setDraft(images || {}); }, [images]);
    const changeImage = (category: string, url: string) => {
        setDraft(previous => ({ ...previous, [category]: url }));
        setSaved(false);
    };
    const save = async () => {
        setSaving(true); setError(''); setSaved(false);
        try { await onSave(draft); setSaved(true); }
        catch { setError('No se guardaron las imágenes. Intenta de nuevo.'); }
        finally { setSaving(false); }
    };
    return <section className="mb-8 rounded-3xl border border-pink-100 bg-white p-5 sm:p-8">
        <h2 className="text-lg font-bold">Imágenes de los círculos</h2>
        <p className="mt-2 mb-6 text-sm text-gray-600">Elige una foto del catálogo o sube una imagen para cada categoría, incluido Todo. Estas imágenes solo cambian los círculos de la tienda.</p>
        <fieldset disabled={saving} className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {['All', ...categories].map(category => {
                const options = products.filter(product => product.imageUrl && (category === 'All' || product.category === category));
                const automatic = options.find(product => product.available)?.imageUrl || options[0]?.imageUrl || '';
                return <div key={category} className="min-w-0 space-y-3 rounded-2xl bg-pink-50/50 p-4">
                    <ImageUpload label={category === 'All' ? 'Todo' : category} currentImage={draft[category] || automatic} onImageSelect={url => changeImage(category, url)} onUploadingChange={active => setUploads(count => count + (active ? 1 : -1))} />
                    <label className="block text-sm">Foto del catálogo
                        <select value={draft[category] || ''} onChange={event => changeImage(category, event.target.value)} className="mt-1 w-full min-w-0 rounded-lg border bg-white p-2">
                            <option value="">Automática</option>
                            {draft[category] && !options.some(product => product.imageUrl === draft[category]) && <option value={draft[category]}>Imagen subida</option>}
                            {options.map(product => <option key={product.id} value={product.imageUrl}>{product.name}</option>)}
                        </select>
                    </label>
                    <button type="button" onClick={() => changeImage(category, '')} className="text-xs text-pink-700 underline">Usar imagen automática</button>
                </div>;
            })}
        </fieldset>
        {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
        {saved && <p role="status" className="mt-4 text-sm text-green-700">Imágenes guardadas.</p>}
        <button type="button" disabled={saving || uploads > 0} onClick={save} className="mt-6 rounded-xl bg-primary px-6 py-3 font-semibold text-white disabled:opacity-50">{uploads > 0 ? 'Subiendo imágenes…' : saving ? 'Guardando…' : 'Guardar imágenes'}</button>
    </section>;
};

const AdminCategoriesTab: React.FC<{
    categories: Category[], 
    products: Product[],
    onUpdateProduct: (p: Product) => void,
    onSave: (cats: Category[]) => void,
    images?: Record<string, string>,
    onSaveImages: (images: Record<string, string>) => Promise<void>
}> = ({ categories, products, onUpdateProduct, onSave, images, onSaveImages }) => {
    const [localCategories, setLocalCategories] = useState(categories || []);
    const [newCat, setNewCat] = useState('');
    const [managedSpecial, setManagedSpecial] = useState<'featured' | 'newArrival' | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    
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

    const toggleSpecial = (product: Product) => {
        if (!managedSpecial) return;
        const field = managedSpecial === 'featured' ? 'isFeatured' : 'isNewArrival';
        onUpdateProduct({
            ...product,
            [field]: !product[field]
        });
    };

    const filteredProducts = products.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (managedSpecial) {
        const title = managedSpecial === 'featured' ? 'En Tendencia (⭐)' : 'Recién Llegados (🆕)';
        const field = managedSpecial === 'featured' ? 'isFeatured' : 'isNewArrival';

        return (
            <div className="p-6">
                <div className="flex items-center gap-4 mb-6">
                    <button onClick={() => setManagedSpecial(null)} className="p-2 hover:bg-gray-100 rounded-full">
                        <ArrowLeftIcon className="w-5 h-5" />
                    </button>
                    <h1 className="text-2xl font-bold">Editar {title}</h1>
                </div>

                <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="relative flex-1">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input 
                                type="text" 
                                placeholder="Buscar productos..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-primary/20 text-sm"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[60vh] overflow-y-auto pr-2">
                        {filteredProducts.map(product => (
                            <div 
                                key={product.id} 
                                onClick={() => toggleSpecial(product)}
                                className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer ${
                                    product[field] 
                                    ? 'border-primary bg-primary/5' 
                                    : 'border-gray-100 hover:border-gray-200 bg-white'
                                }`}
                            >
                                <img src={product.imageUrl} alt={product.name} className="w-12 h-12 object-cover rounded-lg" referrerPolicy="no-referrer" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold truncate">{product.name}</p>
                                    <p className="text-xs text-gray-500">{product.category}</p>
                                </div>
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${
                                    product[field] ? 'bg-primary border-primary' : 'border-gray-200'
                                }`}>
                                    {product[field] && <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }
    
    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-6">Categorías</h1>
            <CategoryImageEditor categories={categories} products={products} images={images} onSave={onSaveImages} />
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Standard Categories */}
                <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
                    <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                        <MenuIcon className="w-5 h-5 text-gray-400" />
                        Categorías del Menú
                    </h2>
                    <div className="flex space-x-2 mb-6">
                        <div className="flex-1">
                            <AdminInput label="" type="text" value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="Nueva categoría..." />
                        </div>
                        <button onClick={handleAdd} className="bg-primary text-white px-6 py-2 rounded-xl hover:scale-105 transition-all whitespace-nowrap self-end">Agregar</button>
                    </div>
                    <div className="space-y-3">
                        {localCategories.map(cat => (
                            <div key={cat} className="flex justify-between items-center p-4 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-colors group">
                                <span className="font-medium">{cat}</span>
                                <button onClick={() => handleRemove(cat)} className="text-red-400 hover:text-red-600 p-2 hover:bg-white rounded-full transition-all">
                                    <TrashIcon className="w-5 h-5"/>
                                </button>
                            </div>
                        ))}
                    </div>
                    <button onClick={handleSave} className="mt-8 w-full bg-green-500 text-white px-4 py-3 rounded-2xl font-bold hover:shadow-lg transition-all">Guardar Orden y Cambios</button>
                </div>

                {/* Special Dynamic Categories */}
                <div className="space-y-6">
                    <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
                        <h2 className="text-lg font-bold mb-6">Secciones Especiales</h2>
                        <p className="text-sm text-gray-500 mb-6 italic">Estas secciones aparecen en la página de inicio y se basan en etiquetas personalizadas.</p>
                        
                        <div className="grid gap-4">
                            <button 
                                onClick={() => setManagedSpecial('featured')}
                                className="flex items-center justify-between p-6 bg-gradient-to-r from-orange-50 to-amber-50 rounded-3xl border border-orange-100 hover:shadow-md transition-all group"
                            >
                                <div className="flex items-center gap-4 text-left">
                                    <div className="text-3xl">⭐</div>
                                    <div>
                                        <p className="font-bold text-orange-900">En Tendencia</p>
                                        <p className="text-xs text-orange-700">{products.filter(p => p.isFeatured).length} productos etiquetados</p>
                                    </div>
                                </div>
                                <ArrowLeftIcon className="w-5 h-5 text-orange-400 rotate-180 group-hover:translate-x-1 transition-transform" />
                            </button>

                            <button 
                                onClick={() => setManagedSpecial('newArrival')}
                                className="flex items-center justify-between p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-3xl border border-blue-100 hover:shadow-md transition-all group"
                            >
                                <div className="flex items-center gap-4 text-left">
                                    <div className="text-3xl">🆕</div>
                                    <div>
                                        <p className="font-bold text-blue-900">Recién Llegados</p>
                                        <p className="text-xs text-blue-700">{products.filter(p => p.isNewArrival).length} productos etiquetados</p>
                                    </div>
                                </div>
                                <ArrowLeftIcon className="w-5 h-5 text-blue-400 rotate-180 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </div>

                    <div className="bg-primary/10 p-8 rounded-3xl border border-primary/20">
                        <h3 className="font-bold text-primary mb-2">Consejo Técnico</h3>
                        <p className="text-sm text-primary/80 leading-relaxed">
                            A diferencia de las categorías fijas, estas secciones son <strong>Dinámicas</strong>. 
                            Puedes cambiar qué productos aparecen aquí sin moverlos de su categoría principal.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

const AdminBannersTab: React.FC<{
    banners: Banner[], 
    menBanners: Banner[],
    categories: Category[],
    products: Product[],
    collections: StoreCollection[],
    onSaveBanners: (b: Banner[]) => Promise<void> | void,
    onSaveMenBanners: (b: Banner[]) => Promise<void> | void
}> = ({ banners, menBanners, categories, products, collections, onSaveBanners, onSaveMenBanners }) => {
    const [uploadCount, setUploadCount] = useState(0);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const save = async (men: boolean) => {
        setSaving(true); setSaveError('');
        try {
            const selected = men ? localMenBanners : localBanners;
            if (selected.some(banner => bannerDestination(banner.link).kind === 'none')) throw new Error('Selecciona el destino de cada banner antes de guardar.');
            await (men ? onSaveMenBanners(localMenBanners) : onSaveBanners(localBanners)); }
        catch (error) { setSaveError(error instanceof Error ? error.message : 'No se guardaron los banners. Intenta nuevamente.'); }
        finally { setSaving(false); }
    };
    const [localBanners, setLocalBanners] = useState<Banner[]>(banners || []);
    const [localMenBanners, setLocalMenBanners] = useState<Banner[]>(menBanners || []);
    
    useEffect(() => {
        setLocalBanners(banners || []);
    }, [banners]);

    useEffect(() => {
        setLocalMenBanners(menBanners || []);
    }, [menBanners]);

    const updateBanner = (id: number, field: keyof Omit<Banner, 'id'>, value: string, isMen: boolean) => {
        if (isMen) {
            setLocalMenBanners(localMenBanners.map(b => b.id === id ? { ...b, [field]: value } : b));
        } else {
            setLocalBanners(localBanners.map(b => b.id === id ? { ...b, [field]: value } : b));
        }
    };
    const addBanner = (isMen: boolean) => {
        const newBanner: Banner = { id: Date.now(), imageUrl: '', title: '', subtitle: '', link: '#productos' };
        if (isMen) {
            setLocalMenBanners([...localMenBanners, newBanner]);
        } else {
            setLocalBanners([...localBanners, newBanner]);
        }
    };
    const removeBanner = (id: number, isMen: boolean) => {
        if (isMen) {
            setLocalMenBanners(localMenBanners.filter(b => b.id !== id));
        } else {
            setLocalBanners(localBanners.filter(b => b.id !== id));
        }
    };

    return (
         <div className="p-6 space-y-12">
            <p className="rounded-xl bg-pink-50 p-4 text-sm text-pink-900">Para celular recomendamos banners verticales de 1200 × 1800 px (2:3). La tienda muestra la imagen completa, sin recortarla. Las nuevas fotos se optimizan al subirlas; utiliza archivos originales disponibles para evitar enlaces rotos.</p>
            {saveError && <p role="alert" className="text-red-700">{saveError}</p>}
            {(uploadCount > 0 || saving) && <p role="status" className="text-sm text-pink-700">{uploadCount > 0 ? 'Subiendo imágenes…' : 'Guardando banners…'}</p>}
            {/* Standard Banners */}
            <div>
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold">Banners Principales (Bombon)</h1>
                    <div>
                        <button onClick={() => addBanner(false)} className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 mr-2">Agregar Banner</button>
                        <button disabled={saving || uploadCount > 0} onClick={() => void save(false)} className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600">Guardar Banners</button>
                    </div>
                </div>
                <div className="space-y-6">
                    {localBanners.map(banner => (
                        <div key={banner.id} className="bg-white rounded-lg shadow p-4 grid grid-cols-1 md:grid-cols-3 gap-4 relative">
                            <ImageUpload onUploadingChange={active => setUploadCount(count => count + (active ? 1 : -1))} optimizeBanner label="Imagen del Banner" currentImage={banner.imageUrl} onImageSelect={url => updateBanner(banner.id, 'imageUrl', url, false)} />
                            <div className="md:col-span-2 space-y-4">
                                <AdminInput label="Nombre del banner (solo administración)" value={banner.title} onChange={e => updateBanner(banner.id, 'title', e.target.value, false)} />
                                <AdminInput label="Texto del botón central" value={banner.buttonText || ''} maxLength={60} onChange={e => updateBanner(banner.id, 'buttonText', e.target.value, false)} placeholder="Ver colección" />
                                <BannerDestinationPicker collections={collections} link={banner.link} categories={categories} products={products} onChange={link => updateBanner(banner.id, 'link', link, false)} />
                            </div>
                            <button onClick={() => removeBanner(banner.id, false)} className="absolute top-2 right-2 text-red-500 hover:text-red-700"><TrashIcon className="w-5 h-5"/></button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Men Banners */}
            <div>
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold">Banners Hombre (Street Legends)</h1>
                    <div>
                        <button onClick={() => addBanner(true)} className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 mr-2">Agregar Banner</button>
                        <button disabled={saving || uploadCount > 0} onClick={() => void save(true)} className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600">Guardar Banners</button>
                    </div>
                </div>
                <div className="space-y-6">
                    {localMenBanners.map(banner => (
                        <div key={banner.id} className="bg-black text-white rounded-lg shadow p-4 grid grid-cols-1 md:grid-cols-3 gap-4 relative border border-gray-800">
                            <ImageUpload onUploadingChange={active => setUploadCount(count => count + (active ? 1 : -1))} optimizeBanner label="Imagen del Banner" currentImage={banner.imageUrl} onImageSelect={url => updateBanner(banner.id, 'imageUrl', url, true)} />
                            <div className="md:col-span-2 space-y-4">
                                <AdminInput label="Nombre del banner (solo administración)" value={banner.title} onChange={e => updateBanner(banner.id, 'title', e.target.value, true)} />
                                <AdminInput label="Texto del botón central" value={banner.buttonText || ''} maxLength={60} onChange={e => updateBanner(banner.id, 'buttonText', e.target.value, true)} placeholder="Ver colección" />
                                <BannerDestinationPicker collections={collections} link={banner.link} categories={categories} products={products} onChange={link => updateBanner(banner.id, 'link', link, true)} />
                            </div>
                            <button onClick={() => removeBanner(banner.id, true)} className="absolute top-2 right-2 text-red-500 hover:text-red-700"><TrashIcon className="w-5 h-5"/></button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const AdminGeneralTab: React.FC<{config: StoreConfig, onSave: (c: StoreConfig) => Promise<void> | void}> = ({ config, onSave }) => {
    const [localConfig, setLocalConfig] = useState(config);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [otherCompany, setOtherCompany] = useState(catalogCompany(config) !== DEFAULT_COMPANY_ID);

    useEffect(() => {
        setLocalConfig(config);
        setOtherCompany(catalogCompany(config) !== DEFAULT_COMPANY_ID);
    }, [config]);

    const handleSave = async () => {
        setIsSaving(true);
        setSaveError('');
        try {
            if (otherCompany && !localConfig.inventoryCompanyId?.trim()) throw new Error('Ingresa el identificador de la empresa.');
            await onSave({ ...localConfig, inventoryCompanyId: catalogCompany(localConfig) });
        } catch (error) {
            setSaveError(error instanceof Error ? error.message : 'No se pudo guardar la configuración.');
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-6">Configuración General</h1>
            <div className="bg-white rounded-lg shadow p-6 max-w-2xl space-y-6">
                <div className="rounded-lg border border-pink-200 bg-pink-50 p-4 space-y-3">
                    <h2 className="font-semibold">Empresa del catálogo</h2>
                    <label htmlFor="catalog-company" className="block text-sm">Productos que se muestran en esta tienda</label>
                    <select id="catalog-company" value={otherCompany ? 'custom' : DEFAULT_COMPANY_ID} onChange={e => { setOtherCompany(e.target.value === 'custom'); setLocalConfig({ ...localConfig, inventoryCompanyId: e.target.value === DEFAULT_COMPANY_ID ? DEFAULT_COMPANY_ID : '' }); }} className="w-full bg-white border rounded-md px-3 py-2">
                        <option value={DEFAULT_COMPANY_ID}>Bombón y Street Legends</option>
                        <option value="custom">Otra empresa de Vestika</option>
                    </select>
                    <AdminInput disabled={!otherCompany} label="Identificador de empresa en Vestika" value={localConfig.inventoryCompanyId ?? DEFAULT_COMPANY_ID} onChange={e => setLocalConfig({ ...localConfig, inventoryCompanyId: e.target.value })} placeholder="default_company" />
                    <p className="text-xs text-gray-600">La configuración inicial corresponde a Bombón y Street Legends. Para conectar otra empresa, copia su identificador desde Vestika y guarda los cambios.</p>
                </div>
                {saveError && <p role="alert" className="text-sm text-red-700">{saveError}</p>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <ImageUpload key={`logo-${localConfig.logoUrl}`} label="Logo Bombon (Principal)" currentImage={localConfig.logoUrl} onImageSelect={url => setLocalConfig({...localConfig, logoUrl: url})} />
                    <ImageUpload key={`second-logo-${localConfig.secondLogoUrl}`} label="Logo Street Legends (Hombre)" currentImage={localConfig.secondLogoUrl || ''} onImageSelect={url => setLocalConfig({...localConfig, secondLogoUrl: url})} />
                </div>
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
                <AdminInput label="WhatsApp (con cód. país)" value={localConfig.social.whatsapp} onChange={e => setLocalConfig({...localConfig, social: {...localConfig.social, whatsapp: e.target.value}})} />
                
                {/* Costos de Envío y Domicilio */}
                <div className="border-t border-gray-200 pt-6 space-y-4">
                    <h3 className="text-lg font-semibold text-gray-800">Costos de Envío</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <AdminInput 
                            label="Costo de Envío a Bogotá ($ COP)" 
                            type="number"
                            value={localConfig.shippingCostBogota !== undefined ? localConfig.shippingCostBogota : (localConfig.shippingCostAmount !== undefined ? localConfig.shippingCostAmount : '')} 
                            onChange={e => setLocalConfig({
                                ...localConfig, 
                                shippingCostBogota: e.target.value !== '' ? Number(e.target.value) : undefined
                            })} 
                        />
                        <AdminInput 
                            label="Costo de Envío Nacional ($ COP)" 
                            type="number"
                            value={localConfig.shippingCostNational !== undefined ? localConfig.shippingCostNational : ''} 
                            onChange={e => setLocalConfig({
                                ...localConfig, 
                                shippingCostNational: e.target.value !== '' ? Number(e.target.value) : undefined
                            })} 
                        />
                        <div className="md:col-span-2">
                            <AdminInput 
                                label="Mínimo de Compra para Envío Gratis ($ COP)" 
                                type="number"
                                value={localConfig.freeShippingThreshold !== undefined ? localConfig.freeShippingThreshold : ''} 
                                onChange={e => setLocalConfig({...localConfig, freeShippingThreshold: e.target.value !== '' ? Number(e.target.value) : undefined})} 
                            />
                        </div>
                    </div>
                </div>
                
                {/* Banner de Anuncios Superior */}
                <div className="border-t border-gray-200 pt-6 space-y-4">
                    <h3 className="text-lg font-semibold text-gray-800">Banner de Anuncios (Cintillo Superior Rotativo)</h3>
                    <p className="text-xs text-gray-500">Un banner con auto-desplazamiento ubicado en la parte superior de la página para mostrar varias promociones o mensajes.</p>
                    
                    <div className="flex items-center space-x-2 bg-gray-50 p-3 rounded-lg">
                        <input 
                            type="checkbox" 
                            id="showAnnouncements" 
                            checked={localConfig.showAnnouncements !== false}
                            onChange={e => setLocalConfig({...localConfig, showAnnouncements: e.target.checked})}
                            className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                        />
                        <label htmlFor="showAnnouncements" className="text-sm font-medium text-gray-700 cursor-pointer">
                            Activar banner de anuncios rotativo
                        </label>
                    </div>

                    {localConfig.showAnnouncements !== false && (
                        <div className="space-y-3">
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">
                                Mensajes Promocionales
                            </label>
                            
                            {(localConfig.announcements || []).map((ann, idx) => (
                                <div key={idx} className="flex space-x-2 items-center">
                                    <input 
                                        type="text" 
                                        value={ann} 
                                        onChange={e => {
                                            const updatedAnns = [...(localConfig.announcements || [])];
                                            updatedAnns[idx] = e.target.value;
                                            setLocalConfig({...localConfig, announcements: updatedAnns});
                                        }}
                                        className="flex-1 bg-gray-50 border border-gray-200 rounded-lg py-2 px-4 focus:ring-2 focus:ring-primary/20 outline-none text-sm"
                                        placeholder="Ej: ✨ ¡Envío GRATIS por compras superiores a $200.000!"
                                    />
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            const updatedAnns = (localConfig.announcements || []).filter((_, i) => i !== idx);
                                            setLocalConfig({...localConfig, announcements: updatedAnns});
                                        }}
                                        className="text-red-500 hover:text-red-700 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                        title="Eliminar mensaje"
                                    >
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            ))}

                            {(!localConfig.announcements || localConfig.announcements.length === 0) && (
                                <p className="text-sm text-gray-400 italic pl-1">No hay mensajes configurados. Agrega uno abajo.</p>
                            )}

                            <button 
                                type="button"
                                onClick={() => {
                                    const currentAnnouncements = localConfig.announcements || [];
                                    setLocalConfig({
                                        ...localConfig, 
                                        announcements: [...currentAnnouncements, '']
                                    });
                                }}
                                className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center space-x-1 mt-2 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg transition-colors inline-flex"
                            >
                                <PlusIcon className="w-4 h-4" />
                                <span>Agregar Nuevo Mensaje</span>
                            </button>
                        </div>
                    )}
                </div>
                
                <button 
                    onClick={handleSave} 
                    disabled={isSaving}
                    className="mt-4 w-full bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 disabled:bg-gray-400 flex items-center justify-center space-x-2"
                >
                    {isSaving && (
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    )}
                    <span>{isSaving ? 'Guardando...' : 'Guardar Configuración'}</span>
                </button>
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

const AdminBranchesTab: React.FC<{ branches: StoreBranch[] }> = ({ branches }) => {
    const handleAddBranch = async () => {
        try {
            await addDoc(collection(db, 'branches'), {
                name: 'Nueva Sede',
                address: 'Dirección #',
                city: 'Valencia',
                phone: '300 000 0000',
                schedule: 'Lunes a Sábado: 9am - 7pm',
                imageUrl: '',
                mapLink: ''
            });
        } catch (error) {
            console.error("Error adding branch:", error);
        }
    };

    const handleUpdateBranch = async (branchId: string, field: string, value: any) => {
        try {
            await updateDoc(doc(db, 'branches', branchId), { [field]: value });
        } catch (error) {
            console.error("Error updating branch:", error);
        }
    };

    const handleDeleteBranch = async (branchId: string) => {
        if (!window.confirm('¿Estás seguro de eliminar esta sede?')) return;
        try {
            await deleteDoc(doc(db, 'branches', branchId));
        } catch (error) {
            console.error("Error deleting branch:", error);
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h2 className="text-xl font-bold">Gestión de Sedes</h2>
                    <p className="text-sm text-gray-500 italic">Administra la información de tus puntos físicos.</p>
                </div>
                <button 
                  onClick={handleAddBranch}
                  className="bg-primary text-white px-6 py-3 rounded-full font-bold hover:scale-105 transition-all shadow-lg flex items-center gap-2"
                >
                    <PlusIcon className="w-5 h-5" />
                    Nueva Sede
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {branches.map((branch) => (
                    <div key={branch.docId} className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 relative group">
                        <button 
                            onClick={() => handleDeleteBranch(branch.docId)}
                            className="absolute top-4 right-4 p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                        >
                            <TrashIcon className="w-6 h-6" />
                        </button>

                        <div className="space-y-6">
                            <AdminInput 
                                label="Nombre de la Sede" 
                                value={branch.name} 
                                onChange={e => handleUpdateBranch(branch.docId, 'name', e.target.value)} 
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <AdminInput 
                                    label="Ciudad" 
                                    value={branch.city} 
                                    onChange={e => handleUpdateBranch(branch.docId, 'city', e.target.value)} 
                                />
                                <AdminInput 
                                    label="Teléfono" 
                                    value={branch.phone} 
                                    onChange={e => handleUpdateBranch(branch.docId, 'phone', e.target.value)} 
                                />
                            </div>
                            <AdminInput 
                                label="Dirección" 
                                value={branch.address} 
                                onChange={e => handleUpdateBranch(branch.docId, 'address', e.target.value)} 
                            />
                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium text-gray-700">Horario</label>
                                <textarea 
                                    rows={3}
                                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                                    value={branch.schedule}
                                    onChange={e => handleUpdateBranch(branch.docId, 'schedule', e.target.value)}
                                />
                            </div>
                            <ImageUpload 
                                label="Foto de la Sede" 
                                currentImage={branch.imageUrl} 
                                onImageSelect={url => handleUpdateBranch(branch.docId, 'imageUrl', url)} 
                            />
                            <AdminInput 
                                label="Enlace Google Maps (URL)" 
                                value={branch.mapLink || ''} 
                                onChange={e => handleUpdateBranch(branch.docId, 'mapLink', e.target.value)} 
                                placeholder="https://maps.app.goo.gl/..."
                            />
                        </div>
                    </div>
                ))}
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
    product: Product; categories: Category[]; onSave: (p: Product) => Promise<void>;
    onCancel: () => void; onDelete: (id: string) => void; isNewProduct: boolean;
}> = ({ product, categories, onSave, onCancel, onDelete, isNewProduct }) => {
    const [edited, setEdited] = useState(product);
    const [isSaving, setIsSaving] = useState(false);
    const saveProduct = async () => {
        if (isSaving) return;
        setIsSaving(true);
        try { await onSave(edited); } finally { setIsSaving(false); }
    };
    const [newSize, setNewSize] = useState('');
    const [newColor, setNewColor] = useState('');
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);

    const handleChange = (field: keyof Product, value: any) => {
        setEdited(p => ({ ...p, [field]: value }));
    };

    const handleGenerateAIDescription = async () => {
        if (!edited.name) {
            alert("Necesitas un nombre para generar la descripción.");
            return;
        }
        setIsGeneratingAI(true);
        const result = await generateProductDescription(edited.name, edited.imageUrl || undefined);
        if (typeof result === 'object') {
            setEdited(p => ({ ...p, name: result.name, description: result.description }));
        } else if (typeof result === 'string' && !result.startsWith('Error')) {
            handleChange('description', result);
        } else if (typeof result === 'string') {
            alert(result);
        }
        setIsGeneratingAI(false);
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
                    <button onClick={saveProduct} disabled={isSaving} className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 disabled:opacity-50">{isSaving ? 'Guardando…' : 'Guardar Producto'}</button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-lg shadow p-6 space-y-4">
                    <AdminInput label="Nombre del Producto" value={edited.name} onChange={e => handleChange('name', e.target.value)} />
                    <AdminInput label="Proveedor" value={edited.provider || ''} onChange={e => handleChange('provider', e.target.value)} placeholder="Ej: Confecciones ABC" />
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-sm font-medium text-gray-700">Descripción</label>
                            <button 
                                onClick={handleGenerateAIDescription} 
                                disabled={isGeneratingAI}
                                className="text-xs text-primary font-bold flex items-center gap-1 hover:underline disabled:opacity-50"
                            >
                                {isGeneratingAI ? 'Generando...' : '✨ Generar con IA'}
                            </button>
                        </div>
                        <textarea value={edited.description} onChange={e => handleChange('description', e.target.value)} rows={4} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"/>
                    </div>
                    <label className="block text-sm font-medium text-gray-700">Fotografías adicionales (una URL por línea)
                        <textarea value={(edited.additionalImages || []).join('\n')} onChange={e => handleChange('additionalImages', e.target.value.split('\n'))} rows={3} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
                    </label>
                    <label className="block text-sm font-medium text-gray-700">Guía de tallas de esta prenda
                        <textarea value={edited.sizeGuideText || ''} onChange={e => handleChange('sizeGuideText', e.target.value)} rows={4} placeholder="Escribe las medidas reales y cómo tomar cada medida." className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
                    </label>
                    <div className="flex flex-wrap gap-4 mb-4">
                        <div className="flex items-center space-x-2">
                            <input type="checkbox" id="madeInColombia" checked={edited.madeInColombia ?? false} onChange={e => handleChange('madeInColombia', e.target.checked)} className="h-4 w-4 text-primary rounded border-gray-300 focus:ring-primary" />
                            <label htmlFor="madeInColombia" className="text-sm font-medium text-gray-700">Hecho en Colombia</label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <input type="checkbox" id="isFeatured" checked={edited.isFeatured ?? false} onChange={e => handleChange('isFeatured', e.target.checked)} className="h-4 w-4 text-primary rounded border-gray-300 focus:ring-primary" />
                            <label htmlFor="isFeatured" className="text-sm font-medium text-gray-700">⭐ Destacado (Tendencia)</label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <input type="checkbox" id="isNewArrival" checked={edited.isNewArrival ?? false} onChange={e => handleChange('isNewArrival', e.target.checked)} className="h-4 w-4 text-primary rounded border-gray-300 focus:ring-primary" />
                            <label htmlFor="isNewArrival" className="text-sm font-medium text-gray-700">🆕 Recién Llegado</label>
                        </div>
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


export default AdminPanel;
