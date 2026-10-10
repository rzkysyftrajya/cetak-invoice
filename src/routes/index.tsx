import { createFileRoute } from "@tanstack/react-router";
import { pdf, Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { Buffer } from "buffer/";
import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_LOGO,
  DEFAULT_SIGNATURE,
  emptyInvoice,
  formatDateID,
  formatRupiah,
  grandTotal,
  invoiceFilename,
  lineTotal,
  parseRupiah,
  type CompanySettings,
  type InvoiceInput,
  type InvoiceItemInput,
} from "../lib/invoice";

export const Route = createFileRoute("/")({
  component: Index,
});

type BankAccount = { bank: string; name: string; number: string };
type ClientRecord = {
  id: string;
  company: string;
  pic: string;
  phone: string;
  email: string;
  address: string;
};
type VehicleRecord = {
  id: string;
  type: string;
  plateNumber: string;
  defaultPrice: number;
};
type InvoiceRecord = InvoiceInput & { id: string; createdAt: string; updatedAt: string };

type NavKey = "dashboard" | "create" | "history" | "clients" | "vehicles" | "settings";

const STORAGE_KEYS = {
  invoices: "vrn.invoices",
  settings: "vrn.company-settings",
  clients: "vrn.clients",
  vehicles: "vrn.vehicles",
};

const defaultCompanySettings: CompanySettings = {
  company_name: "PT VICKY RENTAL NUSANTARA",
  address: "Jl. Sempurna Gg. Mawar No.12, Dusun II, Sambirejo Timur, Kec. Medan Tembung, Kabupaten Deli Serdang, Sumatera Utara 20371.",
  phone: "082363389893",
  email: "vickeycky@gmail.com",
  bank_accounts: [
    { bank: "BCA", name: "VICKY", number: "3831944879" },
    { bank: "MANDIRI", name: "VICKY", number: "1060017903132" },
    { bank: "BNI", name: "VICKY", number: "0793804826" },
  ],
  signer_name: "VICKY",
  signer_title: "Direktur",
  default_city: "Jakarta",
  logo_path: DEFAULT_LOGO,
  signature_path: DEFAULT_SIGNATURE,
};

const defaultClients: ClientRecord[] = [
  {
    id: "client-1",
    company: "Astrindo Travel",
    pic: "Rina Putri",
    phone: "081234567890",
    email: "rina@astrindo.id",
    address: "Jl. Gatot Subroto No. 89, Medan",
  },
  {
    id: "client-2",
    company: "Sinar Mandiri",
    pic: "Budi Santoso",
    phone: "085678912345",
    email: "budi@sinar.id",
    address: "Jl. Imam Bonjol No. 55, Jakarta",
  },
];

const defaultVehicles: VehicleRecord[] = [
  { id: "vehicle-1", type: "Toyota Avanza", plateNumber: "BK 1234 AB", defaultPrice: 550000 },
  { id: "vehicle-2", type: "Honda BR-V", plateNumber: "BK 5678 CD", defaultPrice: 700000 },
  { id: "vehicle-3", type: "Isuzu Elf", plateNumber: "BK 9012 EF", defaultPrice: 1100000 },
];

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function buildDefaultInvoiceNumber(invoices: InvoiceRecord[]): string {
  const values = invoices
    .map((invoice) => Number(String(invoice.invoice_number).replace(/\D/g, "")))
    .filter((item) => Number.isFinite(item) && item > 0)
    .sort((a, b) => b - a);
  const next = values[0] ? values[0] + 1 : 15905;
  return String(next);
}

function emptyFormState(city = "Jakarta"): InvoiceInput {
  const draft = emptyInvoice(city);
  return {
    ...draft,
    invoice_number: "",
    invoice_date: "2026-10-09",
    items: draft.items.map((item) => ({ ...item, service_date: "2026-10-09" })),
    status: "draft",
  };
}

