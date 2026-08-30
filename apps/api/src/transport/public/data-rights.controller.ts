import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  DataTaskCancelRequestSchema,
  DeleteAccountConfirmRequestSchema,
  DeleteAccountPrepareRequestSchema,
  DeleteDayRequestSchema,
  DeleteMatterRequestSchema,
  DeleteRelationshipConfirmRequestSchema,
  DeleteRelationshipPrepareRequestSchema,
  ExportRequestSchema,
  OpaqueIdSchema,
  ReauthVerifyRequestSchema,
  type DataTaskCancelRequest,
  type DeleteAccountConfirmRequest,
  type DeleteAccountPrepareRequest,
  type DeleteDayRequest,
  type DeleteMatterRequest,
  type DeleteRelationshipConfirmRequest,
  type DeleteRelationshipPrepareRequest,
  type ExportRequest,
  type ReauthVerifyRequest,
} from "@daily-energy/shared-schemas";
import type { Request, Response } from "express";

import type { RuntimeConfig } from "../../bootstrap/runtime-config.js";
import { RUNTIME_CONFIG } from "../../composition/tokens.js";
import {
  DataRightsService,
  type DataRightsServiceResult,
} from "../../data-rights/data-rights.service.js";
import { ApiException } from "../common/api-exception.js";
import { RequestContextStore } from "../common/request-context.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { SessionGuard, sessionPrincipalFromRequest } from "./session.guard.js";

@Controller("v1")
@UseGuards(SessionGuard)
export class DataRightsController {
  public constructor(
    private readonly service: DataRightsService,
    private readonly contextStore: RequestContextStore,
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
  ) {}

