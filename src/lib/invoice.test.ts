import { describe, expect, it } from "vitest";
import {
  addDaysToISODate,
  formatDateID,
  formatDateRangeID,
  formatRupiahInput,
  formatRupiah,
  formatBillingQuantity,
  billingUnitLabel,
  isBoyMakmurClient,
  grandTotal,
  inclusiveDaysBetween,
  invoiceFilename,
  lineTotal,
  parseRupiah,
} from "./invoice";

describe("invoice rules", () => {
  it("line total = quantity × unit price", () => {
    expect(lineTotal(3, 450000)).toBe(1350000);
  });
  it("non-positive quantities produce zero, never negative", () => {
    expect(lineTotal(0, 450000)).toBe(0);
    expect(lineTotal(-2, 450000)).toBe(0);
    expect(lineTotal(2, -100)).toBe(0);
  });
  it("grand total sums every row", () => {
    expect(
      grandTotal([
        { quantity: 1, unit_price: 1350000 },
        { quantity: 2, unit_price: 500000 },
      ]),
    ).toBe(2350000);
  });
  it("calculates 12-hour rental units using the unit price", () => {
    expect(grandTotal([{ quantity: 2, unit_price: 350000 }])).toBe(700000);
    expect(formatBillingQuantity(2, "12_hours")).toBe("2 × 12 jam");
    expect(billingUnitLabel("12_hours")).toBe("12 jam");
    expect(isBoyMakmurClient("Boy Makmurrentcar")).toBe(true);
    expect(isBoyMakmurClient("Pelanggan lain")).toBe(false);
  });
  it("adds one-time service charges without multiplying them by rental days", () => {
    expect(
      grandTotal([{ quantity: 6, unit_price: 350000 }], [{ amount: 200000 }, { amount: 50000 }]),
    ).toBe(2350000);
  });
  it("formats Rupiah as Rp1.350.000", () => {
    expect(formatRupiah(1350000)).toBe("Rp1.350.000");
    expect(parseRupiah("Rp1.350.000")).toBe(1350000);
  });
  it("formats amounts as the user types without changing their numeric value", () => {
    expect(formatRupiahInput("350000")).toBe("350.000");
    expect(formatRupiahInput("350.000")).toBe("350.000");
    expect(parseRupiah(formatRupiahInput("350000"))).toBe(350000);
    expect(formatRupiahInput("")).toBe("");
  });
  it("formats Indonesian dates", () => {
    expect(formatDateID("2026-10-09")).toBe("9 Okt 2026");
    expect(formatDateID("2026-10-09", true)).toBe("09 Okt 2026");
  });
  it("calculates and formats inclusive service date ranges", () => {
    expect(addDaysToISODate("2026-10-09", 2)).toBe("2026-10-11");
    expect(inclusiveDaysBetween("2026-10-09", "2026-10-11")).toBe(3);
    expect(inclusiveDaysBetween("2026-10-11", "2026-10-09")).toBe(0);
    expect(formatDateRangeID("2026-10-09", 3, true)).toBe("09-11 Okt 2026");
    expect(formatDateRangeID("2026-10-09", 1, true)).toBe("09 Okt 2026");
  });
  it("builds a clean filename", () => {
    expect(invoiceFilename("15905", "AstrindoTravel Cab Bidakara")).toBe(
      "Invoice-15905-AstrindoTravel.pdf",
    );
    expect(invoiceFilename("15/905", "PT. Ábc: <x>")).toBe("Invoice-15905-Abc.pdf");
  });
});
