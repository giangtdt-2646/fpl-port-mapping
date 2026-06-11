import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { CognitoService } from './cognito.service';
import { TunnelService } from './tunnel.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [AppController, AccountController],
  providers: [AppService, AccountService, CognitoService, TunnelService],
})
export class AppModule {}
