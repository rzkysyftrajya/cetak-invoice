import { supabase } from "@/integrations/supabase/client";
import type { BankAccount, CompanySettings, InvoiceInput } from "./invoice";
import type {
  FleetBookingStatus,
  FleetPaymentStatus,
  FleetRentalMode,
  FleetVehicle,
} from "./fleet";
import { DEFAULT_LOGO, DEFAULT_SIGNATURE, newAdditionalCharge, newItem } from "./invoice";

/** Turn backend errors into safe Indonesian messages. */
export function friendlyError(err: unknown): string {
  const e = err as { code?: string; message?: string; status?: number } | null;
  if (typeof err === "string") return err;
  if (err instanceof Error && !e?.message) return err.message;
  const msg = e?.message ?? "";
  if (/invalid login credentials/i.test(msg))
    return "Username atau kata sandi salah. Periksa kembali username dan kata sandi Anda.";
  if (/email not confirmed/i.test(msg))
    return "Akun belum dikonfirmasi di Supabase Authentication. Minta admin memeriksa status akun.";
  if (/user already registered|user_already_exists/i.test(msg))
    return "Email ini sudah terdaftar. Kembali ke halaman Masuk dan gunakan akun tersebut.";
  if (/password.*(least|minimum|characters)|weak password/i.test(msg))
    return "Kata sandi terlalu pendek atau lemah. Gunakan minimal 6 karakter.";
  if (/signup is disabled|signups not allowed|registration.*disabled/i.test(msg))
    return "Pendaftaran akun baru sedang dinonaktifkan di Supabase. Aktifkan Sign ups pada Authentication > Settings.";
  if (/email rate limit|rate limit.*email/i.test(msg))
    return "Terlalu banyak permintaan email verifikasi. Tunggu beberapa menit lalu coba lagi.";
  if (/invalid api key|invalid jwt/i.test(msg) || e?.status === 401)
    return "Kunci Supabase tidak cocok atau sudah tidak berlaku. Periksa URL dan publishable key pada environment aplikasi.";
  if (
    /PGRST202|PGRST205|42P01|42883|schema cache|could not find the function|relation .* does not exist/i.test(
      msg,
    )
  )
    return "Struktur database Supabase belum lengkap. Jalankan ulang migrasi database yang disediakan proyek.";
  if (/rental_bookings_one_running_per_vehicle_idx/i.test(msg))
    return "Mobil ini sudah memiliki rental berstatus Berjalan. Selesaikan rental aktifnya terlebih dahulu.";
  if (e?.code === "23505" || /duplicate key/i.test(msg))
    return "Nomor sudah digunakan. Gunakan nomor lain.";
  if (/Akses ditolak|permission denied|row-level security/i.test(msg))
    return "Anda tidak memiliki akses untuk tindakan ini.";
  if (/Nomor invoice final/i.test(msg)) return "Nomor invoice final tidak dapat diubah.";
  if (/Keterangan biaya|Biaya tidak valid/i.test(msg)) return msg;
  if (
    /Jumlah hari|Harga tidak valid|Minimal satu baris|tidak ditemukan|rental|mobil|tanggal|Nominal|Nama pelanggan|Pilih mobil/i.test(
      msg,
    )
  )
    return msg;
  if (/Failed to fetch|NetworkError/i.test(msg))
    return "Koneksi bermasalah. Periksa internet Anda.";
  if (!msg)
    return "Supabase tidak mengembalikan pesan kesalahan. Periksa koneksi dan konfigurasi aplikasi.";
  return "Terjadi kesalahan. Silakan coba lagi.";
}

function throwIf(error: unknown) {
  if (error) throw error;
}

// ---------- Settings ----------
export async function getSettings(): Promise<CompanySettings> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  throwIf(userError);
  if (!user) throw new Error("Sesi login tidak ditemukan");
  const { data, error } = await supabase
    .from("company_settings")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();
  throwIf(error);
  if (!data) throw new Error("Pengaturan perusahaan belum tersedia");
  return { ...data, bank_accounts: (data.bank_accounts as unknown as BankAccount[]) ?? [] };
}

