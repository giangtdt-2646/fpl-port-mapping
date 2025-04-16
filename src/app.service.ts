import { Injectable } from '@nestjs/common';
import { exec } from 'child_process';

@Injectable()
export class AppService {
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
    const { error, stdout, stderr } = await this.execAsync(
      `ssh ec2-user@18.177.237.31 'bash script/change_tg_api.sh'`,
    );
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
