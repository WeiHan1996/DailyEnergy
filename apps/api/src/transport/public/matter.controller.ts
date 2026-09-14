import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  DeleteMatterRequestSchema,
  MatterCreateRequestSchema,
  MatterDeleteCommandRequestSchema,
  MatterTransitionRequestSchema,
  MatterUpdateRequestSchema,
  OpaqueIdSchema,
  type MatterCreateRequest,
  type MatterDeleteCommandRequest,
  type MatterTransitionRequest,
  type MatterUpdateRequest,
} from "@daily-energy/shared-schemas";
import type { Request } from "express";

import type { RuntimeConfig } from "../../bootstrap/runtime-config.js";
import { RUNTIME_CONFIG } from "../../composition/tokens.js";
import {
  DataRightsService,
  type DataRightsServiceResult,
} from "../../data-rights/data-rights.service.js";
import {
  MatterService,
  type MatterServiceResult,
} from "../../matter/matter.service.js";
import { ApiException } from "../common/api-exception.js";
import { RequestContextStore } from "../common/request-context.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { SessionGuard, sessionPrincipalFromRequest } from "./session.guard.js";

@Controller("v1/matters")
@UseGuards(SessionGuard)
export class MatterController {
  public constructor(
    private readonly service: MatterService,
    private readonly dataRights: DataRightsService,
    private readonly contextStore: RequestContextStore,
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
  ) {}

  @Get()
  public async list(@Req() request: Request) {
    return this.#success(
      await this.service.list(sessionPrincipalFromRequest(request)),
    );
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  public async create(
    @Req() request: Request,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(MatterCreateRequestSchema))
    body: MatterCreateRequest,
  ) {
    assertIdempotencyKey(idempotencyKey, body.command_ref);
    return this.#success(
      await this.service.create(sessionPrincipalFromRequest(request), body),
    );
  }

  @Patch(":matter_ref")
  @HttpCode(HttpStatus.OK)
  public async update(
    @Req() request: Request,
    @Param("matter_ref", new ZodValidationPipe(OpaqueIdSchema))
    matterRef: string,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(MatterUpdateRequestSchema))
    body: MatterUpdateRequest,
  ) {
    assertIdempotencyKey(idempotencyKey, body.command_ref);
    return this.#success(
      await this.service.update(
        sessionPrincipalFromRequest(request),
        matterRef,
        body,
      ),
    );
  }

  @Post(":matter_ref/pause")
  @HttpCode(HttpStatus.OK)
  public pause(
    @Req() request: Request,
    @Param("matter_ref", new ZodValidationPipe(OpaqueIdSchema))
    matterRef: string,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(MatterTransitionRequestSchema))
    body: MatterTransitionRequest,
  ) {
    assertIdempotencyKey(idempotencyKey, body.command_ref);
    return this.service
      .transition(
        sessionPrincipalFromRequest(request),
        matterRef,
        body,
        "PAUSE",
      )
      .then((result) => this.#success(result));
  }

  @Post(":matter_ref/resume")
  @HttpCode(HttpStatus.OK)
  public resume(
    @Req() request: Request,
    @Param("matter_ref", new ZodValidationPipe(OpaqueIdSchema))
    matterRef: string,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(MatterTransitionRequestSchema))
    body: MatterTransitionRequest,
  ) {
    assertIdempotencyKey(idempotencyKey, body.command_ref);
    return this.service
      .transition(
        sessionPrincipalFromRequest(request),
        matterRef,
        body,
        "RESUME",
      )
      .then((result) => this.#success(result));
  }

  @Post(":matter_ref/complete")
  @HttpCode(HttpStatus.OK)
  public complete(
    @Req() request: Request,
    @Param("matter_ref", new ZodValidationPipe(OpaqueIdSchema))
    matterRef: string,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(MatterTransitionRequestSchema))
    body: MatterTransitionRequest,
  ) {
    assertIdempotencyKey(idempotencyKey, body.command_ref);
    return this.service
      .transition(
        sessionPrincipalFromRequest(request),
        matterRef,
        body,
        "COMPLETE",
      )
      .then((result) => this.#success(result));
  }

  @Post(":matter_ref/delete")
  @HttpCode(HttpStatus.OK)
  public async delete(
    @Req() request: Request,
    @Param("matter_ref", new ZodValidationPipe(OpaqueIdSchema))
    matterRef: string,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(MatterDeleteCommandRequestSchema))
    body: MatterDeleteCommandRequest,
  ) {
    assertIdempotencyKey(idempotencyKey, body.command_ref);
    const deletion = DeleteMatterRequestSchema.parse({
      ...body,
      scope: "MATTER",
      target: { matter_ref: matterRef },
    });
    return this.#success(
      await this.dataRights.deleteMatter(
        sessionPrincipalFromRequest(request),
        deletion,
      ),
    );
  }

  #success<View>(
    result: MatterServiceResult<View> | DataRightsServiceResult<View>,
  ) {
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