export async function updateSettings(s: Partial<CompanySettings>) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  throwIf(userError);
  if (!user) throw new Error("Sesi login tidak ditemukan");
  const { error } = await supabase
    .from("company_settings")
    .update({ ...s, bank_accounts: s.bank_accounts as never })
    .eq("owner_id", user.id);
  throwIf(error);
}

export async function uploadBrandAsset(kind: "logo" | "signature", file: File): Promise<string> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  throwIf(userError);
  if (!user) throw new Error("Sesi login tidak ditemukan");
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${user.id}/${kind}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("brand-assets")
    .upload(path, file, { upsert: true, contentType: file.type });
  throwIf(error);
  return path;
}

/** Resolve logo/signature to absolute URLs usable by the PDF engine. */
export async function resolveBrandUrls(
  s: Pick<CompanySettings, "invoice_template" | "logo_path" | "signature_path">,
): Promise<{ logo: string | null; signature: string | null }> {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const fallbackLogo = s.invoice_template === "vicky" ? origin + DEFAULT_LOGO : null;
  const fallbackSignature = s.invoice_template === "vicky" ? origin + DEFAULT_SIGNATURE : null;
  const resolve = async (path: string | null, fallback: string | null) => {
    if (!path) return fallback;
    if (/^(https?:|data:|\/)/i.test(path)) return path;
    const { data, error } = await supabase.storage
      .from("brand-assets")
      .createSignedUrl(path, 60 * 60);
    throwIf(error);
    if (!data?.signedUrl) throw new Error("Aset brand tidak berhasil dibuka");
    return data.signedUrl;
  };
  const [logo, signature] = await Promise.all([
    resolve(s.logo_path, fallbackLogo),
    resolve(s.signature_path, fallbackSignature),
  ]);
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
  const { data, error } = await supabase
    .from("clients")
    .select("id,company_name,pic_name,phone,email,address")
    .order("company_name");
  throwIf(error);
  return data ?? [];
}
export async function saveClient(c: Omit<Client, "id"> & { id?: string }) {
  const { id, ...rest } = c;
  const { data, error } = id
    ? await supabase.from("clients").update(rest).eq("id", id).select("id").single()
    : await supabase.from("clients").insert(rest).select("id").single();
  throwIf(error);
  if (!data) throw new Error("Data klien tidak berhasil disimpan");
  return data.id;
}
export async function deleteClient(id: string) {
  const { error } = await supabase.from("clients").delete().eq("id", id);
  throwIf(error);
}

// ---------- Vehicles ----------
export type Vehicle = FleetVehicle;
export async function listVehicles(): Promise<Vehicle[]> {
  const { data, error } = await supabase
    .from("vehicles")
    .select(
      "id,car_type,plate_number,brand,model,year,color,transmission,capacity,status,current_km,tax_date,stnk_date,insurance_date,default_price,notes,created_at,updated_at",
    )
    .order("car_type");
  throwIf(error);
  return data ?? [];
}
export type VehicleInput = Pick<Vehicle, "car_type" | "plate_number"> &
  Partial<Omit<Vehicle, "id" | "car_type" | "plate_number">> & { id?: string };
export async function saveVehicle(v: VehicleInput) {
  const { id, ...rest } = v;
  const { data, error } = id
    ? await supabase.from("vehicles").update(rest).eq("id", id).select("id").single()
    : await supabase.from("vehicles").insert(rest).select("id").single();
  throwIf(error);
  if (!data) throw new Error("Data kendaraan tidak berhasil disimpan");
  return data.id;
}
export async function deleteVehicle(id: string) {
  const { error } = await supabase.from("vehicles").delete().eq("id", id);
  throwIf(error);
}

// ---------- Rental bookings ----------
export type RentalBookingStatus = FleetBookingStatus;
export type RentalPaymentStatus = FleetPaymentStatus;
export type RentalBooking = import("./fleet").FleetRental & {
  created_at: string;
  updated_at: string;
};

export type RentalBookingInput = Omit<
  RentalBooking,
  | "id"
  | "created_at"
  | "updated_at"
  | "rental_mode"
  | "start_time"
  | "end_time"
  | "driver_cost"
  | "normal_rate"
