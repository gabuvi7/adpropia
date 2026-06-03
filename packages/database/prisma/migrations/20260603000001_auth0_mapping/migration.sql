-- AlterTable: add Auth0 mapping columns
ALTER TABLE "tenants" ADD COLUMN     "auth0OrgId" TEXT;
ALTER TABLE "users" ADD COLUMN     "auth0UserId" TEXT;

-- CreateIndex: unique constraints for Auth0 identity mapping
CREATE UNIQUE INDEX "tenants_auth0OrgId_key" ON "tenants"("auth0OrgId");
CREATE UNIQUE INDEX "users_auth0UserId_key" ON "users"("auth0UserId");
