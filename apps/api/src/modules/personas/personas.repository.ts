import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { Persona, PersonaFisica, PersonaJuridica, Prisma } from "@adpropia/database";
import { PrismaService } from "../../common/prisma";
import { RequestContextService } from "../../common/request-context/request-context.service";
import type { CreatePersonaDto } from "./personas.dto";

export type PersonaWithSubtype = Persona & {
  fisica: PersonaFisica | null;
  juridica: PersonaJuridica | null;
};

const personaSubtypeInclude = { fisica: true, juridica: true } as const;

@Injectable()
export class PersonasRepository {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(RequestContextService)
    private readonly contextService: RequestContextService
  ) {}

  async create(input: CreatePersonaDto): Promise<PersonaWithSubtype> {
    const { tenantId } = this.contextService.get();

    try {
      return await this.prisma.$transaction(async (tx) =>
        tx.persona.create({
          data: toPersonaCreateData(input, tenantId),
          include: personaSubtypeInclude
        })
      );
    } catch (error) {
      if (hasPrismaCode(error, "P2002")) {
        throw new BadRequestException("Ya existe una persona con esta identidad en esta inmobiliaria.");
      }

      throw new BadRequestException("No pudimos crear la persona con los datos de identidad enviados.");
    }
  }

  findById(id: string): Promise<PersonaWithSubtype | null> {
    const { tenantId } = this.contextService.get();
    return this.prisma.persona.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: personaSubtypeInclude
    });
  }

  list(): Promise<PersonaWithSubtype[]> {
    const { tenantId } = this.contextService.get();
    return this.prisma.persona.findMany({
      where: { tenantId, deletedAt: null },
      include: personaSubtypeInclude,
      orderBy: { displayName: "asc" }
    });
  }

  async assertBelongsToTenant(id: string): Promise<PersonaWithSubtype> {
    const persona = await this.findById(id);

    if (!persona) {
      throw new BadRequestException("La persona indicada no pertenece a esta inmobiliaria.");
    }

    return persona;
  }
}

function toPersonaCreateData(input: CreatePersonaDto, tenantId: string): Prisma.PersonaCreateInput {
  return {
    tenant: { connect: { id: tenantId } },
    displayName: input.displayName,
    kind: input.kind,
    ...(input.email !== undefined ? { email: input.email } : {}),
    ...(input.phone !== undefined ? { phone: input.phone } : {}),
    ...(input.kind === "FISICA" && input.fisica !== undefined
      ? {
          fisica: {
            create: {
              ...(input.fisica.firstName !== undefined ? { firstName: input.fisica.firstName } : {}),
              ...(input.fisica.lastName !== undefined ? { lastName: input.fisica.lastName } : {}),
              ...(input.fisica.dni !== undefined ? { dni: input.fisica.dni } : {}),
              ...(input.fisica.cuit !== undefined ? { cuit: input.fisica.cuit } : {}),
              ...(input.fisica.dateOfBirth !== undefined ? { dateOfBirth: input.fisica.dateOfBirth } : {})
            }
          }
        }
      : {}),
    ...(input.kind === "JURIDICA" && input.juridica !== undefined
      ? {
          juridica: {
            create: {
              legalName: input.juridica.legalName,
              cuit: input.juridica.cuit
            }
          }
        }
      : {})
  };
}

function hasPrismaCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
