import { Controller, HttpCode, Post } from '@nestjs/common';
import { AppService } from './app.service';

@Controller('/api/fpl-port-mapping')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post()
  @HttpCode(200)
  async exec(): Promise<string> {
    return await this.appService.exec();
  }
}
