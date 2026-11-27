import { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';

// customize : remplace un fournisseur qui dépend d'un programme absent hors Docker.
export async function createTestApp(
  customize: (builder: TestingModuleBuilder) => TestingModuleBuilder = (
    builder,
  ) => builder,
): Promise<NestExpressApplication> {
  const moduleFixture = await customize(
    Test.createTestingModule({ imports: [AppModule] }),
  ).compile();
  const app = moduleFixture.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();
  return app;
}
