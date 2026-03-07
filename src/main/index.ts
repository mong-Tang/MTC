import { openZip } from './services/zip-index-service';

async function bootstrap(): Promise<void> {
  // TODO: Electron app lifecycle 연결 시 Main 엔트리로 대체
  if (process.argv.length < 3) {
    return;
  }

  const zipPath = process.argv[2];
  const result = await openZip(zipPath);
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(result.meta, null, 2));
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});