function formatCurrencyInput(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

function emitDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function InvoicePDFDocument({
  invoice,
  company,
}: {
  invoice: InvoiceInput;
  company: CompanySettings;
}) {
  const total = grandTotal(invoice.items);
  const logo = company.logo_path || DEFAULT_LOGO;
  const signature = company.signature_path || DEFAULT_SIGNATURE;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <Image src={logo} style={styles.logo} />
          <View style={styles.companyBlock}>
            <Text style={styles.companyName}>Invoice {company.company_name}</Text>
            <Text style={styles.muted}>{company.address}</Text>
            <Text style={styles.muted}>
              Telp/WA: {company.phone} | Email: {company.email}
            </Text>
          </View>
        </View>

        <View style={styles.headerRule} />
        <View style={styles.recipientRow}>
          <View>
            <Text style={styles.recipientLabel}>Yth.</Text>
            <Text style={styles.recipientName}>{invoice.client_name}</Text>
          </View>
          <View style={styles.invoiceMeta}>
            <Text style={styles.metaRow}>No invoice : {invoice.invoice_number || "-"}</Text>
            <Text style={styles.metaRow}>
              {invoice.city}, {formatDateID(invoice.invoice_date)}
            </Text>
          </View>
        </View>

        <View style={styles.tableWrap}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.cell, styles.noCol]}>No</Text>
            <Text style={[styles.cell, styles.carCol]}>Jenis Mobil</Text>
            <Text style={[styles.cell, styles.plateCol]}>Nopol</Text>
            <Text style={[styles.cell, styles.dateCol]}>Tanggal</Text>
            <Text style={[styles.cell, styles.routeCol]}>Rute</Text>
            <Text style={[styles.cell, styles.serviceCol]}>Tipe Layanan</Text>
            <Text style={[styles.cell, styles.daysCol]}>Hari</Text>
            <Text style={[styles.cell, styles.totalCol]}>Total</Text>
          </View>
          {Array.from({ length: Math.max(10, invoice.items.length) }, (_, index) => {
            const item = invoice.items[index];
            return (
              <View key={item?.key || `empty-${index}`} style={styles.tableRow}>
                <Text style={[styles.cell, styles.noCol]}>{item ? index + 1 : ""}</Text>
                <Text style={[styles.cell, styles.carCol]}>{item?.car_type || ""}</Text>
                <Text style={[styles.cell, styles.plateCol]}>{item?.plate_number || ""}</Text>
                <Text style={[styles.cell, styles.dateCol]}>
                  {item ? formatDateID(item.service_date, true) : ""}
                </Text>
                <Text style={[styles.cell, styles.routeCol]}>{item?.route || ""}</Text>
                <Text style={[styles.cell, styles.serviceCol]}>{item?.service_type || ""}</Text>
                <Text style={[styles.cell, styles.daysCol]}>{item?.days || ""}</Text>
                <Text style={[styles.cell, styles.totalCol]}>
                  {item ? formatRupiah(lineTotal(item.days, item.price_per_day)) : ""}
                </Text>
              </View>
            );
          })}
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalSpacer} />
            <Text style={styles.grandTotalLabel}>Grand Total :</Text>
            <Text style={styles.grandTotalValue}>{formatRupiah(total)}</Text>
          </View>
        </View>

        <View style={styles.footerRow}>
          <View style={styles.bankBox}>
            {company.bank_accounts.map((account) => (
              <View key={`${account.bank}-${account.number}`} style={styles.bankEntry}>
                <Text style={styles.bankName}>{account.bank}</Text>
                <Text style={styles.bankText}>A/N {account.name}</Text>
                <Text style={styles.bankText}>AC No: {account.number}</Text>
              </View>
            ))}
          </View>
          <View style={styles.signatureBox}>
            <Image src={logo} style={styles.signatureWatermark} />
            <Text style={styles.signText}>Hormat Kami</Text>
            <Text style={styles.signCompany}>{company.company_name}</Text>
            <Image src={signature} style={styles.signature} />
            <Text style={styles.signName}>{company.signer_name}</Text>
            <Text style={styles.signTitle}>{company.signer_title}</Text>
          </View>
        </View>
        <Text style={styles.footer}>Terima Kasih!</Text>
      </Page>
    </Document>
  );
}

function InvoicePreview({ invoice, company }: { invoice: InvoiceInput; company: CompanySettings }) {
  const total = grandTotal(invoice.items);

  return (
    <div className="invoice-sheet font-invoice">
      <header className="invoice-header">
        <img
          src={company.logo_path || DEFAULT_LOGO}
          alt="Logo perusahaan"
          className="invoice-logo"
        />
        <div className="invoice-company">
          <h1>Invoice {company.company_name}</h1>
          <p>{company.address}</p>
          <p>
            Telp/WA: {company.phone} | Email: {company.email}
          </p>
        </div>
      </header>
      <div className="invoice-rule" />

      <div className="invoice-recipient">
        <div>
          <div>Yth.</div>
          <div className="invoice-recipient-name">{invoice.client_name}</div>
        </div>
        <div className="invoice-meta">
          <div>No invoice : {invoice.invoice_number || "-"}</div>
          <div>
            {invoice.city}, {formatDateID(invoice.invoice_date)}
          </div>
        </div>
      </div>

      <table className="invoice-table">
        <colgroup>
          <col className="invoice-no-col" />
          <col className="invoice-car-col" />
          <col className="invoice-plate-col" />
          <col className="invoice-date-col" />
          <col className="invoice-route-col" />
          <col className="invoice-service-col" />
          <col className="invoice-days-col" />
          <col className="invoice-total-col" />
        </colgroup>
        <thead>
          <tr>
            <th>No</th>
            <th>Jenis Mobil</th>
            <th>Nopol</th>
            <th>Tanggal</th>
            <th>Rute</th>
            <th>Tipe Layanan</th>
            <th>Hari</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: Math.max(10, invoice.items.length) }, (_, index) => {
            const item = invoice.items[index];
            return (
              <tr key={item?.key || `empty-${index}`}>
                <td>{item ? index + 1 : ""}</td>
                <td>{item?.car_type || ""}</td>
                <td>{item?.plate_number || ""}</td>
                <td>{item ? formatDateID(item.service_date, true) : ""}</td>
                <td>{item?.route || ""}</td>
                <td>{item?.service_type || ""}</td>
                <td>{item?.days || ""}</td>
                <td>{item ? formatRupiah(lineTotal(item.days, item.price_per_day)) : ""}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4} />
            <th colSpan={3}>Grand Total :</th>
            <th>{formatRupiah(total)}</th>
          </tr>
        </tfoot>
      </table>

      <footer className="invoice-footer">
        <div className="invoice-bank-box">
          {company.bank_accounts.map((account) => (
            <div className="invoice-bank-entry" key={`${account.bank}-${account.number}`}>
              <strong>{account.bank}</strong>
              <span>A/N {account.name}</span>
              <span>AC No: {account.number}</span>
            </div>
          ))}
        </div>
        <div className="invoice-signature">
          <img
            className="invoice-signature-watermark"
            src={company.logo_path || DEFAULT_LOGO}
            alt=""
            aria-hidden="true"
          />
          <div>Hormat Kami</div>
          <strong>{company.company_name}</strong>
          <img src={company.signature_path || DEFAULT_SIGNATURE} alt="Tanda tangan" />
          <strong>{company.signer_name}</strong>
          <span>{company.signer_title}</span>
        </div>
      </footer>
      <div className="invoice-thanks">Terima Kasih!</div>
    </div>
  );
}

