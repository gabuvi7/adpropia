import type { Currency, LiquidationAdjustmentSign } from "@adpropia/database";
import { describe, expect, it } from "vitest";
import {
  type CalculatorAdjustment,
  type CalculatorInput,
  type CalculatorPayment,
  type CalculatorPropertyCommission,
  calculateOwnerSettlementInputs,
  LiquidationCalculator
} from "./liquidation-calculator";

const PERIOD_START = new Date("2026-04-01T00:00:00.000Z");
const PERIOD_END = new Date("2026-04-30T23:59:59.999Z");

function buildPayment(overrides: Partial<CalculatorPayment> = {}): CalculatorPayment {
  return {
    paymentId: "pay-1",
    contractId: "contract-1",
    propertyId: "prop-1",
    propertyAddress: "Av. Siempreviva 742",
    paidAt: new Date("2026-04-15T12:00:00.000Z"),
    paidAmount: "100000.00",
    dueAmount: "100000.00",
    currency: "ARS",
    status: "PAID",
    ...overrides
  };
}

function buildInput(overrides: Partial<CalculatorInput> = {}): CalculatorInput {
  return {
    payments: [],
    propertyCommissions: [],
    defaultCommissionBps: 0,
    currency: "ARS",
    periodStart: PERIOD_START,
    periodEnd: PERIOD_END,
    ...overrides
  };
}

