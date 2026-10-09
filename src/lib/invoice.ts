import { z } from "zod";

export type BankAccount = { bank: string; name: string; number: string };

export type CompanySettings = {
  company_name: string;
  address: string;
  phone: string;
  email: string;
  bank_accounts: BankAccount[];
  signer_name: string;
  signer_title: string;
  default_city: string;
  logo_path: string | null;
  signature_path: string | null;
};

export type InvoiceItemInput = {
  key: string;
  vehicle_id: string | null;
  car_type: string;
  plate_number: string;
  service_date: string;
  route: string;
  service_type: string;
  days: number;
  price_per_day: number;
};

export type InvoiceInput = {
  id?: string;
  invoice_number: string;
  invoice_date: string;
  city: string;
  client_id: string | null;
  client_name: string;
  pic_name: string;
  client_address: string;
  notes: string;
  status: "draft" | "final";
  items: InvoiceItemInput[];
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** Rp1.350.000 */
export function formatRupiah(value: number): string {
  const n = Number.isFinite(value) ? Math.round(value) : 0;
  const sign = n < 0 ? "-" : "";
  return `${sign}Rp${Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

/** Parse "1.350.000" / "Rp1.350.000" → 1350000 */
export function parseRupiah(input: string): number {
  const digits = input.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

function parseISODate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** "9 Okt 2026" (pad=false) or "09 Okt 2026" (pad=true) */
export function formatDateID(iso: string, pad = false): string {
  const d = parseISODate(iso);
  if (!d) return "";
  const day = pad ? String(d.getDate()).padStart(2, "0") : String(d.getDate());
  return `${day} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function lineTotal(days: number, price: number): number {
  const d = Number.isInteger(days) && days > 0 ? days : 0;
  const p = Number.isFinite(price) && price >= 0 ? Math.round(price) : 0;
  return d * p;
}

export function grandTotal(items: Pick<InvoiceItemInput, "days" | "price_per_day">[]): number {
  return items.reduce((sum, it) => sum + lineTotal(it.days, it.price_per_day), 0);
}

export function sanitizeFilenamePart(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9-]+/g, "")
    .slice(0, 60);
}

/** Invoice-15905-AstrindoTravel.pdf */
export function invoiceFilename(number: string, client: string): string {
  const num = sanitizeFilenamePart(number) || "Draft";
  const words = client.trim().split(/\s+/).filter((w) => !/^(pt|cv|ud)\.?$/i.test(w));
  const firstWords = words[0] ?? "";
  const cl = sanitizeFilenamePart(firstWords);
  return cl ? `Invoice-${num}-${cl}.pdf` : `Invoice-${num}.pdf`;
}

export function newItem(): InvoiceItemInput {
  return {
    key: Math.random().toString(36).slice(2),
    vehicle_id: null,
    car_type: "",
    plate_number: "",
    service_date: todayISO(),
    route: "",
    service_type: "Dengan Driver",
    days: 1,
    price_per_day: 0,
  };
}

export const itemSchema = z.object({
  car_type: z.string().trim().min(1, "Jenis mobil wajib diisi").max(100),
  plate_number: z.string().trim().max(20),
  service_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal layanan wajib diisi"),
  route: z.string().trim().max(120),
  service_type: z.string().trim().max(60),
  days: z.number().int("Jumlah hari harus bilangan bulat").positive("Jumlah hari harus lebih dari 0").max(365),
  price_per_day: z.number().int().min(0, "Harga tidak boleh negatif").max(1_000_000_000),
});

export const invoiceSchema = z.object({
  invoice_number: z
    .string()
    .trim()
    .max(30, "Nomor invoice maksimal 30 karakter")
    .regex(/^[A-Za-z0-9/._-]*$/, "Nomor invoice hanya boleh huruf, angka, / . _ -"),
  invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal invoice wajib diisi"),
  city: z.string().trim().min(1, "Kota wajib diisi").max(60),
  client_name: z.string().trim().min(1, "Nama perusahaan/klien wajib diisi").max(150),
  pic_name: z.string().trim().max(100),
  client_address: z.string().trim().max(300),
  notes: z.string().trim().max(500),
  status: z.enum(["draft", "final"]),
  items: z.array(itemSchema).min(1, "Minimal satu baris kendaraan"),
});

export function emptyInvoice(city = "Jakarta"): InvoiceInput {
  return {
    invoice_number: "",
    invoice_date: todayISO(),
    city,
    client_id: null,
    client_name: "",
    pic_name: "",
    client_address: "",
    notes: "",
    status: "draft",
    items: [newItem()],
  };
}

export const DEFAULT_LOGO = "/brand/logo-vrn.png";
export const DEFAULT_SIGNATURE = "/brand/signature.png";