function Index() {
  const [activeTab, setActiveTab] = useState<NavKey>("dashboard");
  const [companySettings, setCompanySettings] = useState<CompanySettings>(() => readStorage(STORAGE_KEYS.settings, defaultCompanySettings));
  const [clients, setClients] = useState<ClientRecord[]>(() => readStorage(STORAGE_KEYS.clients, defaultClients));
  const [vehicles, setVehicles] = useState<VehicleRecord[]>(() => readStorage(STORAGE_KEYS.vehicles, defaultVehicles));
  const [invoices, setInvoices] = useState<InvoiceRecord[]>(() => readStorage(STORAGE_KEYS.invoices, []) as InvoiceRecord[]);
  const [form, setForm] = useState<InvoiceInput>(() => emptyFormState("Jakarta"));
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [clientForm, setClientForm] = useState({ company: "", pic: "", phone: "", email: "", address: "" });
  const [vehicleForm, setVehicleForm] = useState({ type: "", plateNumber: "", defaultPrice: "" });
  const [showPreview, setShowPreview] = useState(false);
  const [printWhenReady, setPrintWhenReady] = useState(false);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.settings, companySettings);
  }, [companySettings]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.clients, clients);
  }, [clients]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.vehicles, vehicles);
  }, [vehicles]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.invoices, invoices);
  }, [invoices]);

  useEffect(() => {
    if (!printWhenReady || !showPreview) return;
    const timeout = window.setTimeout(() => {
      window.print();
      setPrintWhenReady(false);
    }, 100);
    return () => window.clearTimeout(timeout);
  }, [printWhenReady, showPreview]);

  const totalNominal = useMemo(() => invoices.reduce((sum, invoice) => sum + grandTotal(invoice.items), 0), [invoices]);
  const recentInvoices = useMemo(() => [...invoices].sort((a, b) => b.invoice_date.localeCompare(a.invoice_date)).slice(0, 5), [invoices]);
  const thisMonthCount = useMemo(() => {
    const monthNow = new Date().getMonth();
    const yearNow = new Date().getFullYear();
    return invoices.filter((invoice) => {
      const invoiceDate = new Date(invoice.invoice_date);
      return !Number.isNaN(invoiceDate.getTime()) && invoiceDate.getMonth() === monthNow && invoiceDate.getFullYear() === yearNow;
    }).length;
  }, [invoices]);

  const menuItems = [
    { key: "dashboard", label: "Dashboard" },
    { key: "create", label: "Buat Invoice" },
    { key: "history", label: "Riwayat Invoice" },
    { key: "clients", label: "Data Klien" },
    { key: "vehicles", label: "Data Kendaraan" },
    { key: "settings", label: "Pengaturan Perusahaan" },
  ] as const;

  const filteredInvoices = useMemo(() => {
    const term = query.trim().toLowerCase();
    return invoices.filter((invoice) => {
      const matchesQuery =
        !term ||
        invoice.invoice_number.toLowerCase().includes(term) ||
        invoice.client_name.toLowerCase().includes(term) ||
        invoice.pic_name.toLowerCase().includes(term);
      const matchesStart = !startDate || invoice.invoice_date >= startDate;
      const matchesEnd = !endDate || invoice.invoice_date <= endDate;
      return matchesQuery && matchesStart && matchesEnd;
    });
  }, [invoices, query, startDate, endDate]);

  function updateForm<T extends keyof InvoiceInput>(key: T, value: InvoiceInput[T]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateItem(index: number, field: keyof InvoiceItemInput, value: string | number | null) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const nextItem = { ...item, [field]: value };
        if (field === "days") nextItem.days = Number(value) || 0;
        if (field === "price_per_day") nextItem.price_per_day = Number(value) || 0;
        return nextItem;
      }),
    }));
  }

  function addItemRow() {
    setForm((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          ...emptyInvoice(current.city).items[0],
          key: makeId("item"),
          service_date: current.invoice_date,
        },
      ],
    }));
  }

  function removeItemRow(index: number) {
    setForm((current) => ({
      ...current,
      items: current.items.length > 1 ? current.items.filter((_, itemIndex) => itemIndex !== index) : current.items,
    }));
  }

  function resetForm() {
    const draft = emptyFormState("Jakarta");
    setForm(draft);
    setSelectedInvoiceId(null);
    setShowPreview(false);
  }

  function createNewInvoice() {
    const draft = emptyFormState("Jakarta");
    draft.invoice_number = buildDefaultInvoiceNumber(invoices);
    setForm(draft);
    setSelectedInvoiceId(null);
    setShowPreview(false);
    setActiveTab("create");
  }

  function loadEditInvoice(invoice: InvoiceRecord) {
    setForm({
      ...invoice,
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      client_id: invoice.client_id ?? null,
    });
    setSelectedInvoiceId(invoice.id);
    setShowPreview(false);
    setActiveTab("create");
  }

  function duplicateInvoice(invoice: InvoiceRecord) {
    const duplicate = {
      ...invoice,
      id: undefined,
      invoice_number: buildDefaultInvoiceNumber(invoices),
      status: "draft",
      items: invoice.items.map((item) => ({ ...item, key: makeId("item") })),
    } as InvoiceInput;
    setForm(duplicate);
    setSelectedInvoiceId(null);
    setShowPreview(false);
    setActiveTab("create");
  }

  function saveInvoice() {
    const cleanNumber = form.invoice_number.trim();
    if (!cleanNumber) {
      window.alert("Nomor invoice wajib diisi.");
      return;
    }
    if (form.client_name.trim().length === 0) {
      window.alert("Nama perusahaan atau klien wajib diisi.");
      return;
    }
    if (form.items.some((item) => !item.car_type.trim() || item.days <= 0 || item.price_per_day < 0)) {
      window.alert("Terdapat baris kendaraan yang belum valid. Periksa jenis mobil, hari, dan harga per hari.");
      return;
    }

    const duplicate = invoices.find((invoice) => invoice.invoice_number === cleanNumber && invoice.id !== selectedInvoiceId);
    if (duplicate) {
      window.alert("Nomor invoice sudah digunakan. Gunakan nomor yang berbeda.");
      return;
    }

    const now = new Date().toISOString();
    const record: InvoiceRecord = {
      ...(form as InvoiceInput),
      id: selectedInvoiceId ?? makeId("invoice"),
      createdAt: selectedInvoiceId ? invoices.find((invoice) => invoice.id === selectedInvoiceId)?.createdAt ?? now : now,
      updatedAt: now,
    };

    setInvoices((current) => {
      const exists = current.some((invoice) => invoice.id === record.id);
      if (exists) {
        return current.map((invoice) => (invoice.id === record.id ? record : invoice));
      }
      return [record, ...current];
    });

    setSelectedInvoiceId(record.id);
    setShowPreview(true);
    setActiveTab("history");
    window.alert("Invoice berhasil disimpan.");
  }

  async function downloadPdf() {
    if (!form.invoice_number.trim()) {
      window.alert("Nomor invoice wajib diisi sebelum unduh PDF.");
      return;
    }
    if (typeof globalThis.Buffer === "undefined") {
      globalThis.Buffer = Buffer;
    }
    const blob = await pdf(<InvoicePDFDocument invoice={form} company={companySettings} />).toBlob();
    emitDownload(invoiceFilename(form.invoice_number, form.client_name), blob);
  }

  function printInvoice() {
    setShowPreview(true);
    setPrintWhenReady(true);
  }

  function deleteInvoice(id: string) {
    const invoice = invoices.find((item) => item.id === id);
    if (!invoice) return;
    if (!window.confirm(`Hapus invoice ${invoice.invoice_number}?`)) return;
    setInvoices((current) => current.filter((item) => item.id !== id));
    if (selectedInvoiceId === id) resetForm();
  }

  function addClient() {
    if (!clientForm.company.trim() || !clientForm.pic.trim()) {
      window.alert("Nama perusahaan dan PIC wajib diisi.");
      return;
    }
    const nextClient: ClientRecord = {
      id: makeId("client"),
      company: clientForm.company.trim(),
      pic: clientForm.pic.trim(),
      phone: clientForm.phone.trim(),
      email: clientForm.email.trim(),
      address: clientForm.address.trim(),
    };
    setClients((current) => [nextClient, ...current]);
    setClientForm({ company: "", pic: "", phone: "", email: "", address: "" });
    window.alert("Data klien berhasil disimpan.");
  }

  function addVehicle() {
    if (!vehicleForm.type.trim()) {
      window.alert("Jenis mobil wajib diisi.");
      return;
    }
    const nextVehicle: VehicleRecord = {
      id: makeId("vehicle"),
      type: vehicleForm.type.trim(),
      plateNumber: vehicleForm.plateNumber.trim(),
      defaultPrice: parseRupiah(vehicleForm.defaultPrice || "0"),
    };
    setVehicles((current) => [nextVehicle, ...current]);
    setVehicleForm({ type: "", plateNumber: "", defaultPrice: "" });
    window.alert("Data kendaraan berhasil disimpan.");
  }

  function applyVehicleToForm(vehicle: VehicleRecord, itemIndex: number) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, index) => {
        if (index !== itemIndex) return item;
        return {
          ...item,
          car_type: vehicle.type,
          plate_number: vehicle.plateNumber,
          price_per_day: vehicle.defaultPrice,
        };
      }),
    }));
  }

  function valueOfBank(account: BankAccount) {
    return `${account.bank} - ${account.name} (${account.number})`;
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-foreground)]">
      <div className="mx-auto flex max-w-[1600px] gap-6 p-5 lg:p-8">
        <aside className="hidden w-72 shrink-0 rounded-[28px] bg-slate-950 p-5 text-white lg:block">
          <div className="mb-8 flex items-center gap-3">
            <img src={companySettings.logo_path || DEFAULT_LOGO} alt="logo" className="h-12 w-12 rounded-xl object-contain" />
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-300">Invoice</div>
              <div className="text-lg font-bold">VRN</div>
            </div>
          </div>
          <nav className="space-y-2">
            {menuItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveTab(item.key)}
                className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                  activeTab === item.key ? "bg-white/12 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 space-y-6">
          <div className="flex flex-col gap-3 rounded-[28px] border border-border bg-white p-5 shadow-card md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Dashboard admin</div>
              <h1 className="mt-2 text-3xl font-bold text-foreground">PT VICKY RENTAL NUSANTARA</h1>
            </div>
            <button
              type="button"
              onClick={createNewInvoice}
              className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
            >
              + Buat Invoice
            </button>
          </div>

          {activeTab === "dashboard" && (
            <>
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[24px] border border-border bg-white p-5 shadow-card">
                  <div className="text-sm text-muted-foreground">Total Invoice</div>
                  <div className="mt-2 text-4xl font-bold text-foreground">{invoices.length}</div>
                </div>
                <div className="rounded-[24px] border border-border bg-white p-5 shadow-card">
                  <div className="text-sm text-muted-foreground">Total Nominal</div>
                  <div className="mt-2 text-3xl font-bold text-foreground">{formatRupiah(totalNominal)}</div>
                </div>
                <div className="rounded-[24px] border border-border bg-white p-5 shadow-card">
                  <div className="text-sm text-muted-foreground">Invoice Bulan Ini</div>
                  <div className="mt-2 text-4xl font-bold text-foreground">{thisMonthCount}</div>
                </div>
                <div className="rounded-[24px] border border-border bg-white p-5 shadow-card">
                  <div className="text-sm text-muted-foreground">Invoice Terbaru</div>
                  <div className="mt-2 text-xl font-bold text-foreground">{recentInvoices[0]?.invoice_number || "-"}</div>
                  <div className="text-sm text-muted-foreground">{recentInvoices[0] ? formatDateID(recentInvoices[0].invoice_date, true) : "Belum ada"}</div>
                </div>
              </section>

              <section className="rounded-[28px] border border-border bg-white p-5 shadow-card">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-foreground">Invoice Terbaru</h2>
                  <button type="button" onClick={() => setActiveTab("history")} className="text-sm font-medium text-primary underline-offset-4 hover:underline">Lihat semua</button>
                </div>
                <div className="space-y-3">
                  {recentInvoices.length === 0 ? (
                    <div className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">Belum ada invoice tersimpan.</div>
                  ) : (
                    recentInvoices.map((invoice) => (
                      <div key={invoice.id} className="flex flex-col gap-3 rounded-2xl border border-border p-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="font-semibold text-foreground">{invoice.invoice_number}</div>
                          <div className="text-sm text-muted-foreground">{invoice.client_name} • {formatDateID(invoice.invoice_date, true)}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="font-semibold text-foreground">{formatRupiah(grandTotal(invoice.items))}</div>
                          </div>
                          <button type="button" onClick={() => loadEditInvoice(invoice)} className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground">Edit</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </>
          )}

          {activeTab === "create" && (
            <section className="grid gap-6">
              <div className="rounded-[28px] border border-border bg-white p-5 shadow-card">
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-foreground">{selectedInvoiceId ? "Edit Invoice" : "Buat Invoice"}</h2>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-foreground">No invoice</span>
                    <input
                      value={form.invoice_number}
                      onChange={(event) => updateForm("invoice_number", event.target.value)}
                      className="w-full rounded-xl border border-input bg-background px-3 py-2.5 outline-none ring-0 transition focus:border-ring"
                    />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-foreground">YTH.</span>
                    <input
                      value={form.client_name}
                      onChange={(event) => updateForm("client_name", event.target.value)}
                      placeholder="Nama penerima invoice"
                      className="w-full rounded-xl border border-input bg-background px-3 py-2.5 outline-none ring-0 transition focus:border-ring"
                    />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-foreground">Kota</span>
                    <input
                      value={form.city}
                      onChange={(event) => updateForm("city", event.target.value)}
                      className="w-full rounded-xl border border-input bg-background px-3 py-2.5 outline-none ring-0 transition focus:border-ring"
                    />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-foreground">Tanggal invoice</span>
                    <input
                      type="date"
                      value={form.invoice_date}
                      onChange={(event) => updateForm("invoice_date", event.target.value)}
                      className="w-full rounded-xl border border-input bg-background px-3 py-2.5 outline-none ring-0 transition focus:border-ring"
                    />
                  </label>
                </div>

                <div className="mt-8 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-foreground">Rincian Layanan Rental Mobil</h3>
                    <button type="button" onClick={addItemRow} className="rounded-xl border border-border bg-muted px-3 py-2 text-sm font-semibold text-foreground">+ Tambah baris</button>
                  </div>

                  {form.items.map((item, index) => (
                    <div key={item.key || index} className="rounded-[24px] border border-border bg-muted p-4">
                      <div className="mb-4 flex items-center justify-between">
                        <div className="text-sm font-semibold text-foreground">Baris {index + 1}</div>
                        {form.items.length > 1 ? (
                          <button type="button" onClick={() => removeItemRow(index)} className="text-sm font-medium text-destructive">Hapus</button>
                        ) : null}
                      </div>

                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <label className="space-y-2 text-sm">
                          <span className="font-medium text-foreground">Jenis mobil</span>
                          <input value={item.car_type} onChange={(event) => updateItem(index, "car_type", event.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-2.5 outline-none ring-0 transition focus:border-ring" />
                        </label>
                        <label className="space-y-2 text-sm">
                          <span className="font-medium text-foreground">Nomor polisi</span>
                          <input value={item.plate_number} onChange={(event) => updateItem(index, "plate_number", event.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-2.5 outline-none ring-0 transition focus:border-ring" />
                        </label>
                        <label className="space-y-2 text-sm">
                          <span className="font-medium text-foreground">Tanggal layanan</span>
                          <input type="date" value={item.service_date} onChange={(event) => updateItem(index, "service_date", event.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-2.5 outline-none ring-0 transition focus:border-ring" />
                        </label>
                        <label className="space-y-2 text-sm">
                          <span className="font-medium text-foreground">Rute perjalanan</span>
                          <input value={item.route} onChange={(event) => updateItem(index, "route", event.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-2.5 outline-none ring-0 transition focus:border-ring" />
                        </label>
                        <label className="space-y-2 text-sm">
                          <span className="font-medium text-foreground">Tipe layanan</span>
                          <select value={item.service_type} onChange={(event) => updateItem(index, "service_type", event.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-2.5 outline-none ring-0 transition focus:border-ring">
                            <option value="Dengan Driver">Dengan Driver</option>
                            <option value="Lepas Kunci">Lepas Kunci</option>
                          </select>
                        </label>
                        <label className="space-y-2 text-sm">
                          <span className="font-medium text-foreground">Jumlah hari</span>
                          <input type="number" min={1} value={item.days} onChange={(event) => updateItem(index, "days", Number(event.target.value))} className="w-full rounded-xl border border-input bg-background px-3 py-2.5 outline-none ring-0 transition focus:border-ring" />
                        </label>
                        <label className="space-y-2 text-sm">
                          <span className="font-medium text-foreground">Harga per hari</span>
                          <input type="number" min={0} value={item.price_per_day} onChange={(event) => updateItem(index, "price_per_day", Number(event.target.value))} className="w-full rounded-xl border border-input bg-background px-3 py-2.5 outline-none ring-0 transition focus:border-ring" />
                        </label>
                        <div className="space-y-2 text-sm">
                          <span className="font-medium text-foreground">Total</span>
                          <div className="flex h-[46px] items-center rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground">
                            {formatRupiah(lineTotal(item.days, item.price_per_day))}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <select
                          value=""
                          onChange={(event) => {
                            const chosen = vehicles.find((vehicle) => vehicle.id === event.target.value);
                            if (chosen) applyVehicleToForm(chosen, index);
                            event.target.value = "";
                          }}
                          className="w-full max-w-xs rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none ring-0 transition focus:border-ring"
                        >
                          <option value="">Pilih kendaraan master</option>
                          {vehicles.map((vehicle) => (
                            <option key={vehicle.id} value={vehicle.id}>{vehicle.type} • {vehicle.plateNumber}</option>
                          ))}
                        </select>
                        <div className="text-sm font-semibold text-foreground">{formatRupiah(lineTotal(item.days, item.price_per_day))}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 rounded-[24px] border border-border bg-amber-50 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">Grand Total</div>
                    <div className="text-2xl font-bold text-foreground">{formatRupiah(grandTotal(form.items))}</div>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button type="button" onClick={() => setShowPreview(true)} className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Preview Invoice</button>
                  <button type="button" onClick={saveInvoice} className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white">Simpan Invoice</button>
                  <button type="button" onClick={downloadPdf} className="rounded-xl border border-border bg-white px-4 py-3 text-sm font-semibold text-foreground">Download PDF</button>
                  <button type="button" onClick={printInvoice} className="rounded-xl border border-border bg-white px-4 py-3 text-sm font-semibold text-foreground">Cetak Invoice</button>
                  <button type="button" onClick={resetForm} className="rounded-xl border border-border bg-white px-4 py-3 text-sm font-semibold text-foreground">Reset Form</button>
                </div>
              </div>

            </section>
          )}

          {activeTab === "history" && (
            <section className="rounded-[28px] border border-border bg-white p-5 shadow-card">
              <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-foreground">Riwayat Invoice</h2>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nomor / klien" className="rounded-xl border border-input bg-background px-3 py-2.5 text-sm" />
                  <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="rounded-xl border border-input bg-background px-3 py-2.5 text-sm" />
                  <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="rounded-xl border border-input bg-background px-3 py-2.5 text-sm" />
                </div>
              </div>

              <div className="space-y-3">
                {filteredInvoices.length === 0 ? (
                  <div className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">Tidak ada invoice yang cocok.</div>
                ) : (
                  filteredInvoices.map((invoice) => (
                    <div key={invoice.id} className="flex flex-col gap-3 rounded-2xl border border-border p-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="font-semibold text-foreground">{invoice.invoice_number}</div>
                        <div className="text-sm text-muted-foreground">{invoice.client_name} • {formatDateID(invoice.invoice_date, true)}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="font-semibold text-foreground">{formatRupiah(grandTotal(invoice.items))}</div>
                        </div>
                        <button type="button" onClick={() => loadEditInvoice(invoice)} className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground">Edit</button>
                        <button type="button" onClick={() => duplicateInvoice(invoice)} className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground">Duplikat</button>
                        <button type="button" onClick={() => deleteInvoice(invoice.id)} className="rounded-lg bg-red-500 px-3 py-2 text-sm font-medium text-white">Hapus</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}

          {activeTab === "clients" && (
            <section className="rounded-[28px] border border-border bg-white p-5 shadow-card">
              <h2 className="text-xl font-bold text-foreground">Data Klien</h2>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  {clients.map((client) => (
                    <div key={client.id} className="rounded-2xl border border-border p-4">
                      <div className="font-semibold text-foreground">{client.company}</div>
                      <div className="text-sm text-muted-foreground">PIC: {client.pic}</div>
                      <div className="text-sm text-muted-foreground">{client.phone} • {client.email}</div>
                      <div className="text-sm text-muted-foreground">{client.address}</div>
                    </div>
                  ))}
                </div>
                <div className="space-y-3">
                  <input value={clientForm.company} onChange={(event) => setClientForm((current) => ({ ...current, company: event.target.value }))} placeholder="Nama perusahaan" className="w-full rounded-xl border border-input bg-background px-3 py-2.5" />
                  <input value={clientForm.pic} onChange={(event) => setClientForm((current) => ({ ...current, pic: event.target.value }))} placeholder="Nama PIC" className="w-full rounded-xl border border-input bg-background px-3 py-2.5" />
                  <input value={clientForm.phone} onChange={(event) => setClientForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Nomor telepon" className="w-full rounded-xl border border-input bg-background px-3 py-2.5" />
                  <input value={clientForm.email} onChange={(event) => setClientForm((current) => ({ ...current, email: event.target.value }))} placeholder="Email" className="w-full rounded-xl border border-input bg-background px-3 py-2.5" />
                  <textarea value={clientForm.address} onChange={(event) => setClientForm((current) => ({ ...current, address: event.target.value }))} placeholder="Alamat" className="min-h-[120px] w-full rounded-xl border border-input bg-background px-3 py-2.5" />
                  <button type="button" onClick={addClient} className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Simpan Klien</button>
                </div>
              </div>
            </section>
          )}

          {activeTab === "vehicles" && (
            <section className="rounded-[28px] border border-border bg-white p-5 shadow-card">
              <h2 className="text-xl font-bold text-foreground">Data Kendaraan</h2>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  {vehicles.map((vehicle) => (
                    <div key={vehicle.id} className="rounded-2xl border border-border p-4">
                      <div className="font-semibold text-foreground">{vehicle.type}</div>
                      <div className="text-sm text-muted-foreground">{vehicle.plateNumber}</div>
                      <div className="text-sm text-muted-foreground">Harga default: {formatRupiah(vehicle.defaultPrice)}</div>
                    </div>
                  ))}
                </div>
                <div className="space-y-3">
                  <input value={vehicleForm.type} onChange={(event) => setVehicleForm((current) => ({ ...current, type: event.target.value }))} placeholder="Jenis mobil" className="w-full rounded-xl border border-input bg-background px-3 py-2.5" />
                  <input value={vehicleForm.plateNumber} onChange={(event) => setVehicleForm((current) => ({ ...current, plateNumber: event.target.value }))} placeholder="Nomor polisi" className="w-full rounded-xl border border-input bg-background px-3 py-2.5" />
                  <input value={vehicleForm.defaultPrice} onChange={(event) => setVehicleForm((current) => ({ ...current, defaultPrice: event.target.value }))} placeholder="Harga default per hari" className="w-full rounded-xl border border-input bg-background px-3 py-2.5" />
                  <button type="button" onClick={addVehicle} className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Simpan Kendaraan</button>
                </div>
              </div>
            </section>
          )}

          {activeTab === "settings" && (
            <section className="space-y-6 rounded-[28px] border border-border bg-white p-5 shadow-card">
              <div>
                <h2 className="text-xl font-bold text-foreground">Pengaturan Perusahaan</h2>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-foreground">Nama perusahaan</span>
                  <input value={companySettings.company_name} onChange={(event) => setCompanySettings((current) => ({ ...current, company_name: event.target.value }))} className="w-full rounded-xl border border-input bg-background px-3 py-2.5" />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-foreground">Kota default</span>
                  <input value={companySettings.default_city} onChange={(event) => setCompanySettings((current) => ({ ...current, default_city: event.target.value }))} className="w-full rounded-xl border border-input bg-background px-3 py-2.5" />
                </label>
                <label className="space-y-2 text-sm md:col-span-2">
                  <span className="font-medium text-foreground">Alamat</span>
                  <textarea value={companySettings.address} onChange={(event) => setCompanySettings((current) => ({ ...current, address: event.target.value }))} className="min-h-[120px] w-full rounded-xl border border-input bg-background px-3 py-2.5" />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-foreground">Telepon / WhatsApp</span>
                  <input value={companySettings.phone} onChange={(event) => setCompanySettings((current) => ({ ...current, phone: event.target.value }))} className="w-full rounded-xl border border-input bg-background px-3 py-2.5" />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-foreground">Email</span>
                  <input value={companySettings.email} onChange={(event) => setCompanySettings((current) => ({ ...current, email: event.target.value }))} className="w-full rounded-xl border border-input bg-background px-3 py-2.5" />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-foreground">Nama penandatangan</span>
                  <input value={companySettings.signer_name} onChange={(event) => setCompanySettings((current) => ({ ...current, signer_name: event.target.value }))} className="w-full rounded-xl border border-input bg-background px-3 py-2.5" />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-foreground">Jabatan penandatangan</span>
                  <input value={companySettings.signer_title} onChange={(event) => setCompanySettings((current) => ({ ...current, signer_title: event.target.value }))} className="w-full rounded-xl border border-input bg-background px-3 py-2.5" />
                </label>
              </div>

              <div className="rounded-[24px] border border-border bg-muted p-4">
                <h3 className="mb-3 text-lg font-bold text-foreground">Rekening Bank</h3>
                <div className="space-y-3">
                  {companySettings.bank_accounts.map((account, index) => (
                    <div key={`${account.bank}-${index}`} className="grid gap-2 md:grid-cols-3">
                      <input value={account.bank} onChange={(event) => setCompanySettings((current) => ({ ...current, bank_accounts: current.bank_accounts.map((item, itemIndex) => itemIndex === index ? { ...item, bank: event.target.value } : item) }))} className="rounded-xl border border-input bg-background px-3 py-2.5" />
                      <input value={account.name} onChange={(event) => setCompanySettings((current) => ({ ...current, bank_accounts: current.bank_accounts.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item) }))} className="rounded-xl border border-input bg-background px-3 py-2.5" />
                      <input value={account.number} onChange={(event) => setCompanySettings((current) => ({ ...current, bank_accounts: current.bank_accounts.map((item, itemIndex) => itemIndex === index ? { ...item, number: event.target.value } : item) }))} className="rounded-xl border border-input bg-background px-3 py-2.5" />
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => setCompanySettings((current) => ({ ...current, bank_accounts: [...current.bank_accounts, { bank: "Bank Baru", name: "Nama", number: "000000" }] }))} className="mt-3 rounded-xl border border-border bg-white px-4 py-2 text-sm font-semibold text-foreground">+ Tambah rekening</button>
              </div>
            </section>
          )}

          {showPreview && (
            <section id="invoice-print-root" className="rounded-[28px] border border-border bg-white p-5 shadow-card">
              <div className="invoice-preview-toolbar mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-foreground">Preview Invoice</h2>
                <button type="button" onClick={() => setShowPreview(false)} className="rounded-xl border border-border bg-white px-3 py-2 text-sm font-medium text-foreground">Tutup</button>
              </div>
              <InvoicePreview invoice={form} company={companySettings} />
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

const styles = StyleSheet.create({
  page: {
    padding: 24,
    backgroundColor: "#ffffff",
    fontFamily: "Helvetica",
    color: "#111827",
    flexDirection: "column",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 106,
  },
  companyBlock: {
    flex: 1,
    alignItems: "center",
    paddingRight: 56,
  },
  logo: {
    width: 76,
    height: 76,
    objectFit: "contain",
  },
  companyName: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 5,
  },
  muted: {
    fontSize: 11,
    color: "#333333",
    textAlign: "center",
    marginBottom: 2,
  },
  headerRule: {
    borderBottomWidth: 1,
    borderBottomColor: "#222222",
    marginTop: 3,
    marginBottom: 19,
  },
  recipientRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginHorizontal: 14,
    marginBottom: 62,
  },
  metaRow: {
    fontSize: 12,
    marginBottom: 3,
  },
  invoiceMeta: {
    alignItems: "flex-end",
  },
  recipientLabel: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 3,
  },
  recipientName: {
    fontSize: 12,
  },
  tableWrap: {
    marginHorizontal: 0,
  },
  tableHeaderRow: {
    flexDirection: "row",
  },
  tableRow: {
    flexDirection: "row",
  },
  cell: {
    fontSize: 11,
    textAlign: "center",
    paddingVertical: 4,
    paddingHorizontal: 2,
    borderWidth: 0.4,
    borderColor: "#222222",
    height: 28,
  },
  noCol: { width: "5%" },
  carCol: { width: "16%" },
  plateCol: { width: "11%" },
  dateCol: { width: "13%" },
  routeCol: { width: "18%" },
  serviceCol: { width: "17%" },
  daysCol: { width: "8%" },
  totalCol: { width: "12%" },
  grandTotalRow: {
    flexDirection: "row",
    height: 30,
  },
  grandTotalSpacer: {
    width: "45%",
    borderWidth: 0.4,
    borderColor: "#222222",
  },
  grandTotalLabel: {
    width: "43%",
    fontSize: 11,
    fontWeight: "bold",
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderWidth: 0.4,
    borderColor: "#222222",
  },
  grandTotalValue: {
    width: "12%",
    fontSize: 11,
    fontWeight: "bold",
    textAlign: "right",
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderWidth: 0.4,
    borderColor: "#222222",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: "auto",
    marginBottom: 25,
  },
  bankBox: {
    width: 175,
    padding: 11,
    borderWidth: 0.8,
    borderColor: "#222222",
    borderRadius: 10,
  },
  bankEntry: {
    marginBottom: 4,
  },
  bankName: {
    fontSize: 10,
    fontWeight: "bold",
  },
  bankText: {
    fontSize: 9,
    lineHeight: 1.2,
  },
  signatureBox: {
    position: "relative",
    width: 190,
    alignItems: "center",
  },
  signatureWatermark: {
    position: "absolute",
    top: 12,
    left: 30,
    width: 130,
    height: 130,
    opacity: 0.12,
  },
  signText: {
    fontSize: 11,
    marginBottom: 2,
  },
  signCompany: {
    fontSize: 11,
    fontWeight: "bold",
  },
  signature: {
    width: 125,
    height: 62,
    objectFit: "contain",
  },
  signName: {
    fontSize: 11,
    fontWeight: "bold",
  },
  signTitle: {
    fontSize: 10,
  },
  footer: {
    textAlign: "center",
    fontSize: 16,
    fontWeight: "bold",
  },
});
