import { Body, Controller, Get, Inject, NotFoundException, Param, Post } from "@nestjs/common";
import { CORE_ENTITY_PERMISSIONS } from "../../common/auth/permissions";
import { RequiresRole } from "../../common/auth/roles.decorator";
import { parseRequestBody } from "../../common/validation/zod-validation";
import { createPersonaSchema } from "./personas.dto";
import { PersonasRepository } from "./personas.repository";

@Controller("personas")
export class PersonasController {
  constructor(@Inject(PersonasRepository) private readonly personasRepository: PersonasRepository) {}

  @Post()
  @RequiresRole(...CORE_ENTITY_PERMISSIONS.create)
  create(@Body() body: unknown) {
    return this.personasRepository.create(parseRequestBody(createPersonaSchema, body));
  }

  @Get()
  @RequiresRole(...CORE_ENTITY_PERMISSIONS.list)
  list() {
    return this.personasRepository.list();
  }

  @Get(":id")
  @RequiresRole(...CORE_ENTITY_PERMISSIONS.read)
  async getById(@Param("id") id: string) {
    const persona = await this.personasRepository.findById(id);
    if (!persona) {
      throw new NotFoundException("No encontramos la persona solicitada.");
    }

    return persona;
  }
}
