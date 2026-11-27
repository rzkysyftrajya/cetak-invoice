import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { listRentalBookings, getSettings, resolveBrandUrls, type RentalBooking } from "@/lib/api";
import { isExcludedRental, rentalDuration, rentalNetProfit, rentalNormalCost, rentalTotal } from "@/lib/fleet";
import { formatRupiah } from "@/lib/invoice";
import { supabase } from "@/integrations/supabase/client";
import { WeeklyRentalReportPdf, type WeeklyReportCompany } from "@/components/weekly-rental-report-pdf";

export const Route = createFileRoute("/weekly-report")({ component: WeeklyRentalReport });

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

function dateLabel(value: string, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", options).format(new Date(`${value}T12:00:00`));
}

function escapeCsv(value: unknown) {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

const defaultCompany: WeeklyReportCompany = { company_name: "PT VICKY RENTAL NUSANTARA", address: "", phone: "", email: "" };

function WeeklyRentalReport() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [rentals, setRentals] = useState<RentalBooking[]>([]);
  const [company, setCompany] = useState<WeeklyReportCompany>(defaultCompany);
  const [logo, setLogo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [startDate, setStartDate] = useState(() => toISODate(startOfWeek(new Date())));
  const [endDate, setEndDate] = useState(() => shiftDate(toISODate(startOfWeek(new Date())), 6));
  const [city, setCity] = useState("all");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextRentals, settings] = await Promise.all([listRentalBookings(), getSettings()]);
      setRentals(nextRentals);
      setCompany({ company_name: settings.company_name, address: settings.address, phone: settings.phone, email: settings.email });
      const assets = await resolveBrandUrls({ invoice_template: settings.invoice_template, logo_path: settings.logo_path, signature_path: settings.signature_path });
      setLogo(assets.logo);
    } catch {
      setError("Data laporan atau pengaturan perusahaan gagal dimuat. Silakan segarkan halaman atau masuk kembali.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError || !data.session) { setAuthenticated(false); setLoading(false); return; }
      setAuthenticated(true);
      void loadData();
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setAuthenticated(Boolean(session));
      if (session) void loadData();
      else { setRentals([]); setLoading(false); }
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [loadData]);

  const cities = useMemo(() => [...new Set(rentals.map((rental) => rental.city).filter(Boolean))].sort((a, b) => a.localeCompare(b, "id")), [rentals]);
  const reportRentals = useMemo(() => rentals.filter((rental) => rental.start_date >= startDate && rental.start_date <= endDate).filter((rental) => city === "all" || rental.city === city).sort((a, b) => a.start_date.localeCompare(b.start_date) || a.customer_name.localeCompare(b.customer_name, "id")), [rentals, startDate, endDate, city]);
  const activeRentals = useMemo(() => reportRentals.filter((rental) => !isExcludedRental(rental)), [reportRentals]);
  const totals = useMemo(() => ({
    count: activeRentals.length,
    billed: activeRentals.reduce((sum, rental) => sum + rentalTotal(rental), 0),
    normalCost: activeRentals.reduce((sum, rental) => sum + (rentalNormalCost(rental) ?? 0), 0),
    driverCost: activeRentals.reduce((sum, rental) => sum + rental.driver_cost, 0),
    netProfit: activeRentals.reduce((sum, rental) => sum + (rentalNetProfit(rental) ?? 0), 0),
    missingCost: activeRentals.filter((rental) => rental.normal_rate === null).length,
  }), [activeRentals]);

  function setWeek(weekStart: string) { setStartDate(weekStart); setEndDate(shiftDate(weekStart, 6)); }

  function exportCsv() {
    const headers = ["Tanggal mulai", "Tanggal selesai", "Pelanggan", "Kota", "Mobil", "Nomor polisi", "Layanan", "Pendapatan", "Harga normal", "Biaya driver", "Profit bersih", "Status rental"];
    const rows = reportRentals.map((rental) => [rental.start_date, rental.end_date, rental.customer_name, rental.city, rental.car_type, rental.plate_number, rental.service, rentalTotal(rental), rentalNormalCost(rental) ?? "Harga normal belum diisi", rental.driver_cost, isExcludedRental(rental) ? "Dikecualikan" : rentalNetProfit(rental) ?? "Belum dihitung", rental.booking_status]);
    const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `laporan-profit-rental-${startDate}-${endDate}.csv`; link.click(); URL.revokeObjectURL(url);
  }

  if (authenticated === false) return <main className="mx-auto max-w-2xl p-6"><section className="rounded-3xl border border-border bg-white p-8 text-center shadow-card"><h1 className="text-2xl font-bold">Login diperlukan</h1><p className="mt-2 text-muted-foreground">Masuk ke aplikasi untuk membuka laporan rental.</p><Link to="/" className="mt-5 inline-flex rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white">Kembali ke halaman masuk</Link></section></main>;

  return (
    <main className="weekly-report min-h-screen bg-[#f3f6fa] px-4 py-6 text-slate-900 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-[#102747] p-5 text-white shadow-lg sm:p-7">
          <div className="flex items-center gap-4">
            {logo ? <img src={logo} alt={`Logo ${company.company_name}`} className="h-16 w-16 rounded-2xl bg-white p-2 object-contain" /> : <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-2xl font-bold">VR</div>}
            <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">Laporan operasional</p><h1 className="mt-1 text-2xl font-bold sm:text-3xl">Profit Rental Mingguan</h1><p className="mt-1 text-sm text-blue-100">{company.company_name}</p></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/" className="rounded-xl border border-white/25 px-4 py-2.5 text-sm font-semibold text-white no-underline hover:bg-white/10">← Aplikasi</Link>
            <button type="button" onClick={() => void loadData()} className="rounded-xl border border-white/25 px-4 py-2.5 text-sm font-semibold hover:bg-white/10">Segarkan</button>
            <button type="button" disabled={!reportRentals.length || loading} onClick={exportCsv} className="rounded-xl border border-white/25 px-4 py-2.5 text-sm font-semibold disabled:opacity-50">Ekspor CSV</button>
            {!loading && !error && <WeeklyRentalReportPdf rentals={reportRentals} company={company} logo={logo} startDate={startDate} endDate={endDate} city={city} />}
          </div>
        </header>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Periode laporan</p><h2 className="mt-1 text-xl font-bold">{dateLabel(startDate)} – {dateLabel(endDate)}</h2><p className="mt-1 text-sm text-slate-500">Rental dikelompokkan berdasarkan tanggal mulai.</p></div>
            <div className="flex gap-2"><button type="button" aria-label="Minggu sebelumnya" onClick={() => setWeek(shiftDate(startDate, -7))} className="rounded-xl border border-slate-200 px-4 py-2.5 font-semibold hover:bg-slate-50">←</button><button type="button" onClick={() => setWeek(toISODate(startOfWeek(new Date())))} className="rounded-xl bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-800 hover:bg-blue-100">Minggu ini</button><button type="button" aria-label="Minggu berikutnya" onClick={() => setWeek(shiftDate(startDate, 7))} className="rounded-xl border border-slate-200 px-4 py-2.5 font-semibold hover:bg-slate-50">→</button></div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="space-y-1.5 text-sm"><span className="font-semibold text-slate-700">Dari tanggal</span><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5" /></label>
            <label className="space-y-1.5 text-sm"><span className="font-semibold text-slate-700">Sampai tanggal</span><input type="date" min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5" /></label>
            <label className="space-y-1.5 text-sm"><span className="font-semibold text-slate-700">Kota tujuan</span><select value={city} onChange={(event) => setCity(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"><option value="all">Semua kota</option>{cities.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          </div>
        </section>

        {loading ? <section className="rounded-3xl bg-white p-10 text-center text-slate-500 shadow-sm">Memuat laporan...</section> : error ? <section role="alert" className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-800">{error}</section> : <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {[["Transaksi aktif", String(totals.count)], ["Pendapatan", formatRupiah(totals.billed)], ["Harga normal", formatRupiah(totals.normalCost)], ["Operasional driver", formatRupiah(totals.driverCost)]].map(([label, value]) => <article key={label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">{label}</p><p className="mt-2 break-words text-2xl font-bold tracking-tight text-slate-900">{value}</p></article>)}
            <article className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm"><p className="text-sm font-semibold text-emerald-800">Profit bersih tercatat</p><p className="mt-2 break-words text-2xl font-bold tracking-tight text-emerald-950">{formatRupiah(totals.netProfit)}</p></article>
          </section>
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Rincian</p><h2 className="mt-1 text-xl font-bold">Profit per transaksi</h2></div><div className="text-sm text-slate-500">{reportRentals.length} transaksi · {city === "all" ? "Semua kota" : city}</div></div>
            {totals.missingCost > 0 && <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Harga normal belum diisi pada {totals.missingCost} transaksi aktif. Profit bersih belum mencakup transaksi tersebut.</p>}
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full min-w-[1050px] border-collapse text-left text-sm">
                <thead className="bg-[#102747] text-xs uppercase tracking-wide text-white"><tr><th className="px-4 py-3">Periode rental</th><th className="px-4 py-3">Pelanggan</th><th className="px-4 py-3">Mobil / plat</th><th className="px-4 py-3">Kota</th><th className="px-4 py-3 text-right">Pendapatan</th><th className="px-4 py-3 text-right">Harga normal</th><th className="px-4 py-3 text-right">Biaya driver</th><th className="px-4 py-3 text-right">Profit bersih</th></tr></thead>
                <tbody>{reportRentals.map((rental, index) => {
                  const excluded = isExcludedRental(rental);
                  const profit = rentalNetProfit(rental);
                  const days = rentalDuration(rental.start_date, rental.end_date, rental.rental_mode, rental.start_time, rental.end_time);
                  return <tr key={rental.id} className={`border-t border-slate-100 align-top ${index % 2 ? "bg-slate-50/70" : "bg-white"}`}><td className="whitespace-nowrap px-4 py-3"><div className="font-semibold">{dateLabel(rental.start_date, { day: "numeric", month: "short" })} – {dateLabel(rental.end_date, { day: "numeric", month: "short", year: "numeric" })}</div><div className="mt-1 text-xs text-slate-500">{days} hari</div></td><td className="px-4 py-3 font-semibold">{rental.customer_name}</td><td className="px-4 py-3"><div className="font-semibold">{rental.car_type}</div><div className="mt-1 text-xs text-slate-500">{rental.plate_number} · {rental.service}</div></td><td className="px-4 py-3">{rental.city || "—"}</td><td className="whitespace-nowrap px-4 py-3 text-right">{formatRupiah(rentalTotal(rental))}</td><td className="whitespace-nowrap px-4 py-3 text-right">{rentalNormalCost(rental) === null ? <span className="text-amber-700">Belum diisi</span> : formatRupiah(rentalNormalCost(rental) ?? 0)}</td><td className="whitespace-nowrap px-4 py-3 text-right">{formatRupiah(rental.driver_cost)}</td><td className="whitespace-nowrap px-4 py-3 text-right font-bold text-emerald-800">{excluded ? "—" : profit === null ? "Belum dihitung" : formatRupiah(profit)}</td></tr>;
                })}{reportRentals.length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center"><div className="text-base font-semibold text-slate-700">Belum ada transaksi pada periode ini</div><p className="mt-1 text-sm text-slate-500">Coba pilih rentang tanggal lain atau semua kota.</p></td></tr>}</tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4"><span className="text-sm font-semibold text-slate-600">Rumus: pendapatan − harga normal − biaya driver</span><span className="text-base font-bold text-emerald-800">Profit bersih: {formatRupiah(totals.netProfit)}</span></div>
          </section>
        </>}
        <footer className="px-2 pb-3 text-center text-xs text-slate-400">{company.company_name} · Laporan operasional internal</footer>
      </div>
      <style>{`@page { size: A4 landscape; margin: 8mm; } @media print { body { background:#fff !important; } .weekly-report { background:#fff !important; padding:0 !important; } .weekly-report > div { max-width:none !important; } .weekly-report button,.weekly-report a { display:none !important; } }`}</style>
    </main>
  );
}
