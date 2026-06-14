import { Module } from "@nestjs/common";
import { RequestContextModule } from "../request-context/request-context.module";
import { RequestLoggingMiddleware } from "./request-logging.middleware";

@Module({
  imports: [RequestContextModule],
  providers: [RequestLoggingMiddleware],
  exports: [RequestLoggingMiddleware]
})
export class RequestLoggingModule {}
