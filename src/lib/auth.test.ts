import { describe, expect, it } from "vitest";
import { invoiceTemplateForUsername, usernameToAuthEmail } from "./auth";

describe("usernameToAuthEmail", () => {
  it("normalizes usernames to the private Supabase Auth address", () => {
    expect(usernameToAuthEmail("  VickyRentCar ")).toBe("vickyrentcar@users.cetak-invoice.invalid");
  });

  describe("invoiceTemplateForUsername", () => {
    it.each([
      ["vickyrentcarnusantara", "vicky"],
      ["boymakmurrentcar", "boy"],
      ["tomsrentcar", "toms"],
    ] as const)("assigns the %s invoice template", (username, template) => {
      expect(invoiceTemplateForUsername(username)).toBe(template);
    });

    it("normalizes username casing and surrounding whitespace", () => {
      expect(invoiceTemplateForUsername(" TomsRentCar ")).toBe("toms");
    });
  });

  it("rejects usernames outside the allowed format", () => {
    expect(() => usernameToAuthEmail("ab")).toThrow("Username harus 3-32 karakter");
    expect(() => usernameToAuthEmail("name@example.com")).toThrow("Username harus 3-32 karakter");
  });
});
