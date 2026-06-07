import { currencies } from "@adpropia/shared";
import { z } from "zod";

export const paymentSchema = z.object({
  contractId: z.string({ error: "Seleccioná un contrato" }).min(1, "Seleccioná un contrato"),
  renterId: z.string({ error: "Seleccioná un inquilino" }).min(1, "Seleccioná un inquilino"),
  dueAmountCents: z
    .number({ error: "Ingresá un importe adeudado válido" })
    .int("El importe adeudado debe ser un número entero")
    .nonnegative("El importe adeudado no puede ser negativo"),
  paidAmountCents: z
    .number({ error: "Ingresá un importe pagado válido" })
    .int("El importe pagado debe ser un número entero")
    .nonnegative("El importe pagado no puede ser negativo"),
  currency: z.enum(currencies, { error: "Seleccioná una moneda válida" }).default("ARS"),
  dueAt: z.coerce.date({ error: "Ingresá una fecha de vencimiento válida" }),
  paidAt: z.coerce.date({ error: "Ingresá una fecha de pago válida" }).optional(),
  notes: z.string().max(1000, "Las notas no pueden superar los 1000 caracteres").optional()
});

export type PaymentInput = z.infer<typeof paymentSchema>;
