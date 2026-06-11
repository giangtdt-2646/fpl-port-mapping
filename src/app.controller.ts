import { Controller, HttpCode, Post } from '@nestjs/common';
import { AppService } from './app.service';

@Controller('/api/fpl-port-mapping')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('/dev1')
  @HttpCode(200)
  async openPortDev1(): Promise<string> {
    return await this.appService.exec('dev1');
  }

  @Post('/dev2')
  @HttpCode(200)
  async openPortDev2(): Promise<string> {
    return await this.appService.exec('dev2');
  }
}
