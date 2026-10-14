import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";

import {
  deleteVehicle,
  friendlyError,
  listRentalBookings,
  listVehicles,
  saveRentalBooking,
  saveVehicle,
  type RentalBooking,
  type RentalBookingInput,
  type Vehicle,
  type VehicleInput,
} from "@/lib/api";
import {
  isExcludedRental,
  isMedanCity,
  rentalDuration,
  rentalMonth,
  rentalNetProfit,
  rentalNormalCost,
  rentalTotal,
  summarizeFleet,
  vehicleTaxStatus,
  type FleetRental,
  type FleetRentalMode,
} from "@/lib/fleet";
import { formatDateRangeID, formatRupiah, formatRupiahInput } from "@/lib/invoice";

export type FleetSection = "dashboard" | "vehicles" | "rentals" | "unitIncome";

type FleetManagementProps = {
  section: FleetSection;
  onSectionChange: (section: FleetSection) => void;
  onDataChanged: () => void;
  newRentalRequest: number;
};

type VehicleForm = {
  id?: string;
  car_type: string;
  plate_number: string;
  brand: string;
  model: string;
  year: string;
  color: string;
  transmission: string;
  capacity: string;
  status: Vehicle["status"];
  current_km: string;
  tax_date: string;
  stnk_date: string;
  insurance_date: string;
  default_price: string;
  notes: string;
};

type RentalForm = {
  id?: string;
  car_type: string;
  plate_number: string;
  city: string;
  customer_name: string;
  whatsapp: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  rental_mode: FleetRentalMode;
  service: string;
  route: string;
  normal_rate: string;
  daily_rate: string;
  deposit: string;
  paid: string;
  driver_cost: string;
  payment_status: RentalBooking["payment_status"];
  booking_status: RentalBooking["booking_status"];
  notes: string;
};

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function monthLabel(month: string) {
  const year = Number(month.slice(0, 4));
  const value = Number(month.slice(5, 7));
  return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(
    new Date(year, value - 1, 1),
  );
}

function emptyVehicleForm(): VehicleForm {
  return {
    car_type: "",
    plate_number: "",
    brand: "",
    model: "",
    year: "",
    color: "",
    transmission: "Matic",
    capacity: "",
    status: "Tersedia",
    current_km: "0",
    tax_date: "",
    stnk_date: "",
    insurance_date: "",
    default_price: "0",
    notes: "",
  };
}

function emptyRentalForm(): RentalForm {
  const date = today();
  return {
    car_type: "",
    plate_number: "",
    city: "",
    customer_name: "",
    whatsapp: "",
    start_date: date,
    end_date: date,
    start_time: "10:00",
    end_time: "10:00",
    rental_mode: "Kalender",
    service: "Dengan Sopir",
    route: "",
    normal_rate: "",
    daily_rate: "0",
    deposit: "0",
    paid: "0",
    driver_cost: "0",
    payment_status: "Belum Bayar",
    booking_status: "Berjalan",
    notes: "",
  };
}

