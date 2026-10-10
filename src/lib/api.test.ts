import { describe, expect, it } from "vitest";
import { friendlyError } from "./api";

describe("Supabase error messages", () => {
  it("explains invalid login credentials", () => {
    expect(friendlyError({ message: "Invalid login credentials", status: 400 })).toContain("Email atau kata sandi salah");
  });

  it("explains unverified email addresses", () => {
    expect(friendlyError({ message: "Email not confirmed", status: 400 })).toContain("Email belum diverifikasi");
  });

  it("explains missing database migrations", () => {
    expect(friendlyError({ message: "Could not find the function public.next_invoice_number", code: "PGRST202" }))
      .toContain("migrasi database");
  });
});
