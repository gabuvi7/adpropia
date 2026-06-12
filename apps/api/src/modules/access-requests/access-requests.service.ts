import { BadRequestException, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { accessRequestSchema, accessRequestModules, recommendAccessPlan, type AccessRequestInput } from "@adpropia/shared";
import { z } from "zod";
import { PrismaService } from "../../common/prisma";
import { ACCESS_REQUESTS_FETCH, RESEND_CLIENT, type AccessRequestsFetch, type ResendClient } from "./access-requests.tokens";

const turnstileResponseSchema = z.object({
  success: z.boolean(),
  challenge_ts: z.string().optional(),
  hostname: z.string().optional(),
  "error-codes": z.array(z.string()).optional()
});

@Injectable()
export class AccessRequestsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(RESEND_CLIENT)
    private readonly resend: ResendClient,
    @Inject(ConfigService)
    private readonly config: ConfigService,
    @Inject(ACCESS_REQUESTS_FETCH)
    private readonly fetchImpl: AccessRequestsFetch
  ) {}

  async submit(input: AccessRequestInput) {
    const parsed = accessRequestSchema.parse(input);
    const turnstile = await this.verifyTurnstile(parsed.turnstileToken);
    const recommendation = recommendAccessPlan(parsed);

    const accessRequest = await this.prisma.accessRequest.create({
      data: {
        companyName: parsed.companyName,
        contactName: parsed.contactName,
        email: parsed.email,
        phone: parsed.phone,
        rentalAdministrationUnits: parsed.rentalAdministrationUnits,
        saleUnits: parsed.saleUnits,
        users: parsed.users,
        selectedModules: parsed.selectedModules,
        recommendedPlan: recommendation.plan,
        ...(turnstile.challengeTs ? { turnstileChallengeTs: turnstile.challengeTs } : {}),
        ...(turnstile.hostname ? { turnstileHostname: turnstile.hostname } : {})
      },
      select: { id: true, recommendedPlan: true }
    });

    await this.sendInternalEmail(parsed, recommendation.label);
    await this.prisma.accessRequest.update({
      where: { id: accessRequest.id },
      data: { notificationSentAt: new Date() }
    });

    return accessRequest;
  }

  private async verifyTurnstile(token: string): Promise<{ challengeTs?: Date; hostname?: string }> {
    const secret = this.config.get<string>("TURNSTILE_SECRET_KEY");
    if (!secret) {
      throw new ServiceUnavailableException("Turnstile is not configured.");
    }

    const body = new URLSearchParams({ secret, response: token });
    const response = await this.fetchImpl("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body
    });

    if (!response.ok) {
      throw new BadRequestException("No pudimos validar la protección anti-spam.");
    }

    const payload = turnstileResponseSchema.parse(await response.json());
    if (!payload.success) {
      throw new BadRequestException("No pudimos validar la protección anti-spam.");
    }

    return {
      ...(payload.challenge_ts ? { challengeTs: new Date(payload.challenge_ts) } : {}),
      ...(payload.hostname ? { hostname: payload.hostname } : {})
    };
  }

  private async sendInternalEmail(input: AccessRequestInput, planLabel: string): Promise<void> {
    if (!this.config.get<string>("RESEND_API_KEY")) {
      throw new ServiceUnavailableException("Resend is not configured.");
    }

    const to = this.config.get<string>("ACCESS_REQUEST_EMAIL_TO") ?? "guviedo@adpropia.com.ar";
    const from = this.config.get<string>("RESEND_FROM_EMAIL") ?? "AdPropIA <no-reply@adpropia.com.ar>";
    const moduleLabels = input.selectedModules.map((value) => accessRequestModules.find((module) => module.value === value)?.label ?? value);

    const result = await this.resend.emails.send({
      from,
      to,
      subject: `Nueva solicitud de acceso — ${input.companyName}`,
      text: [
        `Empresa: ${input.companyName}`,
        `Contacto: ${input.contactName}`,
        `Email: ${input.email}`,
        `WhatsApp/teléfono: ${input.phone}`,
        `Unidades alquiler/administración: ${input.rentalAdministrationUnits}`,
        `Unidades en venta: ${input.saleUnits}`,
        `Usuarios: ${input.users}`,
        `Plan recomendado: ${planLabel}`,
        `Módulos/necesidades: ${moduleLabels.join(", ")}`,
        "",
        "Nota: esta solicitud no crea tenants, organizaciones Auth0, usuarios, membresías, suscripciones, billing ni provisioning."
      ].join("\n")
    });

    if (result.error) {
      throw new ServiceUnavailableException("No pudimos enviar la notificación interna.");
    }
  }
}
