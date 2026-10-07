import fs from "node:fs";
import path from "node:path";

function getAllMarkdownFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      getAllMarkdownFiles(filePath, fileList);
    } else if (file.endsWith(".md")) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

function main() {
  const docsDir = path.resolve("docs");
  const rootReadme = path.resolve("README.md");
  const files = [rootReadme, ...getAllMarkdownFiles(docsDir)];

  let totalLinks = 0;
  let brokenLinks = 0;
  const errors = [];

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    // Match standard markdown links: [text](link)
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;
    while ((match = linkRegex.exec(content)) !== null) {
      const linkTarget = match[2].trim();
      // Skip external links, anchors, mailtos
      if (linkTarget.startsWith("http://") || linkTarget.startsWith("https://") || linkTarget.startsWith("#") || linkTarget.startsWith("mailto:")) {
        continue;
      }
      totalLinks++;
      // Resolve path relative to current file
      const cleanTarget = linkTarget.split("#")[0];
      if (!cleanTarget) continue;
      const targetPath = path.resolve(path.dirname(file), cleanTarget);
      if (!fs.existsSync(targetPath)) {
        brokenLinks++;
        errors.push(`Broken link in ${path.relative(process.cwd(), file)} -> ${linkTarget} (resolved to ${targetPath})`);
      }
    }
  }

  console.log(`filesScanned ${files.length} links ${totalLinks} broken ${brokenLinks}`);
  if (brokenLinks > 0) {
    console.error("Docs check FAILED:");
    for (const err of errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  } else {
    console.log(`Docs check PASSED (${files.length} files scanned)`);
    process.exit(0);
  }
}

main();
