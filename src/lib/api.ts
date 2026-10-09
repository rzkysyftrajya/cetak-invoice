import { supabase } from "@/integrations/supabase/client";
import type { BankAccount, CompanySettings, InvoiceInput } from "./invoice";
import { DEFAULT_LOGO, DEFAULT_SIGNATURE, newItem } from "./invoice";

/** Turn backend errors into safe Indonesian messages. */
export function friendlyError(err: unknown): string {
  const e = err as { code?: string; message?: string } | null;
  const msg = e?.message ?? "";
  if (e?.code === "23505" || /duplicate key/i.test(msg)) return "Nomor sudah digunakan. Gunakan nomor lain.";
  if (/Akses ditolak|permission denied|row-level security/i.test(msg))
    return "Anda tidak memiliki akses untuk tindakan ini.";
  if (/Nomor invoice final/i.test(msg)) return "Nomor invoice final tidak dapat diubah.";
  if (/Jumlah hari|Harga tidak valid|Minimal satu baris|tidak ditemukan/i.test(msg)) return msg;
  if (/Failed to fetch|NetworkError/i.test(msg)) return "Koneksi bermasalah. Periksa internet Anda.";
  return "Terjadi kesalahan. Silakan coba lagi.";
}

function throwIf(error: unknown) {
  if (error) throw error;
}

// ---------- Settings ----------
export async function getSettings(): Promise<CompanySettings> {
  const { data, error } = await supabase.from("company_settings").select("*").eq("id", 1).maybeSingle();
  throwIf(error);
  if (!data) throw new Error("Pengaturan perusahaan belum tersedia");
  return { ...data, bank_accounts: (data.bank_accounts as unknown as BankAccount[]) ?? [] };
}

export async function updateSettings(s: Partial<CompanySettings>) {
  const { error } = await supabase
    .from("company_settings")
    .update({ ...s, bank_accounts: s.bank_accounts as never })
    .eq("id", 1);
  throwIf(error);
}

export async function uploadBrandAsset(kind: "logo" | "signature", file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${kind}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("brand-assets").upload(path, file, { upsert: true, contentType: file.type });
  throwIf(error);
  return path;
}

/** Resolve logo/signature to absolute URLs usable by the PDF engine. */
export async function resolveBrandUrls(s: CompanySettings): Promise<{ logo: string; signature: string }> {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const sign = async (path: string | null, fallback: string) => {
    if (!path) return origin + fallback;
    const { data } = await supabase.storage.from("brand-assets").createSignedUrl(path, 60 * 60);
    return data?.signedUrl ?? origin + fallback;
  };
  const [logo, signature] = await Promise.all([sign(s.logo_path, DEFAULT_LOGO), sign(s.signature_path, DEFAULT_SIGNATURE)]);
  return { logo, signature };
}

// ---------- Clients ----------
export type Client = {
  id: string;
  company_name: string;
  pic_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
};
export async function listClients(): Promise<Client[]> {
  const { data, error } = await supabase.from("clients").select("id,company_name,pic_name,phone,email,address").order("company_name");
  throwIf(error);
  return data ?? [];
}
export async function saveClient(c: Omit<Client, "id"> & { id?: string }) {
  const { id, ...rest } = c;
  const { error } = id
    ? await supabase.from("clients").update(rest).eq("id", id)
    : await supabase.from("clients").insert(rest);
  throwIf(error);
}
export async function deleteClient(id: string) {
  const { error } = await supabase.from("clients").delete().eq("id", id);
  throwIf(error);
}

// ---------- Vehicles ----------
export type Vehicle = { id: string; car_type: string; plate_number: string; default_price: number | null };
export async function listVehicles(): Promise<Vehicle[]> {
  const { data, error } = await supabase.from("vehicles").select("id,car_type,plate_number,default_price").order("car_type");
  throwIf(error);
  return data ?? [];
}
export async function saveVehicle(v: Omit<Vehicle, "id"> & { id?: string }) {
  const { id, ...rest } = v;
  const { error } = id
    ? await supabase.from("vehicles").update(rest).eq("id", id)
    : await supabase.from("vehicles").insert(rest);
  throwIf(error);
}
export async function deleteVehicle(id: string) {
  const { error } = await supabase.from("vehicles").delete().eq("id", id);
  throwIf(error);
}

// ---------- Invoices ----------
export type InvoiceRow = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  client_name: string;
  pic_name: string | null;
  status: string;
  grand_total: number;
  created_at: string;
};

