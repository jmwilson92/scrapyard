import type { Category, DeliveryMode, Material, MetalType, StockForm } from "@/lib/constants";

export type ListingInput = {
  title: string;
  category: Category;
  /** Metal: same as metalType. Other categories: a SUBTYPES value. */
  subtype: string;
  material: Material;
  metalType: MetalType;
  alloy: string;
  form: StockForm;
  lengthIn: number | null;
  widthIn: number | null;
  thicknessIn: number | null;
  diameterIn: number | null;
  quantity: number;
  weightLbs: number | null;
  priceCents: number | null;
  zip: string;
  notes: string;
  deliveryMode: DeliveryMode;
  deliveryRadiusMiles: number | null;
  deliveryFeeCents: number | null;
  certsAvailable: boolean;
  certsNote: string;
};

export type Listing = ListingInput & {
  id: string;
  sellerId: string;
  shopName: string;
  shopZip: string;
  sellerVerified: boolean;
  photoUrl: string | null;
  status: "active" | "sold";
  isExample: boolean;
  createdAt: number;
  updatedAt: number;
};

export type UserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  shopName: string;
  zip: string;
  isExample: boolean;
  verifiedSeller: boolean;
  createdAt: number;
};

export type PublicUser = {
  id: string;
  email: string;
  shopName: string;
  zip: string;
  isExample: boolean;
  verifiedSeller: boolean;
};

export type MessageRow = {
  id: string;
  listingId: string;
  listingTitle: string;
  senderId: string;
  senderShop: string;
  recipientId: string;
  recipientShop: string;
  body: string;
  createdAt: number;
  readAt: number | null;
};

export type InboxThread = {
  listingId: string;
  listingTitle: string;
  otherUserId: string;
  otherShopName: string;
  lastBody: string;
  lastAt: number;
  unread: number;
};
