import { Document, Image, Page, PDFDownloadLink, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { RentalBooking } from "@/lib/api";
import { isExcludedRental, rentalDuration, rentalNetProfit, rentalTotal } from "@/lib/fleet";
import { formatRupiah } from "@/lib/invoice";

export type WeeklyReportCompany = {
  company_name: string;
  address: string;
  phone: string;
  email: string;
};

type WeeklyRentalReportPdfProps = {
  rentals: RentalBooking[];
  company: WeeklyReportCompany;
  logo: string | null;
  startDate: string;
  endDate: string;
  city: string;
};

function dateLabel(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

const styles = StyleSheet.create({
  page: { paddingTop: 32, paddingHorizontal: 34, paddingBottom: 38, fontFamily: "Helvetica", color: "#172033", fontSize: 8 },
  header: { flexDirection: "row", alignItems: "center", borderBottomWidth: 2, borderBottomColor: "#0f2747", paddingBottom: 12, marginBottom: 14 },
  logo: { width: 58, height: 58, objectFit: "contain", marginRight: 13 },
  companyBlock: { flexGrow: 1 },
  companyName: { fontSize: 15, fontFamily: "Helvetica-Bold", color: "#0f2747", marginBottom: 4 },
  companyDetail: { fontSize: 7.5, color: "#536176", marginBottom: 2 },
  reportTag: { backgroundColor: "#edf3f9", borderRadius: 4, paddingVertical: 8, paddingHorizontal: 10, textAlign: "right" },
  reportTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#0f2747", marginBottom: 4 },
  reportPeriod: { fontSize: 8, color: "#536176" },
  summary: { flexDirection: "row", marginBottom: 13, borderWidth: 1, borderColor: "#dce3eb", borderRadius: 5, overflow: "hidden" },
  summaryCell: { flexGrow: 1, paddingVertical: 8, paddingHorizontal: 9, borderRightWidth: 1, borderRightColor: "#dce3eb" },
  summaryLabel: { fontSize: 7, color: "#687589", marginBottom: 4 },
  summaryValue: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#132a49" },
  sectionLabel: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#0f2747", marginBottom: 6 },
  table: { width: "100%", borderWidth: 1, borderColor: "#dce3eb" },
  tableHeader: { flexDirection: "row", backgroundColor: "#0f2747", color: "#ffffff", minHeight: 25, alignItems: "center" },
  row: { flexDirection: "row", minHeight: 31, borderBottomWidth: 1, borderBottomColor: "#e4e9ef", alignItems: "center" },
  alternate: { backgroundColor: "#f6f8fb" },
  cell: { paddingHorizontal: 5, paddingVertical: 5, fontSize: 7, color: "#263449" },
  headCell: { paddingHorizontal: 5, paddingVertical: 6, fontSize: 6.7, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  date: { width: "13%" }, city: { width: "9%" }, customer: { width: "16%" }, vehicle: { width: "15%" }, money: { width: "11%", textAlign: "right" }, status: { width: "9%" }, notes: { width: "10%" },
  subText: { marginTop: 2, fontSize: 6, color: "#687589" },
  empty: { padding: 18, textAlign: "center", color: "#687589", fontSize: 8 },
  note: { marginTop: 8, fontSize: 6.5, lineHeight: 1.35, color: "#687589" },
  footer: { position: "absolute", left: 34, right: 34, bottom: 17, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "#dce3eb", paddingTop: 6, color: "#687589", fontSize: 6.5 },
});

function WeeklyReportDocument({ rentals, company, logo, startDate, endDate, city }: WeeklyRentalReportPdfProps) {
  const active = rentals.filter((rental) => !isExcludedRental(rental));
  const billed = active.reduce((sum, rental) => sum + rentalTotal(rental), 0);
  const paid = active.reduce((sum, rental) => sum + rental.paid, 0);
  const remaining = active.reduce((sum, rental) => sum + Math.max(0, rentalTotal(rental) - rental.paid), 0);
  const costs = active.reduce((sum, rental) => sum + rental.driver_cost, 0);
  const profits = active.reduce((sum, rental) => sum + (rentalNetProfit(rental) ?? 0), 0);
  const missingNormalRate = active.filter((rental) => rental.normal_rate === null).length;

  return (
    <Document title={`Laporan Rental ${startDate} - ${endDate}`} author={company.company_name}>
      <Page size="A4" orientation="landscape" style={styles.page} wrap>
        <View style={styles.header} fixed>
          {logo ? <Image src={logo} style={styles.logo} /> : null}
          <View style={styles.companyBlock}>
            <Text style={styles.companyName}>{company.company_name}</Text>
            <Text style={styles.companyDetail}>{company.address}</Text>
            <Text style={styles.companyDetail}>{[company.phone, company.email].filter(Boolean).join("  •  ")}</Text>
          </View>
          <View style={styles.reportTag}>
            <Text style={styles.reportTitle}>LAPORAN TRANSAKSI RENTAL</Text>
            <Text style={styles.reportPeriod}>{dateLabel(startDate)} — {dateLabel(endDate)}</Text>
            <Text style={styles.reportPeriod}>{city === "all" ? "Semua kota" : city} · Berdasarkan tanggal mulai rental</Text>
          </View>
        </View>

        <View style={styles.summary}>
          {[
            ["TRANSAKSI AKTIF", String(active.length)],
            ["TOTAL TAGIHAN", formatRupiah(billed)],
            ["PEMBAYARAN TERCATAT", formatRupiah(paid)],
            ["SISA TAGIHAN", formatRupiah(remaining)],
            ["BIAYA DRIVER", formatRupiah(costs)],
            ["LABA TERCATAT", formatRupiah(profits)],
          ].map(([label, value], index) => (
            <View key={label} style={[styles.summaryCell, index === 5 ? { borderRightWidth: 0 } : {}]}>
              <Text style={styles.summaryLabel}>{label}</Text>
              <Text style={styles.summaryValue}>{value}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Rincian transaksi ({rentals.length})</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader} fixed>
            <Text style={[styles.headCell, styles.date]}>PERIODE RENTAL</Text>
            <Text style={[styles.headCell, styles.city]}>KOTA</Text>
            <Text style={[styles.headCell, styles.customer]}>PELANGGAN</Text>
            <Text style={[styles.headCell, styles.vehicle]}>KENDARAAN / LAYANAN</Text>
            <Text style={[styles.headCell, styles.money]}>TAGIHAN</Text>
            <Text style={[styles.headCell, styles.money]}>DIBAYAR</Text>
            <Text style={[styles.headCell, styles.money]}>SISA</Text>
            <Text style={[styles.headCell, styles.status]}>STATUS</Text>
            <Text style={[styles.headCell, styles.notes]}>CATATAN</Text>
          </View>
          {rentals.map((rental, index) => {
            const total = rentalTotal(rental);
            const days = rentalDuration(rental.start_date, rental.end_date, rental.rental_mode, rental.start_time, rental.end_time);
            const excluded = isExcludedRental(rental);
            return (
              <View key={rental.id} style={[styles.row, index % 2 ? styles.alternate : {}]} wrap={false}>
                <View style={[styles.cell, styles.date]}>
                  <Text>{dateLabel(rental.start_date)}</Text>
                  <Text style={styles.subText}>s/d {dateLabel(rental.end_date)} · {days} hari</Text>
                </View>
                <Text style={[styles.cell, styles.city]}>{rental.city || "—"}</Text>
                <View style={[styles.cell, styles.customer]}>
                  <Text>{rental.customer_name}</Text>
                  {rental.whatsapp ? <Text style={styles.subText}>{rental.whatsapp}</Text> : null}
                </View>
                <View style={[styles.cell, styles.vehicle]}>
                  <Text>{rental.car_type} · {rental.plate_number}</Text>
                  <Text style={styles.subText}>{rental.service}{rental.route ? ` · ${rental.route}` : ""}</Text>
                </View>
                <Text style={[styles.cell, styles.money]}>{formatRupiah(total)}</Text>
                <Text style={[styles.cell, styles.money]}>{formatRupiah(rental.paid)}</Text>
                <Text style={[styles.cell, styles.money]}>{formatRupiah(Math.max(0, total - rental.paid))}</Text>
                <View style={[styles.cell, styles.status]}>
                  <Text>{rental.booking_status}</Text>
                  <Text style={styles.subText}>{rental.payment_status}{excluded ? " · Dikecualikan" : ""}</Text>
                </View>
                <Text style={[styles.cell, styles.notes]}>{rental.notes || "—"}</Text>
              </View>
            );
          })}
          {rentals.length === 0 ? <Text style={styles.empty}>Tidak ada transaksi yang mulai pada periode ini.</Text> : null}
        </View>
        <Text style={styles.note}>
          Laporan mengelompokkan transaksi berdasarkan tanggal mulai rental. Pembayaran adalah nominal kumulatif yang tersimpan pada catatan rental, bukan rincian tanggal penerimaan. Laba belum mencakup {missingNormalRate} transaksi yang belum memiliki harga normal dan biaya selain operasional driver.
        </Text>
        <View style={styles.footer} fixed>
          <Text>{company.company_name} · Dokumen laporan internal</Text>
          <Text render={({ pageNumber, totalPages }) => `Halaman ${pageNumber} dari ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export function WeeklyRentalReportPdf(props: WeeklyRentalReportPdfProps) {
  const fileName = `Laporan-Rental-${props.startDate}-${props.endDate}.pdf`;
  return (
    <PDFDownloadLink
      document={<WeeklyReportDocument {...props} />}
      fileName={fileName}
      className="inline-flex rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white no-underline disabled:opacity-50"
    >
      {({ loading, error }) => (error ? "PDF gagal dibuat — coba lagi" : loading ? "Menyiapkan PDF…" : "Unduh PDF")}
    </PDFDownloadLink>
  );
}
