import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { listRentalBookings, type RentalBooking } from "@/lib/api";
import { isExcludedRental, rentalNetProfit, rentalTotal } from "@/lib/fleet";
import { formatRupiah } from "@/lib/invoice";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/weekly-report")({
  component: WeeklyRentalReport,
});

function toISODate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function startOfWeek(date: Date) {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

function dateLabel(value: string, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", options).format(new Date(`${value}T12:00:00`));
}

function escapeCsv(value: unknown) {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function WeeklyRentalReport() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [rentals, setRentals] = useState<RentalBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [startDate, setStartDate] = useState(() => toISODate(startOfWeek(new Date())));
  const [endDate, setEndDate] = useState(() => shiftDate(toISODate(startOfWeek(new Date())), 6));
  const [city, setCity] = useState("all");

  const loadRentals = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRentals(await listRentalBookings());
    } catch {
      setError("Data rental belum berhasil dimuat. Coba muat ulang halaman.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError || !data.session) {
        setAuthenticated(false);
        setLoading(false);
        return;
      }
      setAuthenticated(true);
      void loadRentals();
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setAuthenticated(Boolean(session));
      if (session) void loadRentals();
      else {
        setRentals([]);
        setLoading(false);
      }
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [loadRentals]);

  const cities = useMemo(
    () => [...new Set(rentals.map((rental) => rental.city).filter(Boolean))].sort((a, b) => a.localeCompare(b, "id")),
    [rentals],
  );
  const reportRentals = useMemo(
    () => rentals
      .filter((rental) => rental.start_date >= startDate && rental.start_date <= endDate)
      .filter((rental) => city === "all" || rental.city === city)
      .sort((a, b) => a.start_date.localeCompare(b.start_date) || a.customer_name.localeCompare(b.customer_name, "id")),
    [rentals, startDate, endDate, city],
  );
  const activeRentals = reportRentals.filter((rental) => !isExcludedRental(rental));
  const totals = useMemo(() => ({
    count: activeRentals.length,
    billed: activeRentals.reduce((sum, rental) => sum + rentalTotal(rental), 0),
    paid: activeRentals.reduce((sum, rental) => sum + rental.paid, 0),
    remaining: activeRentals.reduce((sum, rental) => sum + Math.max(0, rentalTotal(rental) - rental.paid), 0),
    operating: activeRentals.reduce((sum, rental) => sum + rental.driver_cost, 0),
    knownProfit: activeRentals.reduce((sum, rental) => sum + (rentalNetProfit(rental) ?? 0), 0),
    missingCost: activeRentals.filter((rental) => rental.normal_rate === null).length,
  }), [activeRentals]);

  function setWeek(weekStart: string) {
    setStartDate(weekStart);
    setEndDate(shiftDate(weekStart, 6));
  }

  function exportCsv() {
    const headers = ["Tanggal mulai", "Tanggal selesai", "Kota", "Pelanggan", "WhatsApp", "Mobil", "Nomor polisi", "Layanan", "Tagihan", "Deposit", "Dibayar", "Sisa", "Biaya driver", "Keuntungan bersih (jika harga normal tersedia)", "Status booking", "Status pembayaran", "Catatan"];
    const rows = reportRentals.map((rental) => [
      rental.start_date, rental.end_date, rental.city, rental.customer_name, rental.whatsapp ?? "", rental.car_type, rental.plate_number, rental.service,
      rentalTotal(rental), rental.deposit, rental.paid, Math.max(0, rentalTotal(rental) - rental.paid), rental.driver_cost,
      rentalNetProfit(rental) ?? "Belum dihitung", rental.booking_status, rental.payment_status, rental.notes ?? "",
    ]);
    const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `laporan-rental-${startDate}-${endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (authenticated === false) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <section className="rounded-3xl border border-border bg-white p-8 text-center shadow-card">
          <h1 className="text-2xl font-bold">Login diperlukan</h1>
          <p className="mt-2 text-muted-foreground">Masuk ke aplikasi untuk membuka laporan rental.</p>
          <Link to="/" className="mt-5 inline-flex rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white">Kembali ke halaman masuk</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="weekly-report mx-auto max-w-[1600px] space-y-5 p-5 pb-12 lg:p-8">
      <style>{`@page { size: A4 landscape; margin: 12mm; } @media print { body { background: white !important; } .weekly-report { max-width: none !important; padding: 0 !important; } .no-print { display: none !important; } .weekly-report-card { border: 0 !important; box-shadow: none !important; padding: 0 !important; } .weekly-report-table { min-width: 0 !important; font-size: 8pt !important; } .weekly-report-table th, .weekly-report-table td { padding: 5px 4px !important; } thead { display: table-header-group; } tr { break-inside: avoid; } }`}</style>
      <header className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/" className="text-sm font-semibold text-muted-foreground hover:text-foreground">← Kembali ke aplikasi</Link>
          <h1 className="mt-2 text-3xl font-bold">Laporan Transaksi Rental Mingguan</h1>
          <p className="mt-1 text-sm text-muted-foreground">Transaksi dikelompokkan berdasarkan tanggal mulai rental. Invoice tidak diperlukan.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void loadRentals()} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold">Segarkan</button>
          <button type="button" disabled={!reportRentals.length} onClick={exportCsv} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold disabled:opacity-50">Ekspor CSV</button>
          <button type="button" disabled={!reportRentals.length} onClick={() => window.print()} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Cetak / Simpan PDF</button>
        </div>
      </header>

      <section className="weekly-report-card rounded-3xl border border-border bg-white p-5 shadow-card">
        <div className="mb-4 hidden print:block">
          <h1 className="text-2xl font-bold">Laporan Transaksi Rental Mingguan</h1>
          <p>Periode: {dateLabel(startDate)} – {dateLabel(endDate)} · Dasar laporan: tanggal mulai rental</p>
          {city !== "all" && <p>Kota: {city}</p>}
        </div>
        <div className="no-print mb-5 grid gap-4 md:grid-cols-[auto_1fr_1fr_1fr] md:items-end">
          <div className="flex gap-2">
            <button type="button" aria-label="Minggu sebelumnya" onClick={() => setWeek(shiftDate(startDate, -7))} className="rounded-xl border border-border px-4 py-2.5">←</button>
            <button type="button" onClick={() => setWeek(toISODate(startOfWeek(new Date())))} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold">Minggu ini</button>
            <button type="button" aria-label="Minggu berikutnya" onClick={() => setWeek(shiftDate(startDate, 7))} className="rounded-xl border border-border px-4 py-2.5">→</button>
          </div>
          <label className="space-y-2 text-sm"><span className="font-medium">Dari tanggal</span><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-2.5" /></label>
          <label className="space-y-2 text-sm"><span className="font-medium">Sampai tanggal</span><input type="date" min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-2.5" /></label>
          <label className="space-y-2 text-sm"><span className="font-medium">Kota</span><select value={city} onChange={(event) => setCity(event.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-2.5"><option value="all">Semua kota</option>{cities.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        </div>
        <div className="mb-5 text-sm text-muted-foreground">Periode: <strong className="text-foreground">{dateLabel(startDate)} – {dateLabel(endDate)}</strong> · {city === "all" ? "Semua kota" : city} · {reportRentals.length} transaksi{reportRentals.length !== 1 ? "" : ""}</div>
        {loading ? <p className="py-8 text-center text-muted-foreground">Memuat laporan...</p> : error ? <p role="alert" className="py-8 text-center text-red-700">{error}</p> : (
          <>
            <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {[["Transaksi aktif", String(totals.count)], ["Total tagihan", formatRupiah(totals.billed)], ["Pembayaran tercatat", formatRupiah(totals.paid)], ["Sisa tagihan", formatRupiah(totals.remaining)], ["Biaya driver", formatRupiah(totals.operating)]].map(([label, value]) => <div key={label} className="rounded-2xl bg-slate-50 p-4"><div className="text-sm text-muted-foreground">{label}</div><div className="mt-1 text-xl font-bold">{value}</div></div>)}
            </div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm">
              <p>Keuntungan tercatat (transaksi dengan harga normal): <strong>{formatRupiah(totals.knownProfit)}</strong></p>
              {totals.missingCost > 0 && <p className="text-amber-800">Harga normal belum diisi pada {totals.missingCost} transaksi; keuntungan belum mencakup transaksi tersebut.</p>}
            </div>
            <div className="overflow-x-auto">
              <table className="weekly-report-table w-full min-w-[1180px] border-collapse text-left text-xs sm:text-sm">
                <thead><tr className="border-y border-border bg-slate-50 text-muted-foreground"><th className="p-3">Tanggal rental</th><th className="p-3">Kota</th><th className="p-3">Pelanggan</th><th className="p-3">Kendaraan</th><th className="p-3">Tagihan</th><th className="p-3">Dibayar</th><th className="p-3">Sisa</th><th className="p-3">Status</th><th className="p-3">Catatan</th></tr></thead>
                <tbody>{reportRentals.map((rental) => {
                  const excluded = isExcludedRental(rental);
                  const total = rentalTotal(rental);
                  const days = Math.max(1, Math.round((new Date(`${rental.end_date}T12:00:00`).getTime() - new Date(`${rental.start_date}T12:00:00`).getTime()) / 86_400_000) + (rental.rental_mode === "Kalender" ? 1 : 0));
                  return <tr key={rental.id} className="border-b border-border align-top"><td className="p-3">{dateLabel(rental.start_date)}<div className="text-muted-foreground">s/d {dateLabel(rental.end_date)} · {days} hari</div></td><td className="p-3">{rental.city || "—"}</td><td className="p-3">{rental.customer_name}<div className="text-muted-foreground">{rental.whatsapp || ""}</div></td><td className="p-3">{rental.car_type}<div className="text-muted-foreground">{rental.plate_number} · {rental.service}</div></td><td className="p-3">{formatRupiah(total)}</td><td className="p-3">{formatRupiah(rental.paid)}</td><td className="p-3">{formatRupiah(Math.max(0, total - rental.paid))}</td><td className="p-3">{rental.booking_status}<div className="text-muted-foreground">{rental.payment_status}{excluded ? " · Dikecualikan dari ringkasan" : ""}</div></td><td className="max-w-48 whitespace-pre-wrap p-3">{rental.notes || "—"}</td></tr>;
                })}{reportRentals.length === 0 && <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Tidak ada transaksi rental yang mulai pada periode ini.</td></tr>}</tbody>
              </table>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">Laporan memakai tanggal mulai rental; rental lintas minggu hanya muncul pada minggu tanggal mulainya agar tidak terhitung ganda. Pembayaran adalah nominal kumulatif yang tercatat pada transaksi, bukan histori uang masuk berdasarkan tanggal.</p>
          </>
        )}
      </section>
    </main>
  );
}
