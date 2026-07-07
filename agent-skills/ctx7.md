# Skill: Context7 / Current Docs

Use this when changing or debugging library, framework, SDK, CLI, or platform
APIs.

## Steps

1. Inspect the repo version first:
   - Frontend: `frontend/package.json`
   - Electron desktop shell: `desktop/package.json`
   - Backend: `backend/requirements.txt`
2. Use Context7/current docs for the exact package or framework before relying
   on memory.
3. Prefer official docs or primary sources when Context7 is unavailable.
4. Cite the version-sensitive assumption in the implementation note or final
   response when it affects behavior.

## Current Important Packages

- React 19, React Router 7, Vite 8, TypeScript 6, Tailwind 3.
- TanStack Table 8, TanStack Virtual 3, Glide Data Grid 6.
- FastAPI 0.115, SQLModel 0.0.22, Uvicorn 0.34, PyInstaller in build flows.
- Electron 31, electron-builder 24.

## Guardrails

- Do not change framework versions as part of a normal feature fix.
- If a doc example conflicts with local patterns, follow the local pattern unless
  the docs prove the local code is wrong or deprecated.