> & {
  id?: string;
  normal_rate: number;
  rental_mode?: FleetRentalMode;
  start_time?: string | null;
  end_time?: string | null;
  driver_cost?: number;
};

export async function listRentalBookings(): Promise<RentalBooking[]> {
  const { data, error } = await supabase
    .from("rental_bookings")
    .select(
      "id,vehicle_id,city,car_type,plate_number,customer_name,whatsapp,start_date,end_date,start_time,end_time,rental_mode,service,route,normal_rate,daily_rate,deposit,paid,driver_cost,payment_status,booking_status,notes,created_at,updated_at",
    )
    .order("start_date", { ascending: false })
    .order("created_at", { ascending: false });
  throwIf(error);
  return data ?? [];
}

export async function saveRentalBooking(booking: RentalBookingInput): Promise<RentalBooking> {
  const { id, ...values } = booking;
  const result = id
    ? await supabase.from("rental_bookings").update(values).eq("id", id).select("*").single()
    : await supabase.from("rental_bookings").insert(values).select("*").single();
  throwIf(result.error);
  if (!result.data) throw new Error("Data rental tidak berhasil disimpan");
  return result.data;
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

export async function listInvoices(
  opts: { search?: string; from?: string; to?: string; limit?: number } = {},
): Promise<InvoiceRow[]> {
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
    .select("*, invoice_items(*), invoice_additional_charges(*)")
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
    additional_charges: [...(data.invoice_additional_charges ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((charge) => ({
        ...newAdditionalCharge(),
        description: charge.description,
        amount: Number(charge.amount),
      })),
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

export async function listAllInvoices(): Promise<
  (InvoiceInput & { id: string; createdAt: string; updatedAt: string })[]
> {
  const { data, error } = await supabase
    .from("invoices")
    .select("*, invoice_items(*), invoice_additional_charges(*)")
    .order("invoice_date", { ascending: false })
    .order("created_at", { ascending: false });
  throwIf(error);
  return (data ?? []).map((row) => ({
    id: row.id,
    invoice_number: row.invoice_number,
    invoice_date: row.invoice_date,
    city: row.city,
    client_id: row.client_id,
    client_name: row.client_name,
    pic_name: row.pic_name ?? "",
    client_address: row.client_address ?? "",
    notes: row.notes ?? "",
    status: row.status === "final" ? "final" : "draft",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    additional_charges: [...(row.invoice_additional_charges ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((charge) => ({
        ...newAdditionalCharge(),
        description: charge.description,
        amount: Number(charge.amount),
      })),
    items: [...(row.invoice_items ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((item) => ({
        ...newItem(),
        vehicle_id: item.vehicle_id,
        car_type: item.car_type,
        plate_number: item.plate_number ?? "",
        service_date: item.service_date ?? "",
        route: item.route ?? "",
        service_type: item.service_type ?? "",
        days: item.days,
        price_per_day: Number(item.price_per_day),
      })),
  }));
}

export async function isInvoiceNumberTaken(num: string, excludeId?: string): Promise<boolean> {
  let q = supabase.from("invoices").select("id").eq("invoice_number", num.trim());
  if (excludeId) q = q.neq("id", excludeId);
  const { data, error } = await q.limit(1);
  throwIf(error);
  return (data?.length ?? 0) > 0;
}

export async function nextInvoiceNumber(): Promise<string> {
  const { data, error } = await supabase.rpc("next_invoice_number");
  throwIf(error);
  if (!data) throw new Error("Nomor invoice berikutnya tidak berhasil dibuat");
  return data;
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
    additional_charges: inv.additional_charges.map((charge) => ({
      description: charge.description.trim(),
      amount: charge.amount,
    })),
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
  const { data: u, error: userError } = await supabase.auth.getUser();
  throwIf(userError);
  if (!u.user) return null;
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
  throwIf(error);
  const roles = (data ?? []).map((r) => r.role);
  if (roles.includes("admin")) return "admin";
  if (roles.includes("staff")) return "staff";
  return null;
}

export type UserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: "admin" | "staff" | null;
};
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
