declare const Controller: (path: string) => ClassDecorator;
declare const Get: () => MethodDecorator;

@Controller("health")
export class HealthController {
  @Get()
  getHealth(): string {
    return "ok";
  }
}
