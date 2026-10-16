import { describe, expect, it } from "vitest";
import { friendlyError } from "./api";

describe("Supabase error messages", () => {
  it("explains invalid login credentials", () => {
    expect(friendlyError({ message: "Invalid login credentials", status: 400 })).toContain("Username atau kata sandi salah");
  });

  it("explains unverified email addresses", () => {
    expect(friendlyError({ message: "Email not confirmed", status: 400 })).toContain("Email belum diverifikasi");
  });

  it("explains missing database migrations", () => {
    expect(friendlyError({ message: "Could not find the function public.next_invoice_number", code: "PGRST202" }))
      .toContain("migrasi database");
  });

  it("explains when a vehicle already has a running rental", () => {
    expect(friendlyError({
      message: 'duplicate key value violates unique constraint "rental_bookings_one_running_per_vehicle_idx"',
      code: "23505",
    })).toContain("sudah memiliki rental berstatus Berjalan");
  });
});
