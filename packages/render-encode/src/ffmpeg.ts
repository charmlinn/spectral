import { spawn } from "node:child_process";

export type CommandInvocationInput = {
  command: string;
  args: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
};

export type CommandInvocationResult = {
  command: string;
  args: string[];
  exitCode: number;
  stdout: string;
  stderr: string;
};

export async function runCommand(
  input: CommandInvocationInput,
): Promise<CommandInvocationResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(input.command, input.args, {
      cwd: input.cwd,
      env: input.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (exitCode) => {
      const result: CommandInvocationResult = {
        command: input.command,
        args: input.args,
        exitCode: exitCode ?? 0,
        stdout,
        stderr,
      };

      if ((exitCode ?? 0) !== 0) {
        reject(
          new Error(
            `${input.command} ${input.args.join(" ")} exited with code ${exitCode ?? 0}: ${stderr || stdout}`,
          ),
        );
        return;
      }

      resolve(result);
    });
  });
}

export async function runFfmpeg(
  input: Omit<CommandInvocationInput, "command"> & {
    ffmpegBin?: string;
  },
): Promise<CommandInvocationResult> {
  return runCommand({
    command: input.ffmpegBin ?? "ffmpeg",
    args: input.args,
    cwd: input.cwd,
    env: input.env,
  });
}
