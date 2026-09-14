# Do not run the full typecheck or build on a shared box

`pnpm run typecheck` fans `tsc` across every core and is memory-hungry. Measured on a 16 GB / 4 vCPU
VPS running an Orca `serve` instance plus other agents:

```
tsc peak          6.9 GB in a single process
swap              4095 / 4095 MB, fully exhausted
available RAM     5304 MB before the kill, 12217 MB after
SIGTERM           ignored - it took SIGKILL
```

A clean `pnpm build:linux` OOMed twice on the same host, at a 4 GB cap and again at 6 GB with
`NODE_OPTIONS=--max-old-space-size=2048` bounding each worker. It consumed only 97s and 142s of CPU
before dying: the constraint is memory, not time.

**Run these on a CI runner instead.** A GitHub `ubuntu-latest` job completes the same work in a few
minutes and cannot evict anything a human is using.

## The trap worth knowing about

A `pre-push` guard that runs `npm run lint && npm run typecheck && npm test` re-imports this
problem at exactly the moment you thought you had designed it out — you move builds to CI, then the
push hook runs the build locally anyway. It is not obvious from the hook's name that it is the
heaviest thing on the box.

Targeted work is fine and is what local runs are for: a single vitest file, `oxlint` on one path,
`tsc --noEmit` on one file.
