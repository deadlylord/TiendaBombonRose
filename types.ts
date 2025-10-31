

export interface ProductVariantDetail {
  available: boolean;
}

export interface ProductColorVariantDetail extends ProductVariantDetail {
  imageUrl?: string;
}

export interface ProductVariants {
  hasSizes: boolean;
  sizes: Record<string, ProductVariantDetail>;
  hasColors: boolean;
  colors: Record<string, ProductColorVariantDetail>;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl: string;
  available: boolean;
  variants: ProductVariants;
}

export type Category = string;

export interface Banner {
  id: number;
  imageUrl: string;
  title: string;
  subtitle: string;
  link: string;
}

export interface ContactInfo {
  name: string;
  phone: string;
  schedule: string;
}

export interface SocialLinks {
  instagram: string;
  tiktok: string;
  whatsapp: string;
}

export interface StoreConfig {
  logoUrl: string;
  contact: ContactInfo;
  social: SocialLinks;
}

export interface CartItem {
  id: string;
  productId: string;
  name:string;
  price: number;
  quantity: number;
  imageUrl: string;
  size?: string;
  color?: string;
}

export interface Order {
  docId: string;
  orderNumber: string;
  status: 'Pendiente' | 'En Proceso' | 'Enviado' | 'Completado' | 'Cancelado';
  date: string;
  customerName: string;
  customerPhone: string;
  items: CartItem[];
  subtotal: number;
  shippingCost: number;
  total: number;
  deliveryMethod: 'Recoger en Tienda' | 'Envío a Domicilio';
  address?: string;
  paymentMethod: string;
}

export type ToastMessage = {
  id: number;
  message: string;
  type: 'success' | 'error';
};