export async function listInvoices(opts: { search?: string; from?: string; to?: string; limit?: number } = {}): Promise<InvoiceRow[]> {
  let q = supabase
    .from("invoices")
    .select("id,invoice_number,invoice_date,client_name,pic_name,status,grand_total,created_at")
    .order("invoice_date", { ascending: false })
    .order("created_at", { ascending: false });
  const s = opts.search?.trim().replace(/[%,()]/g, "");
  if (s) q = q.or(`invoice_number.ilike.%${s}%,client_name.ilike.%${s}%`);
  if (opts.from) q = q.gte("invoice_date", opts.from);
  if (opts.to) q = q.lte("invoice_date", opts.to);
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  throwIf(error);
  return data ?? [];
}

export async function getInvoiceStats() {
  const { data, error } = await supabase.from("invoices").select("grand_total,invoice_date");
  throwIf(error);
  const rows = data ?? [];
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return {
    count: rows.length,
    total: rows.reduce((s, r) => s + Number(r.grand_total), 0),
    thisMonth: rows.filter((r) => r.invoice_date.startsWith(ym)).length,
  };
}

export async function getInvoice(id: string): Promise<InvoiceInput & { id: string }> {
  const { data, error } = await supabase
    .from("invoices")
    .select("*, invoice_items(*)")
    .eq("id", id)
    .maybeSingle();
  throwIf(error);
  if (!data) throw new Error("Invoice tidak ditemukan");
  const items = [...(data.invoice_items ?? [])].sort((a, b) => a.position - b.position);
  return {
    id: data.id,
    invoice_number: data.invoice_number,
    invoice_date: data.invoice_date,
    city: data.city,
    client_id: data.client_id,
    client_name: data.client_name,
    pic_name: data.pic_name ?? "",
    client_address: data.client_address ?? "",
    notes: data.notes ?? "",
    status: data.status === "final" ? "final" : "draft",
    items: items.map((it) => ({
      ...newItem(),
      vehicle_id: it.vehicle_id,
      car_type: it.car_type,
      plate_number: it.plate_number ?? "",
      service_date: it.service_date ?? "",
      route: it.route ?? "",
      service_type: it.service_type ?? "",
      days: it.days,
      price_per_day: Number(it.price_per_day),
    })),
  };
}

export async function isInvoiceNumberTaken(num: string, excludeId?: string): Promise<boolean> {
  let q = supabase.from("invoices").select("id").eq("invoice_number", num.trim());
  if (excludeId) q = q.neq("id", excludeId);
  const { data, error } = await q.limit(1);
  throwIf(error);
  return (data?.length ?? 0) > 0;
}

export async function saveInvoice(inv: InvoiceInput): Promise<string> {
  const payload = {
    id: inv.id ?? "",
    invoice_number: inv.invoice_number.trim(),
    invoice_date: inv.invoice_date,
    city: inv.city.trim(),
    client_id: inv.client_id ?? "",
    client_name: inv.client_name.trim(),
    pic_name: inv.pic_name.trim(),
    client_address: inv.client_address.trim(),
    notes: inv.notes.trim(),
    status: inv.status,
    items: inv.items.map((it) => ({
      vehicle_id: it.vehicle_id ?? "",
      car_type: it.car_type.trim(),
      plate_number: it.plate_number.trim(),
      service_date: it.service_date,
      route: it.route.trim(),
      service_type: it.service_type.trim(),
      days: it.days,
      price_per_day: it.price_per_day,
    })),
  };
  const { data, error } = await supabase.rpc("save_invoice", { p: payload });
  throwIf(error);
  return data as string;
}

export async function deleteInvoice(id: string) {
  const { error } = await supabase.from("invoices").delete().eq("id", id);
  throwIf(error);
}

// ---------- Users / roles ----------
export async function getMyRole(): Promise<"admin" | "staff" | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
  const roles = (data ?? []).map((r) => r.role);
  if (roles.includes("admin")) return "admin";
  if (roles.includes("staff")) return "staff";
  return null;
}

export type UserRow = { id: string; email: string | null; full_name: string | null; role: "admin" | "staff" | null };
export async function listUsers(): Promise<UserRow[]> {
  const [{ data: profiles, error }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("id,email,full_name").order("created_at"),
    supabase.from("user_roles").select("user_id,role"),
  ]);
  throwIf(error);
  return (profiles ?? []).map((p) => {
    const r = (roles ?? []).filter((x) => x.user_id === p.id).map((x) => x.role);
    return { ...p, role: r.includes("admin") ? "admin" : r.includes("staff") ? "staff" : null };
  });
}
export async function setUserAccess(userId: string, grant: boolean) {
  const { error } = grant
    ? await supabase.from("user_roles").insert({ user_id: userId, role: "staff" })
    : await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "staff");
  throwIf(error);
}
