import { Document, Image, Page, PDFDownloadLink, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { RentalBooking } from "@/lib/api";
import { isExcludedRental, rentalDuration, rentalNetProfit, rentalNormalCost, rentalTotal } from "@/lib/fleet";
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
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

const styles = StyleSheet.create({
  page: { paddingTop: 24, paddingHorizontal: 28, paddingBottom: 30, fontFamily: "Helvetica", color: "#172033", fontSize: 8 },
  header: { flexDirection: "row", alignItems: "center", borderBottomWidth: 2, borderBottomColor: "#0f2747", paddingBottom: 8, marginBottom: 9 },
  logo: { width: 46, height: 46, objectFit: "contain", marginRight: 10 },
  companyBlock: { flexGrow: 1 },
  companyName: { fontSize: 13, fontFamily: "Helvetica-Bold", color: "#0f2747", marginBottom: 3 },
  companyDetail: { fontSize: 7, color: "#536176", marginBottom: 1 },
  reportTag: { backgroundColor: "#edf3f9", borderRadius: 4, paddingVertical: 6, paddingHorizontal: 9, textAlign: "right" },
  reportTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#0f2747", marginBottom: 3 },
  reportPeriod: { fontSize: 7, color: "#536176", marginBottom: 2 },
  summary: { flexDirection: "row", marginBottom: 9, borderWidth: 1, borderColor: "#dce3eb", borderRadius: 4, overflow: "hidden" },
  summaryCell: { flexGrow: 1, paddingVertical: 6, paddingHorizontal: 8, borderRightWidth: 1, borderRightColor: "#dce3eb" },
  profitCell: { flexGrow: 1.25, paddingVertical: 6, paddingHorizontal: 8, backgroundColor: "#e8f5ee" },
  summaryLabel: { fontSize: 6.5, color: "#687589", marginBottom: 3 },
  summaryValue: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#132a49" },
  profitValue: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#087443" },
  sectionLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#0f2747", marginBottom: 4 },
  table: { width: "100%", borderWidth: 1, borderColor: "#dce3eb" },
  tableHeader: { flexDirection: "row", backgroundColor: "#0f2747", minHeight: 21, alignItems: "center" },
  row: { flexDirection: "row", minHeight: 24, borderBottomWidth: 1, borderBottomColor: "#e4e9ef", alignItems: "center" },
  alternate: { backgroundColor: "#f6f8fb" },
  cell: { paddingHorizontal: 4, paddingVertical: 3, fontSize: 6.5, color: "#263449" },
  headCell: { paddingHorizontal: 4, paddingVertical: 5, fontSize: 6.1, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  date: { width: "13%" }, customer: { width: "20%" }, city: { width: "10%" }, vehicle: { width: "14%" }, money: { width: "12%", textAlign: "right" }, profit: { width: "13%", textAlign: "right", fontFamily: "Helvetica-Bold", color: "#087443" },
  subText: { marginTop: 1, fontSize: 5.7, color: "#687589" },
  empty: { padding: 14, textAlign: "center", color: "#687589", fontSize: 7 },
  note: { marginTop: 5, fontSize: 6, color: "#687589" },
  footer: { position: "absolute", left: 28, right: 28, bottom: 13, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "#dce3eb", paddingTop: 4, color: "#687589", fontSize: 6 },
});

function WeeklyReportDocument({ rentals, company, logo, startDate, endDate, city }: WeeklyRentalReportPdfProps) {
  const active = rentals.filter((rental) => !isExcludedRental(rental));
  const billed = active.reduce((sum, rental) => sum + rentalTotal(rental), 0);
  const normalCost = active.reduce((sum, rental) => sum + (rentalNormalCost(rental) ?? 0), 0);
  const driverCost = active.reduce((sum, rental) => sum + rental.driver_cost, 0);
  const netProfit = active.reduce((sum, rental) => sum + (rentalNetProfit(rental) ?? 0), 0);
  const missingNormalRate = active.filter((rental) => rental.normal_rate === null).length;

  return (
    <Document title={`Laporan Profit Rental ${startDate} - ${endDate}`} author={company.company_name}>
      <Page size="A4" orientation="landscape" style={styles.page} wrap>
        <View style={styles.header} fixed>
          {logo ? <Image src={logo} style={styles.logo} /> : null}
          <View style={styles.companyBlock}>
            <Text style={styles.companyName}>{company.company_name}</Text>
            <Text style={styles.companyDetail}>{company.address}</Text>
            <Text style={styles.companyDetail}>{[company.phone, company.email].filter(Boolean).join("  •  ")}</Text>
          </View>
          <View style={styles.reportTag}>
            <Text style={styles.reportTitle}>LAPORAN PROFIT RENTAL</Text>
            <Text style={styles.reportPeriod}>{dateLabel(startDate)} — {dateLabel(endDate)}</Text>
            <Text style={styles.reportPeriod}>{city === "all" ? "Semua kota" : city}</Text>
          </View>
        </View>

        <View style={styles.summary}>
          <View style={styles.summaryCell}><Text style={styles.summaryLabel}>TRANSAKSI AKTIF</Text><Text style={styles.summaryValue}>{active.length}</Text></View>
          <View style={styles.summaryCell}><Text style={styles.summaryLabel}>PENDAPATAN</Text><Text style={styles.summaryValue}>{formatRupiah(billed)}</Text></View>
          <View style={styles.summaryCell}><Text style={styles.summaryLabel}>HARGA NORMAL</Text><Text style={styles.summaryValue}>{formatRupiah(normalCost)}</Text></View>
          <View style={styles.summaryCell}><Text style={styles.summaryLabel}>OPERASIONAL DRIVER</Text><Text style={styles.summaryValue}>{formatRupiah(driverCost)}</Text></View>
          <View style={styles.profitCell}><Text style={styles.summaryLabel}>PROFIT BERSIH TERCATAT</Text><Text style={styles.profitValue}>{formatRupiah(netProfit)}</Text></View>
        </View>

        <Text style={styles.sectionLabel}>Rincian profit per transaksi</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader} fixed>
            <Text style={[styles.headCell, styles.date]}>PERIODE RENTAL</Text>
            <Text style={[styles.headCell, styles.customer]}>PELANGGAN</Text>
            <Text style={[styles.headCell, styles.city]}>KOTA</Text>
            <Text style={[styles.headCell, styles.vehicle]}>KENDARAAN / LAYANAN</Text>
            <Text style={[styles.headCell, styles.money]}>PENDAPATAN</Text>
            <Text style={[styles.headCell, styles.money]}>HARGA NORMAL</Text>
            <Text style={[styles.headCell, styles.money]}>BIAYA DRIVER</Text>
            <Text style={[styles.headCell, styles.profit]}>PROFIT BERSIH</Text>
          </View>
          {rentals.map((rental, index) => {
            const excluded = isExcludedRental(rental);
            const normal = rentalNormalCost(rental);
            const profit = rentalNetProfit(rental);
            const days = rentalDuration(rental.start_date, rental.end_date, rental.rental_mode, rental.start_time, rental.end_time);
            return (
              <View key={rental.id} style={[styles.row, index % 2 ? styles.alternate : {}]} wrap={false}>
                <View style={[styles.cell, styles.date]}><Text>{dateLabel(rental.start_date)}</Text><Text style={styles.subText}>s/d {dateLabel(rental.end_date)} · {days} hari</Text></View>
                <View style={[styles.cell, styles.customer]}><Text>{rental.customer_name}</Text><Text style={styles.subText}>{rental.booking_status}{excluded ? " · Dikecualikan" : ""}</Text></View>
                <Text style={[styles.cell, styles.city]}>{rental.city || "—"}</Text>
                <View style={[styles.cell, styles.vehicle]}><Text>{rental.car_type} · {rental.plate_number}</Text><Text style={styles.subText}>{rental.service}</Text></View>
                <Text style={[styles.cell, styles.money]}>{formatRupiah(rentalTotal(rental))}</Text>
                <Text style={[styles.cell, styles.money]}>{normal === null ? "Belum diisi" : formatRupiah(normal)}</Text>
                <Text style={[styles.cell, styles.money]}>{formatRupiah(rental.driver_cost)}</Text>
                <Text style={[styles.cell, styles.profit]}>{excluded ? "—" : profit === null ? "Belum dihitung" : formatRupiah(profit)}</Text>
              </View>
            );
          })}
          {rentals.length === 0 ? <Text style={styles.empty}>Tidak ada transaksi yang mulai pada periode ini.</Text> : null}
        </View>
        <Text style={styles.note}>Profit bersih = pendapatan − harga normal − biaya operasional driver. Transaksi tanpa harga normal tidak dihitung dalam profit; transaksi batal/no-show tetap terlihat tetapi dikecualikan dari ringkasan.</Text>
        {missingNormalRate > 0 ? <Text style={styles.note}>Perhatian: {missingNormalRate} transaksi aktif belum memiliki harga normal, sehingga profit bersih belum mencakup transaksi tersebut.</Text> : null}
        <View style={styles.footer} fixed><Text>{company.company_name} · Laporan internal</Text><Text render={({ pageNumber, totalPages }) => `Halaman ${pageNumber} dari ${totalPages}`} /></View>
      </Page>
    </Document>
  );
}

export function WeeklyRentalReportPdf(props: WeeklyRentalReportPdfProps) {
  const fileName = `Laporan-Profit-Rental-${props.startDate}-${props.endDate}.pdf`;
  return <PDFDownloadLink document={<WeeklyReportDocument {...props} />} fileName={fileName} className="inline-flex rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white no-underline disabled:opacity-50">{({ loading, error }) => error ? "PDF gagal dibuat — coba lagi" : loading ? "Menyiapkan PDF…" : "Unduh PDF"}</PDFDownloadLink>;
}
