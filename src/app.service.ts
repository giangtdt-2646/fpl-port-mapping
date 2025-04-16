import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { exec } from 'child_process';

@Injectable()
export class AppService {
  constructor(private configService: ConfigService) {}

  async exec(): Promise<string> {
    try {
      const portMapped = await this.execPortMapping();
      return portMapped ? 'port mapping success' : 'port mapping failed';
    } catch (error) {
      console.error(`Execution error: ${error}`);
      return 'port mapping failed';
    }
  }

  async execPortMapping(): Promise<boolean> {
    const portMappingCommand = this.configService.get<string>(
      'PORT_MAPPING_COMMAND',
    );

    if (!portMappingCommand) {
      console.error('PORT_MAPPING_COMMAND not defined');
      return false;
    }

    const { error, stdout, stderr } = await this.execAsync(portMappingCommand);
    if (error) {
      console.error(`execPortMapping error: ${error}`);
      return false;
    }

    if (stderr) {
      console.error(`execPortMapping stderr: ${stderr}`);
      return false;
    }

    console.log(`execPortMapping stdout:\n${stdout}`);

    return true;
  }

  execAsync(
    cmd: string,
  ): Promise<{ error: Error | null; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        resolve({ error, stdout, stderr });
      });
    });
  }
}
