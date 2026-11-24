#!/usr/bin/env node
// Writes THIRD-PARTY-NOTICES.txt: the license texts of every Rust crate and JavaScript package that ends up in the
// Linux app, each text once, followed by the packages it covers. Rust crates come from `cargo metadata` (the normal
// dependencies of the `tune` binary on x86_64 Linux), JavaScript packages from package.json's `dependencies` and what
// they depend on in package-lock.json. With `--check` it only compares and exits 1 when the file is out of date.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'THIRD-PARTY-NOTICES.txt');
const TARGET = 'x86_64-unknown-linux-gnu';
const LICENSE_FILE = /^(licen[cs]e|copying|notice|copyright|unlicense)/i;

// Standard texts for the few crates published without a license file whose license needs their own copyright line.
const MIT = `
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit
persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the
Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
`.trim();

const BSD_3 = `
Redistribution and use in source and binary forms, with or without modification, are permitted provided that the
following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following
   disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following
   disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote
   products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES,
INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
`.trim();

// Licenses whose full text carries no per-package copyright line: a crate without a license file joins the text another
// package already ships. The pattern finds that text.
const SHARED_TEXT = {
  'Apache-2.0': /^\s*Apache License\s+Version 2\.0, January 2004/,
  'MPL-2.0': /^\s*Mozilla Public License Version 2\.0/,
};
const SYNTHESIZED = { MIT, 'BSD-3-Clause': BSD_3 };

// Code-point order, so the file comes out the same under every system language.
const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const normalize = (text) => text.replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '').trim();
const key = (text) => text.replace(/\s+/g, ' ').trim();

function licenseFiles(dir) {
  return readdirSync(dir)
    .filter((name) => LICENSE_FILE.test(name) && statSync(join(dir, name)).isFile())
    .sort()
    .map((name) => normalize(readFileSync(join(dir, name), 'utf8')));
}

function repoUrl(value) {
  const url = typeof value === 'string' ? value : value?.url;
  return url ? url.replace(/^git\+/, '').replace(/\.git$/, '') : '';
}

