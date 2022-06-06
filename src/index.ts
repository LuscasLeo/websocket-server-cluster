import { IsEnum, IsObject, IsString, IsOptional, validateSync } from "class-validator";
import http from "http";
import * as redis from "redis";
import * as uuid from "uuid";
import { Message } from "websocket";
import { createWebSocketServerNode } from "./core/node";
import {
  RedisMessageHandler,
  RedisPublishMessageEncoder,
  RedisSubcriptionMessageDecoder,
  WebSocketClientMessageDecoder,
  WebSocketClientMessageEncoder,
  WebSocketMessageHandler,
} from "./core/types";

const RedisJsonDecoder: RedisSubcriptionMessageDecoder<RedisType> = (message: string) => JSON.parse(message);

const RedisJsonEncoder: RedisPublishMessageEncoder<RedisType> = (message: any) => JSON.stringify(message);

const JSONWebsocketClientMessageDecoder: WebSocketClientMessageDecoder<any> = (message: Message) => {
  let jsonMessage: any;
  if (message.type === "utf8") {
    jsonMessage = JSON.parse(message.utf8Data);
  } else if (message.type === "binary") {
    jsonMessage = JSON.parse(message.binaryData.toString("utf8"));
  } else throw new Error("Unknown message type");

  const messageInstance = Object.assign(new WebSocketMessage(), jsonMessage);

  const errors = validateSync(messageInstance);

  if (errors.length > 0) {
    throw new Error(`Invalid message: ${JSON.stringify(errors)}`);
  }

  return messageInstance;
};

const JSONWebsocketClientMessageEncoder: WebSocketClientMessageEncoder<any> = (message: string) => {
  return {
    type: "utf8",
    utf8Data: JSON.stringify(message),
  };
};

export enum WebSocketMessageType {
  GET_SERVER_ID = "GET_SERVER_ID",
  BROADCAST_MESSAGE = "BROADCAST_MESSAGE",
}
export class RedisType {
  @IsString()
  serverId: string;

  @IsString()
  @IsOptional()
  connectionId: string | null;

  @IsEnum(WebSocketMessageType, { message: `Invalid message type (must be one of ${Object.values(WebSocketMessageType).join(", ")})` })
  type: WebSocketMessageType;

  @IsObject()
  data: object;
}

export class WebSocketMessage {
  @IsEnum(WebSocketMessageType, { message: `Invalid message type (must be one of ${Object.values(WebSocketMessageType).join(", ")})` })
  type: WebSocketMessageType;

  @IsObject()
  data: object;
}

async function main() {
  const SERVER_ID = uuid.v4();
  const SERVER_PORT = process.env.SERVER_PORT || 0;
  const SERVERS_CHANNEL = "servers";
  const SERVER_CLUSTER_URL = process.env.REDIS_SERVER || "redis://localhost:6379";

  const httpServer = http.createServer((request, response) => {
    response.setHeader("Content-Type", "text/plain");
    response.write("Web Socket Server ID: " + SERVER_ID);
    response.end();
  });

  const redisClient = redis.createClient({ url: SERVER_CLUSTER_URL });

  const handleRedisMessage: RedisMessageHandler<RedisType> = (message) => {
    console.log("received", message);
    console.log("server ID", message.serverId);

    broadcastWSMessage({
      type: message.type,
      data: {
        serverId: message.serverId,
        connectionId: message.connectionId,
        data: message.data,

      },
    });
  };

  const handlewebsocketMessage: WebSocketMessageHandler<WebSocketMessage> = ({ connection, connectionId, message }) => {
    broadcastRedisMessage({
      serverId: SERVER_ID,
      connectionId,
      type: message.type,
      data: message.data,
    });
  };

  const { broadcastRedisMessage, broadcastWSMessage, clients } = await createWebSocketServerNode<RedisType, WebSocketMessage>({
    serverId: SERVER_ID,
    httpServer,
    redisClient,
    serverChannel: SERVERS_CHANNEL,
    webSocketClientMessageEncoder: JSONWebsocketClientMessageEncoder,
    webSocketClientMessageDecoder: JSONWebsocketClientMessageDecoder,
    redisMessageHandler: handleRedisMessage,
    webSocketMessageHandler: handlewebsocketMessage,
    redisPublishMessageEncoder: RedisJsonEncoder,
    redisSubcriptionMessageDecoder: RedisJsonDecoder,
  });

  broadcastRedisMessage({ data: { message: "Hello world! Server is Up" }, serverId: SERVER_ID, connectionId: null, type: WebSocketMessageType.BROADCAST_MESSAGE });

  console.log("Starting server");

  httpServer.listen(SERVER_PORT, () => {
    const getPort = (address: ReturnType<typeof httpServer.address>) => {
      if (address === null) {
        return null;
      }

      if (typeof address == "string") return address;
      else return address.port;
    };
    console.log(`Server is listening on port ${getPort(httpServer.address())}`);
  });
}

main().catch((err) => {
  console.error(err);
});

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

//Capture signals to shut down cleanly
process.on("SIGINT", async () => {
  console.log("SIGINT received. Shutting down...");
  await wait(10000);
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("SIGTERM received. Shutting down...");
  await wait(10000);
  process.exit(0);
});
