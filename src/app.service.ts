import { Injectable } from '@nestjs/common';
import { exec } from 'child_process';

@Injectable()
export class AppService {
  async exec(server: 'dev1' | 'dev2'): Promise<string> {
    try {
      const portMapped = await this.execPortMapping(server);
      return portMapped ? `port mapping success for server ${server}` : `port mapping failed for server ${server}`;
    } catch (error) {
      console.error(`Execution error: ${error}`);
      return 'port mapping failed';
    }
  }

  async execPortMapping(server: 'dev1' | 'dev2'): Promise<boolean> {
    const dev1 = 'ec2-user@18.177.237.31';
    const dev2 = 'ec2-user@52.69.79.171';
    const { error, stdout, stderr } = await this.execAsync(
      `ssh ${server === 'dev1' ? dev1 : dev2} 'bash script/change_tg_api.sh'`,
    );
    if (error) {
      console.error(`execPortMapping error - ${server}: ${error}`);
      return false;
    }

    if (stderr) {
      console.error(`execPortMapping stderr - ${server}: ${stderr}`);
      return false;
    }
    console.log(`execPortMapping server ${server} success at `, new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    console.log(`execPortMapping server ${server} stdout:\n${stdout}`);

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