function rustPackages() {
  const json = execFileSync('cargo', ['metadata', '--format-version', '1', '--locked', '--filter-platform', TARGET], {
    cwd: ROOT,
    maxBuffer: 1 << 28,
    encoding: 'utf8',
  });
  const metadata = JSON.parse(json);
  const byId = new Map(metadata.packages.map((p) => [p.id, p]));
  const nodes = new Map(metadata.resolve.nodes.map((n) => [n.id, n]));
  const members = new Set(metadata.workspace_members);
  const root = metadata.packages.find((p) => p.name === 'tune' && members.has(p.id));
  if (!root) throw new Error('no `tune` package in the workspace');
  const seen = new Set();
  const stack = [root.id];
  while (stack.length > 0) {
    const id = stack.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    for (const dep of nodes.get(id)?.deps ?? []) {
      if (dep.dep_kinds.some((kind) => kind.kind === null)) stack.push(dep.pkg);
    }
  }
  return [...seen]
    .filter((id) => !members.has(id))
    .map((id) => byId.get(id))
    .map((p) => {
      const dir = dirname(p.manifest_path);
      const texts = licenseFiles(dir);
      if (p.license_file && !LICENSE_FILE.test(p.license_file)) {
        texts.push(normalize(readFileSync(join(dir, p.license_file), 'utf8')));
      }
      const git = p.source?.match(/^git\+([^?#]+).*#([0-9a-f]{7})/);
      const from = git ? ` (git ${git[1]}, commit ${git[2]})` : '';
      return {
        label: `${p.name} ${p.version}${from}`,
        repo: repoUrl(p.repository),
        license: p.license ?? '',
        authors: (p.authors ?? []).map((a) => a.replace(/\s*<[^>]*>/, '')),
        name: p.name,
        texts,
      };
    });
}

function npmPackages() {
  const lock = JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf8'));
  const manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  const seen = new Set();
  const stack = Object.keys(manifest.dependencies ?? {});
  while (stack.length > 0) {
    const name = stack.pop();
    if (seen.has(name)) continue;
    seen.add(name);
    const entry = lock.packages[`node_modules/${name}`];
    if (!entry) throw new Error(`${name} is not in package-lock.json`);
    stack.push(...Object.keys(entry.dependencies ?? {}));
  }
  return [...seen].map((name) => {
    const dir = join(ROOT, 'node_modules', name);
    if (!existsSync(dir)) throw new Error(`${name} is not installed; run npm install first`);
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    return {
      label: `${name} ${pkg.version}`,
      repo: repoUrl(pkg.repository),
      license: pkg.license ?? '',
      authors: [],
      name,
      texts: licenseFiles(dir),
    };
  });
}

function build() {
  const packages = [...rustPackages(), ...npmPackages()];
  const groups = new Map();
  const add = (text, pkg) => {
    const k = key(text);
    if (!groups.has(k)) groups.set(k, { text, packages: new Map() });
    groups.get(k).packages.set(pkg.label, pkg);
  };
  const missing = [];
  for (const pkg of packages) {
    if (pkg.texts.length === 0) missing.push(pkg);
    for (const text of pkg.texts) add(text, pkg);
  }
  for (const pkg of missing) {
    const ids = pkg.license.split(/\s+(?:OR|AND|WITH)\s+|[()/]/).map((s) => s.trim()).filter(Boolean);
    const shared = ids.find((id) => SHARED_TEXT[id]);
    if (shared) {
      const group = [...groups.values()]
        .filter((g) => SHARED_TEXT[shared].test(g.text))
        .sort((a, b) => b.packages.size - a.packages.size)[0];
      if (!group) throw new Error(`${pkg.label}: no ${shared} text to share`);
      group.packages.set(pkg.label, { ...pkg, note: 'published without a license file' });
      continue;
    }
    // A crate from the same repository under the same license carries the repository's own copyright line.
    const sibling = packages.find(
      (other) => other.texts.length > 0 && other.repo && other.repo === pkg.repo && other.license === pkg.license,
    );
    if (sibling) {
      for (const text of sibling.texts) {
        add(text, { ...pkg, note: `published without a license file; text from ${sibling.name}` });
      }
      continue;
    }
    const own = ids.find((id) => SYNTHESIZED[id]);
    if (!own) throw new Error(`${pkg.label}: no license file and no standard text for "${pkg.license}"`);
    const holders = pkg.authors.length > 0 ? pkg.authors.join(', ') : `the ${pkg.name} authors`;
    const heading = `${own} License (standard text; the package is published without a license file)`;
    add(`${heading}\n\nCopyright (c) ${holders}\n\n${SYNTHESIZED[own]}`, pkg);
  }

  const sorted = [...groups.values()]
    .map((g) => ({ ...g, list: [...g.packages.values()].sort((a, b) => byText(a.label, b.label)) }))
    .sort((a, b) => byText(a.list[0].label, b.list[0].label) || byText(key(a.text), key(b.text)));
  const rule = '='.repeat(100);
  const lines = [
    'Third-party software in Tune',
    '',
    'Tune is licensed under the GNU General Public License, version 3 or any later version (see LICENSE).',
    '',
    `It includes the ${packages.length} third-party packages listed below: Rust crates built into the program, and`,
    'JavaScript packages and fonts in its interface. Each license text appears once, after the list of packages it',
    'covers. The source code of each package is available from its repository, or at the version listed from crates.io',
    'or npm.',
    '',
    'This file is generated by scripts/third-party-notices.mjs; do not edit it by hand.',
  ];
  for (const group of sorted) {
    lines.push('', rule, '');
    for (const pkg of group.list) {
      const extra = [pkg.license, pkg.repo, pkg.note].filter(Boolean).join('; ');
      lines.push(`${pkg.label}${extra ? ` (${extra})` : ''}`);
    }
    lines.push('', group.text);
  }
  return `${lines.join('\n')}\n`;
}

const text = build();
if (process.argv.includes('--check')) {
  const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (current !== text) {
    console.error('THIRD-PARTY-NOTICES.txt is out of date: run `npm run notices`.');
    process.exit(1);
  }
  console.log('THIRD-PARTY-NOTICES.txt is up to date.');
} else {
  writeFileSync(OUT, text);
  console.log(`Wrote THIRD-PARTY-NOTICES.txt (${text.length} characters).`);
}
