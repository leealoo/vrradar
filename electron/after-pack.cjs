const fs = require("fs");
const path = require("path");

function copyDir(source, target) {
  if (!fs.existsSync(source)) return;
  fs.mkdirSync(target, { recursive: true });

  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      copyDir(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

exports.default = async function afterPack(context) {
  const appDir = path.join(context.appOutDir, "resources", "app");
  const standaloneDir = path.join(appDir, ".next", "standalone");
  const staticDir = path.join(appDir, ".next", "static");
  const publicDir = path.join(appDir, "public");
  const projectRoot = path.join(__dirname, "..");

  // Copy static and public into standalone
  copyDir(staticDir, path.join(standaloneDir, ".next", "static"));
  copyDir(publicDir, path.join(standaloneDir, "public"));

  // Copy the entire standalone node_modules (electron-builder prunes it)
  const sourceNodeModules = path.join(projectRoot, ".next", "standalone", "node_modules");
  const targetNodeModules = path.join(standaloneDir, "node_modules");
  copyDir(sourceNodeModules, targetNodeModules);
};
