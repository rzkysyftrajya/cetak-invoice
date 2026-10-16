import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import {
  formatDateID,
  formatDateRangeID,
  formatRupiah,
  grandTotal,
  lineTotal,
  type CompanySettings,
  type InvoiceInput,
} from "../lib/invoice";

type TemplateProps = {
  invoice: InvoiceInput;
  company: CompanySettings;
  logo: string | null;
  signature: string | null;
};

function serviceDescription(
  carType: string,
  plateNumber: string,
  serviceType: string,
  route: string,
  serviceDate: string,
  days: number,
) {
  return [
    serviceType || "Layanan rental",
    [carType, plateNumber].filter(Boolean).join(" "),
    formatDateRangeID(serviceDate, days),
    route,
  ]
    .filter(Boolean)
    .join(" · ");
}

function InvoicePDF({ invoice, company, logo, signature }: TemplateProps) {
  if (company.invoice_template === "boy")
    return <BoyInvoicePDF invoice={invoice} company={company} logo={logo} signature={signature} />;
  return <TomsInvoicePDF invoice={invoice} company={company} logo={logo} signature={signature} />;
}

function BoyInvoicePDF({ invoice, company, logo, signature }: TemplateProps) {
  const charges = invoice.additional_charges ?? [];
  const subtotal = grandTotal(invoice.items, charges);
  const itemsTotal = grandTotal(invoice.items);

  return (
    <Document>
      <Page size="A4" style={boyPdf.page}>
        <View style={boyPdf.header}>
          <View style={boyPdf.company}>
            <Text style={boyPdf.title}>FAKTUR</Text>
            <Text style={boyPdf.companyName}>{company.company_name}</Text>
            <Text style={boyPdf.companyInfo}>{company.address}</Text>
            <Text style={boyPdf.companyInfo}>ID</Text>
            <Text style={boyPdf.companyInfo}>{company.phone}</Text>
            <Text style={boyPdf.companyInfo}>{company.email}</Text>
          </View>
          {logo ? <Image src={logo} style={boyPdf.logo} /> : null}
        </View>

        <View style={boyPdf.recipient}>
          <View style={boyPdf.recipientClient}>
            <Text style={boyPdf.smallLabel}>DITAGIH KEPADA</Text>
            <Text style={boyPdf.clientName}>{invoice.client_name}</Text>
            {invoice.pic_name ? <Text style={boyPdf.clientDetail}>{invoice.pic_name}</Text> : null}
            {invoice.client_address ? (
              <Text style={boyPdf.clientDetail}>{invoice.client_address}</Text>
            ) : null}
          </View>
          <View style={boyPdf.recipientMeta}>
            <Text style={boyPdf.metaLabel}>NO. FAKTUR</Text>
            <Text style={boyPdf.metaValue}>{invoice.invoice_number}</Text>
            <Text style={boyPdf.metaLabel}>DITERBITKAN</Text>
            <Text style={boyPdf.metaValue}>{formatDateID(invoice.invoice_date)}</Text>
          </View>
        </View>

        <View style={boyPdf.table}>
          <View style={boyPdf.tableHeader}>
            <Text style={[boyPdf.cell, boyPdf.description]}>KETERANGAN</Text>
            <Text style={[boyPdf.cell, boyPdf.price]}>HARGA</Text>
            <Text style={[boyPdf.cell, boyPdf.quantity]}>KUANTITAS</Text>
            <Text style={[boyPdf.cell, boyPdf.amount]}>JUMLAH</Text>
          </View>
          {invoice.items.map((item, index) => (
            <View key={item.key || `boy-item-${index}`} style={boyPdf.tableRow}>
              <Text style={[boyPdf.cell, boyPdf.description]}>
                {serviceDescription(
                  item.car_type,
                  item.plate_number,
                  item.service_type,
                  item.route,
                  item.service_date,
                  item.days,
                )}
              </Text>
              <Text style={[boyPdf.cell, boyPdf.price]}>{formatRupiah(item.price_per_day)}</Text>
              <Text style={[boyPdf.cell, boyPdf.quantity]}>{item.days}</Text>
              <Text style={[boyPdf.cell, boyPdf.amount]}>
                {formatRupiah(lineTotal(item.days, item.price_per_day))}
              </Text>
            </View>
          ))}
          {charges.map((charge, index) => (
            <View key={charge.key || `boy-charge-${index}`} style={boyPdf.tableRow}>
              <Text style={[boyPdf.cell, boyPdf.description]}>{charge.description}</Text>
              <Text style={[boyPdf.cell, boyPdf.price]}>{formatRupiah(charge.amount)}</Text>
              <Text style={[boyPdf.cell, boyPdf.quantity]}>1</Text>
              <Text style={[boyPdf.cell, boyPdf.amount]}>{formatRupiah(charge.amount)}</Text>
            </View>
          ))}
        </View>

        <View style={boyPdf.totals}>
          {charges.length > 0 ? (
            <>
              <View style={boyPdf.totalLine}>
                <Text>Subtotal</Text>
                <Text>{formatRupiah(itemsTotal)}</Text>
              </View>
              <View style={boyPdf.totalLine}>
                <Text>Biaya tambahan</Text>
                <Text>{formatRupiah(subtotal - itemsTotal)}</Text>
              </View>
            </>
          ) : null}
          <View style={boyPdf.grandTotal}>
            <Text>Total</Text>
            <Text>{formatRupiah(subtotal)}</Text>
          </View>
        </View>

        {invoice.notes ? <Text style={boyPdf.notes}>{invoice.notes}</Text> : null}

        <View style={boyPdf.footer}>
          <View style={boyPdf.bank}>
            <Text style={boyPdf.bankHeading}>Instruksi Pembayaran</Text>
            {company.bank_accounts.map((account) => (
              <Text key={`${account.bank}-${account.number}`} style={boyPdf.bankLine}>
                {account.bank} · {account.name} · {account.number}
              </Text>
            ))}
          </View>
          <View style={boyPdf.sign}>
            <Text>Hormat Kami,</Text>
            {signature ? (
              <Image src={signature} style={boyPdf.signature} />
            ) : (
              <View style={boyPdf.signSpace} />
            )}
            <Text style={boyPdf.signer}>{company.signer_name}</Text>
            <Text>{company.signer_title}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

function TomsInvoicePDF({ invoice, company, logo, signature }: TemplateProps) {
  const charges = invoice.additional_charges ?? [];
  const total = grandTotal(invoice.items, charges);

  return (
    <Document>
      <Page size="A4" style={tomsPdf.page}>
        {logo ? <Image src={logo} style={tomsPdf.watermark} /> : null}
        <View style={tomsPdf.header}>
          {logo ? (
            <Image src={logo} style={tomsPdf.logo} />
          ) : (
            <View style={tomsPdf.logoPlaceholder} />
          )}
          <View style={tomsPdf.company}>
            <Text style={tomsPdf.companyName}>{company.company_name}</Text>
            <Text style={tomsPdf.companyInfo}>{company.address}</Text>
            <Text style={tomsPdf.companyInfo}>Phone: {company.phone}</Text>
            <Text style={tomsPdf.companyInfo}>{company.email}</Text>
          </View>
          <Text style={tomsPdf.invoiceStamp}>INVOICE</Text>
        </View>

        <View style={tomsPdf.recipient}>
          <Text style={tomsPdf.recipientLabel}>kepada Yth.:</Text>
          <Text style={tomsPdf.recipientName}>{invoice.client_name}</Text>
          {invoice.pic_name ? (
            <Text style={tomsPdf.recipientDetail}>{invoice.pic_name}</Text>
          ) : null}
          {invoice.client_address ? (
            <Text style={tomsPdf.recipientDetail}>{invoice.client_address}</Text>
          ) : null}
        </View>
        <View style={tomsPdf.meta}>
          <Text>No Invoice : {invoice.invoice_number}</Text>
          <Text>
            Tanggal Invoice : {invoice.city}, {formatDateID(invoice.invoice_date)}
          </Text>
        </View>

        <View style={tomsPdf.table}>
          <View style={tomsPdf.tableHeader}>
            <Text style={[tomsPdf.cell, tomsPdf.no]}>No</Text>
            <Text style={[tomsPdf.cell, tomsPdf.description]}>Keterangan</Text>
            <Text style={[tomsPdf.cell, tomsPdf.price]}>Harga Perhari</Text>
            <Text style={[tomsPdf.cell, tomsPdf.units]}>Unit</Text>
            <Text style={[tomsPdf.cell, tomsPdf.amount]}>Harga</Text>
          </View>
          {invoice.items.map((item, index) => (
            <View key={item.key || `toms-item-${index}`} style={tomsPdf.tableRow}>
              <Text style={[tomsPdf.cell, tomsPdf.no]}>{index + 1}</Text>
              <Text style={[tomsPdf.cell, tomsPdf.description]}>
                {serviceDescription(
                  item.car_type,
                  item.plate_number,
                  item.service_type,
                  item.route,
                  item.service_date,
                  item.days,
                )}
              </Text>
              <Text style={[tomsPdf.cell, tomsPdf.price]}>{formatRupiah(item.price_per_day)}</Text>
              <Text style={[tomsPdf.cell, tomsPdf.units]}>{item.days}</Text>
              <Text style={[tomsPdf.cell, tomsPdf.amount]}>
                {formatRupiah(lineTotal(item.days, item.price_per_day))}
              </Text>
            </View>
          ))}
          {charges.map((charge, index) => (
            <View key={charge.key || `toms-charge-${index}`} style={tomsPdf.tableRow}>
              <Text style={[tomsPdf.cell, tomsPdf.no]}>{invoice.items.length + index + 1}</Text>
              <Text style={[tomsPdf.cell, tomsPdf.description]}>{charge.description}</Text>
              <Text style={[tomsPdf.cell, tomsPdf.price]}>-</Text>
              <Text style={[tomsPdf.cell, tomsPdf.units]}>1</Text>
              <Text style={[tomsPdf.cell, tomsPdf.amount]}>{formatRupiah(charge.amount)}</Text>
            </View>
          ))}
          <View style={tomsPdf.totalRow}>
            <Text style={tomsPdf.totalLabel}>Total Harga :</Text>
            <Text style={tomsPdf.totalAmount}>{formatRupiah(total)}</Text>
          </View>
        </View>

        {invoice.notes ? <Text style={tomsPdf.notes}>{invoice.notes}</Text> : null}

        <View style={tomsPdf.footer}>
          <View style={tomsPdf.bank}>
            <Text style={tomsPdf.bankHeading}>BANK TRANSFER :</Text>
            {company.bank_accounts.map((account) => (
              <Text key={`${account.bank}-${account.number}`} style={tomsPdf.bankLine}>
                {account.bank} · A/C Name: {account.name} · A/C No: {account.number}
              </Text>
            ))}
          </View>
          <View style={tomsPdf.sign}>
            <Text>Hormat Kami</Text>
            <Text style={tomsPdf.signCompany}>{company.company_name}</Text>
            {signature ? (
              <Image src={signature} style={tomsPdf.signature} />
            ) : (
              <View style={tomsPdf.signSpace} />
            )}
            <Text style={tomsPdf.signer}>{company.signer_name}</Text>
            <Text>{company.signer_title}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export function InvoiceTemplatePDF(props: TemplateProps) {
  return <InvoicePDF {...props} />;
}

export function InvoiceTemplatePreview({ invoice, company, logo, signature }: TemplateProps) {
  if (company.invoice_template === "boy") {
    const charges = invoice.additional_charges ?? [];
    const subtotal = grandTotal(invoice.items, charges);
    const itemsTotal = grandTotal(invoice.items);
    return (
      <div className="invoice-sheet invoice-sheet--boy font-invoice">
        <header className="boy-header">
          <div className="boy-company">
            <h1>FAKTUR</h1>
            <h2>{company.company_name}</h2>
            <p>{company.address}</p>
            <p>{company.phone}</p>
            <p>{company.email}</p>
          </div>
          {logo ? <img src={logo} alt={`${company.company_name} logo`} /> : null}
        </header>
        <section className="boy-recipient">
          <div>
            <strong>DITAGIH KEPADA</strong>
            <h3>{invoice.client_name}</h3>
            {invoice.pic_name ? <p>{invoice.pic_name}</p> : null}
            {invoice.client_address ? <p>{invoice.client_address}</p> : null}
          </div>
          <dl>
            <dt>NO. FAKTUR</dt>
            <dd>{invoice.invoice_number}</dd>
            <dt>DITERBITKAN</dt>
            <dd>{formatDateID(invoice.invoice_date)}</dd>
          </dl>
        </section>
        <table className="boy-table">
          <thead>
            <tr>
              <th>KETERANGAN</th>
              <th>HARGA</th>
              <th>KUANTITAS</th>
              <th>JUMLAH</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, index) => (
              <tr key={item.key || `boy-preview-${index}`}>
                <td>
                  {serviceDescription(
                    item.car_type,
                    item.plate_number,
                    item.service_type,
                    item.route,
                    item.service_date,
                    item.days,
                  )}
                </td>
                <td>{formatRupiah(item.price_per_day)}</td>
                <td>{item.days}</td>
                <td>{formatRupiah(lineTotal(item.days, item.price_per_day))}</td>
              </tr>
            ))}
            {charges.map((charge, index) => (
              <tr key={charge.key || `boy-preview-charge-${index}`}>
                <td>{charge.description}</td>
                <td>{formatRupiah(charge.amount)}</td>
                <td>1</td>
                <td>{formatRupiah(charge.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <section className="boy-totals">
          {charges.length ? (
            <>
              <div>
                <span>Subtotal</span>
                <span>{formatRupiah(itemsTotal)}</span>
              </div>
              <div>
                <span>Biaya tambahan</span>
                <span>{formatRupiah(subtotal - itemsTotal)}</span>
              </div>
            </>
          ) : null}
          <div className="boy-grand-total">
            <strong>Total</strong>
            <strong>{formatRupiah(subtotal)}</strong>
          </div>
        </section>
        {invoice.notes ? <p className="boy-notes">{invoice.notes}</p> : null}
        <footer className="boy-footer">
          <div className="boy-bank">
            <strong>Instruksi Pembayaran</strong>
            {company.bank_accounts.map((account) => (
              <p key={`${account.bank}-${account.number}`}>
                {account.bank} · {account.name} · {account.number}
              </p>
            ))}
          </div>
          <div className="boy-signature">
            <span>Hormat Kami,</span>
            {signature ? <img src={signature} alt="Tanda tangan" /> : <div />}
            <strong>{company.signer_name}</strong>
            <span>{company.signer_title}</span>
          </div>
        </footer>
        <p className="boy-terms">
          Dengan menandatangani dokumen ini, pelanggan setuju dengan layanan dan persyaratan yang
          tercantum.
        </p>
      </div>
    );
  }

  const charges = invoice.additional_charges ?? [];
  const total = grandTotal(invoice.items, charges);
  return (
    <div className="invoice-sheet invoice-sheet--toms font-invoice">
      {logo ? <img className="toms-watermark" src={logo} alt="" aria-hidden="true" /> : null}
      <header className="toms-header">
        {logo ? (
          <img className="toms-logo" src={logo} alt={`${company.company_name} logo`} />
        ) : null}
        <div className="toms-company">
          <h1>{company.company_name}</h1>
          <p>{company.address}</p>
          <p>Phone: {company.phone}</p>
          <p>{company.email}</p>
        </div>
        <strong className="toms-stamp">INVOICE</strong>
      </header>
      <section className="toms-recipient">
        <strong>kepada Yth.:</strong>
        <span>{invoice.client_name}</span>
        {invoice.pic_name ? <span>{invoice.pic_name}</span> : null}
        {invoice.client_address ? <span>{invoice.client_address}</span> : null}
      </section>
      <section className="toms-meta">
        <div>No Invoice : {invoice.invoice_number}</div>
        <div>
          Tanggal Invoice : {invoice.city}, {formatDateID(invoice.invoice_date)}
        </div>
      </section>
      <table className="toms-table">
        <thead>
          <tr>
            <th>No</th>
            <th>Keterangan</th>
            <th>Harga Perhari</th>
            <th>Unit</th>
            <th>Harga</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item, index) => (
            <tr key={item.key || `toms-preview-${index}`}>
              <td>{index + 1}</td>
              <td>
                {serviceDescription(
                  item.car_type,
                  item.plate_number,
                  item.service_type,
                  item.route,
                  item.service_date,
                  item.days,
                )}
              </td>
              <td>{formatRupiah(item.price_per_day)}</td>
              <td>{item.days}</td>
              <td>{formatRupiah(lineTotal(item.days, item.price_per_day))}</td>
            </tr>
          ))}
          {charges.map((charge, index) => (
            <tr key={charge.key || `toms-preview-charge-${index}`}>
              <td>{invoice.items.length + index + 1}</td>
              <td>{charge.description}</td>
              <td>-</td>
              <td>1</td>
              <td>{formatRupiah(charge.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th colSpan={4}>Total Harga :</th>
            <th>{formatRupiah(total)}</th>
          </tr>
        </tfoot>
      </table>
      {invoice.notes ? <p className="toms-notes">{invoice.notes}</p> : null}
      <footer className="toms-footer">
        <div className="toms-bank">
          <strong>BANK TRANSFER :</strong>
          {company.bank_accounts.map((account) => (
            <p key={`${account.bank}-${account.number}`}>
              {account.bank} · A/C Name: {account.name} · A/C No: {account.number}
            </p>
          ))}
        </div>
        <div className="toms-signature">
          <span>Hormat Kami</span>
          <strong>{company.company_name}</strong>
          {signature ? <img src={signature} alt="Tanda tangan" /> : <div />}
          <strong>{company.signer_name}</strong>
          <span>{company.signer_title}</span>
        </div>
      </footer>
    </div>
  );
}

const boyPdf = StyleSheet.create({
  page: { padding: 42, fontFamily: "Helvetica", color: "#252525", fontSize: 9 },
  header: { flexDirection: "row", justifyContent: "space-between", minHeight: 150 },
  company: { width: "60%" },
  title: { fontSize: 23, fontWeight: "bold", marginBottom: 18 },
  companyName: { fontSize: 14, fontWeight: "bold", marginBottom: 4 },
  companyInfo: { color: "#686868", fontSize: 9, marginBottom: 2 },
  logo: { width: 145, height: 105, objectFit: "contain" },
  recipient: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 14,
    borderWidth: 0.7,
    borderColor: "#dedede",
    borderRadius: 6,
    marginBottom: 20,
  },
  recipientClient: { width: "60%" },
  smallLabel: { fontSize: 8, fontWeight: "bold", marginBottom: 7 },
  clientName: { fontSize: 12, fontWeight: "bold", marginBottom: 3 },
  clientDetail: { color: "#555555", marginTop: 2 },
  recipientMeta: {
    width: "34%",
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
  },
  metaLabel: { width: "60%", textAlign: "right", fontSize: 8, marginBottom: 8 },
  metaValue: { width: "38%", textAlign: "right", marginBottom: 8 },
  table: { width: "100%" },
  tableHeader: { flexDirection: "row", backgroundColor: "#f1f2f4" },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e1e1e1" },
  cell: { padding: 8, fontSize: 8.5 },
  description: { width: "49%", textAlign: "left" },
  price: { width: "18%", textAlign: "right" },
  quantity: { width: "14%", textAlign: "right" },
  amount: { width: "19%", textAlign: "right" },
  totals: { width: "44%", alignSelf: "flex-end", marginTop: 16 },
  totalLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    color: "#555555",
  },
  grandTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.7,
    borderTopColor: "#777777",
    marginTop: 7,
    paddingTop: 8,
    fontSize: 12,
    fontWeight: "bold",
  },
  notes: { marginTop: 18, color: "#555555" },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: "auto",
  },
  bank: { width: "55%" },
  bankHeading: { fontWeight: "bold", marginBottom: 5 },
  bankLine: { fontSize: 8, marginBottom: 3 },
  sign: { width: "36%", alignItems: "center", minHeight: 95 },
  signSpace: { height: 52 },
  signature: { width: 105, height: 52, objectFit: "contain" },
  signer: { fontWeight: "bold", marginTop: 4 },
});

const tomsPdf = StyleSheet.create({
  page: {
    position: "relative",
    padding: 36,
    fontFamily: "Helvetica",
    color: "#111111",
    fontSize: 9,
  },
  watermark: {
    position: "absolute",
    top: 185,
    left: 55,
    width: 490,
    height: 490,
    opacity: 0.08,
    objectFit: "contain",
  },
  header: { flexDirection: "row", alignItems: "center", minHeight: 110 },
  logo: { width: 78, height: 78, objectFit: "contain", marginRight: 12 },
  logoPlaceholder: { width: 78, height: 78, marginRight: 12 },
  company: { flex: 1 },
  companyName: { fontSize: 14, fontWeight: "bold", marginBottom: 4 },
  companyInfo: { fontSize: 8.5, marginBottom: 2 },
  invoiceStamp: {
    borderWidth: 1.5,
    borderColor: "#222222",
    paddingVertical: 6,
    paddingHorizontal: 20,
    fontWeight: "bold",
  },
  recipient: { alignItems: "flex-end", marginTop: 12 },
  recipientLabel: { fontWeight: "bold", marginBottom: 7 },
  recipientName: { fontWeight: "bold" },
  recipientDetail: { marginTop: 2 },
  meta: { alignItems: "flex-end", marginTop: 12, marginBottom: 14, fontWeight: "bold" },
  table: { width: "100%" },
  tableHeader: { flexDirection: "row", backgroundColor: "#ededed" },
  tableRow: { flexDirection: "row", minHeight: 42, backgroundColor: "#f7f7f7" },
  cell: {
    borderWidth: 0.7,
    borderColor: "#222222",
    padding: 7,
    fontSize: 8.5,
    textAlign: "center",
  },
  no: { width: "7%" },
  description: { width: "52%", textAlign: "left" },
  price: { width: "16%" },
  units: { width: "8%" },
  amount: { width: "17%", textAlign: "right" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    borderWidth: 0.7,
    borderTopWidth: 0,
    padding: 7,
  },
  totalLabel: { marginRight: 12, fontWeight: "bold" },
  totalAmount: { fontWeight: "bold" },
  notes: { marginTop: 12 },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: "auto",
    paddingTop: 24,
  },
  bank: { width: "48%", borderWidth: 0.7, borderColor: "#333333", padding: 9 },
  bankHeading: { fontWeight: "bold", marginBottom: 4 },
  bankLine: { fontSize: 8, marginTop: 3 },
  sign: { width: "42%", alignItems: "center" },
  signCompany: { fontWeight: "bold", marginTop: 3 },
  signature: { width: 115, height: 58, objectFit: "contain" },
  signSpace: { height: 58 },
  signer: { fontWeight: "bold", marginTop: 4 },
});