  @Get("data-rights/summary")
  public async getSummary(@Req() request: Request) {
    return this.#success(
      await this.service.getSummary(sessionPrincipalFromRequest(request)),
    );
  }

  @Get("data-rights/tasks")
  public async listTasks(@Req() request: Request) {
    return this.#success(
      await this.service.listTasks(sessionPrincipalFromRequest(request)),
    );
  }

  @Get("data-rights/tasks/:task_ref")
  public async getTask(
    @Req() request: Request,
    @Param("task_ref", new ZodValidationPipe(OpaqueIdSchema)) taskRef: string,
  ) {
    return this.#success(
      await this.service.getTask(sessionPrincipalFromRequest(request), taskRef),
    );
  }

  @Post("data-rights/export")
  @HttpCode(HttpStatus.ACCEPTED)
  public async createExport(
    @Req() request: Request,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(ExportRequestSchema)) body: ExportRequest,
  ) {
    assertIdempotencyKey(idempotencyKey, body.command_ref);
    return this.#success(
      await this.service.createExport(
        sessionPrincipalFromRequest(request),
        body,
      ),
    );
  }

  @Get("data-rights/exports/:task_ref/artifacts/:download_ref")
  public async downloadExport(
    @Req() request: Request,
    @Res() response: Response,
    @Param("task_ref", new ZodValidationPipe(OpaqueIdSchema)) taskRef: string,
    @Param("download_ref", new ZodValidationPipe(OpaqueIdSchema))
    downloadRef: string,
  ) {
    const result = await this.service.downloadExport(
      sessionPrincipalFromRequest(request),
      taskRef,
      downloadRef,
    );
    response.set({
      "Cache-Control": "no-store",
      "Content-Disposition": 'attachment; filename="dailyenergy-export.json"',
      "Content-Length": String(result.byteLength),
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "X-Request-Id": this.contextStore.get().requestId,
    });
    return response.status(HttpStatus.OK).send(result.body);
  }

  @Post("data-rights/delete/day")
  @HttpCode(HttpStatus.ACCEPTED)
  public async deleteDay(
    @Req() request: Request,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(DeleteDayRequestSchema)) body: DeleteDayRequest,
  ) {
    assertIdempotencyKey(idempotencyKey, body.command_ref);
    return this.#success(
      await this.service.deleteDay(sessionPrincipalFromRequest(request), body),
    );
  }

  @Post("data-rights/delete/matter")
  @HttpCode(HttpStatus.ACCEPTED)
  public async deleteMatter(
    @Req() request: Request,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(DeleteMatterRequestSchema))
    body: DeleteMatterRequest,
  ) {
    assertIdempotencyKey(idempotencyKey, body.command_ref);
    return this.#success(
      await this.service.deleteMatter(
        sessionPrincipalFromRequest(request),
        body,
      ),
    );
  }

  @Post("data-rights/delete/relationship/prepare")
  @HttpCode(HttpStatus.OK)
  public async prepareRelationshipDeletion(
    @Req() request: Request,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(DeleteRelationshipPrepareRequestSchema))
    body: DeleteRelationshipPrepareRequest,
  ) {
    assertIdempotencyKey(idempotencyKey, body.command_ref);
    return this.#success(
      await this.service.prepareRelationshipDeletion(
        sessionPrincipalFromRequest(request),
        body,
      ),
    );
  }

  @Post("data-rights/delete/relationship/confirm")
  @HttpCode(HttpStatus.ACCEPTED)
  public async confirmRelationshipDeletion(
    @Req() request: Request,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(DeleteRelationshipConfirmRequestSchema))
    body: DeleteRelationshipConfirmRequest,
  ) {
    assertIdempotencyKey(idempotencyKey, body.command_ref);
    return this.#success(
      await this.service.confirmRelationshipDeletion(
        sessionPrincipalFromRequest(request),
        body,
      ),
    );
  }

  @Post("data-rights/delete/account/prepare")
  @HttpCode(HttpStatus.OK)
  public async prepareAccountDeletion(
    @Req() request: Request,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(DeleteAccountPrepareRequestSchema))
    body: DeleteAccountPrepareRequest,
  ) {
    assertIdempotencyKey(idempotencyKey, body.command_ref);
    return this.#success(
      await this.service.prepareAccountDeletion(
        sessionPrincipalFromRequest(request),
        body,
      ),
    );
  }

  @Post("auth/reauth/verify")
  @HttpCode(HttpStatus.OK)
  public async verifyIdentity(
    @Req() request: Request,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(ReauthVerifyRequestSchema))
    body: ReauthVerifyRequest,
  ) {
    assertIdempotencyKey(idempotencyKey, body.command_ref);
    return this.#success(
      await this.service.verifyIdentity(
        sessionPrincipalFromRequest(request),
        body,
      ),
    );
  }

  @Post("data-rights/delete/account/confirm")
  @HttpCode(HttpStatus.ACCEPTED)
  public async confirmAccountDeletion(
    @Req() request: Request,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(DeleteAccountConfirmRequestSchema))
    body: DeleteAccountConfirmRequest,
  ) {
    assertIdempotencyKey(idempotencyKey, body.command_ref);
    return this.#success(
      await this.service.confirmAccountDeletion(
        sessionPrincipalFromRequest(request),
        body,
      ),
    );
  }

  @Post("data-rights/tasks/:task_ref/cancel")
  @HttpCode(HttpStatus.OK)
  public async cancelTask(
    @Req() request: Request,
    @Param("task_ref", new ZodValidationPipe(OpaqueIdSchema)) taskRef: string,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(DataTaskCancelRequestSchema))
    body: DataTaskCancelRequest,
  ) {
    assertIdempotencyKey(idempotencyKey, body.command_ref);
    return this.#success(
      await this.service.cancelTask(
        sessionPrincipalFromRequest(request),
        taskRef,
        body,
      ),
    );
  }

  #success<View>(result: DataRightsServiceResult<View>) {
    return {
      data: result.view,
      ok: true as const,
      product_date: result.resolution.productDate,
      product_date_policy_version: this.config.productDatePolicyVersion,
      request_id: this.contextStore.get().requestId,
      server_now: result.resolution.now.toISOString(),
    };
  }
}

function assertIdempotencyKey(
  idempotencyKey: string | undefined,
  commandRef: string,
): void {
  if (idempotencyKey !== commandRef) {
    throw new ApiException({ code: "IDEMPOTENCY_CONFLICT" });
  }
}
