# GLB texture permanent fix

Updated `src/components/shared/ModelViewer.tsx` so protected/data model sources use one session-stable object URL.

Key changes:
- Protected GLB is fetched once and cached for the browser session.
- Object URL is not revoked during React Strict Mode cleanup.
- Removed automatic source retries for intermediate `scene` errors.
- Removed `key={modelSrc}` remounting.
- Prevents model-viewer/THREE embedded texture blob URLs from being invalidated mid-decode.
