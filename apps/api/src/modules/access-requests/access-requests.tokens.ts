import type { Resend } from "resend";

export const RESEND_CLIENT = Symbol("RESEND_CLIENT");
export const ACCESS_REQUESTS_FETCH = Symbol("ACCESS_REQUESTS_FETCH");

export type AccessRequestsFetch = typeof fetch;
export type ResendClient = Pick<Resend, "emails">;
