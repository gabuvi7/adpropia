import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { RequiresRole } from "../../common/auth/roles.decorator";
import { CORE_ENTITY_PERMISSIONS } from "../../common/auth/permissions";
import { parseRequestBody } from "../../common/validation/zod-validation";
import {
  activateContractScheduleSchema,
  changeContractStatusSchema,
  createContractSchema,
  createContractStructureSchema,
  defineContractDepositSchema,
  finalizeContractEarlySchema,
  registerContractGuaranteeSchema,
  updateContractSchema
} from "./contracts.dto";
import { ContractsService } from "./contracts.service";

@Controller("contracts")
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Post()
  @RequiresRole(...CORE_ENTITY_PERMISSIONS.create)
  create(@Body() body: unknown) {
    return this.contractsService.createContract(parseRequestBody(createContractSchema, body));
  }

  @Post("structured")
  @RequiresRole(...CORE_ENTITY_PERMISSIONS.create)
  createStructure(@Body() body: unknown) {
    return this.contractsService.createContractStructure(parseRequestBody(createContractStructureSchema, body));
  }

  @Get()
  @RequiresRole(...CORE_ENTITY_PERMISSIONS.list)
  list() {
    return this.contractsService.listContracts();
  }

  @Get("active")
  @RequiresRole(...CORE_ENTITY_PERMISSIONS.list)
  listActive() {
    return this.contractsService.listActiveContracts();
  }

  @Get(":id")
  @RequiresRole(...CORE_ENTITY_PERMISSIONS.read)
  getById(@Param("id") id: string) {
    return this.contractsService.getContractById(id);
  }

  @Patch(":id")
  @RequiresRole(...CORE_ENTITY_PERMISSIONS.update)
  update(@Param("id") id: string, @Body() body: unknown) {
    return this.contractsService.updateContract(id, parseRequestBody(updateContractSchema, body));
  }

  @Patch(":id/status")
  @RequiresRole("ADMIN")
  changeStatus(@Param("id") id: string, @Body() body: unknown) {
    return this.contractsService.changeContractStatus(id, parseRequestBody(changeContractStatusSchema, body).status);
  }

  @Post(":id/schedule/activate")
  @RequiresRole(...CORE_ENTITY_PERMISSIONS.update)
  activateSchedule(@Param("id") id: string, @Body() body: unknown) {
    return this.contractsService.activateContractSchedule(id, parseRequestBody(activateContractScheduleSchema, body));
  }

  @Post(":id/guarantees")
  @RequiresRole(...CORE_ENTITY_PERMISSIONS.update)
  registerGuarantee(@Param("id") id: string, @Body() body: unknown) {
    return this.contractsService.registerContractGuarantee(id, parseRequestBody(registerContractGuaranteeSchema, body));
  }

  @Post(":id/deposit")
  @RequiresRole(...CORE_ENTITY_PERMISSIONS.update)
  defineDeposit(@Param("id") id: string, @Body() body: unknown) {
    return this.contractsService.defineContractDeposit(id, parseRequestBody(defineContractDepositSchema, body));
  }

  @Patch(":id/finalize-early")
  @RequiresRole(...CORE_ENTITY_PERMISSIONS.update)
  finalizeEarly(@Param("id") id: string, @Body() body: unknown) {
    return this.contractsService.finalizeContractEarly(id, parseRequestBody(finalizeContractEarlySchema, body));
  }
}
