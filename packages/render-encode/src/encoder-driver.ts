import { planRenderArtifacts } from "./artifact-planner";
import type { EncodeRenderInput, EncodeRenderResult, EncoderDriver } from "./contracts";
import { runCommand, type CommandInvocationResult } from "./ffmpeg";
import { validateRenderOutput } from "./output-validator";

export class ValidatingEncoderDriver implements EncoderDriver {
  async encode(input: EncodeRenderInput): Promise<EncodeRenderResult> {
    const artifacts = planRenderArtifacts({
      session: input.session,
    });
    const validation = await validateRenderOutput({
      session: input.session,
      outputPath: input.outputPath,
      posterPath: input.posterPath ?? null,
    });

    return {
      outputPath: input.outputPath,
      posterPath: input.posterPath ?? null,
      artifacts,
      validation,
      metadata: {
        validator: "basic-file-validator",
      },
    };
  }
}

export type CommandEncoderDriverOptions = {
  command: string;
  createArgs: (input: EncodeRenderInput) => string[];
  env?: NodeJS.ProcessEnv;
};

export class CommandEncoderDriver implements EncoderDriver {
  readonly #command: string;
  readonly #createArgs: (input: EncodeRenderInput) => string[];
  readonly #env?: NodeJS.ProcessEnv;

  constructor(options: CommandEncoderDriverOptions) {
    this.#command = options.command;
    this.#createArgs = options.createArgs;
    this.#env = options.env;
  }

  async encode(input: EncodeRenderInput): Promise<EncodeRenderResult> {
    const invocation = await runCommand({
      command: this.#command,
      args: this.#createArgs(input),
      cwd: input.workingDirectory,
      env: this.#env,
    });

    return this.#buildResult(input, invocation);
  }

  async #buildResult(
    input: EncodeRenderInput,
    invocation: CommandInvocationResult,
  ): Promise<EncodeRenderResult> {
    const artifacts = planRenderArtifacts({
      session: input.session,
    });
    const validation = await validateRenderOutput({
      session: input.session,
      outputPath: input.outputPath,
      posterPath: input.posterPath ?? null,
    });

    return {
      outputPath: input.outputPath,
      posterPath: input.posterPath ?? null,
      artifacts,
      validation,
      metadata: {
        command: invocation.command,
        args: invocation.args,
        stdout: invocation.stdout,
        stderr: invocation.stderr,
      },
    };
  }
}
