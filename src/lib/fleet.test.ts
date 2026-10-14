import { describe, expect, it } from "vitest";

import {
  isExcludedRental,
  isMedanCity,
  rentalDuration,
  rentalNetProfit,
  rentalNormalCost,
  rentalTotal,
  summarizeFleet,
  vehicleTaxStatus,
} from "./fleet";
import type { FleetRental, FleetVehicle } from "./fleet";

const vehicle: FleetVehicle = {
  id: "vehicle-1",
  car_type: "Avanza",
  plate_number: "BK 1234 AA",
  brand: "Toyota",
  model: "Veloz",
  year: 2023,
  color: "Hitam",
  transmission: "Matic",
  capacity: 7,
  status: "Disewa",
  current_km: 12000,
  tax_date: null,
  stnk_date: null,
  insurance_date: null,
  default_price: 500000,
  notes: null,
};

const rental: FleetRental = {
  id: "rental-1",
  city: "Jakarta",
  vehicle_id: vehicle.id,
  car_type: vehicle.car_type,
  plate_number: vehicle.plate_number,
  customer_name: "Pelanggan",
  whatsapp: null,
  start_date: "2026-10-15",
  end_date: "2026-10-16",
  start_time: "10:00",
  end_time: "10:01",
  rental_mode: "24jam",
  service: "Dengan Sopir",
  route: null,
  normal_rate: 300000,
  daily_rate: 500000,
  deposit: 100000,
  paid: 200000,
  driver_cost: 50000,
  payment_status: "DP",
  booking_status: "Berjalan",
  notes: null,
  created_at: "2026-10-14T12:00:00.000Z",
};

describe("fleet calculations", () => {
  it("recognizes Medan in a city label regardless of case or surrounding text", () => {
    expect(isMedanCity("Medan")).toBe(true);
    expect(isMedanCity("Kota Medan, Sumatera Utara")).toBe(true);
    expect(isMedanCity("Semarang")).toBe(false);
  });

  it("counts inclusive calendar dates and rounds 24-hour rentals up", () => {
    expect(rentalDuration("2026-10-15", "2026-10-16", "Kalender")).toBe(2);
    expect(rentalDuration("2026-10-15", "2026-10-16", "24jam", "10:00", "10:01")).toBe(2);
  });

  it("rejects invalid and backwards date/time ranges", () => {
    expect(rentalDuration("2026-02-30", "2026-03-01", "Kalender")).toBe(0);
    expect(rentalDuration("2026-10-16", "2026-10-15", "Kalender")).toBe(0);
    expect(rentalDuration("2026-10-15", "2026-10-15", "24jam", "10:00", "10:00")).toBe(0);
  });

  it("calculates rental totals and excludes cancelled/no-show rentals", () => {
    expect(rentalTotal(rental)).toBe(1_000_000);
    expect(isExcludedRental({ booking_status: "No Show", payment_status: "DP" })).toBe(true);
    const noShow = { ...rental, id: "no-show", booking_status: "No Show" as const };
    const result = summarizeFleet([rental, noShow], "2026-10");
    expect(result.totalBilling).toBe(1_000_000);
    expect(result.normalCost).toBe(600_000);
    expect(result.profit).toBe(350_000);
    expect(result.deposit).toBe(100_000);
    expect(result.remaining).toBe(800_000);
  });

  it("keeps the monthly dashboard totals combined across cities", () => {
    const secondCity = { ...rental, id: "rental-2", city: "Surabaya" };
    const result = summarizeFleet([rental, secondCity], "2026-10");
    expect(result.rentalCount).toBe(2);
    expect(result.normalCost).toBe(1_200_000);
    expect(result.totalBilling).toBe(2_000_000);
  });

  it("calculates net profit using daily normal price, sale price, and driver costs", () => {
    expect(rentalNormalCost(rental)).toBe(600_000);
    expect(rentalNetProfit(rental)).toBe(350_000);
    expect(rentalNetProfit({ ...rental, normal_rate: null })).toBeNull();
  });

  it("classifies tax dates as overdue, due soon, safe, or missing", () => {
    const today = new Date(2026, 9, 15);
    expect(vehicleTaxStatus("2026-10-14", today)).toBe("Terlambat");
    expect(vehicleTaxStatus("2026-11-14", today)).toBe("Segera Jatuh Tempo");
    expect(vehicleTaxStatus("2026-12-15", today)).toBe("Aman");
    expect(vehicleTaxStatus(null, today)).toBe("Belum Diisi");
  });
});
