import type { InvoiceTemplate } from "./invoice";

const AUTH_EMAIL_DOMAIN = "users.cetak-invoice.invalid";

export function usernameToAuthEmail(username: string): string {
  const normalized = username.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{2,31}$/.test(normalized)) {
    throw new Error("Username harus 3-32 karakter dan hanya boleh berisi huruf, angka, _ atau -.");
  }
  return `${normalized}@${AUTH_EMAIL_DOMAIN}`;
}

export function invoiceTemplateForUsername(username: string): InvoiceTemplate {
  const normalized = username.trim().toLowerCase();
  if (normalized === "boymakmurrentcar") return "boy";
  if (normalized === "tomsrentcar") return "toms";
  return "vicky";
}
