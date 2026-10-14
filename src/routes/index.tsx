import { createFileRoute } from "@tanstack/react-router";
import { pdf, Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { Buffer } from "buffer/";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CarFront, Ellipsis, FilePlus2, Files, LayoutDashboard, Settings, Users } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../integrations/supabase/client";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "../components/ui/sheet";
import {
  deleteInvoice as deleteCloudInvoice,
  friendlyError,
  getMyRole,
  getSettings,
  listAllInvoices,
  listClients,
  listRentalBookings,
  listVehicles,
  nextInvoiceNumber,
  saveClient,
  saveRentalBooking,
  saveInvoice as saveCloudInvoice,
  saveVehicle,
  updateSettings,
  type RentalBooking,
  type RentalBookingInput,
  type RentalBookingStatus,
  type RentalPaymentStatus,
} from "../lib/api";
import {
  DEFAULT_LOGO,
  DEFAULT_SIGNATURE,
  addDaysToISODate,
  emptyInvoice,
  formatDateID,
  formatDateRangeID,
  formatRupiah,
  grandTotal,
  inclusiveDaysBetween,
  invoiceFilename,
  lineTotal,
  newAdditionalCharge,
  newItem,
  parseRupiah,
  todayISO,
  type CompanySettings,
  type InvoiceAdditionalChargeInput,
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

type NavKey = "dashboard" | "create" | "history" | "clients" | "vehicles" | "rentals" | "settings";
type UserRole = "admin" | "staff";
type RentalFormState = {
  id?: string;
  vehicle_id: string;
  car_type: string;
  plate_number: string;
  customer_name: string;
  whatsapp: string;
  start_date: string;
  end_date: string;
  service: string;
  route: string;
  daily_rate: string;
  deposit: string;
  paid: string;
  payment_status: RentalPaymentStatus;
  booking_status: RentalBookingStatus;
  notes: string;
};

function emptyRentalForm(): RentalFormState {
  const today = todayISO();
  return {
    vehicle_id: "",
    car_type: "",
    plate_number: "",
    customer_name: "",
    whatsapp: "",
    start_date: today,
    end_date: today,
    service: "Dengan Sopir",
    route: "",
    daily_rate: "0",
    deposit: "0",
    paid: "0",
    payment_status: "Belum Bayar",
    booking_status: "Berjalan",
    notes: "",
  };
}

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

const sampleClientIds = new Set(["client-1", "client-2"]);
const sampleVehicleIds = new Set(["vehicle-1", "vehicle-2", "vehicle-3"]);

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
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
  const additionalCharges = invoice.additional_charges ?? [];
  const total = grandTotal(invoice.items, additionalCharges);
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
          {invoice.items.map((item, index) => {
            return (
              <View key={item.key || `item-${index}`} style={styles.tableRow}>
                <Text style={[styles.cell, styles.noCol]}>{index + 1}</Text>
                <Text style={[styles.cell, styles.carCol]}>{item.car_type || ""}</Text>
                <Text style={[styles.cell, styles.plateCol]}>{item.plate_number || ""}</Text>
                <Text style={[styles.cell, styles.dateCol]}>
                  {formatDateRangeID(item.service_date, item.days, true)}
                </Text>
                <Text style={[styles.cell, styles.routeCol]}>{item.route || ""}</Text>
                <Text style={[styles.cell, styles.serviceCol]}>{item.service_type || ""}</Text>
                <Text style={[styles.cell, styles.daysCol]}>{item.days || ""}</Text>
                <Text style={[styles.cell, styles.totalCol]}>
                  {formatRupiah(lineTotal(item.days, item.price_per_day))}
                </Text>
              </View>
            );
          })}
          {Array.from(
            { length: Math.max(0, 10 - invoice.items.length) },
            (_, index) => (
              <View key={`empty-${index}`} style={styles.tableRow}>
                <Text style={[styles.cell, styles.noCol]} />
                <Text style={[styles.cell, styles.carCol]} />
                <Text style={[styles.cell, styles.plateCol]} />
                <Text style={[styles.cell, styles.dateCol]} />
                <Text style={[styles.cell, styles.routeCol]} />
                <Text style={[styles.cell, styles.serviceCol]} />
                <Text style={[styles.cell, styles.daysCol]} />
                <Text style={[styles.cell, styles.totalCol]} />
              </View>
            ),
          )}
        </View>
        <View style={styles.invoiceSummary}>
          {additionalCharges.length > 0 ? (
            <>
              <View style={styles.summaryHeadingRow}>
                <Text style={[styles.summaryCell, styles.summaryDescriptionCol]}>Biaya Tambahan</Text>
                <Text style={[styles.summaryCell, styles.summaryAmountCol]}>Nominal</Text>
              </View>
              {additionalCharges.map((charge, index) => (
                <View key={charge.key || `charge-${index}`} style={styles.summaryRow}>
                  <Text style={[styles.summaryCell, styles.summaryDescriptionCol]}>{charge.description}</Text>
                  <Text style={[styles.summaryCell, styles.summaryAmountCol]}>{formatRupiah(charge.amount)}</Text>
                </View>
              ))}
            </>
          ) : null}
          <View style={styles.summaryTotalRow}>
            <Text style={[styles.summaryCell, styles.summaryTotalLabel]}>Grand Total :</Text>
            <Text style={[styles.summaryCell, styles.summaryTotalAmount]}>{formatRupiah(total)}</Text>
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
  const additionalCharges = invoice.additional_charges ?? [];
  const total = grandTotal(invoice.items, additionalCharges);

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
                <td>{item ? formatDateRangeID(item.service_date, item.days, true) : ""}</td>
                <td>{item?.route || ""}</td>
                <td>{item?.service_type || ""}</td>
                <td>{item?.days || ""}</td>
                <td>{item ? formatRupiah(lineTotal(item.days, item.price_per_day)) : ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <table className="invoice-summary-table">
        <colgroup>
          <col className="invoice-summary-description-col" />
          <col className="invoice-summary-amount-col" />
        </colgroup>
        {additionalCharges.length > 0 ? (
          <>
            <thead>
              <tr>
                <th>Biaya Tambahan</th>
                <th>Nominal</th>
              </tr>
            </thead>
            <tbody>
              {additionalCharges.map((charge, index) => (
                <tr key={charge.key || `charge-${index}`}>
                  <td>{charge.description}</td>
                  <td>{formatRupiah(charge.amount)}</td>
                </tr>
              ))}
            </tbody>
          </>
        ) : null}
        <tfoot>
          <tr>
            <th>Grand Total :</th>
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
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [role, setRole] = useState<UserRole | null>(null);
  const [roleCheckedFor, setRoleCheckedFor] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [cloudError, setCloudError] = useState("");
  const [authForm, setAuthForm] = useState({ email: "", password: "" });
  const [authPending, setAuthPending] = useState(false);
  const [invoiceSaving, setInvoiceSaving] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [localImportCount, setLocalImportCount] = useState(0);
  const [importPending, setImportPending] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [activeTab, setActiveTab] = useState<NavKey>("dashboard");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [companySettings, setCompanySettings] = useState<CompanySettings>(defaultCompanySettings);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [rentalBookings, setRentalBookings] = useState<RentalBooking[]>([]);
  const [form, setForm] = useState<InvoiceInput>(() => emptyFormState("Jakarta"));
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [clientForm, setClientForm] = useState({ company: "", pic: "", phone: "", email: "", address: "" });
  const [vehicleForm, setVehicleForm] = useState({ type: "", plateNumber: "", defaultPrice: "" });
  const [rentalForm, setRentalForm] = useState<RentalFormState>(emptyRentalForm);
  const [rentalSearch, setRentalSearch] = useState("");
  const [rentalStatusFilter, setRentalStatusFilter] = useState<"all" | RentalBookingStatus>("Berjalan");
  const [rentalSaving, setRentalSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [printWhenReady, setPrintWhenReady] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setAuthError(friendlyError(error));
      setSession(data.session);
      setAuthLoading(false);
    }).catch((error: unknown) => {
      if (!active) return;
      setAuthError(friendlyError(error));
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user.id) {
      setRole(null);
      setRoleCheckedFor(null);
      setClients([]);
      setVehicles([]);
      setInvoices([]);
      setRentalBookings([]);
      setLocalImportCount(0);
      return;
    }

    let active = true;
    setCloudLoading(true);
    setCloudError("");
    void (async () => {
      try {
        const nextRole = await getMyRole();
        if (!active) return;
        setRole(nextRole);
        setRoleCheckedFor(session.user.id);
        if (!nextRole) return;

        const [settings, cloudClients, cloudVehicles, cloudInvoices, cloudRentals] = await Promise.all([
          getSettings(),
          listClients(),
          listVehicles(),
          listAllInvoices(),
          listRentalBookings(),
        ]);
        if (!active) return;
        setCompanySettings(settings);
        setClients(cloudClients.map((client) => ({
          id: client.id,
          company: client.company_name,
          pic: client.pic_name ?? "",
          phone: client.phone ?? "",
          email: client.email ?? "",
          address: client.address ?? "",
        })));
        setVehicles(cloudVehicles.map((vehicle) => ({
          id: vehicle.id,
          type: vehicle.car_type,
          plateNumber: vehicle.plate_number,
          defaultPrice: Number(vehicle.default_price ?? 0),
        })));
        setInvoices(cloudInvoices);
        setRentalBookings(cloudRentals);
        const localInvoices = readStorage<InvoiceRecord[]>(STORAGE_KEYS.invoices, []);
        const cloudNumbers = new Set(cloudInvoices.map((invoice) => invoice.invoice_number));
        setLocalImportCount(localInvoices.filter((invoice) => !cloudNumbers.has(invoice.invoice_number)).length);
      } catch (error) {
        if (active) {
          setRoleCheckedFor(session.user.id);
          setCloudError(friendlyError(error));
        }
      } finally {
        if (active) setCloudLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [session?.user.id, reloadKey]);

  useEffect(() => {
    if (!printWhenReady || !showPreview) return;
    const timeout = window.setTimeout(() => {
      window.print();
      setPrintWhenReady(false);
    }, 100);
    return () => window.clearTimeout(timeout);
  }, [printWhenReady, showPreview]);

  const totalNominal = useMemo(
    () => rentalBookings.reduce((sum, booking) => {
      const isExcluded = booking.booking_status === "Dibatalkan" || booking.booking_status === "No Show";
      const isIncluded = booking.booking_status === "Berjalan" || booking.payment_status === "Lunas";
      return isExcluded || !isIncluded
        ? sum
        : sum + inclusiveDaysBetween(booking.start_date, booking.end_date) * booking.daily_rate;
    }, 0),
    [rentalBookings],
  );
  const recentInvoices = useMemo(() => [...invoices].sort((a, b) => b.invoice_date.localeCompare(a.invoice_date)).slice(0, 5), [invoices]);
  const runningRentalCount = useMemo(
    () => rentalBookings.filter((booking) => booking.booking_status === "Berjalan").length,
    [rentalBookings],
  );
  const filteredRentalBookings = useMemo(() => {
    const term = rentalSearch.trim().toLowerCase();
    return rentalBookings.filter((booking) => {
      const matchesStatus = rentalStatusFilter === "all" || booking.booking_status === rentalStatusFilter;
      const matchesSearch = !term || [
        booking.car_type,
        booking.plate_number,
        booking.customer_name,
        booking.whatsapp ?? "",
        booking.route ?? "",
      ].some((value) => value.toLowerCase().includes(term));
      return matchesStatus && matchesSearch;
    });
  }, [rentalBookings, rentalSearch, rentalStatusFilter]);
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
    { key: "rentals", label: "Rental Berjalan" },
    { key: "settings", label: "Pengaturan Perusahaan" },
  ] as const;
  const mobilePrimaryItems = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "create", label: "Buat Invoice", icon: FilePlus2 },
    { key: "history", label: "Riwayat", icon: Files },
    { key: "rentals", label: "Rental", icon: CarFront },
  ] as const;
  const mobileMoreItems = menuItems.filter(
    (item) => !mobilePrimaryItems.some((primaryItem) => primaryItem.key === item.key),
  );

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

  function updateAdditionalCharge(
    index: number,
    field: keyof InvoiceAdditionalChargeInput,
    value: string | number,
  ) {
    setForm((current) => ({
      ...current,
      additional_charges: (current.additional_charges ?? []).map((charge, chargeIndex) => {
        if (chargeIndex !== index) return charge;
        return {
          ...charge,
          [field]: field === "amount" ? Number(value) || 0 : value,
        };
      }),
    }));
  }

  function addAdditionalCharge() {
    setForm((current) => ({
      ...current,
      additional_charges: [
        ...(current.additional_charges ?? []),
        { ...newAdditionalCharge(), key: makeId("charge") },
      ],
    }));
  }

  function removeAdditionalCharge(index: number) {
    setForm((current) => ({
      ...current,
      additional_charges: (current.additional_charges ?? []).filter((_, chargeIndex) => chargeIndex !== index),
    }));
  }

  function updateServiceDate(index: number, field: "start" | "end", value: string) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const startDate = field === "start" ? value : item.service_date;
        const endDate =
          field === "end" ? value : addDaysToISODate(item.service_date, item.days - 1);
        if (
          field === "end" &&
          (!startDate || inclusiveDaysBetween(startDate, endDate) > 365)
        )
          return item;
        if (field === "start" && !startDate) return { ...item, service_date: "" };
        const days = inclusiveDaysBetween(startDate, endDate);
        return {
          ...item,
          service_date: startDate,
          days: days > 0 ? Math.min(days, 365) : 1,
        };
      }),
    }));
  }

  function addItemRow() {
    setForm((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          ...newItem(),
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
    const draft = emptyFormState(companySettings.default_city);
    setForm(draft);
    setSelectedInvoiceId(null);
    setShowPreview(false);
  }

  async function createNewInvoice() {
    try {
      const draft = emptyFormState(companySettings.default_city);
      draft.invoice_number = await nextInvoiceNumber();
      setForm(draft);
      setSelectedInvoiceId(null);
      setShowPreview(false);
      setActiveTab("create");
    } catch (error) {
      window.alert(friendlyError(error));
    }
  }

  function loadEditInvoice(invoice: InvoiceRecord) {
    setForm({
      ...invoice,
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      client_id: invoice.client_id ?? null,
      additional_charges: invoice.additional_charges ?? [],
    });
    setSelectedInvoiceId(invoice.id);
    setShowPreview(false);
    setActiveTab("create");
  }

  async function duplicateInvoice(invoice: InvoiceRecord) {
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...source } = invoice;
    try {
      const duplicate: InvoiceInput = {
        ...source,
        invoice_number: await nextInvoiceNumber(),
        status: "draft",
        items: invoice.items.map((item) => ({ ...item, key: makeId("item") })),
        additional_charges: (invoice.additional_charges ?? []).map((charge) => ({
          ...charge,
          key: makeId("charge"),
        })),
      };
      setForm(duplicate);
      setSelectedInvoiceId(null);
      setShowPreview(false);
      setActiveTab("create");
    } catch (error) {
      window.alert(friendlyError(error));
    }
  }

  async function saveInvoice() {
    const cleanNumber = form.invoice_number.trim();
    if (!cleanNumber) {
      window.alert("Nomor invoice wajib diisi.");
      return;
    }
    if (form.client_name.trim().length === 0) {
      window.alert("Nama perusahaan atau klien wajib diisi.");
      return;
    }
    if (form.items.some((item) => !item.car_type.trim() || !item.service_date || item.days <= 0 || item.days > 365 || item.price_per_day < 0)) {
      window.alert("Terdapat baris kendaraan yang belum valid. Periksa jenis mobil, rentang tanggal, hari, dan harga per hari.");
      return;
    }
    if ((form.additional_charges ?? []).some((charge) =>
      !charge.description.trim() || !Number.isInteger(charge.amount) || charge.amount < 0 || charge.amount > 1_000_000_000
    )) {
      window.alert("Terdapat biaya tambahan yang belum valid. Isi keterangan dan pastikan nominalnya tidak negatif.");
      return;
    }

    const duplicate = invoices.find((invoice) => invoice.invoice_number === cleanNumber && invoice.id !== selectedInvoiceId);
    if (duplicate) {
      window.alert("Nomor invoice sudah digunakan. Gunakan nomor yang berbeda.");
      return;
    }

    setInvoiceSaving(true);
    try {
      const invoiceToSave: InvoiceInput = {
        ...form,
        invoice_number: cleanNumber,
      };
      if (selectedInvoiceId) invoiceToSave.id = selectedInvoiceId;
      const recordId = await saveCloudInvoice(invoiceToSave);
      const cloudInvoices = await listAllInvoices();
      setInvoices(cloudInvoices);
      setSelectedInvoiceId(recordId);
      setShowPreview(true);
      setActiveTab("history");
      window.alert("Invoice berhasil disimpan ke Supabase.");
    } catch (error) {
      window.alert(friendlyError(error));
    } finally {
      setInvoiceSaving(false);
    }
  }

  async function downloadPdf() {
    if (!form.invoice_number.trim()) {
      window.alert("Nomor invoice wajib diisi sebelum unduh PDF.");
      return;
    }
    if (typeof globalThis.Buffer === "undefined") {
      Object.defineProperty(globalThis, "Buffer", { configurable: true, value: Buffer });
    }
    const blob = await pdf(<InvoicePDFDocument invoice={form} company={companySettings} />).toBlob();
    emitDownload(invoiceFilename(form.invoice_number, form.client_name), blob);
  }

  function printInvoice() {
    setShowPreview(true);
    setPrintWhenReady(true);
  }

  async function deleteInvoice(id: string) {
    const invoice = invoices.find((item) => item.id === id);
    if (!invoice) return;
    if (!window.confirm(`Hapus invoice ${invoice.invoice_number}?`)) return;
    try {
      await deleteCloudInvoice(id);
      setInvoices((current) => current.filter((item) => item.id !== id));
      if (selectedInvoiceId === id) resetForm();
    } catch (error) {
      window.alert(friendlyError(error));
    }
  }

  async function addClient() {
    if (!clientForm.company.trim() || !clientForm.pic.trim()) {
      window.alert("Nama perusahaan dan PIC wajib diisi.");
      return;
    }
    try {
      const client = {
        company_name: clientForm.company.trim(),
        pic_name: clientForm.pic.trim(),
        phone: clientForm.phone.trim(),
        email: clientForm.email.trim(),
        address: clientForm.address.trim(),
      };
      const id = await saveClient(client);
      setClients((current) => [{
        id,
        company: client.company_name,
        pic: client.pic_name,
        phone: client.phone,
        email: client.email,
        address: client.address,
      }, ...current]);
      setClientForm({ company: "", pic: "", phone: "", email: "", address: "" });
      window.alert("Data klien berhasil disimpan ke Supabase.");
    } catch (error) {
      window.alert(friendlyError(error));
    }
  }

  async function addVehicle() {
    if (!vehicleForm.type.trim() || !vehicleForm.plateNumber.trim()) {
      window.alert("Jenis mobil dan nomor polisi wajib diisi.");
      return;
    }
    try {
      const vehicle = {
        car_type: vehicleForm.type.trim(),
        plate_number: vehicleForm.plateNumber.trim(),
        default_price: parseRupiah(vehicleForm.defaultPrice || "0"),
      };
      const id = await saveVehicle(vehicle);
      setVehicles((current) => [{
        id,
        type: vehicle.car_type,
        plateNumber: vehicle.plate_number,
        defaultPrice: vehicle.default_price,
      }, ...current]);
      setVehicleForm({ type: "", plateNumber: "", defaultPrice: "" });
      window.alert("Data kendaraan berhasil disimpan ke Supabase.");
    } catch (error) {
      window.alert(friendlyError(error));
    }
  }

  function updateRentalVehicle(vehicleId: string) {
    const vehicle = vehicles.find((item) => item.id === vehicleId);
    setRentalForm((current) => ({
      ...current,
      vehicle_id: vehicleId,
      car_type: vehicle?.type ?? "",
      plate_number: vehicle?.plateNumber ?? "",
      daily_rate: vehicle ? String(vehicle.defaultPrice) : current.daily_rate,
    }));
  }

  function editRentalBooking(booking: RentalBooking) {
    setRentalForm({
      id: booking.id,
      vehicle_id: booking.vehicle_id ?? "",
      car_type: booking.car_type,
      plate_number: booking.plate_number,
      customer_name: booking.customer_name,
      whatsapp: booking.whatsapp ?? "",
      start_date: booking.start_date,
      end_date: booking.end_date,
      service: booking.service,
      route: booking.route ?? "",
      daily_rate: String(booking.daily_rate),
      deposit: String(booking.deposit),
      paid: String(booking.paid),
      payment_status: booking.payment_status,
      booking_status: booking.booking_status,
      notes: booking.notes ?? "",
    });
    setActiveTab("rentals");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submitRentalBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const vehicle = vehicles.find((item) => item.id === rentalForm.vehicle_id);
    const days = inclusiveDaysBetween(rentalForm.start_date, rentalForm.end_date);
    const dailyRate = Number(rentalForm.daily_rate || 0);
    const deposit = Number(rentalForm.deposit || 0);
    const paid = Number(rentalForm.paid || 0);

    if (!vehicle) {
      window.alert("Pilih kendaraan dari Data Kendaraan terlebih dahulu.");
      return;
    }
    if (!rentalForm.customer_name.trim()) {
      window.alert("Nama pelanggan wajib diisi.");
      return;
    }
    if (!days) {
      window.alert("Tanggal selesai harus sama dengan atau setelah tanggal mulai.");
      return;
    }
    if ([dailyRate, deposit, paid].some((amount) =>
      !Number.isSafeInteger(amount) || amount < 0 || amount > 10_000_000_000
    )) {
      window.alert("Nominal harga, deposit, dan pembayaran harus berupa angka bulat yang wajar.");
      return;
    }

    const payload: RentalBookingInput = {
      ...(rentalForm.id ? { id: rentalForm.id } : {}),
      vehicle_id: vehicle.id,
      car_type: vehicle.type,
      plate_number: vehicle.plateNumber,
      customer_name: rentalForm.customer_name.trim(),
      whatsapp: rentalForm.whatsapp.trim() || null,
      start_date: rentalForm.start_date,
      end_date: rentalForm.end_date,
      service: rentalForm.service,
      route: rentalForm.route.trim() || null,
      daily_rate: dailyRate,
      deposit,
      paid,
      payment_status: rentalForm.payment_status,
      booking_status: rentalForm.booking_status,
      notes: rentalForm.notes.trim() || null,
    };

    setRentalSaving(true);
    try {
      const saved = await saveRentalBooking(payload);
      setRentalBookings((current) =>
        [saved, ...current.filter((booking) => booking.id !== saved.id)]
          .sort((a, b) => b.start_date.localeCompare(a.start_date) || b.created_at.localeCompare(a.created_at)),
      );
      setRentalStatusFilter("all");
      setRentalSearch("");
      setRentalForm(emptyRentalForm());
      window.alert("Data rental berhasil disimpan.");
    } catch (error) {
      window.alert(friendlyError(error));
    } finally {
      setRentalSaving(false);
    }
  }

  function cancelRentalEdit() {
    setRentalForm(emptyRentalForm());
  }

  async function saveCompanySettings() {
    setSettingsSaving(true);
    try {
      await updateSettings(companySettings);
      window.alert("Pengaturan perusahaan berhasil disimpan ke Supabase.");
    } catch (error) {
      window.alert(friendlyError(error));
    } finally {
      setSettingsSaving(false);
    }
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError("");
    setAuthPending(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: authForm.email.trim(),
        password: authForm.password,
      });
      if (error) throw error;
      setSession(data.session);
    } catch (error) {
      setAuthError(friendlyError(error));
    } finally {
      setAuthPending(false);
    }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) window.alert(friendlyError(error));
  }

  async function importLocalInvoices() {
    const localInvoices = readStorage<InvoiceRecord[]>(STORAGE_KEYS.invoices, []);
    const cloudNumbers = new Set(invoices.map((invoice) => invoice.invoice_number));
    const toImport = localInvoices.filter((invoice) => !cloudNumbers.has(invoice.invoice_number));
    if (toImport.length === 0) {
      setLocalImportCount(0);
      return;
    }
    if (!window.confirm(`Impor ${toImport.length} invoice dari browser ini ke Supabase? Data lokal tidak akan dihapus.`)) return;

    setImportPending(true);
    let imported = 0;
    const importedInvoices: InvoiceRecord[] = [];
    try {
      for (const invoice of toImport) {
        const { id: _localId, createdAt: _createdAt, updatedAt: _updatedAt, ...invoiceData } = invoice;
        const id = await saveCloudInvoice({
          ...invoiceData,
          client_id: null,
          items: invoice.items.map((item) => ({ ...item, vehicle_id: null })),
          additional_charges: invoice.additional_charges ?? [],
        });
        const timestamp = new Date().toISOString();
        importedInvoices.push({ ...invoice, id, client_id: null, createdAt: timestamp, updatedAt: timestamp });
        cloudNumbers.add(invoice.invoice_number);
        imported += 1;
      }
      setInvoices((current) => [...importedInvoices, ...current]);
      setLocalImportCount(localInvoices.filter((invoice) => !cloudNumbers.has(invoice.invoice_number)).length);
      window.alert(`${imported} invoice berhasil diimpor. Data lokal tetap tersimpan di browser ini.`);
    } catch (error) {
      setInvoices((current) => [...importedInvoices, ...current]);
      setLocalImportCount(localInvoices.filter((invoice) => !cloudNumbers.has(invoice.invoice_number)).length);
      window.alert(`${imported} invoice berhasil diimpor sebelum terjadi kesalahan: ${friendlyError(error)}. Anda dapat mencoba lagi untuk invoice yang belum masuk.`);
    } finally {
      setImportPending(false);
    }
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

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted p-6 text-sm text-muted-foreground">
        Memeriksa sesi Supabase...
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted p-5">
        <form onSubmit={submitAuth} className="w-full max-w-md space-y-5 rounded-[28px] border border-border bg-white p-7 shadow-card">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Vicky Rental Nusantara</div>
            <h1 className="mt-2 text-2xl font-bold text-foreground">Masuk ke Invoice</h1>
          </div>
          <label className="block space-y-2 text-sm">
            <span className="font-medium text-foreground">Email</span>
            <input
              required
              type="email"
              autoComplete="email"
              value={authForm.email}
              onChange={(event) => setAuthForm((current) => ({ ...current, email: event.target.value }))}
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5"
            />
          </label>
          <label className="block space-y-2 text-sm">
            <span className="font-medium text-foreground">Kata sandi</span>
            <input
              required
              type="password"
              minLength={6}
              autoComplete="current-password"
              value={authForm.password}
              onChange={(event) => setAuthForm((current) => ({ ...current, password: event.target.value }))}
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5"
            />
          </label>
          {authError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{authError}</p>}
          <button
            type="submit"
            disabled={authPending}
            className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {authPending ? "Memproses..." : "Masuk"}
          </button>
        </form>
      </div>
    );
  }

  if (!roleCheckedFor || roleCheckedFor !== session.user.id || cloudLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted p-6 text-sm text-muted-foreground">
        Menghubungkan ke Supabase dan memuat data...
      </div>
    );
  }

  if (cloudError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted p-5">
        <div className="w-full max-w-md space-y-4 rounded-[28px] border border-border bg-white p-7 shadow-card">
          <h1 className="text-xl font-bold text-foreground">Data Supabase gagal dimuat</h1>
          <p role="alert" className="text-sm text-muted-foreground">{cloudError}</p>
          <button
            type="button"
            onClick={() => setReloadKey((value) => value + 1)}
            className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
          >
            Coba lagi
          </button>
          <button type="button" onClick={signOut} className="w-full text-sm text-muted-foreground underline">Keluar</button>
        </div>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted p-5">
        <div className="w-full max-w-lg space-y-4 rounded-[28px] border border-border bg-white p-7 shadow-card">
          <h1 className="text-xl font-bold text-foreground">Akun belum diberi akses</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Anda berhasil masuk, tetapi akun ini belum memiliki peran admin/staf. Admin proyek dapat mengganti placeholder email lalu menjalankan perintah ini lewat Supabase SQL Editor:
          </p>
          <code className="block overflow-x-auto rounded-xl bg-muted p-3 text-xs">
            insert into public.user_roles (user_id, role)<br />
            select id, 'staff' from auth.users where email = '&lt;EMAIL_AKUN&gt;'<br />
            on conflict (user_id, role) do nothing;
          </code>
          <button type="button" onClick={signOut} className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Keluar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-foreground)]">
      <div className="mx-auto flex max-w-[1600px] gap-6 p-5 pb-28 lg:p-8">
        <aside className="hidden w-72 shrink-0 rounded-[28px] bg-slate-950 p-5 text-white lg:block">
          <div className="mb-8 flex items-center gap-3">
            <img src={companySettings.logo_path || DEFAULT_LOGO} alt="logo" className="h-12 w-12 rounded-xl object-contain" />
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-300">Manajemen Rental</div>
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
              <h1 className="mt-2 text-3xl font-bold text-foreground">PT VICKY RENTAL NUSANTARA</h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={createNewInvoice}
                className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
              >
                + Buat Invoice
              </button>
              <button
                type="button"
                onClick={() => { cancelRentalEdit(); setActiveTab("rentals"); }}
                className="rounded-xl border border-border px-4 py-3 text-sm font-semibold text-foreground"
              >
                + Catat Rental
              </button>
              <button
                type="button"
                onClick={signOut}
                className="rounded-xl border border-border px-4 py-3 text-sm font-medium text-foreground"
              >
                Keluar
              </button>
            </div>
          </div>

          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <nav
              aria-label="Navigasi utama"
              className="fixed inset-x-0 bottom-0 z-50 flex border-t border-border bg-white/95 px-1 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(15,23,42,0.12)] backdrop-blur lg:hidden"
            >
              {mobilePrimaryItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setActiveTab(item.key)}
                    aria-current={activeTab === item.key ? "page" : undefined}
                    className={`flex min-h-16 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold leading-tight ${
                      activeTab === item.key ? "text-slate-950" : "text-muted-foreground"
                    }`}
                  >
                    <Icon aria-hidden="true" className="h-5 w-5" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
              <SheetTrigger asChild>
                <button
                  type="button"
                  aria-label="Buka menu lainnya"
                  aria-current={mobileMoreItems.some((item) => item.key === activeTab) ? "page" : undefined}
                  className={`flex min-h-16 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold leading-tight ${
                    mobileMoreItems.some((item) => item.key === activeTab) ? "text-slate-950" : "text-muted-foreground"
                  }`}
                >
                  <Ellipsis aria-hidden="true" className="h-5 w-5" />
                  <span>Lainnya</span>
                </button>
              </SheetTrigger>
            </nav>
            <SheetContent
              side="bottom"
              className="max-h-[70vh] overflow-y-auto rounded-t-3xl px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-6 lg:hidden"
            >
              <SheetHeader className="mb-5 text-left">
                <SheetTitle>Navigasi</SheetTitle>
                <SheetDescription>Pilih halaman yang ingin dibuka.</SheetDescription>
              </SheetHeader>
              <div className="grid grid-cols-2 gap-3">
                {mobileMoreItems.map((item) => {
                  const Icon = item.key === "clients" ? Users : item.key === "vehicles" ? CarFront : Settings;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        setActiveTab(item.key);
                        setMobileNavOpen(false);
                      }}
                      aria-current={activeTab === item.key ? "page" : undefined}
                      className={`flex min-h-16 items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-semibold ${
                        activeTab === item.key
                          ? "border-slate-950 bg-slate-950 text-white"
                          : "border-border bg-white text-foreground"
                      }`}
                    >
                      <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </SheetContent>
          </Sheet>

          {localImportCount > 0 && (
            <section className="flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-semibold text-amber-950">Ada {localImportCount} invoice lama di browser ini</div>
                <p className="mt-1 text-amber-900">
                  Impor jika ingin memindahkannya ke Supabase. Invoice lokal tidak akan dihapus.
                </p>
              </div>
              <button
                type="button"
                disabled={importPending}
                onClick={importLocalInvoices}
                className="shrink-0 rounded-xl bg-amber-900 px-4 py-2.5 font-semibold text-white disabled:opacity-60"
              >
                {importPending ? "Mengimpor..." : "Impor invoice lokal"}
              </button>
            </section>
          )}

          {activeTab === "dashboard" && (
            <>
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[24px] border border-border bg-white p-5 shadow-card">
                  <div className="text-sm text-muted-foreground">Total Invoice</div>
                  <div className="mt-2 text-4xl font-bold text-foreground">{invoices.length}</div>
                </div>
                <div className="rounded-[24px] border border-border bg-white p-5 shadow-card">
                  <div className="text-sm text-muted-foreground">Total Nominal Rental</div>
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
                <button
                  type="button"
                  onClick={() => setActiveTab("rentals")}
                  className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-5 text-left shadow-card"
                >
                  <div className="text-sm text-emerald-800">Mobil Sedang Berjalan</div>
                  <div className="mt-2 text-4xl font-bold text-emerald-950">{runningRentalCount}</div>
                  <div className="text-sm text-emerald-800">Lihat data rental aktif</div>
                </button>
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
                            <div className="font-semibold text-foreground">{formatRupiah(grandTotal(invoice.items, invoice.additional_charges ?? []))}</div>
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

          {activeTab === "rentals" && (
            <section className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Data Mobil Berjalan</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Catat rental dan pantau status kendaraan, pelanggan, jadwal, serta pembayaran.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {([
                  ["Berjalan", "Sedang Disewa", "text-emerald-700"],
                  ["Booking", "Booking", "text-amber-700"],
                  ["Selesai", "Selesai", "text-slate-700"],
                ] as const).map(([status, label, color]) => (
                  <div key={status} className="rounded-[24px] border border-border bg-white p-5 shadow-card">
                    <div className="text-sm text-muted-foreground">{label}</div>
                    <div className={`mt-2 text-3xl font-bold ${color}`}>
                      {rentalBookings.filter((booking) => booking.booking_status === status).length}
                    </div>
                  </div>
                ))}
              </div>

              <form onSubmit={submitRentalBooking} className="space-y-5 rounded-[28px] border border-border bg-white p-5 shadow-card">
                <div>
                  <h3 className="text-xl font-bold text-foreground">
                    {rentalForm.id ? "Edit Data Rental" : "Catat Rental Berjalan"}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Total tagihan dihitung dari jumlah hari kalender dikali harga per hari.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-foreground">Kendaraan *</span>
                    <select
                      required
                      value={rentalForm.vehicle_id}
                      onChange={(event) => updateRentalVehicle(event.target.value)}
                      className="w-full rounded-xl border border-input bg-background px-3 py-2.5"
                    >
                      <option value="">Pilih kendaraan</option>
                      {vehicles.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>{vehicle.type} · {vehicle.plateNumber}</option>
                      ))}
                    </select>
                    {vehicles.length === 0 && (
                      <span className="block text-xs text-amber-700">Tambahkan kendaraan melalui menu Data Kendaraan terlebih dahulu.</span>
                    )}
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-foreground">Nama pelanggan *</span>
                    <input required value={rentalForm.customer_name} onChange={(event) => setRentalForm((current) => ({ ...current, customer_name: event.target.value }))} className="w-full rounded-xl border border-input bg-background px-3 py-2.5" />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-foreground">No. WhatsApp</span>
                    <input inputMode="tel" value={rentalForm.whatsapp} onChange={(event) => setRentalForm((current) => ({ ...current, whatsapp: event.target.value }))} className="w-full rounded-xl border border-input bg-background px-3 py-2.5" />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-foreground">Tanggal mulai *</span>
                    <input required type="date" value={rentalForm.start_date} onChange={(event) => setRentalForm((current) => ({ ...current, start_date: event.target.value }))} className="w-full rounded-xl border border-input bg-background px-3 py-2.5" />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-foreground">Tanggal selesai *</span>
                    <input required type="date" min={rentalForm.start_date || undefined} value={rentalForm.end_date} onChange={(event) => setRentalForm((current) => ({ ...current, end_date: event.target.value }))} className="w-full rounded-xl border border-input bg-background px-3 py-2.5" />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-foreground">Layanan</span>
                    <select value={rentalForm.service} onChange={(event) => setRentalForm((current) => ({ ...current, service: event.target.value }))} className="w-full rounded-xl border border-input bg-background px-3 py-2.5">
                      <option>Dengan Sopir</option>
                      <option>Lepas Kunci</option>
                      <option>Rent To Rent (LK)</option>
                      <option>Rent To Rent (All In)</option>
                    </select>
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-foreground">Tujuan / rute</span>
                    <input value={rentalForm.route} onChange={(event) => setRentalForm((current) => ({ ...current, route: event.target.value }))} className="w-full rounded-xl border border-input bg-background px-3 py-2.5" />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-foreground">Harga per hari (Rp)</span>
                    <input type="number" min={0} step={1} value={rentalForm.daily_rate} onChange={(event) => setRentalForm((current) => ({ ...current, daily_rate: event.target.value }))} className="w-full rounded-xl border border-input bg-background px-3 py-2.5" />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-foreground">Deposit (Rp)</span>
                    <input type="number" min={0} step={1} value={rentalForm.deposit} onChange={(event) => setRentalForm((current) => ({ ...current, deposit: event.target.value }))} className="w-full rounded-xl border border-input bg-background px-3 py-2.5" />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-foreground">Sudah dibayar (Rp)</span>
                    <input type="number" min={0} step={1} value={rentalForm.paid} onChange={(event) => setRentalForm((current) => ({ ...current, paid: event.target.value }))} className="w-full rounded-xl border border-input bg-background px-3 py-2.5" />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-foreground">Status pembayaran</span>
                    <select value={rentalForm.payment_status} onChange={(event) => setRentalForm((current) => ({ ...current, payment_status: event.target.value as RentalPaymentStatus }))} className="w-full rounded-xl border border-input bg-background px-3 py-2.5">
                      <option>Belum Bayar</option><option>DP</option><option>Lunas</option><option>Dibatalkan</option>
                    </select>
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-foreground">Status rental</span>
                    <select value={rentalForm.booking_status} onChange={(event) => setRentalForm((current) => ({ ...current, booking_status: event.target.value as RentalBookingStatus }))} className="w-full rounded-xl border border-input bg-background px-3 py-2.5">
                      <option>Booking</option><option>Berjalan</option><option>Selesai</option><option>Dibatalkan</option><option>No Show</option>
                    </select>
                  </label>
                  <label className="space-y-2 text-sm md:col-span-2 xl:col-span-3">
                    <span className="font-medium text-foreground">Catatan</span>
                    <textarea value={rentalForm.notes} onChange={(event) => setRentalForm((current) => ({ ...current, notes: event.target.value }))} className="min-h-24 w-full rounded-xl border border-input bg-background px-3 py-2.5" />
                  </label>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button type="submit" disabled={rentalSaving || vehicles.length === 0} className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
                    {rentalSaving ? "Menyimpan..." : rentalForm.id ? "Simpan Perubahan" : "Simpan Rental"}
                  </button>
                  {rentalForm.id && (
                    <button type="button" onClick={cancelRentalEdit} className="rounded-xl border border-border px-5 py-3 text-sm font-semibold text-foreground">
                      Batal Edit
                    </button>
                  )}
                </div>
              </form>

              <div className="rounded-[28px] border border-border bg-white p-5 shadow-card">
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-foreground">Daftar Rental</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Pilih status Berjalan untuk melihat kendaraan yang sedang digunakan.</p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input value={rentalSearch} onChange={(event) => setRentalSearch(event.target.value)} placeholder="Cari mobil / pelanggan" aria-label="Cari data rental" className="rounded-xl border border-input bg-background px-3 py-2.5 text-sm" />
                    <select value={rentalStatusFilter} onChange={(event) => setRentalStatusFilter(event.target.value as "all" | RentalBookingStatus)} aria-label="Filter status rental" className="rounded-xl border border-input bg-background px-3 py-2.5 text-sm">
                      <option value="Berjalan">Sedang Berjalan</option>
                      <option value="Booking">Booking</option>
                      <option value="Selesai">Selesai</option>
                      <option value="Dibatalkan">Dibatalkan</option>
                      <option value="No Show">No Show</option>
                      <option value="all">Semua Status</option>
                    </select>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1050px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="p-3 font-semibold">Mobil</th>
                        <th className="p-3 font-semibold">Pelanggan</th>
                        <th className="p-3 font-semibold">Jadwal</th>
                        <th className="p-3 font-semibold">Layanan / Rute</th>
                        <th className="p-3 text-right font-semibold">Total / Dibayar</th>
                        <th className="p-3 font-semibold">Status</th>
                        <th className="p-3 font-semibold">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRentalBookings.map((booking) => {
                        const days = inclusiveDaysBetween(booking.start_date, booking.end_date);
                        const total = days * booking.daily_rate;
                        const remaining = Math.max(0, total - booking.paid);
                        return (
                          <tr key={booking.id} className="border-b border-border last:border-0">
                            <td className="p-3"><div className="font-semibold text-foreground">{booking.car_type}</div><div className="text-xs text-muted-foreground">{booking.plate_number}</div></td>
                            <td className="p-3"><div className="font-medium text-foreground">{booking.customer_name}</div><div className="text-xs text-muted-foreground">{booking.whatsapp || "Tanpa nomor WhatsApp"}</div></td>
                            <td className="p-3"><div>{formatDateRangeID(booking.start_date, days, true)}</div><div className="text-xs text-muted-foreground">{days} hari</div></td>
                            <td className="p-3"><div>{booking.service}</div><div className="text-xs text-muted-foreground">{booking.route || "Rute belum diisi"}</div></td>
                            <td className="p-3 text-right"><div className="font-medium">{formatRupiah(total)}</div><div className="text-xs text-muted-foreground">Dibayar {formatRupiah(booking.paid)} · Sisa {formatRupiah(remaining)}</div></td>
                            <td className="p-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${booking.booking_status === "Berjalan" ? "bg-emerald-100 text-emerald-800" : booking.booking_status === "Booking" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"}`}>{booking.booking_status}</span><div className="mt-1 text-xs text-muted-foreground">{booking.payment_status}</div></td>
                            <td className="p-3"><button type="button" onClick={() => editRentalBooking(booking)} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground">Edit</button></td>
                          </tr>
                        );
                      })}
                      {filteredRentalBookings.length === 0 && (
                        <tr><td colSpan={7} className="p-8 text-center text-sm text-muted-foreground">Belum ada data rental untuk filter ini.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
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
                          <span className="font-medium text-foreground">Tanggal dari</span>
                          <input
                            type="date"
                            value={item.service_date}
                            onChange={(event) => updateServiceDate(index, "start", event.target.value)}
                            className="w-full rounded-xl border border-input bg-background px-3 py-2.5 outline-none ring-0 transition focus:border-ring"
                          />
                        </label>
                        <label className="space-y-2 text-sm">
                          <span className="font-medium text-foreground">Tanggal sampai</span>
                          <input
                            type="date"
                            value={addDaysToISODate(item.service_date, item.days - 1)}
                            min={item.service_date || undefined}
                            max={addDaysToISODate(item.service_date, 364) || undefined}
                            onChange={(event) => updateServiceDate(index, "end", event.target.value)}
                            className="w-full rounded-xl border border-input bg-background px-3 py-2.5 outline-none ring-0 transition focus:border-ring"
                          />
                        </label>
                        <label className="space-y-2 text-sm">
                          <span className="font-medium text-foreground">Rute perjalanan</span>
                          <input value={item.route} onChange={(event) => updateItem(index, "route", event.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-2.5 outline-none ring-0 transition focus:border-ring" />
                        </label>
                        <label className="space-y-2 text-sm">
                          <span className="font-medium text-foreground">Tipe layanan</span>
                          <input
                            value={item.service_type}
                            onChange={(event) => updateItem(index, "service_type", event.target.value)}
                            className="w-full rounded-xl border border-input bg-background px-3 py-2.5 outline-none ring-0 transition focus:border-ring"
                          />
                        </label>
                        <label className="space-y-2 text-sm">
                          <span className="font-medium text-foreground">Jumlah hari</span>
                          <input
                            type="number"
                            min={1}
                            max={365}
                            value={item.days}
                            onChange={(event) => updateItem(index, "days", Number(event.target.value))}
                            className="w-full rounded-xl border border-input bg-background px-3 py-2.5 outline-none ring-0 transition focus:border-ring"
                          />
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

                <div className="mt-8 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-foreground">Biaya Tambahan Layanan / Operasional</h3>
                      <p className="text-sm text-muted-foreground">Biaya sekali bayar, tidak dikalikan jumlah hari rental.</p>
                    </div>
                    <button
                      type="button"
                      onClick={addAdditionalCharge}
                      className="shrink-0 rounded-xl border border-border bg-muted px-3 py-2 text-sm font-semibold text-foreground"
                    >
                      + Tambah biaya
                    </button>
                  </div>

                  {(form.additional_charges ?? []).map((charge, index) => (
                    <div key={charge.key || index} className="rounded-[24px] border border-border bg-muted p-4">
                      <div className="mb-4 flex items-center justify-between">
                        <div className="text-sm font-semibold text-foreground">Biaya {index + 1}</div>
                        <button
                          type="button"
                          onClick={() => removeAdditionalCharge(index)}
                          className="text-sm font-medium text-destructive"
                        >
                          Hapus
                        </button>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="space-y-2 text-sm">
                          <span className="font-medium text-foreground">Keterangan biaya</span>
                          <input
                            value={charge.description}
                            onChange={(event) => updateAdditionalCharge(index, "description", event.target.value)}
                            placeholder="Contoh: Biaya antar-jemput bandara"
                            maxLength={120}
                            className="w-full rounded-xl border border-input bg-background px-3 py-2.5 outline-none ring-0 transition focus:border-ring"
                          />
                        </label>
                        <label className="space-y-2 text-sm">
                          <span className="font-medium text-foreground">Nominal (sekali bayar)</span>
                          <input
                            type="number"
                            min={0}
                            max={1_000_000_000}
                            step={1}
                            value={charge.amount}
                            onChange={(event) => updateAdditionalCharge(index, "amount", event.target.value)}
                            className="w-full rounded-xl border border-input bg-background px-3 py-2.5 outline-none ring-0 transition focus:border-ring"
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 rounded-[24px] border border-border bg-amber-50 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">Grand Total</div>
                    <div className="text-2xl font-bold text-foreground">{formatRupiah(grandTotal(form.items, form.additional_charges ?? []))}</div>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button type="button" onClick={() => setShowPreview(true)} className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Preview Invoice</button>
                  <button type="button" onClick={saveInvoice} disabled={invoiceSaving} className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
                    {invoiceSaving ? "Menyimpan..." : "Simpan Invoice"}
                  </button>
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
                          <div className="font-semibold text-foreground">{formatRupiah(grandTotal(invoice.items, invoice.additional_charges ?? []))}</div>
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
              {role === "admin" && (
                <button
                  type="button"
                  onClick={saveCompanySettings}
                  disabled={settingsSaving}
                  className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {settingsSaving ? "Menyimpan..." : "Simpan Pengaturan"}
                </button>
              )}
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
  carCol: { width: "14%" },
  plateCol: { width: "10%" },
  dateCol: { width: "20%" },
  routeCol: { width: "15%" },
  serviceCol: { width: "16%" },
  daysCol: { width: "8%" },
  totalCol: { width: "12%" },
  invoiceSummary: {
    width: "60%",
    alignSelf: "flex-end",
    marginTop: 8,
  },
  summaryHeadingRow: {
    flexDirection: "row",
  },
  summaryRow: {
    flexDirection: "row",
  },
  summaryCell: {
    fontSize: 10,
    paddingVertical: 4,
    paddingHorizontal: 5,
    borderWidth: 0.4,
    borderColor: "#222222",
  },
  summaryDescriptionCol: {
    width: "70%",
    textAlign: "left",
  },
  summaryAmountCol: {
    width: "30%",
    textAlign: "right",
  },
  summaryTotalRow: {
    flexDirection: "row",
    marginTop: 4,
  },
  summaryTotalLabel: {
    fontWeight: "bold",
  },
  summaryTotalAmount: {
    fontWeight: "bold",
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
