import { createClusterCommunication } from "./cluster";
import { CreateWebsocketServerNodeConfig } from "./types";
import { createServerCommunication } from "./websocket-server";

export async function createWebSocketServerNode<RT, WT>({
    serverId,
    httpServer,
    redisClient,
    serverChannel,
    webSocketClientMessageEncoder,
    webSocketClientMessageDecoder,
    redisMessageHandler,
    webSocketMessageHandler,
    redisPublishMessageEncoder,
    redisSubcriptionMessageDecoder,
  }: CreateWebsocketServerNodeConfig<RT, WT>) {
    const { sendMessage: sendMessageToConnections, clients } = await createServerCommunication(
      httpServer,
      ({ connection, connectionId, data }) => {
        try {
          const message = webSocketClientMessageDecoder(data);
          webSocketMessageHandler({ connection, connectionId, message });
        } catch (error) {
          console.error(error);
        }
      },
      ({ connection, connectionId }) => {
        connection.sendUTF(`You are connected to server ${serverId} with connection ID ${connectionId}`);
      }
    );
  
    const { sendMessage: broadCastMessageOnCluster } = await createClusterCommunication(redisClient, serverChannel, (message) => {
      try {
        const messageObject = redisSubcriptionMessageDecoder(message);
        redisMessageHandler(messageObject);
      } catch (error) {
        console.error(error);
      }
    });
  
    function broadcastWSMessage(message: WT) {
      const messageString = webSocketClientMessageEncoder(message);
      sendMessageToConnections(messageString);
    }
  
    function broadcastRedisMessage(message: RT) {
      const messageString = redisPublishMessageEncoder(message);
      broadCastMessageOnCluster(messageString);
    }
  
    return { broadcastWSMessage, broadcastRedisMessage, clients };
  }