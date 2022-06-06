import { connection, Message, server } from "websocket";
import * as http from "http";
import * as uuid from "uuid";
import { IncomingConnectionMessageEvent, NewConnectionEvent } from "./types";

export async function createServerCommunication(
    httpServer: http.Server,
    onMessage: (message: IncomingConnectionMessageEvent) => void,
    onConnection: (connection: NewConnectionEvent) => void
  ) {
    const wsServer = new server({ httpServer: httpServer });
  
    const clients: { [id: string]: connection } = {};
  
    wsServer.on("request", (request) => {
      const connectionId = uuid.v4();
      const connection = request.accept(null, request.origin);
  
      clients[connectionId] = connection;
  
      connection.on("message", (message) => {
        onMessage({ connection, connectionId, data: message });
      });
  
      connection.on("close", () => {
        delete clients[connectionId];
      });
  
      onConnection({ connection, connectionId });
    });
  
    function sendMessage(message: Message) {
      for (const connectionId in clients) {
        const connection = clients[connectionId];
  
        if (message.type === "utf8") {
          connection.sendUTF(message.utf8Data);
        } else if (message.type === "binary") {
          connection.sendBytes(message.binaryData);
        }
      }
    }
  
    return { sendMessage, clients };
  }
  