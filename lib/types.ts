import type { ListingType } from "@/lib/business";
import type { Category, DeliveryMode, Material, MetalType, StockForm } from "@/lib/constants";

export type ListingInput = {
  /** "offer" sells material; "wanted" is a request for material. */
  listingType: ListingType;
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
  companyId: string | null;
  businessType: string;
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
  companyId: string | null;
  /** True once the company profile has the required business details. */
  profileComplete: boolean;
};

export type MessageRow = {
  id: string;
  listingId: string;
  /** Set when the thread is about an RFQ instead of a listing. */
  rfqId?: string;
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
  rfqId?: string;
  listingTitle: string;
  otherUserId: string;
  otherShopName: string;
  lastBody: string;
  lastAt: number;
  unread: number;
};
