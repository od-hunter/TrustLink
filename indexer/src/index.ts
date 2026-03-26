import { PrismaClient } from "@prisma/client";
import { createServer } from "http";
import Fastify from "fastify";
import { expressMiddleware } from "@apollo/server/express4";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/lib/use/ws";
import { readFileSync } from "fs";
import { join } from "path";
import { ApolloServer } from "@apollo/server";
import express from "express";
import { startIndexer } from "./indexer";
import { buildResolvers } from "./graphql";

const db = new PrismaClient();

async function main() {
  await db.$connect();

  // ── REST (Fastify) ─────────────────────────────────────────────────────────
  const fastify = Fastify({ logger: true });

  fastify.get<{ Params: { subject: string } }>(
    "/attestations/:subject",
    async (req) => {
      return db.attestation.findMany({
        where: { subject: req.params.subject },
        orderBy: { timestamp: "desc" },
      });
    }
  );

  fastify.get<{ Params: { issuer: string } }>(
    "/attestations/issuer/:issuer",
    async (req) => {
      return db.attestation.findMany({
        where: { issuer: req.params.issuer },
        orderBy: { timestamp: "desc" },
      });
    }
  );

  const REST_PORT = Number(process.env.PORT ?? 3000);
  await fastify.listen({ port: REST_PORT, host: "0.0.0.0" });

  // ── GraphQL (Apollo + WebSocket) ───────────────────────────────────────────
  const typeDefs = readFileSync(join(__dirname, "schema.graphql"), "utf-8");
  const schema = makeExecutableSchema({
    typeDefs,
    resolvers: buildResolvers(db),
  });

  const app = express();
  const httpServer = createServer(app);

  // WebSocket server for subscriptions
  const wsServer = new WebSocketServer({ server: httpServer, path: "/graphql" });
  const serverCleanup = useServer({ schema }, wsServer);

  const apollo = new ApolloServer({
    schema,
    introspection: true, // enables Apollo Sandbox / Explorer in development
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
    ],
  });

  await apollo.start();

  app.use(
    "/graphql",
    express.json(),
    expressMiddleware(apollo, {
      context: async () => ({ db }),
    })
  );

  const GQL_PORT = Number(process.env.GQL_PORT ?? 4000);
  httpServer.listen(GQL_PORT, "0.0.0.0", () => {
    console.log(`GraphQL endpoint:   http://0.0.0.0:${GQL_PORT}/graphql`);
    console.log(`GraphQL Playground: http://localhost:${GQL_PORT}/graphql`);
  });

  // ── Indexer ────────────────────────────────────────────────────────────────
  startIndexer(db).catch((err) => {
    console.error("Indexer error:", err);
    process.exit(1);
  });
}

main();