function amountInput(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

function inputDate(value: string | null) {
  return value?.slice(0, 10) ?? "";
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block space-y-2 text-sm ${className}`}>
      <span className="font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground";
const cardClass = "rounded-[24px] border border-border bg-white p-5 shadow-card";

export function FleetManagement({
  section,
  onSectionChange,
  onDataChanged,
  newRentalRequest,
}: FleetManagementProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [rentals, setRentals] = useState<RentalBooking[]>([]);
  const [month, setMonth] = useState(currentMonth);
  const [incomeCity, setIncomeCity] = useState("all");
  const [vehicleForm, setVehicleForm] = useState<VehicleForm>(emptyVehicleForm);
  const [rentalForm, setRentalForm] = useState<RentalForm>(emptyRentalForm);
  const [vehicleSaving, setVehicleSaving] = useState(false);
  const [rentalSaving, setRentalSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [nextVehicles, nextRentals] = await Promise.all([listVehicles(), listRentalBookings()]);
      setVehicles(nextVehicles);
      setRentals(nextRentals);
    } catch (error) {
      setLoadError(friendlyError(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setRentalForm(emptyRentalForm());
  }, [newRentalRequest]);

  const dashboard = useMemo(() => summarizeFleet(rentals, month), [rentals, month]);
  const rentalsForMonth = useMemo(
    () => rentals.filter((rental) => rentalMonth(rental).startsWith(month)),
    [rentals, month],
  );
  const cities = useMemo(
    () =>
      [...new Set(rentalsForMonth.map((rental) => rental.city))].sort((a, b) =>
        a.localeCompare(b, "id"),
      ),
    [rentalsForMonth],
  );
  const matchingRentals = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return rentalsForMonth.filter((rental) => {
      const matchesCity = incomeCity === "all" || rental.city === incomeCity;
      const matchesSearch =
        !term ||
        [
          rental.car_type,
          rental.plate_number,
          rental.customer_name,
          rental.whatsapp ?? "",
          rental.route ?? "",
          rental.city,
        ].some((value) => value.toLocaleLowerCase().includes(term));
      return matchesCity && matchesSearch;
    });
  }, [rentalsForMonth, incomeCity, search]);
  const includedMatchingRentals = useMemo(
    () => matchingRentals.filter((rental) => !isExcludedRental(rental)),
    [matchingRentals],
  );
  const citySummaries = useMemo(() => {
    return [...new Set(includedMatchingRentals.map((rental) => rental.city))].map((city) => {
      const rows = includedMatchingRentals.filter((rental) => rental.city === city);
      const billed = rows.reduce((sum, rental) => sum + rentalTotal(rental), 0);
      const paid = rows.reduce((sum, rental) => sum + rental.paid, 0);
      const operatingCost = rows.reduce((sum, rental) => sum + rental.driver_cost, 0);
      const pricedRows = rows.filter((rental) => rental.normal_rate !== null);
      return {
        city,
        rentalCount: rows.length,
        billed,
        paid,
        operatingCost,
        normalCost: pricedRows.reduce((sum, rental) => sum + (rentalNormalCost(rental) ?? 0), 0),
        missingNormalRate: rows.length - pricedRows.length,
        profit: pricedRows.reduce((sum, rental) => sum + (rentalNetProfit(rental) ?? 0), 0),
      };
    });
  }, [includedMatchingRentals]);

  function shiftMonth(amount: number) {
    const year = Number(month.slice(0, 4));
    const value = Number(month.slice(5, 7));
    const date = new Date(year, value - 1 + amount, 1);
    const next = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    if (next <= currentMonth()) setMonth(next);
  }

  function startNewRental() {
    setRentalForm(emptyRentalForm());
    onSectionChange("rentals");
  }

  function editVehicle(vehicle: Vehicle) {
    setVehicleForm({
      id: vehicle.id,
      car_type: vehicle.car_type,
      plate_number: vehicle.plate_number,
      brand: vehicle.brand ?? "",
      model: vehicle.model ?? "",
      year: vehicle.year == null ? "" : String(vehicle.year),
      color: vehicle.color ?? "",
      transmission: vehicle.transmission,
      capacity: vehicle.capacity == null ? "" : String(vehicle.capacity),
      status: vehicle.status,
      current_km: String(vehicle.current_km),
      tax_date: inputDate(vehicle.tax_date),
      stnk_date: inputDate(vehicle.stnk_date),
      insurance_date: inputDate(vehicle.insurance_date),
      default_price: String(vehicle.default_price ?? 0),
      notes: vehicle.notes ?? "",
    });
    onSectionChange("vehicles");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function editRental(rental: FleetRental) {
    setRentalForm({
      id: rental.id,
      car_type: rental.car_type,
      plate_number: rental.plate_number,
      city: rental.city === "Belum dipilih" ? "" : rental.city,
      customer_name: rental.customer_name,
      whatsapp: rental.whatsapp ?? "",
      start_date: rental.start_date,
      end_date: rental.end_date,
      start_time: rental.start_time?.slice(0, 5) ?? "10:00",
      end_time: rental.end_time?.slice(0, 5) ?? "10:00",
      rental_mode: rental.rental_mode,
      service: rental.service,
      route: rental.route ?? "",
      normal_rate: rental.normal_rate === null ? "" : String(rental.normal_rate),
      daily_rate: String(rental.daily_rate),
      deposit: String(rental.deposit),
      paid: String(rental.paid),
      driver_cost: String(rental.driver_cost),
      payment_status: rental.payment_status,
      booking_status: rental.booking_status,
      notes: rental.notes ?? "",
    });
    onSectionChange("rentals");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submitVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!vehicleForm.car_type.trim() || !vehicleForm.plate_number.trim()) {
      window.alert("Nama mobil dan nomor polisi wajib diisi.");
      return;
    }
    const year = vehicleForm.year ? Number(vehicleForm.year) : null;
    const capacity = vehicleForm.capacity ? Number(vehicleForm.capacity) : null;
    const currentKm = amountInput(vehicleForm.current_km);
    const defaultPrice = amountInput(vehicleForm.default_price);
    if (
      (year !== null && (!Number.isInteger(year) || year < 1900 || year > 2200)) ||
      (capacity !== null && (!Number.isInteger(capacity) || capacity < 1)) ||
      !Number.isSafeInteger(currentKm) ||
      !Number.isSafeInteger(defaultPrice) ||
      defaultPrice > 10_000_000_000
    ) {
      window.alert("Periksa kembali tahun, kapasitas, kilometer, dan harga sewa.");
      return;
    }

    const payload: VehicleInput = {
      ...(vehicleForm.id ? { id: vehicleForm.id } : {}),
      car_type: vehicleForm.car_type.trim(),
      plate_number: vehicleForm.plate_number.trim().toUpperCase(),
      brand: vehicleForm.brand.trim() || null,
      model: vehicleForm.model.trim() || null,
      year,
      color: vehicleForm.color.trim() || null,
      transmission: vehicleForm.transmission,
      capacity,
      status: vehicleForm.status,
      current_km: currentKm,
      tax_date: vehicleForm.tax_date || null,
      stnk_date: vehicleForm.stnk_date || null,
      insurance_date: vehicleForm.insurance_date || null,
      default_price: defaultPrice,
      notes: vehicleForm.notes.trim() || null,
    };

    setVehicleSaving(true);
    try {
      await saveVehicle(payload);
      setVehicleForm(emptyVehicleForm());
      await refresh();
      onDataChanged();
      window.alert("Data mobil berhasil disimpan.");
    } catch (error) {
      window.alert(friendlyError(error));
    } finally {
      setVehicleSaving(false);
    }
  }

  async function removeVehicle(vehicle: Vehicle) {
    if (!window.confirm(`Hapus data mobil ${vehicle.car_type} (${vehicle.plate_number})?`)) return;
    try {
      await deleteVehicle(vehicle.id);
      await refresh();
      onDataChanged();
    } catch (error) {
      window.alert(friendlyError(error));
    }
  }

  async function submitRental(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rentalForm.car_type.trim() || !rentalForm.plate_number.trim()) {
      window.alert("Nama mobil dan nomor polisi wajib diisi.");
      return;
    }
    if (!rentalForm.customer_name.trim()) {
      window.alert("Nama pelanggan wajib diisi.");
      return;
    }
    const city = rentalForm.city.trim();
    if (!city) {
      window.alert("Pilih atau masukkan kota tujuan order.");
      return;
    }
    if (isMedanCity(city)) {
      window.alert("Catatan rental ini khusus order luar Medan. Pilih kota tujuan lain.");
      return;
    }
    const duration = rentalDuration(
      rentalForm.start_date,
      rentalForm.end_date,
      rentalForm.rental_mode,
      rentalForm.start_time,
      rentalForm.end_time,
    );
    if (!duration) {
      window.alert("Periksa kembali tanggal dan jam mulai/selesai rental.");
      return;
    }
    if (!rentalForm.normal_rate.trim()) {
      window.alert("Harga normal per hari wajib diisi agar keuntungan bersih dapat dihitung.");
      return;
    }
    const normalRate = amountInput(rentalForm.normal_rate);
    const money = [
      normalRate,
      amountInput(rentalForm.daily_rate),
      amountInput(rentalForm.deposit),
      amountInput(rentalForm.paid),
      amountInput(rentalForm.driver_cost),
    ];
    if (
      money.some((amount) => !Number.isSafeInteger(amount) || amount < 0 || amount > 10_000_000_000)
    ) {
      window.alert("Nominal harga, deposit, pembayaran, dan biaya operasional tidak valid.");
      return;
    }

    const payload: RentalBookingInput = {
      ...(rentalForm.id ? { id: rentalForm.id } : {}),
      vehicle_id: null,
      city,
      car_type: rentalForm.car_type.trim(),
      plate_number: rentalForm.plate_number.trim(),
      customer_name: rentalForm.customer_name.trim(),
      whatsapp: rentalForm.whatsapp.trim() || null,
      start_date: rentalForm.start_date,
      end_date: rentalForm.end_date,
      start_time: rentalForm.rental_mode === "24jam" ? rentalForm.start_time : null,
      end_time: rentalForm.rental_mode === "24jam" ? rentalForm.end_time : null,
      rental_mode: rentalForm.rental_mode,
      service: rentalForm.service,
      route: rentalForm.route.trim() || null,
      daily_rate: amountInput(rentalForm.daily_rate),
      normal_rate: normalRate,
      deposit: amountInput(rentalForm.deposit),
      paid: amountInput(rentalForm.paid),
      driver_cost: amountInput(rentalForm.driver_cost),
      payment_status: rentalForm.payment_status,
      booking_status: rentalForm.booking_status,
      notes: rentalForm.notes.trim() || null,
    };

    setRentalSaving(true);
    try {
      await saveRentalBooking(payload);
      setRentalForm(emptyRentalForm());
      await refresh();
      onDataChanged();
      window.alert("Data rental berhasil disimpan.");
    } catch (error) {
      window.alert(friendlyError(error));
    } finally {
      setRentalSaving(false);
    }
  }

  function changeVehicleForm<K extends keyof VehicleForm>(key: K, value: VehicleForm[K]) {
    setVehicleForm((current) => ({ ...current, [key]: value }));
  }

  function changeRentalForm<K extends keyof RentalForm>(key: K, value: RentalForm[K]) {
    setRentalForm((current) => ({ ...current, [key]: value }));
  }

  const rentalPreview =
    rentalDuration(
      rentalForm.start_date,
      rentalForm.end_date,
      rentalForm.rental_mode,
      rentalForm.start_time,
      rentalForm.end_time,
    ) * amountInput(rentalForm.daily_rate);
  const rentalNormalCostPreview =
    rentalForm.normal_rate.trim() === ""
      ? null
      : rentalDuration(
          rentalForm.start_date,
          rentalForm.end_date,
          rentalForm.rental_mode,
          rentalForm.start_time,
          rentalForm.end_time,
        ) * amountInput(rentalForm.normal_rate);
  const rentalNetProfitPreview =
    rentalNormalCostPreview === null
      ? null
      : rentalPreview - rentalNormalCostPreview - amountInput(rentalForm.driver_cost);

  if (loading) {
    return (
      <section className={cardClass} aria-live="polite">
        Memuat data armada...
      </section>
    );
  }

  if (loadError) {
    return (
      <section className={`${cardClass} space-y-4`}>
        <p role="alert" className="text-sm text-destructive">
          {loadError}
        </p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
        >
          Coba lagi
        </button>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {section === "dashboard" && (
        <>
          <section className={`${cardClass} flex flex-wrap items-center justify-between gap-4`}>
            <div>
              <h2 className="text-xl font-bold text-foreground">Dashboard Order Rental</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Ringkasan gabungan semua order luar Medan.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Bulan sebelumnya"
                onClick={() => shiftMonth(-1)}
                className="rounded-xl border border-border px-3 py-2"
              >
                ‹
              </button>
              <div className="min-w-36 text-center text-sm font-semibold">{monthLabel(month)}</div>
              <button
                type="button"
                aria-label="Bulan berikutnya"
                disabled={month >= currentMonth()}
                onClick={() => shiftMonth(1)}
                className="rounded-xl border border-border px-3 py-2 disabled:opacity-40"
              >
                ›
              </button>
              <button
                type="button"
                onClick={() => setMonth(currentMonth())}
                className="rounded-xl border border-border px-3 py-2 text-sm"
              >
                Bulan Ini
              </button>
              <button
                type="button"
                onClick={() => void refresh()}
                className="rounded-xl border border-border px-3 py-2 text-sm"
              >
                ↻ Segarkan
              </button>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Rental Bulan", dashboard.rentalCount],
              ["Total Tagihan Bulan", formatRupiah(dashboard.totalBilling)],
              ["Harga Normal Bulan", formatRupiah(dashboard.normalCost)],
              ["Keuntungan Bersih Bulan", formatRupiah(dashboard.profit)],
              ["Deposit Ditahan", formatRupiah(dashboard.deposit)],
              ["Sisa Tagihan", formatRupiah(dashboard.remaining)],
            ].map(([label, value]) => (
              <div key={String(label)} className={cardClass}>
                <div className="text-sm text-muted-foreground">{label}</div>
                <div className="mt-2 text-2xl font-bold text-foreground">{value}</div>
              </div>
            ))}
          </section>
          {dashboard.missingNormalRate > 0 && (
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              Harga normal belum diisi pada {dashboard.missingNormalRate} transaksi bulan ini.
              Lengkapi harga pada transaksi lama agar keuntungan bersih mencakup semuanya.
            </p>
          )}

          <section className={cardClass}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-foreground">Rental {monthLabel(month)}</h2>
                <p className="mt-1 text-sm text-muted-foreground">Selesai: {dashboard.completed}</p>
              </div>
              <button
                type="button"
                onClick={startNewRental}
                className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"
              >
                + Catat Rental
              </button>
            </div>
            <RentalTable rentals={dashboard.rentals.slice(0, 20)} onEdit={editRental} />
          </section>
        </>
      )}

      {section === "vehicles" && (
        <section className="space-y-5">
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              {vehicleForm.id ? "Edit Data Mobil" : "Tambah Data Mobil"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Simpan informasi kendaraan dan pengingat masa berlaku dokumen.
            </p>
          </div>
          <form onSubmit={submitVehicle} className={`${cardClass} space-y-5`}>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Nama mobil *">
                <input
                  required
                  value={vehicleForm.car_type}
                  onChange={(event) => changeVehicleForm("car_type", event.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Nomor polisi *">
                <input
                  required
                  value={vehicleForm.plate_number}
                  onChange={(event) => changeVehicleForm("plate_number", event.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Merek">
                <input
                  value={vehicleForm.brand}
                  onChange={(event) => changeVehicleForm("brand", event.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Tipe / Model">
                <input
                  value={vehicleForm.model}
                  onChange={(event) => changeVehicleForm("model", event.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Tahun">
                <input
                  type="number"
                  min="1900"
                  max="2200"
                  value={vehicleForm.year}
                  onChange={(event) => changeVehicleForm("year", event.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Warna">
                <input
                  value={vehicleForm.color}
                  onChange={(event) => changeVehicleForm("color", event.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Transmisi">
                <select
                  value={vehicleForm.transmission}
                  onChange={(event) => changeVehicleForm("transmission", event.target.value)}
                  className={inputClass}
                >
                  <option>Matic</option>
                  <option>Manual</option>
                </select>
              </Field>
              <Field label="Kapasitas penumpang">
                <input
                  type="number"
                  min="1"
                  value={vehicleForm.capacity}
                  onChange={(event) => changeVehicleForm("capacity", event.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Status mobil">
                <select
                  value={vehicleForm.status}
                  onChange={(event) =>
                    changeVehicleForm("status", event.target.value as Vehicle["status"])
                  }
                  className={inputClass}
                >
                  <option>Tersedia</option>
                  <option>Disewa</option>
                  <option>Servis</option>
                </select>
              </Field>
              <Field label="KM saat ini">
                <input
                  inputMode="numeric"
                  value={vehicleForm.current_km}
                  onChange={(event) => changeVehicleForm("current_km", event.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Harga sewa per hari">
                <input
                  inputMode="numeric"
                  value={formatRupiahInput(vehicleForm.default_price)}
                  onChange={(event) =>
                    changeVehicleForm("default_price", formatRupiahInput(event.target.value))
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Pajak tahunan">
                <input
                  type="date"
                  value={vehicleForm.tax_date}
                  onChange={(event) => changeVehicleForm("tax_date", event.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="STNK 5 tahunan">
                <input
                  type="date"
                  value={vehicleForm.stnk_date}
                  onChange={(event) => changeVehicleForm("stnk_date", event.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Asuransi">
                <input
                  type="date"
                  value={vehicleForm.insurance_date}
                  onChange={(event) => changeVehicleForm("insurance_date", event.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Catatan" className="md:col-span-2">
                <textarea
                  value={vehicleForm.notes}
                  onChange={(event) => changeVehicleForm("notes", event.target.value)}
                  className={`${inputClass} min-h-20`}
                />
              </Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={vehicleSaving}
                className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {vehicleSaving
                  ? "Menyimpan..."
                  : vehicleForm.id
                    ? "Simpan Perubahan"
                    : "Simpan Data Mobil"}
              </button>
              {vehicleForm.id && (
                <button
                  type="button"
                  onClick={() => setVehicleForm(emptyVehicleForm())}
                  className="rounded-xl border border-border px-5 py-3 text-sm"
                >
                  Batal Edit
                </button>
              )}
            </div>
          </form>
          <section className={cardClass}>
            <h3 className="mb-4 text-lg font-bold">Data Armada</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="p-3">Kota</th>
                    <th className="p-3">Mobil / Plat</th>
                    <th className="p-3">Tahun / KM</th>
                    <th className="p-3">Harga / Hari</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Pajak</th>
                    <th className="p-3">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map((vehicle) => (
                    <tr key={vehicle.id} className="border-b border-border last:border-0">
                      <td className="p-3 font-medium">
                        {vehicle.car_type}
                        <div className="text-xs text-muted-foreground">{vehicle.plate_number}</div>
                      </td>
                      <td className="p-3">
                        {vehicle.year ?? "—"} / {vehicle.current_km.toLocaleString("id-ID")} km
                      </td>
                      <td className="p-3">{formatRupiah(vehicle.default_price ?? 0)}</td>
                      <td className="p-3">{vehicle.status}</td>
                      <td className="p-3">{vehicleTaxStatus(vehicle.tax_date)}</td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => editVehicle(vehicle)}
                            className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void removeVehicle(vehicle)}
                            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700"
                          >
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {vehicles.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-5 text-center text-muted-foreground">
                        Belum ada data mobil.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </section>
      )}

      {section === "rentals" && (
        <section className="space-y-5">
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              {rentalForm.id ? "Edit Transaksi Rental" : "Catat Transaksi Rental"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Masukkan detail penyewa, jadwal, pembayaran, dan biaya operasional.
            </p>
          </div>
          <form onSubmit={submitRental} className={`${cardClass} space-y-5`}>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Jenis mobil *">
                <input
                  required
                  value={rentalForm.car_type}
                  onChange={(event) => changeRentalForm("car_type", event.target.value)}
                  placeholder="Contoh: Toyota Avanza"
                  className={inputClass}
                />
              </Field>
              <Field label="Nomor polisi *">
                <input
                  required
                  value={rentalForm.plate_number}
                  onChange={(event) => changeRentalForm("plate_number", event.target.value)}
                  placeholder="Nomor polisi kendaraan"
                  className={inputClass}
                />
              </Field>
              <Field label="Kota tujuan order *">
                <input
                  required
                  list="rental-order-cities"
                  value={rentalForm.city}
                  onChange={(event) => changeRentalForm("city", event.target.value)}
                  placeholder="Pilih atau ketik kota"
                  className={inputClass}
                />
                <datalist id="rental-order-cities">
                  <option value="Surabaya" />
                  <option value="Jakarta" />
                  <option value="Semarang" />
                  <option value="Makassar" />
                  <option value="Batam" />
                  <option value="Yogyakarta" />
                </datalist>
                <span className="block text-xs text-muted-foreground">
                  Order luar Medan saja. Kota lain bisa diketik.
                </span>
              </Field>
              <Field label="Nama pelanggan *">
                <input
                  required
                  value={rentalForm.customer_name}
                  onChange={(event) => changeRentalForm("customer_name", event.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="No. WhatsApp">
                <input
                  inputMode="tel"
                  value={rentalForm.whatsapp}
                  onChange={(event) => changeRentalForm("whatsapp", event.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Mode sewa">
                <select
                  value={rentalForm.rental_mode}
                  onChange={(event) =>
                    changeRentalForm("rental_mode", event.target.value as FleetRentalMode)
                  }
                  className={inputClass}
                >
                  <option value="Kalender">Harian (tanggal kalender)</option>
                  <option value="24jam">24 jam</option>
                </select>
              </Field>
              <Field label="Tanggal mulai *">
                <input
                  required
                  type="date"
                  value={rentalForm.start_date}
                  onChange={(event) => changeRentalForm("start_date", event.target.value)}
                  className={inputClass}
                />
              </Field>
              {rentalForm.rental_mode === "24jam" && (
                <Field label="Jam mulai *">
                  <input
                    required
                    type="time"
                    value={rentalForm.start_time}
                    onChange={(event) => changeRentalForm("start_time", event.target.value)}
                    className={inputClass}
                  />
                </Field>
              )}
              <Field label="Tanggal selesai *">
                <input
                  required
                  type="date"
                  value={rentalForm.end_date}
                  onChange={(event) => changeRentalForm("end_date", event.target.value)}
                  className={inputClass}
                />
              </Field>
              {rentalForm.rental_mode === "24jam" && (
                <Field label="Jam selesai *">
                  <input
                    required
                    type="time"
                    value={rentalForm.end_time}
                    onChange={(event) => changeRentalForm("end_time", event.target.value)}
                    className={inputClass}
                  />
                </Field>
              )}
              <Field label="Layanan">
                <select
                  value={rentalForm.service}
                  onChange={(event) => changeRentalForm("service", event.target.value)}
                  className={inputClass}
                >
                  <option>Dengan Sopir</option>
                  <option>Lepas Kunci</option>
                </select>
              </Field>
              <Field label="Tujuan / Rute">
                <input
                  value={rentalForm.route}
                  onChange={(event) => changeRentalForm("route", event.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Harga normal per hari *">
                <input
                  required
                  inputMode="numeric"
                  value={formatRupiahInput(rentalForm.normal_rate)}
                  onChange={(event) =>
                    changeRentalForm("normal_rate", formatRupiahInput(event.target.value))
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Harga jual ke tamu per hari *">
                <input
                  required
                  inputMode="numeric"
                  value={formatRupiahInput(rentalForm.daily_rate)}
                  onChange={(event) =>
                    changeRentalForm("daily_rate", formatRupiahInput(event.target.value))
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Deposit">
                <input
                  inputMode="numeric"
                  value={formatRupiahInput(rentalForm.deposit)}
                  onChange={(event) =>
                    changeRentalForm("deposit", formatRupiahInput(event.target.value))
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Sudah dibayar">
                <input
                  inputMode="numeric"
                  value={formatRupiahInput(rentalForm.paid)}
                  onChange={(event) =>
                    changeRentalForm("paid", formatRupiahInput(event.target.value))
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Operasional driver">
                <input
                  inputMode="numeric"
                  value={formatRupiahInput(rentalForm.driver_cost)}
                  onChange={(event) =>
                    changeRentalForm("driver_cost", formatRupiahInput(event.target.value))
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Status pembayaran">
                <select
                  value={rentalForm.payment_status}
                  onChange={(event) =>
                    changeRentalForm(
                      "payment_status",
                      event.target.value as RentalForm["payment_status"],
                    )
                  }
                  className={inputClass}
                >
                  <option>Belum Bayar</option>
                  <option>DP</option>
                  <option>Lunas</option>
                  <option>Dibatalkan</option>
                </select>
              </Field>
              <Field label="Status booking">
                <select
                  value={rentalForm.booking_status}
                  onChange={(event) =>
                    changeRentalForm(
                      "booking_status",
                      event.target.value as RentalForm["booking_status"],
                    )
                  }
                  className={inputClass}
                >
                  <option>Booking</option>
                  <option>Berjalan</option>
                  <option>Selesai</option>
                  <option>Dibatalkan</option>
                  <option>No Show</option>
                </select>
              </Field>
              <Field label="Catatan" className="md:col-span-2">
                <textarea
                  value={rentalForm.notes}
                  onChange={(event) => changeRentalForm("notes", event.target.value)}
                  className={`${inputClass} min-h-20`}
                />
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="rounded-xl bg-muted px-4 py-3 text-sm">
                {rentalDuration(
                  rentalForm.start_date,
                  rentalForm.end_date,
                  rentalForm.rental_mode,
                  rentalForm.start_time,
                  rentalForm.end_time,
                )}{" "}
                hari · Tagihan tamu: <strong>{formatRupiah(rentalPreview)}</strong>
                <div className="mt-1 text-muted-foreground">
                  Harga normal:{" "}
                  <strong>
                    {rentalNormalCostPreview === null
                      ? "Isi harga normal"
                      : formatRupiah(rentalNormalCostPreview)}
                  </strong>{" "}
                  · Keuntungan bersih:{" "}
                  <strong>
                    {rentalNetProfitPreview === null
                      ? "Belum dihitung"
                      : formatRupiah(rentalNetProfitPreview)}
                  </strong>
                </div>
              </div>
              <button
                type="submit"
                disabled={rentalSaving}
                className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {rentalSaving
                  ? "Menyimpan..."
                  : rentalForm.id
                    ? "Simpan Perubahan"
                    : "Simpan Transaksi Rental"}
              </button>
              {rentalForm.id && (
                <button
                  type="button"
                  onClick={() => setRentalForm(emptyRentalForm())}
                  className="rounded-xl border border-border px-5 py-3 text-sm"
                >
                  Batal Edit
                </button>
              )}
            </div>
          </form>
          <section className={cardClass}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-bold">Riwayat Transaksi Rental</h3>
              <input
                aria-label="Cari transaksi rental"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari mobil atau pelanggan"
                className={`${inputClass} max-w-sm`}
              />
            </div>
            <RentalTable
              rentals={rentals.filter((rental) => {
                const term = search.trim().toLocaleLowerCase();
                return (
                  !term ||
                  [
                    rental.car_type,
                    rental.plate_number,
                    rental.customer_name,
                    rental.whatsapp ?? "",
                    rental.city,
                  ].some((value) => value.toLocaleLowerCase().includes(term))
                );
              })}
              onEdit={editRental}
            />
          </section>
        </section>
      )}

      {section === "unitIncome" && (
        <section className="space-y-5">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Pendapatan / Kota</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Ringkasan gabungan tagihan, pembayaran, biaya operasional, dan keuntungan per kota.
            </p>
          </div>
          <section className={`${cardClass} grid gap-4 md:grid-cols-2`}>
            <Field label="Periode">
              <input
                type="month"
                value={month}
                max={currentMonth()}
                onChange={(event) => event.target.value && setMonth(event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Kota tujuan">
              <select
                value={incomeCity}
                onChange={(event) => setIncomeCity(event.target.value)}
                className={inputClass}
              >
                <option value="all">Gabungan semua kota</option>
                {cities.map((city) => (
                  <option key={city} value={city}>
                    {city === "Belum dipilih" ? "Belum ditentukan" : city}
                  </option>
                ))}
              </select>
            </Field>
          </section>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              [
                "Total Tagihan",
                includedMatchingRentals.reduce((sum, rental) => sum + rentalTotal(rental), 0),
              ],
              ["Harga Normal", citySummaries.reduce((sum, summary) => sum + summary.normalCost, 0)],
              [
                "Pembayaran Diterima",
                includedMatchingRentals.reduce((sum, rental) => sum + rental.paid, 0),
              ],
              [
                "Operasional Driver",
                includedMatchingRentals.reduce((sum, rental) => sum + rental.driver_cost, 0),
              ],
              ["Deposit", includedMatchingRentals.reduce((sum, rental) => sum + rental.deposit, 0)],
              [
                "Keuntungan Bersih",
                citySummaries.reduce((sum, summary) => sum + summary.profit, 0),
              ],
            ].map(([label, total]) => (
              <div key={String(label)} className={cardClass}>
                <div className="text-sm text-muted-foreground">{label}</div>
                <div className="mt-2 text-xl font-bold">{formatRupiah(Number(total))}</div>
              </div>
            ))}
          </section>
          {citySummaries.some((summary) => summary.missingNormalRate > 0) && (
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              Ada transaksi yang belum memiliki harga normal. Keuntungan bersih yang ditampilkan
              belum mencakup transaksi tersebut.
            </p>
          )}
          <section className={cardClass}>
            <h3 className="mb-4 text-lg font-bold">Ringkasan Pendapatan per Kota</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="p-3">Kota</th>
                    <th className="p-3">Jumlah Rental</th>
                    <th className="p-3">Total Tagihan</th>
                    <th className="p-3">Harga Normal</th>
                    <th className="p-3">Dibayar</th>
                    <th className="p-3">Operasional</th>
                    <th className="p-3">Keuntungan</th>
                  </tr>
                </thead>
                <tbody>
                  {citySummaries.map((summary) => (
                    <tr key={summary.city} className="border-b border-border last:border-0">
                      <td className="p-3 font-medium">
                        {summary.city === "Belum dipilih" ? "Belum ditentukan" : summary.city}
                      </td>
                      <td className="p-3">{summary.rentalCount}</td>
                      <td className="p-3">{formatRupiah(summary.billed)}</td>
                      <td className="p-3">
                        {formatRupiah(summary.normalCost)}
                        {summary.missingNormalRate > 0 && (
                          <div className="text-xs text-amber-700">
                            Belum diisi: {summary.missingNormalRate}
                          </div>
                        )}
                      </td>
                      <td className="p-3">{formatRupiah(summary.paid)}</td>
                      <td className="p-3">{formatRupiah(summary.operatingCost)}</td>
                      <td className="p-3 font-semibold">{formatRupiah(summary.profit)}</td>
                    </tr>
                  ))}
                  {citySummaries.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-5 text-center text-muted-foreground">
                        Belum ada transaksi rental untuk filter ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          <section className={cardClass}>
            <h3 className="mb-4 text-lg font-bold">Riwayat Order · {monthLabel(month)}</h3>
            <RentalTable rentals={matchingRentals} onEdit={editRental} />
          </section>
        </section>
      )}
    </div>
  );
}

function RentalTable({
  rentals,
  onEdit,
}: {
  rentals: FleetRental[];
  onEdit: (rental: FleetRental) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1080px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="p-3">Kota</th>
            <th className="p-3">Mobil / Plat</th>
            <th className="p-3">Pelanggan</th>
            <th className="p-3">Periode</th>
            <th className="p-3">Hari</th>
            <th className="p-3">Tagihan</th>
            <th className="p-3">Dibayar / Sisa</th>
            <th className="p-3">Status</th>
            <th className="p-3">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {rentals.map((rental) => {
            const days = rentalDuration(
              rental.start_date,
              rental.end_date,
              rental.rental_mode,
              rental.start_time,
              rental.end_time,
            );
            const total = rentalTotal(rental);
            const remaining = Math.max(0, total - rental.paid);
            return (
              <tr key={rental.id} className="border-b border-border last:border-0">
                <td className="p-3">
                  {rental.city === "Belum dipilih" ? "Belum ditentukan" : rental.city}
                </td>
                <td className="p-3 font-medium">
                  {rental.car_type}
                  <div className="text-xs text-muted-foreground">{rental.plate_number}</div>
                </td>
                <td className="p-3">
                  {rental.customer_name}
                  <div className="text-xs text-muted-foreground">{rental.whatsapp}</div>
                </td>
                <td className="p-3">
                  {formatDateRangeID(rental.start_date, days, true)}
                  {rental.rental_mode === "24jam" && (
                    <div className="text-xs text-muted-foreground">
                      {rental.start_time?.slice(0, 5)}–{rental.end_time?.slice(0, 5)} · 24 jam
                    </div>
                  )}
                </td>
                <td className="p-3">{days}</td>
                <td className="p-3">
                  {formatRupiah(total)}
                  <div className="text-xs text-muted-foreground">
                    Jual/hari {formatRupiah(rental.daily_rate)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Normal/hari{" "}
                    {rental.normal_rate === null ? "Belum diisi" : formatRupiah(rental.normal_rate)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Deposit {formatRupiah(rental.deposit)}
                  </div>
                </td>
                <td className="p-3">
                  {formatRupiah(rental.paid)}
                  <div className="text-xs text-muted-foreground">
                    Sisa {formatRupiah(remaining)}
                  </div>
                </td>
                <td className="p-3">
                  {rental.booking_status}
                  <div className="text-xs text-muted-foreground">{rental.payment_status}</div>
                </td>
                <td className="p-3">
                  <button
                    type="button"
                    onClick={() => onEdit(rental)}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            );
          })}
          {rentals.length === 0 && (
            <tr>
              <td colSpan={9} className="p-5 text-center text-muted-foreground">
                Belum ada data rental untuk filter ini.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
