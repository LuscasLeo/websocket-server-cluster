import { connection, Message } from "websocket";
import * as redis from "redis";
import * as http from "http";

export type RedisClient = ReturnType<typeof redis.createClient>;

export type IncomingConnectionMessageEvent = {
  connection: connection;
  connectionId: string;
  data: Message;
};

export type NewConnectionEvent = {
  connectionId: string;
  connection: connection;
};

export type RedisSubcriptionMessageDecoder<T> = (message: string) => T;

export type RedisPublishMessageEncoder<T> = (message: T) => string;

export type WebSocketClientMessageDecoder<T> = (message: Message) => T;

export type WebSocketClientMessageEncoder<T> = (message: T) => Message;

export type RedisMessageHandler<RT> = (message: RT) => void;

export type WebSocketMessageHandleContext<WT> = {
  connection: connection;
  connectionId: string;
  message: WT;
};

export type WebSocketMessageHandler<WT> = (context: WebSocketMessageHandleContext<WT>) => void;

export type CreateWebsocketServerNodeConfig<RT, WT> = {
  serverId: string;
  httpServer: http.Server;
  redisClient: RedisClient;
  serverChannel: string;
  webSocketClientMessageEncoder: WebSocketClientMessageEncoder<WT>;
  webSocketClientMessageDecoder: WebSocketClientMessageDecoder<WT>;
  redisMessageHandler: RedisMessageHandler<RT>;
  webSocketMessageHandler: WebSocketMessageHandler<WT>;
  redisPublishMessageEncoder: RedisPublishMessageEncoder<RT>;
  redisSubcriptionMessageDecoder: RedisSubcriptionMessageDecoder<RT>;
};
