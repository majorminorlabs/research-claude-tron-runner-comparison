# Third-party components

The games use dependencies through npm and their exact package manifests/lockfiles are included. Installed npm modules and bundled build output are excluded. Dependency installation must preserve each package's own license notices.

- `three`: runtime dependency in Sonnet 5.5 and Opus 5.5; inspect the locked package's LICENSE when installing.
- `@fontsource/orbitron`: Sonnet 5.5 and Opus 5.5; font and package notices remain upstream.
- `@fontsource/rajdhani`: Sonnet 5.5; font and package notices remain upstream.
- Sonnet 5: Google Fonts stylesheet is an original external runtime request; publication does not replace it or claim offline operation.
- Remotion 4.0.532: rendering tool, not game code. Its two-tier license has eligibility conditions; review the included notice before using it. A proposed generated-code license does not override these terms.
- Other build/test packages are listed in the JSON and each project's lockfile; the package does not relicense them.

Complete installed direct-runtime and renderer license texts are copied under `benchmark/evidence/licenses/` where available. No dependency license status is treated as a quality metric.
