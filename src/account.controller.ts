import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AccountService, CreateAccountResult } from './account.service';
import { CreateAccountDto } from './create-account.dto';

@Controller('/api/fpl-support')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Post('/create-account')
  @HttpCode(201)
  async createAccount(@Body() body: CreateAccountDto): Promise<CreateAccountResult> {
    return await this.accountService.createAccount(body);
  }
}
