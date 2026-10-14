export type FleetCarStatus = "Tersedia" | "Disewa" | "Servis";
export type FleetBookingStatus = "Booking" | "Berjalan" | "Selesai" | "Dibatalkan" | "No Show";
export type FleetPaymentStatus = "Belum Bayar" | "DP" | "Lunas" | "Dibatalkan";
export type FleetRentalMode = "Kalender" | "24jam";

export type FleetVehicle = {
  id: string;
  car_type: string;
  plate_number: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  transmission: string;
  capacity: number | null;
  status: FleetCarStatus;
  current_km: number;
  tax_date: string | null;
  stnk_date: string | null;
  insurance_date: string | null;
  default_price: number | null;
  notes: string | null;
};

export type FleetRental = {
  id: string;
  city: string;
  vehicle_id: string | null;
  car_type: string;
  plate_number: string;
  customer_name: string;
  whatsapp: string | null;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  rental_mode: FleetRentalMode;
  service: string;
  route: string | null;
  normal_rate: number | null;
  daily_rate: number;
  deposit: number;
  paid: number;
  driver_cost: number;
  payment_status: FleetPaymentStatus;
  booking_status: FleetBookingStatus;
  notes: string | null;
  created_at: string;
};

export function isMedanCity(city: string): boolean {
  return /\bmedan\b/i.test(city.trim());
}

function dateTimeValue(date: string, time: string): number | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!dateMatch || !timeMatch) return null;
  const [, year, month, day] = dateMatch;
  const value = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
  );
  const parsed = new Date(value);
  if (
    parsed.getUTCFullYear() !== Number(year) ||
    parsed.getUTCMonth() !== Number(month) - 1 ||
    parsed.getUTCDate() !== Number(day)
  )
    return null;
  return value;
}

export function rentalDuration(
  startDate: string,
  endDate: string,
  mode: FleetRentalMode,
  startTime?: string | null,
  endTime?: string | null,
): number {
  if (mode === "24jam") {
    const start = dateTimeValue(startDate, startTime ?? "");
    const end = dateTimeValue(endDate, endTime ?? "");
    if (start === null || end === null || end <= start) return 0;
    return Math.ceil((end - start) / 86_400_000);
  }

  const start = dateTimeValue(startDate, "00:00");
  const end = dateTimeValue(endDate, "00:00");
  if (start === null || end === null || end < start) return 0;
  return Math.floor((end - start) / 86_400_000) + 1;
}

export function rentalTotal(
  rental: Pick<
    FleetRental,
    "start_date" | "end_date" | "rental_mode" | "start_time" | "end_time" | "daily_rate"
  >,
): number {
  return (
    rentalDuration(
      rental.start_date,
      rental.end_date,
      rental.rental_mode,
      rental.start_time,
      rental.end_time,
    ) * rental.daily_rate
  );
}

export function rentalNormalCost(
  rental: Pick<
    FleetRental,
    "start_date" | "end_date" | "rental_mode" | "start_time" | "end_time" | "normal_rate"
  >,
): number | null {
  if (rental.normal_rate === null) return null;
  return (
    rentalDuration(
      rental.start_date,
      rental.end_date,
      rental.rental_mode,
      rental.start_time,
      rental.end_time,
    ) * rental.normal_rate
  );
}

export function rentalNetProfit(
  rental: Pick<
    FleetRental,
    | "start_date"
    | "end_date"
    | "rental_mode"
    | "start_time"
    | "end_time"
    | "normal_rate"
    | "daily_rate"
    | "driver_cost"
  >,
): number | null {
  const normalCost = rentalNormalCost(rental);
  if (normalCost === null) return null;
  return rentalTotal(rental) - normalCost - rental.driver_cost;
}

export function isExcludedRental(
  rental: Pick<FleetRental, "booking_status" | "payment_status">,
): boolean {
  return (
    rental.booking_status === "Dibatalkan" ||
    rental.booking_status === "No Show" ||
    rental.payment_status === "Dibatalkan"
  );
}

export function vehicleTaxStatus(taxDate: string | null, today = new Date()): string {
  if (!taxDate) return "Belum Diisi";
  const parsed = dateTimeValue(taxDate, "00:00");
  if (parsed === null) return "Belum Diisi";
  const due = new Date(parsed);
  const current = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const daysRemaining = Math.ceil((parsed - current) / 86_400_000);
  if (daysRemaining < 0) return "Terlambat";
  if (daysRemaining <= 30) return "Segera Jatuh Tempo";
  return "Aman";
}

export function rentalMonth(rental: Pick<FleetRental, "start_date" | "created_at">): string {
  return rental.start_date || rental.created_at.slice(0, 7);
}

export function summarizeFleet(rentals: FleetRental[], month: string) {
  const monthRentals = rentals.filter((rental) => rentalMonth(rental).startsWith(month));
  const included = monthRentals.filter((rental) => !isExcludedRental(rental));
  const totalBilling = included.reduce((sum, rental) => sum + rentalTotal(rental), 0);
  const pricedRentals = included.filter((rental) => rental.normal_rate !== null);
  const profit = pricedRentals.reduce((sum, rental) => sum + (rentalNetProfit(rental) ?? 0), 0);

  return {
    rentalCount: included.length,
    completed: monthRentals.filter((rental) => rental.booking_status === "Selesai").length,
    missingNormalRate: included.filter((rental) => rental.normal_rate === null).length,
    totalBilling,
    normalCost: pricedRentals.reduce((sum, rental) => sum + (rentalNormalCost(rental) ?? 0), 0),
    profit,
    deposit: included.reduce((sum, rental) => sum + rental.deposit, 0),
    remaining: included.reduce(
      (sum, rental) => sum + Math.max(0, rentalTotal(rental) - rental.paid),
      0,
    ),
    rentals: monthRentals,
  };
}