describe("LiquidationCalculator", () => {
  // ──────────────────────────────────────────────────────────────────────────
  // Bloque A — gross calculation (REQ-001)
  // ──────────────────────────────────────────────────────────────────────────
  describe("Bloque A — cálculo de gross", () => {
    it("input vacío devuelve totals en 0.00 y lineItems vacíos", () => {
      const calc = new LiquidationCalculator();
      const result = calc.calculate(buildInput());

      expect(result.lineItems).toEqual([]);
      expect(result.totals).toEqual({
        grossAmount: "0.00",
        commissionAmount: "0.00",
        adjustmentsTotal: "0.00",
        netAmount: "0.00",
        currency: "ARS"
      });
    });

    it("pago PAID exacto entra completo (paidAmount === dueAmount)", () => {
      const calc = new LiquidationCalculator();
      const result = calc.calculate(
        buildInput({
          payments: [buildPayment({ paidAmount: "100000.00", dueAmount: "100000.00" })]
        })
      );

      expect(result.lineItems).toHaveLength(1);
      expect(result.lineItems[0]!.liquidableAmount).toBe("100000.00");
      expect(result.totals.grossAmount).toBe("100000.00");
    });

    it("pago PARTIAL entra por paidAmount (< dueAmount)", () => {
      const calc = new LiquidationCalculator();
      const result = calc.calculate(
        buildInput({
          payments: [
            buildPayment({
              status: "PARTIAL",
              paidAmount: "40000.00",
              dueAmount: "100000.00"
            })
          ]
        })
      );

      expect(result.lineItems[0]!.liquidableAmount).toBe("40000.00");
      expect(result.totals.grossAmount).toBe("40000.00");
    });

    it("pago OVERPAID entra topado a dueAmount (paidAmount > dueAmount)", () => {
      const calc = new LiquidationCalculator();
      const result = calc.calculate(
        buildInput({
          payments: [
            buildPayment({
              status: "OVERPAID",
              paidAmount: "150000.00",
              dueAmount: "100000.00"
            })
          ]
        })
      );

      expect(result.lineItems[0]!.liquidableAmount).toBe("100000.00");
      expect(result.totals.grossAmount).toBe("100000.00");
    });

    it.each<["VOIDED" | "PENDING"]>([["VOIDED"], ["PENDING"]])(
      "pago en status %s se excluye",
      (status) => {
        const calc = new LiquidationCalculator();
        const result = calc.calculate(
          buildInput({ payments: [buildPayment({ status })] })
        );

        expect(result.lineItems).toEqual([]);
        expect(result.totals.grossAmount).toBe("0.00");
      }
    );

    it("pago en otra currency se excluye", () => {
      const calc = new LiquidationCalculator();
      const result = calc.calculate(
        buildInput({
          currency: "ARS",
          payments: [buildPayment({ currency: "USD", paidAmount: "1000.00" })]
        })
      );

      expect(result.lineItems).toEqual([]);
      expect(result.totals.grossAmount).toBe("0.00");
    });

    it("pago con paidAt anterior a periodStart se excluye", () => {
      const calc = new LiquidationCalculator();
      const result = calc.calculate(
        buildInput({
          payments: [
            buildPayment({ paidAt: new Date("2026-03-31T23:59:59.999Z") })
          ]
        })
      );

      expect(result.lineItems).toEqual([]);
    });

    it("pago con paidAt posterior a periodEnd se excluye", () => {
      const calc = new LiquidationCalculator();
      const result = calc.calculate(
        buildInput({
          payments: [
            buildPayment({ paidAt: new Date("2026-05-01T00:00:00.000Z") })
          ]
        })
      );

      expect(result.lineItems).toEqual([]);
    });

    it("paidAt exactamente en periodStart entra (rango inclusivo)", () => {
      const calc = new LiquidationCalculator();
      const result = calc.calculate(
        buildInput({
          payments: [buildPayment({ paidAt: PERIOD_START })]
        })
      );
      expect(result.lineItems).toHaveLength(1);
    });

    it("paidAt exactamente en periodEnd entra (rango inclusivo)", () => {
      const calc = new LiquidationCalculator();
      const result = calc.calculate(
        buildInput({
          payments: [buildPayment({ paidAt: PERIOD_END })]
        })
      );
      expect(result.lineItems).toHaveLength(1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Bloque B — comisión jerárquica (REQ-002)
  // ──────────────────────────────────────────────────────────────────────────
  describe("Bloque B — comisión jerárquica", () => {
    it("property con commissionBps propio (700 bps = 7%) usa ese bps", () => {
      const calc = new LiquidationCalculator();
      const result = calc.calculate(
        buildInput({
          payments: [buildPayment({ propertyId: "prop-1", paidAmount: "100000.00" })],
          propertyCommissions: [{ propertyId: "prop-1", commissionBps: 700 }],
          defaultCommissionBps: 500
        })
      );

      expect(result.lineItems[0]!.commissionBpsApplied).toBe(700);
      expect(result.lineItems[0]!.commissionAmount).toBe("7000.00");
    });

    it("property sin commissionBps (null) cae al defaultCommissionBps", () => {
      const calc = new LiquidationCalculator();
      const result = calc.calculate(
        buildInput({
          payments: [buildPayment({ propertyId: "prop-1", paidAmount: "100000.00" })],
          propertyCommissions: [{ propertyId: "prop-1", commissionBps: null }],
          defaultCommissionBps: 500
        })
      );

      expect(result.lineItems[0]!.commissionBpsApplied).toBe(500);
      expect(result.lineItems[0]!.commissionAmount).toBe("5000.00");
    });

    it("property no presente en propertyCommissions cae al defaultCommissionBps", () => {
      const calc = new LiquidationCalculator();
      const result = calc.calculate(
        buildInput({
          payments: [buildPayment({ propertyId: "prop-X", paidAmount: "100000.00" })],
          propertyCommissions: [],
          defaultCommissionBps: 500
        })
      );

      expect(result.lineItems[0]!.commissionBpsApplied).toBe(500);
      expect(result.lineItems[0]!.commissionAmount).toBe("5000.00");
    });

    it("ambos bps en 0 produce commissionBpsApplied=0 (snapshot exacto) y commissionAmount=0.00", () => {
      const calc = new LiquidationCalculator();
      const result = calc.calculate(
        buildInput({
          payments: [buildPayment({ propertyId: "prop-1", paidAmount: "100000.00" })],
          propertyCommissions: [{ propertyId: "prop-1", commissionBps: 0 }],
          defaultCommissionBps: 0
        })
      );

      expect(result.lineItems[0]!.commissionBpsApplied).toBe(0);
      expect(result.lineItems[0]!.commissionAmount).toBe("0.00");
      expect(result.lineItems[0]!.netAmount).toBe("100000.00");
    });

    it("bps=1500 (15%) sobre paidAmount=100000.00 → commissionAmount=15000.00", () => {
      const calc = new LiquidationCalculator();
      const result = calc.calculate(
        buildInput({
          payments: [buildPayment({ propertyId: "prop-1", paidAmount: "100000.00" })],
          propertyCommissions: [{ propertyId: "prop-1", commissionBps: 1500 }],
          defaultCommissionBps: 0
        })
      );

      expect(result.lineItems[0]!.commissionAmount).toBe("15000.00");
      expect(result.lineItems[0]!.netAmount).toBe("85000.00");
    });

    it("bps=333 (3.33%) sobre paidAmount=100000.00 → commissionAmount=3330.00", () => {
      const calc = new LiquidationCalculator();
      const result = calc.calculate(
        buildInput({
          payments: [buildPayment({ propertyId: "prop-1", paidAmount: "100000.00" })],
          propertyCommissions: [{ propertyId: "prop-1", commissionBps: 333 }],
          defaultCommissionBps: 0
        })
      );

      expect(result.lineItems[0]!.commissionAmount).toBe("3330.00");
    });

    it("trunca hacia abajo: bps=1, paidAmount=0.10 → commissionAmount=0.00 (10 cents * 1 / 10000 = 0)", () => {
      const calc = new LiquidationCalculator();
      const result = calc.calculate(
        buildInput({
          payments: [
            buildPayment({
              propertyId: "prop-1",
              paidAmount: "0.10",
              dueAmount: "0.10"
            })
          ],
          propertyCommissions: [{ propertyId: "prop-1", commissionBps: 1 }],
          defaultCommissionBps: 0
        })
      );

      expect(result.lineItems[0]!.liquidableAmount).toBe("0.10");
      expect(result.lineItems[0]!.commissionBpsApplied).toBe(1);
      expect(result.lineItems[0]!.commissionAmount).toBe("0.00");
      expect(result.lineItems[0]!.netAmount).toBe("0.10");
    });

    it("commission se calcula sobre liquidableAmount y no sobre paidAmount cuando hay OVERPAID", () => {
      const calc = new LiquidationCalculator();
      const result = calc.calculate(
        buildInput({
          payments: [
            buildPayment({
              propertyId: "prop-1",
              status: "OVERPAID",
              paidAmount: "200000.00",
              dueAmount: "100000.00"
            })
          ],
          propertyCommissions: [{ propertyId: "prop-1", commissionBps: 1000 }], // 10%
          defaultCommissionBps: 0
        })
      );

      expect(result.lineItems[0]!.liquidableAmount).toBe("100000.00");
      expect(result.lineItems[0]!.commissionAmount).toBe("10000.00");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Bloque C — ajustes manuales (REQ-003)
  // ──────────────────────────────────────────────────────────────────────────
  describe("Bloque C — ajustes manuales", () => {
    function buildAdjustment(
      sign: LiquidationAdjustmentSign,
      amount: string,
      concept = "Ajuste"
    ): CalculatorAdjustment {
      return { concept, amount, sign };
    }

    it("adjustment CREDIT suma al neto", () => {
      const calc = new LiquidationCalculator();
      const result = calc.calculate(
        buildInput({
          payments: [buildPayment({ paidAmount: "100000.00" })],
          propertyCommissions: [{ propertyId: "prop-1", commissionBps: 1000 }], // 10000.00 commission
          defaultCommissionBps: 0,
          adjustments: [buildAdjustment("CREDIT", "5000.00")]
        })
      );

      expect(result.totals.grossAmount).toBe("100000.00");
      expect(result.totals.commissionAmount).toBe("10000.00");
      expect(result.totals.adjustmentsTotal).toBe("5000.00");
      expect(result.totals.netAmount).toBe("95000.00"); // 100000 - 10000 + 5000
    });

    it("adjustment DEBIT resta del neto", () => {
      const calc = new LiquidationCalculator();
      const result = calc.calculate(
        buildInput({
          payments: [buildPayment({ paidAmount: "100000.00" })],
          propertyCommissions: [{ propertyId: "prop-1", commissionBps: 1000 }],
          defaultCommissionBps: 0,
          adjustments: [buildAdjustment("DEBIT", "8000.00")]
        })
      );

      expect(result.totals.adjustmentsTotal).toBe("-8000.00");
      expect(result.totals.netAmount).toBe("82000.00"); // 100000 - 10000 - 8000
    });

    it("mezcla CREDIT + DEBIT calcula adjustmentsTotal = sum(CREDIT) - sum(DEBIT)", () => {
      const calc = new LiquidationCalculator();
      const result = calc.calculate(
        buildInput({
          payments: [buildPayment({ paidAmount: "100000.00" })],
          propertyCommissions: [{ propertyId: "prop-1", commissionBps: 1000 }],
          defaultCommissionBps: 0,
          adjustments: [
            buildAdjustment("CREDIT", "3000.00", "Bonificación A"),
            buildAdjustment("CREDIT", "2000.00", "Bonificación B"),
            buildAdjustment("DEBIT", "1500.00", "Reintegro")
          ]
        })
      );

      // CREDIT = 5000, DEBIT = 1500, total = 3500
      expect(result.totals.adjustmentsTotal).toBe("3500.00");
      expect(result.totals.netAmount).toBe("93500.00"); // 100000 - 10000 + 3500
    });

    it("sin adjustments: adjustmentsTotal=0.00 y net=gross-commission", () => {
      const calc = new LiquidationCalculator();
      const result = calc.calculate(
        buildInput({
          payments: [buildPayment({ paidAmount: "100000.00" })],
          propertyCommissions: [{ propertyId: "prop-1", commissionBps: 1000 }],
          defaultCommissionBps: 0
          // adjustments omitido
        })
      );

      expect(result.totals.adjustmentsTotal).toBe("0.00");
      expect(result.totals.netAmount).toBe("90000.00");
    });

    it("adjustments con DEBIT > gross-commission: el calculator NO valida positividad, deja el neto negativo", () => {
      const calc = new LiquidationCalculator();
      const result = calc.calculate(
        buildInput({
          payments: [buildPayment({ paidAmount: "10000.00" })],
          propertyCommissions: [{ propertyId: "prop-1", commissionBps: 0 }],
          defaultCommissionBps: 0,
          adjustments: [{ concept: "Multa", amount: "50000.00", sign: "DEBIT" }]
        })
      );

      // 10000 - 0 - 50000 = -40000
      expect(result.totals.adjustmentsTotal).toBe("-50000.00");
      expect(result.totals.netAmount).toBe("-40000.00");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Bloque D — snapshot inmutable
  // ──────────────────────────────────────────────────────────────────────────
  describe("Bloque D — snapshot inmutable", () => {
    it("commissionBpsApplied del resultado no cambia si después se mutara el array original de propertyCommissions", () => {
      const calc = new LiquidationCalculator();
      const propertyCommissions: CalculatorPropertyCommission[] = [
        { propertyId: "prop-1", commissionBps: 700 }
      ];

      const result = calc.calculate(
        buildInput({
          payments: [buildPayment({ propertyId: "prop-1", paidAmount: "100000.00" })],
          propertyCommissions,
          defaultCommissionBps: 500
        })
      );

      // Mutamos el input *después* del cálculo. El resultado ya emitido no debe cambiar.
      propertyCommissions[0] = { propertyId: "prop-1", commissionBps: 9999 };

      expect(result.lineItems[0]!.commissionBpsApplied).toBe(700);
      expect(result.lineItems[0]!.commissionAmount).toBe("7000.00");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Bloque E — multi-currency (REQ-004)
  // ──────────────────────────────────────────────────────────────────────────
  describe("Bloque E — multi-currency", () => {
    it("input currency=ARS con un pago USD: se excluye el USD sin error y los totales son en ARS", () => {
      const calc = new LiquidationCalculator();
      const result = calc.calculate(
        buildInput({
          currency: "ARS",
          payments: [
            buildPayment({
              paymentId: "ars-1",
              paidAt: new Date("2026-04-10T00:00:00.000Z"),
              currency: "ARS",
              paidAmount: "100000.00"
            }),
            buildPayment({
              paymentId: "usd-1",
              paidAt: new Date("2026-04-11T00:00:00.000Z"),
              currency: "USD",
              paidAmount: "1000.00"
            })
          ]
        })
      );

      expect(result.lineItems).toHaveLength(1);
      expect(result.lineItems[0]!.paymentId).toBe("ars-1");
      expect(result.lineItems[0]!.currency).toBe("ARS");
      expect(result.totals.currency).toBe("ARS");
    });

    it("todos los line items y totals heredan input.currency", () => {
      const calc = new LiquidationCalculator();
      const usdCurrency: Currency = "USD";
      const result = calc.calculate(
        buildInput({
          currency: usdCurrency,
          payments: [buildPayment({ currency: "USD", paidAmount: "500.00" })]
        })
      );

      expect(result.lineItems[0]!.currency).toBe("USD");
      expect(result.totals.currency).toBe("USD");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Bloque F — orden de line items
  // ──────────────────────────────────────────────────────────────────────────
  describe("Bloque F — orden de line items", () => {
    it("ordena line items por paidAt asc", () => {
      const calc = new LiquidationCalculator();
      const result = calc.calculate(
        buildInput({
          payments: [
            buildPayment({
              paymentId: "pay-c",
              paidAt: new Date("2026-04-20T00:00:00.000Z")
            }),
            buildPayment({
              paymentId: "pay-a",
              paidAt: new Date("2026-04-05T00:00:00.000Z")
            }),
            buildPayment({
              paymentId: "pay-b",
              paidAt: new Date("2026-04-10T00:00:00.000Z")
            })
          ]
        })
      );

      expect(result.lineItems.map((li) => li.paymentId)).toEqual([
        "pay-a",
        "pay-b",
        "pay-c"
      ]);
    });

    it("paidAt empate: ordena por paymentId asc", () => {
      const calc = new LiquidationCalculator();
      const sameDate = new Date("2026-04-15T12:00:00.000Z");
      const result = calc.calculate(
        buildInput({
          payments: [
            buildPayment({ paymentId: "pay-z", paidAt: sameDate }),
            buildPayment({ paymentId: "pay-a", paidAt: sameDate }),
            buildPayment({ paymentId: "pay-m", paidAt: sameDate })
          ]
        })
      );

      expect(result.lineItems.map((li) => li.paymentId)).toEqual([
        "pay-a",
        "pay-m",
        "pay-z"
      ]);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Sumas con múltiples line items
  // ──────────────────────────────────────────────────────────────────────────
  describe("agregación con múltiples line items", () => {
    it("totals son la suma exacta de cada line item (gross y commission)", () => {
      const calc = new LiquidationCalculator();
      const result = calc.calculate(
        buildInput({
          payments: [
            buildPayment({
              paymentId: "p1",
              propertyId: "prop-1",
              paidAmount: "30000.00",
              dueAmount: "30000.00",
              paidAt: new Date("2026-04-05T00:00:00.000Z")
            }),
            buildPayment({
              paymentId: "p2",
              propertyId: "prop-2",
              paidAmount: "70000.00",
              dueAmount: "70000.00",
              paidAt: new Date("2026-04-10T00:00:00.000Z")
            })
          ],
          propertyCommissions: [
            { propertyId: "prop-1", commissionBps: 1000 }, // 3000
            { propertyId: "prop-2", commissionBps: 500 } // 3500
          ],
          defaultCommissionBps: 0
        })
      );

      expect(result.totals.grossAmount).toBe("100000.00");
      expect(result.totals.commissionAmount).toBe("6500.00");
      expect(result.totals.netAmount).toBe("93500.00");
    });
  });

  describe("owner settlement inputs", () => {
    it("blocks estimated rent periods before owner settlement inputs are calculated", () => {
      expect(() =>
        calculateOwnerSettlementInputs({
          contractCommissionBps: 1000,
          currency: "ARS",
          periods: [
            {
              rentPeriodId: "period-1",
              propertyId: "prop-1",
              calculationState: "ESTIMATED",
              estimatedAmount: "120000.00",
              realAmount: null
            }
          ],
          ownershipShares: [
            { propertyId: "prop-1", ownerPersonaId: "owner-persona-1", ownershipShareBps: 10000 }
          ]
        })
      ).toThrow("No se puede liquidar un período estimado sin monto real reconciliado.");
    });

    it("uses reconciled real amount minus contract commission and distributes by ownership share", () => {
      const result = calculateOwnerSettlementInputs({
        contractCommissionBps: 1000,
        currency: "ARS",
        periods: [
          {
            rentPeriodId: "period-1",
            propertyId: "prop-1",
            calculationState: "RECONCILED",
            estimatedAmount: "100000.00",
            realAmount: "120000.00"
          }
        ],
        ownershipShares: [
          { propertyId: "prop-1", ownerPersonaId: "owner-persona-1", ownershipShareBps: 6000 },
          { propertyId: "prop-1", ownerPersonaId: "owner-persona-2", ownershipShareBps: 4000 }
        ]
      });

      expect(result.totals).toEqual({
        realAmount: "120000.00",
        commissionAmount: "12000.00",
        ownerPayoutBaseAmount: "108000.00",
        currency: "ARS"
      });
      expect(result.ownerInputs.map((input) => input.ownerPersonaId)).toEqual([
        "owner-persona-1",
        "owner-persona-2"
      ]);
      expect(result.ownerInputs.map((input) => input.ownershipShareBps)).toEqual([6000, 4000]);
      expect(result.ownerInputs.map((input) => input.ownerPayoutAmount)).toEqual(["64800.00", "43200.00"]);
      expect(result.ownerInputs[0]).toEqual(
        expect.objectContaining({
          rentPeriodId: "period-1",
          propertyId: "prop-1",
          realAmount: "120000.00",
          contractCommissionBps: 1000,
          commissionAmount: "12000.00",
          ownerPayoutBaseAmount: "108000.00",
          currency: "ARS"
        })
      );
    });

    it("triangulates multiple owners with uneven cents while preserving the payout base", () => {
      const result = calculateOwnerSettlementInputs({
        contractCommissionBps: 333,
        currency: "ARS",
        periods: [
          {
            rentPeriodId: "period-2",
            propertyId: "prop-1",
            calculationState: "RECONCILED",
            estimatedAmount: "999.00",
            realAmount: "1000.01"
          }
        ],
        ownershipShares: [
          { propertyId: "prop-1", ownerPersonaId: "owner-persona-1", ownershipShareBps: 3333 },
          { propertyId: "prop-1", ownerPersonaId: "owner-persona-2", ownershipShareBps: 3333 },
          { propertyId: "prop-1", ownerPersonaId: "owner-persona-3", ownershipShareBps: 3334 }
        ]
      });

      expect(result.totals).toEqual({
        realAmount: "1000.01",
        commissionAmount: "33.30",
        ownerPayoutBaseAmount: "966.71",
        currency: "ARS"
      });
      expect(result.ownerInputs.map((input) => input.ownerPayoutAmount)).toEqual([
        "322.21",
        "322.20",
        "322.30"
      ]);
    });

    it("rejects reconciled periods without real amount because they are not settlement eligible", () => {
      expect(() =>
        calculateOwnerSettlementInputs({
          contractCommissionBps: 0,
          currency: "ARS",
          periods: [
            {
              rentPeriodId: "period-without-real-amount",
              propertyId: "prop-1",
              calculationState: "RECONCILED",
              estimatedAmount: "100000.00",
              realAmount: null
            }
          ],
          ownershipShares: [
            { propertyId: "prop-1", ownerPersonaId: "owner-persona-1", ownershipShareBps: 10000 }
          ]
        })
      ).toThrow("No se puede liquidar un período estimado sin monto real reconciliado.");
    });

    it("rejects ownership shares that do not add up to 100%", () => {
      expect(() =>
        calculateOwnerSettlementInputs({
          contractCommissionBps: 0,
          currency: "ARS",
          periods: [
            {
              rentPeriodId: "period-ownership-gap",
              propertyId: "prop-1",
              calculationState: "RECONCILED",
              estimatedAmount: "100000.00",
              realAmount: "100000.00"
            }
          ],
          ownershipShares: [
            { propertyId: "prop-1", ownerPersonaId: "owner-persona-1", ownershipShareBps: 5000 },
            { propertyId: "prop-1", ownerPersonaId: "owner-persona-2", ownershipShareBps: 4000 }
          ]
        })
      ).toThrow("La participación de propietarios debe sumar 100%.");
    });

    it("supports zero commission by paying the full real amount to owners", () => {
      const result = calculateOwnerSettlementInputs({
        contractCommissionBps: 0,
        currency: "ARS",
        periods: [
          {
            rentPeriodId: "period-zero-commission",
            propertyId: "prop-1",
            calculationState: "RECONCILED",
            estimatedAmount: "90000.00",
            realAmount: "100000.00"
          }
        ],
        ownershipShares: [
          { propertyId: "prop-1", ownerPersonaId: "owner-persona-1", ownershipShareBps: 2500 },
          { propertyId: "prop-1", ownerPersonaId: "owner-persona-2", ownershipShareBps: 7500 }
        ]
      });

      expect(result.totals).toEqual({
        realAmount: "100000.00",
        commissionAmount: "0.00",
        ownerPayoutBaseAmount: "100000.00",
        currency: "ARS"
      });
      expect(result.ownerInputs.map((input) => input.ownerPayoutAmount)).toEqual(["25000.00", "75000.00"]);
    });

    it.each([
      { commissionBps: -1, expectedMessage: "La comisión del contrato debe estar entre 0% y 100%." },
      { commissionBps: 10001, expectedMessage: "La comisión del contrato debe estar entre 0% y 100%." }
    ])("rejects invalid contract commission $commissionBps bps", ({ commissionBps, expectedMessage }) => {
      expect(() =>
        calculateOwnerSettlementInputs({
          contractCommissionBps: commissionBps,
          currency: "ARS",
          periods: [
            {
              rentPeriodId: "period-invalid-commission",
              propertyId: "prop-1",
              calculationState: "RECONCILED",
              estimatedAmount: "100000.00",
              realAmount: "100000.00"
            }
          ],
          ownershipShares: [
            { propertyId: "prop-1", ownerPersonaId: "owner-persona-1", ownershipShareBps: 10000 }
          ]
        })
      ).toThrow(expectedMessage);
    });

    it("allocates rounding remainder so owner payout inputs add up to the payout base", () => {
      const result = calculateOwnerSettlementInputs({
        contractCommissionBps: 0,
        currency: "ARS",
        periods: [
          {
            rentPeriodId: "period-remainder",
            propertyId: "prop-1",
            calculationState: "RECONCILED",
            estimatedAmount: "0.00",
            realAmount: "100.01"
          }
        ],
        ownershipShares: [
          { propertyId: "prop-1", ownerPersonaId: "owner-persona-1", ownershipShareBps: 3333 },
          { propertyId: "prop-1", ownerPersonaId: "owner-persona-2", ownershipShareBps: 3333 },
          { propertyId: "prop-1", ownerPersonaId: "owner-persona-3", ownershipShareBps: 3334 }
        ]
      });

      expect(result.totals.ownerPayoutBaseAmount).toBe("100.01");
      expect(result.ownerInputs.map((input) => input.ownerPayoutAmount)).toEqual(["33.33", "33.33", "33.35"]);
    });
  });
});
