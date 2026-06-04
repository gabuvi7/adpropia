import { z } from "zod";

const requiredId = (label: string) =>
  z
    .string({ required_error: `${label} es obligatorio.`, invalid_type_error: `${label} debe ser texto.` })
    .trim()
    .min(1, `${label} es obligatorio.`);

const auth0Id = (label: string) =>
  z
    .string({ required_error: `${label} es obligatorio.`, invalid_type_error: `${label} debe ser texto.` })
    .trim()
    .min(1, `${label} es obligatorio.`);

const tenantRoleSchema = z.enum(["OWNER", "ADMIN", "OPERATOR", "READONLY"], {
  errorMap: () => ({ message: "El rol no es válido." })
});

export const linkTenantAuth0OrgSchema = z.object({
  auth0OrgId: auth0Id("El ID de organización de Auth0")
});

export const linkUserAuth0SubjectSchema = z.object({
  auth0UserId: auth0Id("El subject de Auth0")
});

export const provisionMembershipSchema = z.object({
  tenantId: requiredId("El tenant"),
  userId: requiredId("El usuario"),
  role: tenantRoleSchema
});

export type LinkTenantAuth0OrgDto = z.infer<typeof linkTenantAuth0OrgSchema>;
export type LinkUserAuth0SubjectDto = z.infer<typeof linkUserAuth0SubjectSchema>;
export type ProvisionMembershipDto = z.infer<typeof provisionMembershipSchema>;
