import { describe, expect, it } from "vitest";
import { formatRupiah, grandTotal, invoiceFilename, lineTotal, parseRupiah, formatDateID } from "./invoice";

describe("invoice rules", () => {
  it("line total = days × price per day", () => {
    expect(lineTotal(3, 450000)).toBe(1350000);
  });
  it("non-positive days produce zero, never negative", () => {
    expect(lineTotal(0, 450000)).toBe(0);
    expect(lineTotal(-2, 450000)).toBe(0);
    expect(lineTotal(2, -100)).toBe(0);
  });
  it("grand total sums every row", () => {
    expect(grandTotal([{ days: 1, price_per_day: 1350000 }, { days: 2, price_per_day: 500000 }])).toBe(2350000);
  });
  it("formats Rupiah as Rp1.350.000", () => {
    expect(formatRupiah(1350000)).toBe("Rp1.350.000");
    expect(parseRupiah("Rp1.350.000")).toBe(1350000);
  });
  it("formats Indonesian dates", () => {
    expect(formatDateID("2026-10-09")).toBe("9 Okt 2026");
    expect(formatDateID("2026-10-09", true)).toBe("09 Okt 2026");
  });
  it("builds a clean filename", () => {
    expect(invoiceFilename("15905", "AstrindoTravel Cab Bidakara")).toBe("Invoice-15905-AstrindoTravel.pdf");
    expect(invoiceFilename("15/905", "PT. Ábc: <x>")).toBe("Invoice-15905-Abc.pdf");
  });
});
