/**
 * Remove `.next` with retries — Windows often returns ENOTEMPTY/EBUSY when
 * OneDrive, antivirus, or a running `next dev` holds files open.
 */
const fs = require("fs");
const path = require("path");

const target = path.join(process.cwd(), ".next");

function sleepRoughlyOneSecond() {
  try {
    require("child_process").execSync(
      process.platform === "win32" ? "ping -n 2 127.0.0.1 >nul" : "sleep 1",
      { stdio: "ignore" },
    );
  } catch {
    /* ignore */
  }
}

for (let i = 0; i < 10; i++) {
  try {
    fs.rmSync(target, { recursive: true, force: true });
    process.exit(0);
  } catch (err) {
    if (err && err.code === "ENOENT") {
      process.exit(0);
    }
    const retryable =
      err &&
      (err.code === "ENOTEMPTY" ||
        err.code === "EBUSY" ||
        err.code === "EPERM");
    if (!retryable || i === 9) {
      console.error(err?.message || err);
      console.error(
        "Could not remove apps/web/.next — stop `next dev`, close editors locking the folder, then retry.",
      );
      process.exit(1);
    }
    sleepRoughlyOneSecond();
  }
}
