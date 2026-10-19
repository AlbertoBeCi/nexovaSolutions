import { spawn } from "node:child_process";
import { resolve } from "node:path";

const root = "/workspace/uis";
const commands = [
  { name: "website", directory: "website", port: "3000" },
  { name: "backoffice", directory: "backoffice", port: "3001" },
];
const children = [];
let stopping = false;

function stop(exitCode) {
  if (stopping) return;
  stopping = true;
  process.exitCode = exitCode;

  const running = children.filter(
    (child) => child.exitCode === null && child.signalCode === null,
  );

  if (running.length === 0) return;

  const forceStop = setTimeout(() => {
    for (const child of running) child.kill("SIGKILL");
  }, 10_000);
  forceStop.unref();

  Promise.all(
    running.map(
      (child) =>
        new Promise((resolveClose) => {
          if (child.exitCode !== null || child.signalCode !== null) {
            resolveClose();
          } else {
            child.once("close", resolveClose);
          }
        }),
    ),
  ).then(() => clearTimeout(forceStop));
}

for (const command of commands) {
  const directory = resolve(root, command.directory);
  const nextCli = resolve(directory, "node_modules/next/dist/bin/next");
  const child = spawn(
    process.execPath,
    [nextCli, "dev", "--webpack", "--hostname", "0.0.0.0", "--port", command.port],
    { cwd: directory, env: process.env, stdio: "inherit" },
  );

  children.push(child);

  child.on("error", (error) => {
    console.error(`[${command.name}] no se pudo iniciar Next.js:`, error);
    stop(1);
  });

  child.on("close", (code, signal) => {
    if (!stopping) {
      console.error(
        `[${command.name}] Next.js terminó${signal ? ` por ${signal}` : ` con código ${code}`}.`,
      );
      stop(code ?? 1);
    }
  });
}

process.on("SIGINT", () => stop(130));
process.on("SIGTERM", () => stop(143));
