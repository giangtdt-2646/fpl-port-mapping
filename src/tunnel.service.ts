import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { ChildProcess, spawn } from 'child_process';
import { connect } from 'net';
import { Server } from './create-account.dto';
import { getServerConfig } from './server-config';

const PORT_CHECK_TIMEOUT_MS = 1000;
const TUNNEL_READY_TIMEOUT_MS = 15000;
const POLL_INTERVAL_MS = 400;

@Injectable()
export class TunnelService implements OnModuleDestroy {
  private readonly logger = new Logger(TunnelService.name);
  private readonly processes = new Map<Server, ChildProcess>();
  // De-dupe concurrent ensure() calls for the same server.
  private readonly pending = new Map<Server, Promise<void>>();

  /** Ensure the DB port for `server` is reachable, starting the SSH tunnel if needed. */
  async ensureTunnel(server: Server): Promise<void> {
    const { tunnel } = getServerConfig(server);

    if (await this.isPortOpen(tunnel.localPort)) {
      return; // tunnel (or a manual one) is already up
    }

    let inFlight = this.pending.get(server);
    if (!inFlight) {
      inFlight = this.startTunnel(server).finally(() => this.pending.delete(server));
      this.pending.set(server, inFlight);
    }
    await inFlight;
  }

  private async startTunnel(server: Server): Promise<void> {
    const { tunnel } = getServerConfig(server);
    const forward = `${tunnel.localPort}:${tunnel.remoteHost}:${tunnel.remotePort}`;
    this.logger.log(`[${server}] Starting SSH tunnel: -L ${forward} ${tunnel.bastion}`);

    const child = spawn(
      'ssh',
      [
        '-N',
        '-o', 'StrictHostKeyChecking=accept-new',
        '-o', 'ExitOnForwardFailure=yes',
        '-o', 'BatchMode=yes',
        '-o', 'ServerAliveInterval=30',
        '-L', forward,
        tunnel.bastion,
      ],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    );

    let stderr = '';
    child.stderr?.on('data', (d) => (stderr += d.toString()));
    child.on('exit', (code) => {
      this.processes.delete(server);
      if (code) {
        this.logger.error(`[${server}] SSH tunnel exited with code ${code}: ${stderr.trim()}`);
      }
    });
    this.processes.set(server, child);

    const deadline = Date.now() + TUNNEL_READY_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) {
        throw new InternalServerErrorException(
          `SSH tunnel for ${server} failed to start: ${stderr.trim() || `exit ${child.exitCode}`}`,
        );
      }
      if (await this.isPortOpen(tunnel.localPort)) {
        this.logger.log(`[${server}] SSH tunnel ready on localhost:${tunnel.localPort}`);
        return;
      }
      await this.delay(POLL_INTERVAL_MS);
    }

    child.kill();
    throw new InternalServerErrorException(
      `SSH tunnel for ${server} did not become ready within ${TUNNEL_READY_TIMEOUT_MS}ms. ` +
        `Check that you can ssh to ${tunnel.bastion}. ${stderr.trim()}`,
    );
  }

  private isPortOpen(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = connect({ host: '127.0.0.1', port });
      const done = (ok: boolean) => {
        socket.destroy();
        resolve(ok);
      };
      socket.setTimeout(PORT_CHECK_TIMEOUT_MS);
      socket.once('connect', () => done(true));
      socket.once('timeout', () => done(false));
      socket.once('error', () => done(false));
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  onModuleDestroy(): void {
    for (const [server, child] of this.processes) {
      this.logger.log(`[${server}] Closing SSH tunnel`);
      child.kill();
    }
    this.processes.clear();
  }
}
